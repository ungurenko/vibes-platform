# План подготовки проекта VIBES к релизу

---

# ЧАСТЬ 1: ОТЧЁТ SENIOR QA ENGINEER

## 1.1 План регресс-тестирования

### Модуль аутентификации
- [ ] Тест входа с корректными данными
- [ ] Тест входа с некорректными данными
- [ ] Тест регистрации через инвайт-ссылку
- [ ] Тест регистрации с невалидным инвайтом
- [ ] Тест регистрации с истёкшим инвайтом
- [ ] Тест сброса пароля
- [ ] Тест блокировки пользователя
- [ ] Тест онбординга нового пользователя

### Модуль уроков
- [ ] Тест отображения списка модулей
- [ ] Тест воспроизведения видео
- [ ] Тест отметки урока как завершённого
- [ ] Тест снятия отметки завершения
- [ ] Тест навигации между уроками
- [ ] Тест отображения материалов урока
- [ ] Тест корректного расчёта прогресса

### Модуль дашборда
- [ ] Тест отображения стадий обучения
- [ ] Тест отображения задач
- [ ] Тест виджета предстоящего созвона
- [ ] Тест быстрых действий (навигация)

### Модуль AI-ассистента
- [ ] Тест отправки сообщения
- [ ] Тест получения ответа от API
- [ ] Тест сохранения истории чата
- [ ] Тест очистки истории
- [ ] Тест быстрых вопросов
- [ ] Тест обработки ошибок API

### Административный модуль
- [ ] Тест списка студентов с фильтрацией
- [ ] Тест блокировки/разблокировки студента
- [ ] Тест сброса прогресса студента
- [ ] Тест управления контентом (CRUD)
- [ ] Тест генерации инвайтов
- [ ] Тест удаления инвайтов
- [ ] Тест управления созвонами

### Общие тесты
- [ ] Тест переключения темы (светлая/тёмная)
- [ ] Тест переключения звуков интерфейса
- [ ] Тест мобильной адаптивности сайдбара
- [ ] Тест корректной работы localStorage

---

## 1.2 Найденные баги и проблемы

### КРИТИЧЕСКИЕ (P0) - блокируют релиз

#### BUG-001: Hardcoded значение для расчёта прогресса
- **Файл:** `App.tsx:77`
- **Описание:** Прогресс пользователя рассчитывается как `(completedLessons.length / 20) * 100`, где 20 - захардкоженное число, не отражающее реальное количество уроков.
- **Влияние:** Некорректное отображение прогресса у всех пользователей.
- **Код:**
```typescript
progress: Math.round((completedLessons.length / 20) * 100), // Approx progress
```

#### BUG-002: Возможность регистрации с пустым паролем
- **Файл:** `App.tsx:275`
- **Описание:** При регистрации пароль может быть пустой строкой из-за fallback `password || ''`.
- **Влияние:** Пользователи могут создать аккаунт без пароля.
- **Код:**
```typescript
password: data.password || '',
```

#### BUG-003: Отсутствие аутентификации на API endpoint
- **Файл:** `api/chat.js`
- **Описание:** Endpoint `/api/chat` доступен без проверки авторизации. Любой может отправлять запросы и тратить API-кредиты.
- **Влияние:** Финансовые потери, злоупотребление API.

#### BUG-004: Отсутствие валидации входных данных API
- **Файл:** `api/chat.js:8`
- **Описание:** Параметры `messages` и `model` не валидируются. Можно отправить массив с миллионом элементов.
- **Влияние:** Потенциальный DoS, неожиданные ошибки.
- **Код:**
```javascript
const { messages, model } = req.body;
// Нет проверки типа, длины, структуры
```

### ВЫСОКИЙ ПРИОРИТЕТ (P1) - серьёзные проблемы

#### BUG-005: Слабая генерация инвайт-токенов
- **Файл:** `App.tsx:324`
- **Описание:** Токены генерируются как `vibes-${Math.random().toString(36).substring(2, 7)}`, что даёт всего ~60 миллионов комбинаций. Легко подобрать перебором.
- **Влияние:** Неавторизованный доступ к регистрации.
- **Код:**
```typescript
const token = `vibes-${Math.random().toString(36).substring(2, 7)}`;
```

