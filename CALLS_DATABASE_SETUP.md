# Настройка базы данных для созвонов

Эта инструкция поможет настроить таблицу `calls` в Supabase для управления расписанием созвонов.

## Шаги настройки

### 1. Откройте Supabase SQL Editor

1. Перейдите на [https://app.supabase.com](https://app.supabase.com)
2. Выберите ваш проект
3. В левом меню нажмите на "SQL Editor"
4. Нажмите "New Query"

### 2. Выполните SQL скрипт

Скопируйте и выполните содержимое файла `supabase_calls_schema.sql`:

```sql
-- Calls table for managing course calls/meetings
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  duration TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'completed')),
  meeting_url TEXT,
  recording_url TEXT,
  materials JSONB DEFAULT '[]'::jsonb,
  attendees_count INTEGER DEFAULT 0,
  reminders JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (all authenticated users can view calls)
CREATE POLICY "Allow public read access to calls"
  ON calls
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete calls
CREATE POLICY "Allow admin insert on calls"
  ON calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin update on calls"
  ON calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin delete on calls"
  ON calls
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS calls_date_idx ON calls(date DESC);

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);

-- Update updated_at timestamp on every update
CREATE OR REPLACE FUNCTION update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calls_updated_at_trigger
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_calls_updated_at();
```

### 3. Нажмите "Run" для выполнения скрипта

После выполнения вы увидите сообщение об успешном создании таблицы.

## Структура таблицы

### Поля таблицы `calls`:

- `id` (UUID) - Уникальный идентификатор созвона
- `date` (DATE) - Дата созвона (YYYY-MM-DD)
- `time` (TEXT) - Время созвона (HH:MM)
- `duration` (TEXT) - Длительность (например, "60 мин")
- `topic` (TEXT) - Тема созвона
- `description` (TEXT) - Описание созвона
- `status` (TEXT) - Статус: 'scheduled', 'live', или 'completed'
- `meeting_url` (TEXT) - Ссылка на встречу (Zoom/Meet)
- `recording_url` (TEXT) - Ссылка на запись
- `materials` (JSONB) - Массив материалов `[{name: string, size: string}]`
- `attendees_count` (INTEGER) - Количество участников
- `reminders` (JSONB) - Массив напоминаний `['24h', '1h', '15m']`
- `created_at` (TIMESTAMP) - Дата создания записи
- `updated_at` (TIMESTAMP) - Дата последнего обновления

## Политики безопасности (RLS)

### Чтение:
- Все аутентифицированные пользователи могут **читать** созвоны

### Запись/Изменение/Удаление:
- Только **администраторы** (с `role = 'admin'` в таблице `profiles`) могут:
  - Создавать новые созвоны
  - Редактировать существующие
  - Удалять созвоны

## Проверка работы таблицы

После настройки вы можете:

1. **В админ-панели** (вкладка "Созвоны"):
   - Добавлять новые созвоны
   - Редактировать существующие
   - Удалять созвоны
   - Отправлять напоминания

2. **В студенческой панели** (главная страница):
   - Видеть виджет с ближайшим созвоном
   - Видеть статус созвона (Запланирован/Идёт сейчас)
   - Видеть время и тему созвона

## Устранение проблем

### Ошибка: "permission denied for table calls"
Убедитесь, что:
1. Таблица `profiles` существует
2. У вашего пользователя есть поле `role` со значением `'admin'`
3. RLS политики созданы корректно

### Ошибка: "relation calls does not exist"
Убедитесь, что SQL скрипт выполнен успешно в Supabase SQL Editor

### Созвоны не отображаются
Проверьте:
1. Что таблица создана
2. Что в ней есть записи (можно добавить через админ-панель)
3. Что пользователь аутентифицирован

## Дополнительно: Добавление тестовых данных

Если хотите добавить тестовые данные, выполните:

```sql
INSERT INTO calls (date, time, duration, topic, description, status, meeting_url, reminders)
VALUES
  (
    CURRENT_DATE + 1,
    '19:00',
    '90 мин',
    'Разбор домашних заданий: Лендинг',
    'Смотрим работы студентов, разбираем типичные ошибки в верстке и дизайне. Q&A сессия в конце.',
    'scheduled',
    'https://zoom.us/j/123456789',
    '["24h", "1h"]'::jsonb
  ),
  (
    CURRENT_DATE,
    '18:00',
    '60 мин',
    'Live Coding: Анимации во Framer Motion',
    'В прямом эфире верстаем сложную анимацию появления карточек.',
    'live',
    'https://zoom.us/j/987654321',
    '["15m"]'::jsonb
  );
```

Это создаст два тестовых созвона: один на завтра и один "идёт сейчас".

## Готово!

Теперь ваша система управления созвонами полностью синхронизирована с базой данных Supabase. Вы можете управлять созвонами через админ-панель, а студенты будут видеть актуальное расписание на главной странице.
