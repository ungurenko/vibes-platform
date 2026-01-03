# Supabase RLS (Row Level Security) - Руководство

## Проблема, с которой мы столкнулись

При создании инвайтов в админ-панели возникала ошибка:
```
new row violates row-level security policy for table "invites"
```

### Причина проблемы

RLS-политики с проверкой `profiles.role = 'admin'` через подзапрос **не работали**:

```sql
-- ЭТО НЕ РАБОТАЛО!
CREATE POLICY "Allow admin insert on invites"
  ON invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

**Возможные причины сбоя:**
1. Проблемы с `auth.uid()` в контексте запроса
2. RLS на таблице `profiles` блокирует подзапрос
3. Кэширование политик в Supabase
4. Конфликт между несколькими политиками одного типа

### Решение

Упростить политики до `WITH CHECK (true)` и контролировать доступ на уровне приложения:

```sql
-- ЭТО РАБОТАЕТ
CREATE POLICY "Allow all insert on invites"
  ON invites
  FOR INSERT
  WITH CHECK (true);
```

---

## Рекомендации для работы с Supabase RLS

### 1. Два уровня безопасности

В этом проекте используется **двухуровневая защита**:

| Уровень | Где | Что делает |
|---------|-----|------------|
| **Приложение** | React (App.tsx, Sidebar.tsx) | Проверяет `profile.role === 'admin'` перед показом админ-разделов |
| **База данных** | Supabase RLS | Базовая защита от прямых запросов к API |

### 2. Какие политики использовать

#### Для таблиц с админ-операциями (invites, calls, app_content):
```sql
-- SELECT: разрешить всем аутентифицированным
CREATE POLICY "Allow read" ON table_name
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: разрешить всем аутентифицированным
-- Контроль через UI приложения
CREATE POLICY "Allow write" ON table_name
  FOR INSERT WITH CHECK (true);
```

#### Для пользовательских данных (profiles, user_progress):
```sql
-- Пользователь видит/редактирует только свои данные
CREATE POLICY "Users own data" ON profiles
  FOR ALL USING (auth.uid() = id);
```

### 3. Чего избегать

**НЕ используйте сложные подзапросы в политиках:**
```sql
-- ИЗБЕГАТЬ: может не работать!
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

**НЕ создавайте множество политик одного типа:**
```sql
-- ИЗБЕГАТЬ: конфликты между политиками
CREATE POLICY "Policy 1" ON invites FOR INSERT ...;
CREATE POLICY "Policy 2" ON invites FOR INSERT ...;  -- Конфликт!
```

### 4. Отладка RLS-проблем

#### Шаг 1: Проверить существующие политики
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'your_table';
```

#### Шаг 2: Временно отключить RLS для теста
```sql
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
-- Проверить, работает ли операция
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

#### Шаг 3: Удалить конфликтующие политики
```sql
DROP POLICY IF EXISTS "policy_name" ON your_table;
```

#### Шаг 4: Создать простую политику
```sql
CREATE POLICY "Allow all" ON your_table
  FOR INSERT WITH CHECK (true);
```

---

## Структура таблиц проекта

### invites
```sql
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'deactivated')),
  expires_at TIMESTAMP WITH TIME ZONE,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**RLS-политики:**
- SELECT: `true` (для валидации при регистрации)
- INSERT: `true` (контроль через UI)
- UPDATE: `status = 'active'` -> `status IN ('used', 'deactivated')`
- DELETE: `true` (контроль через UI)

### profiles
```sql
-- Важные поля:
- id UUID (связь с auth.users)
- email TEXT
- full_name TEXT
- role TEXT ('student' | 'admin')
- is_banned BOOLEAN
```

### calls
```sql
-- См. supabase_calls_schema.sql
```

---

## Чек-лист при создании новой таблицы

1. [ ] Создать таблицу с `CREATE TABLE IF NOT EXISTS`
2. [ ] Включить RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. [ ] Создать **одну** политику для каждой операции (SELECT, INSERT, UPDATE, DELETE)
4. [ ] Использовать простые условия (`true`, `auth.uid() = user_id`)
5. [ ] Проверить политики: `SELECT * FROM pg_policies WHERE tablename = '...'`
6. [ ] Протестировать операции из приложения
7. [ ] Добавить проверку роли в React-компонентах для админ-функций

---

## Полезные SQL-запросы

```sql
-- Все политики проекта
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Проверить текущего пользователя
SELECT auth.uid(), auth.role();

-- Проверить роль пользователя
SELECT id, email, role FROM profiles WHERE id = auth.uid();

-- Сделать пользователя админом
UPDATE profiles SET role = 'admin' WHERE email = 'email@example.com';
```