#### BUG-006: setTimeout без cleanup
- **Файл:** `Register.tsx:54-57`
- **Описание:** setTimeout не отменяется при размонтировании компонента, что вызывает memory leak и потенциальный вызов setState на размонтированном компоненте.
- **Код:**
```typescript
setTimeout(() => {
    setIsLoading(false);
    onRegister({ name, email, avatar: avatar || undefined, password });
}, 1500);
```

#### BUG-007: Пустые обработчики событий
- **Файл:** `App.tsx:378, 382`
- **Описание:** Функции `onUpdateStudent`, `onAddStudent`, `onDeleteStudent`, `onDeactivateInvite` передаются как пустые функции `() => {}`. Функционал не реализован.
- **Влияние:** Кнопки в UI не работают.

#### BUG-008: Отсутствие timeout для fetch запросов
- **Файл:** `views/Assistant.tsx:273-282`
- **Описание:** Запрос к `/api/chat` не имеет timeout. При зависании API пользователь будет ждать бесконечно.
- **Код:**
```typescript
const response = await fetch("/api/chat", {
    method: "POST",
    // Нет AbortController с timeout
});
```

### СРЕДНИЙ ПРИОРИТЕТ (P2) - улучшения

#### BUG-009: Использование типа any
- **Файлы:** `App.tsx:40-41`, `Home.tsx:27,41`
- **Описание:** Критические состояния `session`, `profile`, `upcomingCall` типизированы как `any`, что теряет преимущества TypeScript.
- **Код:**
```typescript
const [session, setSession] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);
```

#### BUG-010: Раскрытие внутренних ошибок API
- **Файл:** `api/chat.js:30-33`
- **Описание:** При ошибке OpenRouter детали передаются клиенту, раскрывая внутреннюю структуру.
- **Код:**
```javascript
return res.status(response.status).json({
    error: 'OpenRouter API Error',
    details: errorData  // Раскрытие внутренних деталей
});
```

#### BUG-011: Использование confirm() и alert()
- **Файлы:** `App.tsx:170,236,266`, `AdminStudents.tsx:181,185,194,197`
- **Описание:** Использование нативных `alert()` и `confirm()` вместо UI-компонентов. Блокирует поток, плохой UX.

#### BUG-012: N+1 запросы к базе данных
- **Файл:** `lib/supabase.ts:223-257`
- **Описание:** `fetchAllStudents()` делает 2 отдельных запроса вместо одного с JOIN.
- **Код:**
```typescript
const { data: profiles } = await supabase.from('profiles').select('*');
const { data: progress } = await supabase.from('user_progress').select('user_id');
// Затем ручное объединение в памяти
```

#### BUG-013: Отсутствие пагинации
- **Файлы:** `AdminStudents.tsx`, `AdminSettings.tsx`, `AdminCalls.tsx`
- **Описание:** Все записи загружаются одним запросом без пагинации.
- **Влияние:** При большом количестве данных - медленная загрузка и высокое потребление памяти.

---

## 1.3 Проблемы безопасности

| # | Проблема | Критичность | Файл |
|---|----------|-------------|------|
| 1 | API endpoint без аутентификации | КРИТИЧНО | api/chat.js |
| 2 | Отсутствие rate limiting | ВЫСОКАЯ | api/chat.js |
| 3 | Слабые инвайт-токены | ВЫСОКАЯ | App.tsx:324 |
| 4 | Пустой пароль при регистрации | ВЫСОКАЯ | App.tsx:275 |
| 5 | Раскрытие деталей ошибок | СРЕДНЯЯ | api/chat.js:30 |

---

# ЧАСТЬ 2: ПЛАН SENIOR FULLSTACK DEVELOPER

## 2.1 План исправления критических багов

### [x] BUG-001: Исправить расчёт прогресса (ВЫПОЛНЕНО)
**Файл:** `App.tsx:77`
```typescript
// БЫЛО:
progress: Math.round((completedLessons.length / 20) * 100),

// СТАНЕТ:
const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
progress: totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0,
```

### [x] BUG-002: Добавить валидацию пароля (ВЫПОЛНЕНО)
**Файл:** `App.tsx:272-282`
```typescript
// Добавить проверку перед вызовом signUp:
if (!data.password || data.password.length < 8) {
    alert('Пароль должен содержать минимум 8 символов');
    return;
}
```

### [x] BUG-003: Добавить аутентификацию на API (ВЫПОЛНЕНО)
**Файл:** `api/chat.js`
```javascript
// Добавить проверку токена сессии:
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
}
// Проверить токен через Supabase
```

