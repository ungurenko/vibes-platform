# Админ-панель управления дашбордом

## Что реализовано

### 1. База данных ✅

Созданы 4 новые таблицы для управления дашбордом:

#### `dashboard_tasks`
Хранит задачи по неделям, которые отображаются на дашборде студента.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Уникальный идентификатор |
| week_number | INTEGER | Номер недели (1-4) |
| title | TEXT | Текст задачи |
| link | TEXT | Ссылка при клике (опционально) |
| order | INTEGER | Порядок отображения |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

#### `user_dashboard_tasks`
Отслеживает прогресс выполнения задач каждым пользователем.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Уникальный идентификатор |
| user_id | UUID | ID пользователя (FK → profiles) |
| task_id | UUID | ID задачи (FK → dashboard_tasks) |
| completed | BOOLEAN | Выполнена ли задача |
| completed_at | TIMESTAMP | Время выполнения |
| created_at | TIMESTAMP | Дата создания |

#### `dashboard_quick_links`
Настраиваемые быстрые ссылки на дашборде.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Уникальный идентификатор |
| title | TEXT | Название ссылки |
| icon | TEXT | Название иконки |
| url | TEXT | URL ссылки |
| order | INTEGER | Порядок отображения |
| is_active | BOOLEAN | Активна ли ссылка |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

#### `dashboard_settings`
Глобальные настройки дашборда.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Уникальный идентификатор |
| greeting_template | TEXT | Шаблон приветствия ({name}) |
| show_week_indicator | BOOLEAN | Показывать индикатор недели |
| show_calls_block | BOOLEAN | Показывать блок созвонов |
| no_calls_text | TEXT | Текст при отсутствии созвонов |
| cohort_start_date | DATE | Дата старта потока |
| week_duration_days | INTEGER | Длительность недели в днях |
| total_weeks | INTEGER | Общее количество недель |
| updated_at | TIMESTAMP | Дата обновления |

### 2. API функции ✅

Добавлены функции в `lib/supabase.ts`:

#### Управление задачами
```typescript
fetchAllDashboardTasks(weekNumber?: number) // Получить все задачи (с фильтром)
createDashboardTask(taskData) // Создать задачу
updateDashboardTask(id, taskData) // Обновить задачу
deleteDashboardTask(id) // Удалить задачу
reorderDashboardTasks(tasks) // Изменить порядок
```

#### Прогресс студентов
```typescript
fetchUserDashboardProgress(userId, weekNumber?) // Прогресс пользователя
toggleDashboardTaskComplete(userId, taskId, isComplete) // Отметить/снять задачу
getTaskStats() // Статистика по всем студентам
```

#### Быстрые ссылки
```typescript
fetchAllQuickLinks(activeOnly?) // Получить ссылки
createQuickLink(linkData) // Создать ссылку
updateQuickLink(id, linkData) // Обновить ссылку
deleteQuickLink(id) // Удалить ссылку
reorderQuickLinks(links) // Изменить порядок
```

#### Настройки
```typescript
fetchDashboardSettings() // Получить настройки
updateDashboardSettings(settings) // Обновить настройки
getCurrentWeek() // Получить текущую неделю (расчёт)
```

#### Полные данные для студента
```typescript
fetchCompleteDashboardData(userId) // Все данные дашборда за 1 запрос
```

### 3. SQL Схема

Файл: `supabase_dashboard_schema.sql`

Включает:
- Создание всех таблиц
- Row Level Security (RLS) политики
- Триггеры для auto-update timestamps
- Helper-функции для расчёта текущей недели
- Seed данные (задачи недели 1, быстрые ссылки по умолчанию)

## Как запустить

### Шаг 1: Применить SQL схему

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте содержимое файла `supabase_dashboard_schema.sql`
3. Вставьте и выполните

Альтернативно через CLI:
```bash
supabase db reset # если нужно сбросить всю БД
# или
psql -h <your-supabase-host> -U postgres -d postgres -f supabase_dashboard_schema.sql
```

### Шаг 2: Проверить таблицы

В Supabase Dashboard → Table Editor должны появиться:
- ✅ `dashboard_tasks`
- ✅ `user_dashboard_tasks`
- ✅ `dashboard_quick_links`
- ✅ `dashboard_settings`

### Шаг 3: Проверить seed данные

**dashboard_tasks** должна содержать 4 задачи для недели 1:
- Посмотреть "Как работает веб"
- Настроить VS Code и окружение
- Сгенерировать ТЗ с Ассистентом
- Выбрать стиль в библиотеке

**dashboard_quick_links** должна содержать 4 ссылки:
- Стили
- Промпты
- Термины
- AI Чат

**dashboard_settings** должна содержать 1 запись с настройками по умолчанию.

## Что нужно сделать дальше

### UI Компоненты админки (в разработке)

1. **AdminDashboardTasks** - управление задачами
   - Таблица задач с фильтром по неделям
   - Форма создания/редактирования
   - Drag-and-drop сортировка
   - Массовые действия

2. **AdminDashboardSettings** - настройки дашборда
   - Форма настроек приветствия
   - Выбор даты старта потока
   - Настройки отображения блоков

3. **AdminQuickLinks** - управление быстрыми ссылками
   - Список ссылок с drag-and-drop
   - Форма редактирования
   - Переключатель активности