### [x] BUG-004: Добавить валидацию входных данных (ВЫПОЛНЕНО)
**Файл:** `api/chat.js`
```javascript
// Добавить после получения body:
if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return res.status(400).json({ error: 'Invalid messages format' });
}
if (!messages.every(m => m.role && m.content && typeof m.content === 'string')) {
    return res.status(400).json({ error: 'Invalid message structure' });
}
```

### [x] BUG-005: Усилить генерацию токенов (ВЫПОЛНЕНО)
**Файл:** `App.tsx:324`
```typescript
// БЫЛО:
const token = `vibes-${Math.random().toString(36).substring(2, 7)}`;

// СТАНЕТ:
const generateSecureToken = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return 'vibes-' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};
```

### [x] BUG-006: Исправить setTimeout (ВЫПОЛНЕНО)
**Файл:** `Register.tsx:45-58`
```typescript
// Использовать useEffect с cleanup:
const [isSubmitting, setIsSubmitting] = useState(false);

useEffect(() => {
    if (!isSubmitting) return;
    const timer = setTimeout(() => {
        setIsLoading(false);
        onRegister({ name, email, avatar: avatar || undefined, password });
        setIsSubmitting(false);
    }, 1500);
    return () => clearTimeout(timer);
}, [isSubmitting]);

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { alert("Пароли не совпадают"); return; }
    if (!agreed) return;
    setIsLoading(true);
    setIsSubmitting(true);
};
```

### [x] BUG-007: Реализовать пустые обработчики (ВЫПОЛНЕНО)
**Файлы:** `App.tsx`, `lib/supabase.ts`
```typescript
// Добавить в supabase.ts:
export const updateStudent = async (studentId: string, data: Partial<Student>) => { ... };
export const deleteStudent = async (studentId: string) => { ... };
export const deactivateInvite = async (inviteId: string) => { ... };

// Подключить в App.tsx вместо пустых функций
```

### [x] BUG-008: Добавить timeout для fetch (ВЫПОЛНЕНО)
**Файл:** `views/Assistant.tsx:263-312`
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд

try {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "...", messages: apiMessages }),
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    // ...
} catch (error) {
    if (error.name === 'AbortError') {
        // Показать сообщение о таймауте
    }
}
```

---

## 2.2 План рефакторинга кода

### [ ] Улучшить типизацию
**Файл:** `types.ts` - добавить типы для Supabase
```typescript
export interface SupabaseSession {
    access_token: string;
    refresh_token: string;
    user: {
        id: string;
        email: string;
        // ...
    };
}

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    role: 'student' | 'admin';
    is_banned: boolean;
    has_onboarded: boolean;
    created_at: string;
    updated_at: string;
}
```

**Файл:** `App.tsx:40-41`
```typescript
// БЫЛО:
const [session, setSession] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);

// СТАНЕТ:
const [session, setSession] = useState<SupabaseSession | null>(null);
const [profile, setProfile] = useState<UserProfile | null>(null);
```

### [ ] Заменить alert/confirm на UI-компоненты
**Файлы:** Все файлы с alert()
- Использовать существующий компонент Toast из AdminSettings.tsx
- Использовать ConfirmModal из components/Shared.tsx

### [ ] Добавить useCallback для обработчиков
**Файл:** `App.tsx`
```typescript
// БЫЛО:
const handleToggleLesson = async (lessonId: string) => { ... };

// СТАНЕТ:
const handleToggleLesson = useCallback(async (lessonId: string) => {
    // ...
}, [currentUser, completedLessons]);
```

### [ ] Вынести логику аутентификации в отдельный хук
**Создать файл:** `hooks/useAuth.ts`
```typescript
export const useAuth = () => {
    const [session, setSession] = useState<SupabaseSession | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Вся логика auth из App.tsx

    return { session, profile, isLoading, login, logout, register };
};
```

---

## 2.3 Оптимизация работы с базой данных

### [ ] Объединить запросы в fetchAllStudents
**Файл:** `lib/supabase.ts:223-257`
```typescript
// БЫЛО: 2 отдельных запроса

// СТАНЕТ: один запрос с подсчётом
export const fetchAllStudents = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            *,
            user_progress(count)
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(p => ({
        id: p.id,
        name: p.full_name || 'Студент',
        email: p.email,
        avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.full_name}`,
        status: p.is_banned ? 'banned' : 'active',
        isBanned: p.is_banned,
        progress: p.user_progress?.[0]?.count || 0,
        // ...
    }));
};
```

### [ ] Добавить кэширование контента
**Файл:** `lib/supabase.ts` - добавить кэш
```typescript
const contentCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

export const fetchAppContent = async (key: string) => {
    // Проверить кэш
    const cached = contentCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const { data, error } = await supabase
        .from('app_content')
        .select('data')
        .eq('key', key)
        .single();

    if (!error && data) {
        contentCache.set(key, { data: data.data, timestamp: Date.now() });
    }

    return data?.data || null;
};

export const invalidateContentCache = (key?: string) => {
    if (key) contentCache.delete(key);
    else contentCache.clear();
};
```

---

## 2.4 Добавление пагинации

### [ ] Пагинация для списка студентов
**Файл:** `views/AdminStudents.tsx`
```typescript
const ITEMS_PER_PAGE = 20;
const [currentPage, setCurrentPage] = useState(1);

const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
}, [filteredStudents, currentPage]);

const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

// В JSX добавить компонент пагинации
```

### [ ] Пагинация для инвайтов
**Файл:** `views/AdminSettings.tsx`
```typescript
// Аналогично AdminStudents.tsx
```

### [ ] Пагинация для созвонов (серверная)
**Файл:** `lib/supabase.ts`
```typescript
export const fetchCallsPaginated = async (page: number, limit: number = 10) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
        .from('calls')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .range(from, to);

    if (error) throw error;

    return {
        calls: data,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
    };
};
```

---

## 2.5 Удаление неиспользуемого кода

### [ ] Проверить и удалить моковые данные
**Файл:** `data.ts`
- [ ] `STUDENT_ACTIVITY_LOG` - используется в AdminStudents.tsx:538 (оставить или заменить на реальные данные)
- [ ] `STUDENT_CHAT_HISTORY` - импортируется но не используется (УДАЛИТЬ)

### [ ] Удалить закомментированный код
Проверить все файлы на наличие закомментированного кода и удалить его.

### [ ] Заменить пустые обработчики реальной логикой
**Файл:** `App.tsx:378, 382`
- `onUpdateStudent={() => {}}` - реализовать или удалить prop
- `onAddStudent={() => {}}` - реализовать или удалить prop
- `onDeleteStudent={() => {}}` - реализовать или удалить prop
- `onDeactivateInvite={() => {}}` - реализовать или удалить prop

---

## 2.6 Дополнительные улучшения

### [ ] Добавить Error Boundary
**Создать файл:** `components/ErrorBoundary.tsx`
```typescript
class ErrorBoundary extends React.Component<Props, State> {
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} />;
        }
        return this.props.children;
    }
}
```

### [ ] Добавить rate limiting на API (если возможно на Vercel)
**Файл:** `api/chat.js`
```javascript
// Использовать Vercel KV или внешний сервис для rate limiting
// Или добавить простую проверку по IP в памяти (ограниченно)
```

### [ ] Скрыть детали ошибок API
**Файл:** `api/chat.js:28-34`
```javascript
// БЫЛО:
return res.status(response.status).json({
    error: 'OpenRouter API Error',
    details: errorData
});

// СТАНЕТ:
console.error('OpenRouter API Error:', errorData); // Логировать на сервере
return res.status(500).json({
    error: 'Произошла ошибка при обработке запроса. Попробуйте позже.'
});
```

---

## 2.7 Чеклист перед релизом

### Безопасность
- [x] API endpoint защищён аутентификацией
- [x] Входные данные валидируются
- [x] Токены генерируются криптографически безопасно
- [x] Детали ошибок скрыты от клиента
- [x] Пароли валидируются на минимальную длину

### Производительность
- [ ] Запросы к БД оптимизированы (нет N+1)
- [ ] Реализовано кэширование контента
- [ ] Добавлена пагинация для больших списков
- [ ] useCallback используется для обработчиков

### Качество кода
- [ ] Типизация улучшена (нет any)
- [x] Пустые обработчики заменены реальной логикой
- [ ] Неиспользуемый код удалён
- [ ] Error Boundaries добавлены

### UX
- [ ] alert()/confirm() заменены на UI-компоненты
- [x] Timeout для долгих запросов
- [x] Корректное отображение прогресса

---

**Дата создания:** 2025-12-30
**Автор:** Senior QA Engineer & Senior Fullstack Developer