4. **Просмотр прогресса студентов**
   - Интеграция в AdminStudents
   - Отображение выполненных задач
   - Фильтрация по прогрессу

## Архитектура решения

```
┌─────────────────────────────────────────────────────┐
│                  Student Dashboard                   │
│  (Home.tsx - отображает задачи, ссылки, настройки)  │
└────────────────────┬────────────────────────────────┘
                     │
                     │ fetchCompleteDashboardData()
                     │
┌────────────────────▼────────────────────────────────┐
│              Supabase API (lib/supabase.ts)         │
│  - Получение задач по неделям                       │
│  - Отслеживание прогресса                           │
│  - Управление ссылками и настройками                │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              Supabase PostgreSQL                     │
│  - dashboard_tasks (задачи)                         │
│  - user_dashboard_tasks (прогресс)                  │
│  - dashboard_quick_links (ссылки)                   │
│  - dashboard_settings (настройки)                   │
└─────────────────────────────────────────────────────┘
                     ▲
                     │
┌────────────────────┴────────────────────────────────┐
│              Admin Panel (TODO)                      │
│  - AdminDashboardTasks (управление задачами)        │
│  - AdminDashboardSettings (настройки)               │
│  - AdminStudents (просмотр прогресса)               │
└─────────────────────────────────────────────────────┘
```

## Примеры использования API

### Получить все данные дашборда для студента

```typescript
const data = await fetchCompleteDashboardData(userId);

// Результат:
{
  currentWeek: 1,
  totalWeeks: 4,
  tasks: [
    { id: "...", title: "...", link: "/lessons", completed: false }
  ],
  completedCount: 0,
  totalCount: 4,
  quickLinks: [
    { title: "Стили", icon: "palette", url: "/styles" }
  ],
  upcomingCall: {
    id: "...",
    title: "Созвон 1: Старт лендинга",
    date: "2025-01-15",
    time: "19:00",
    link: "https://zoom.us/..."
  },
  settings: {
    greetingTemplate: "Привет, {name}!",
    showWeekIndicator: true,
    showCallsBlock: true,
    noCallsText: "Нет запланированных созвонов"
  }
}
```

### Создать новую задачу для недели 2

```typescript
await createDashboardTask({
  week_number: 2,
  title: "Опубликовать лендинг на Vercel",
  link: "/roadmaps",
  order: 1
});
```

### Отметить задачу как выполненную

```typescript
await toggleDashboardTaskComplete(userId, taskId, true);
```

### Обновить настройки дашборда

```typescript
await updateDashboardSettings({
  cohort_start_date: "2025-01-10",
  week_duration_days: 7,
  total_weeks: 4
});
```

### Получить статистику по всем студентам

```typescript
const stats = await getTaskStats();

// Результат:
[
  {
    userId: "...",
    name: "Александр",
    email: "alex@example.com",
    completedTasks: 3,
    totalTasks: 4
  },
  // ...
]
```

## Безопасность (RLS)

Все таблицы защищены Row Level Security:

**Студенты могут:**
- ✅ Читать все задачи
- ✅ Читать активные быстрые ссылки
- ✅ Читать настройки дашборда
- ✅ Читать/изменять свой прогресс

**Студенты НЕ могут:**
- ❌ Создавать/удалять задачи
- ❌ Изменять быстрые ссылки
- ❌ Изменять настройки
- ❌ Видеть прогресс других студентов

**Админы могут:**
- ✅ Всё вышеперечисленное
- ✅ Управлять задачами (CRUD)
- ✅ Управлять быстрыми ссылками (CRUD)
- ✅ Изменять настройки
- ✅ Видеть прогресс всех студентов

## Миграция данных

Если у вас уже есть задачи в `data.ts` (DASHBOARD_STAGES), их можно импортировать:

```typescript
import { DASHBOARD_STAGES } from './data';

// Запустить один раз для миграции
async function migrateOldTasks() {
  for (const stage of DASHBOARD_STAGES) {
    for (const task of stage.tasks) {
      await createDashboardTask({
        week_number: stage.id,
        title: task.title,
        link: null,
        order: stage.tasks.indexOf(task) + 1
      });
    }
  }
}
```

## Технические детали

### Расчёт текущей недели

Функция `get_current_week()` в PostgreSQL:
1. Берёт дату старта потока из `dashboard_settings.cohort_start_date`
2. Вычисляет количество дней с начала
3. Делит на `week_duration_days` (по умолчанию 7)
4. Возвращает номер недели (1-based)
5. Ограничивает максимумом `total_weeks`

### Optimistic Updates

Функция `toggleDashboardTaskComplete` использует optimistic updates:
1. UI мгновенно обновляется
2. Запрос отправляется в БД
3. При ошибке - откат изменений в UI

### Производительность

- Все таблицы проиндексированы по часто используемым полям
- `fetchCompleteDashboardData()` делает минимум запросов
- RLS политики оптимизированы для быстрых проверок

## Поддержка

При возникновении проблем:
1. Проверьте логи Supabase Dashboard → Logs
2. Убедитесь, что RLS политики применились
3. Проверьте переменные окружения (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## Changelog

### 2025-01-XX - Initial Release
- ✅ Создана база данных для управления дашбордом
- ✅ Добавлены все API функции в `lib/supabase.ts`
- ✅ Реализована система RLS для безопасности
- ✅ Добавлены helper-функции для расчёта текущей недели
- ⏳ UI компоненты админки (в разработке)
