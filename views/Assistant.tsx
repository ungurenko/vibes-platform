
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Cpu, 
  Trash2, 
  Copy, 
  Check, 
  Terminal, 
  Zap,
  MessageSquare,
  Settings,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '../SoundContext';
import { DEFAULT_AI_SYSTEM_INSTRUCTION } from '../data';
import { supabase, cleanupStorage } from '../lib/supabase';

// --- Configuration ---

// Флаг для отключения сохранения в Supabase при проблемах
const ENABLE_SUPABASE_CHAT_SAVE = true; // Установить false для отключения сохранения

const QUICK_QUESTIONS = [
  "Как задеплоить на Vercel?",
  "Что такое API простыми словами?",
  "Как исправить ошибку 404?",
  "Напиши промпт для кнопки"
];

// --- Helpers ---

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// --- Components ---

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  const { playSound } = useSound();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    playSound('copy');
    navigator.clipboard.writeText(code);
    setCopied(true);
    // Clear previous timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/10 shadow-lg group font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="text-xs text-zinc-400 lowercase font-medium">{language}</span>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          {copied ? <span className="text-emerald-500">Скопировано</span> : <span>Копировать</span>}
        </button>
      </div>
      <div className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <pre className="text-zinc-300 leading-relaxed whitespace-pre font-mono text-[13px]">
          {code}
        </pre>
      </div>
    </div>
  );
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="markdown-body prose prose-zinc dark:prose-invert max-w-none prose-p:leading-7 prose-p:mb-4 prose-pre:m-0 prose-pre:p-0 prose-pre:bg-transparent text-sm md:text-base break-words">
      <ReactMarkdown 
        components={{
          a: ({node, ...props}) => (
            <a target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-bold break-all" {...props} />
          ),
          code: ({node, inline, className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = !inline && (match || String(children).includes('\n'));
            
            return isBlock ? (
              <CodeBlock code={String(children).replace(/\n$/, '')} language={match ? match[1] : 'text'} />
            ) : (
              <code className="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded px-1.5 py-0.5 font-mono text-xs md:text-sm text-violet-700 dark:text-violet-300 break-words" {...props}>
                {children}
              </code>
            );
          },
          ul: ({node, ...props}) => (
            <ul className="list-disc list-outside ml-4 mb-4 space-y-1 marker:text-violet-500" {...props} />
          ),
          ol: ({node, ...props}) => (
            <ol className="list-decimal list-outside ml-4 mb-4 space-y-1 marker:text-violet-500 font-medium" {...props} />
          ),
          li: ({node, ...props}) => (
            <li className="pl-1" {...props} />
          ),
          p: ({node, ...props}) => (
            <p className="mb-4 last:mb-0 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200" {...props} />
          ),
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-6 text-zinc-900 dark:text-white font-display" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 mt-5 text-zinc-900 dark:text-white font-display" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2 mt-4 text-zinc-900 dark:text-white font-display" {...props} />,
          strong: ({node, ...props}) => <strong className="font-bold text-zinc-900 dark:text-white" {...props} />,
          em: ({node, ...props}) => <em className="italic text-zinc-800 dark:text-zinc-300" {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-violet-500 pl-4 py-2 my-4 bg-zinc-50 dark:bg-white/5 rounded-r-lg italic text-zinc-600 dark:text-zinc-400" {...props} />
          )
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

interface AssistantProps {
    initialMessage?: string | null;
    onMessageHandled?: () => void;
    session?: { access_token: string; user: { id: string } } | null;
}

const Assistant: React.FC<AssistantProps> = ({ initialMessage, onMessageHandled, session: sessionProp }) => {
  const { playSound } = useSound();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_AI_SYSTEM_INSTRUCTION);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Load system instruction from localStorage
  useEffect(() => {
      const savedInstruction = localStorage.getItem('vibes_ai_system_instruction');
      if (savedInstruction) {
          setSystemInstruction(savedInstruction);
      }
  }, []);

  // Sync with Supabase on Mount
  useEffect(() => {
    const syncChat = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Fallback for non-logged users
                const saved = localStorage.getItem('vibes_chat_history');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
                    } catch (e) { 
                        console.error("[Chat] Failed to parse local chat history:", e);
                    }
                }
                return;
            }

            // Если сохранение отключено, используем только localStorage
            if (!ENABLE_SUPABASE_CHAT_SAVE) {
                console.log("[Chat] Supabase chat save is disabled, using localStorage");
                const saved = localStorage.getItem('vibes_chat_history');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
                    } catch (e) { 
                        console.error("[Chat] Failed to parse local chat history:", e);
                    }
                } else {
                    // Создаем начальное сообщение
                    const initialMsg: ChatMessage = {
                        id: 'init',
                        role: 'assistant',
                        text: 'Привет! Я твой ИИ-ментор по вайб-кодингу. Готов помочь с кодом, ошибками или объяснить сложные штуки простыми словами. **С чего начнем?**',
                        timestamp: new Date()
                    };
                    setMessages([initialMsg]);
                }
                return;
            }

            const userId = session.user.id;
            const { data: existingChats, error } = await supabase
                .from('chats')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) {
                console.warn("[Chat] Failed to load from Supabase:", error);
                // Fallback to localStorage
                const saved = localStorage.getItem('vibes_chat_history');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
                    } catch (e) { 
                        console.error("[Chat] Failed to parse local chat history:", e);
                    }
                } else {
                    // Создаем начальное сообщение
                    const initialMsg: ChatMessage = {
                        id: 'init',
                        role: 'assistant',
                        text: 'Привет! Я твой ИИ-ментор по вайб-кодингу. Готов помочь с кодом, ошибками или объяснить сложные штуки простыми словами. **С чего начнем?**',
                        timestamp: new Date()
                    };
                    setMessages([initialMsg]);
                }
                return;
            }

            if (existingChats && existingChats.length > 0) {
                setChatId(existingChats[0].id);
                setMessages(existingChats[0].messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            } else {
                const initialMsg: ChatMessage = {
                    id: 'init',
                    role: 'assistant',
                    text: 'Привет! Я твой ИИ-ментор по вайб-кодингу. Готов помочь с кодом, ошибками или объяснить сложные штуки простыми словами. **С чего начнем?**',
                    timestamp: new Date()
                };
                setMessages([initialMsg]);
                
                // Create first chat in DB (неблокирующе)
                try {
                    const { data: newChat, error: insertError } = await supabase
                        .from('chats')
                        .insert([{ user_id: userId, messages: [initialMsg] }])
                        .select()
                        .single();
                    
                    if (insertError) {
                        console.warn("[Chat] Failed to create chat in Supabase:", insertError);
                        // Не блокируем работу, просто логируем
                    } else if (newChat) {
                        setChatId(newChat.id);
                    }
                } catch (err) {
                    console.error("[Chat] Error creating chat:", err);
                    // Не блокируем работу компонента
                }
            }
        } catch (err) {
            console.error("[Chat] Error syncing chat:", err);
            // Не блокируем работу компонента, используем fallback
            const saved = localStorage.getItem('vibes_chat_history');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
                } catch (e) { 
                    console.error("[Chat] Failed to parse local chat history:", e);
                }
            } else {
                // Создаем начальное сообщение
                const initialMsg: ChatMessage = {
                    id: 'init',
                    role: 'assistant',
                    text: 'Привет! Я твой ИИ-ментор по вайб-кодингу. Готов помочь с кодом, ошибками или объяснить сложные штуки простыми словами. **С чего начнем?**',
                    timestamp: new Date()
                };
                setMessages([initialMsg]);
            }
        }
    };

    syncChat();
  }, []);

  // Handle Initial Context from other pages
  useEffect(() => {
      if (initialMessage && !isTyping) {
          handleSend(initialMessage);
          if (onMessageHandled) onMessageHandled();
      }
  }, [initialMessage]);

  // Persist to Supabase when messages change (no localStorage to avoid quota issues)
  useEffect(() => {
    // Если сохранение отключено, используем localStorage
    if (!ENABLE_SUPABASE_CHAT_SAVE) {
      try {
        localStorage.setItem('vibes_chat_history', JSON.stringify(messages));
      } catch (e) {
        console.warn("[Chat] Failed to save to localStorage:", e);
      }
      return;
    }

    const saveChat = async () => {
        if (!chatId || messages.length === 0) return;

        try {
            // Limit messages to last 100 to prevent DB bloat
            const messagesToSave = messages.slice(-100);

            const { error } = await supabase
                .from('chats')
                .update({ messages: messagesToSave, updated_at: new Date().toISOString() })
                .eq('id', chatId);
            
            if (error) {
                console.warn("[Chat] Failed to save to Supabase:", error);
                // Не блокируем работу, просто логируем
                // Fallback to localStorage при ошибке
                try {
                    localStorage.setItem('vibes_chat_history', JSON.stringify(messages));
                } catch (localError) {
                    console.warn("[Chat] Failed to save to localStorage fallback:", localError);
                }
            }
        } catch (err) {
            console.error("[Chat] Error saving chat:", err);
            // Не показываем ошибку пользователю, просто логируем
            // Fallback to localStorage при ошибке
            try {
                localStorage.setItem('vibes_chat_history', JSON.stringify(messages));
            } catch (localError) {
                console.warn("[Chat] Failed to save to localStorage fallback:", localError);
            }
        }
    };

    const timer = setTimeout(saveChat, 1000); // Debounce saves
    return () => clearTimeout(timer);
  }, [messages, chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  // Функция проверки доступности API
  const checkApiAvailability = async (): Promise<{ available: boolean; error?: string }> => {
    try {
      let pingUrl: string;
      try {
        const url = new URL("/api/ping", window.location.href);
        pingUrl = url.toString();
      } catch (e) {
        pingUrl = "/api/ping";
      }

      const response = await fetch(pingUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000) // 5 секунд timeout для проверки
      });

      if (response.ok) {
        return { available: true };
      } else {
        return { available: false, error: `API вернул статус ${response.status}` };
      }
    } catch (error: any) {
      console.warn("[API Check] Ping failed:", error);
      return { 
        available: false, 
        error: error.message || 'Не удалось подключиться к API'
      };
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    // Используем сессию из props (от App.tsx) или пробуем получить из Supabase
    let session = sessionProp;
    if (!session) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }

    if (!session) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        text: 'Вы не авторизованы. Пожалуйста, перезагрузите страницу и войдите в систему.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    playSound('success'); // Play sound for sent message

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Reset height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Проверка доступности API перед отправкой запроса
    const apiCheck = await checkApiAvailability();
    if (!apiCheck.available) {
      console.warn("[API] API недоступен:", apiCheck.error);
      // Не блокируем запрос, но логируем предупреждение
    }

    // Создаём AbortController для timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд timeout

    // Retry логика с экспоненциальной задержкой
    const maxRetries = 3;

    // Use URL constructor to ensure Safari compatibility
    // This guarantees a valid absolute URL
    let apiUrl: string;
    let apiUrlAlt: string | null = null; // Альтернативный URL для Safari
    try {
      const url = new URL("/api/chat", window.location.href);
      apiUrl = url.toString();
      
      // Альтернативный способ для Safari - используем origin напрямую
      if (window.location.origin) {
        apiUrlAlt = `${window.location.origin}/api/chat`;
      }
      
      console.log("[URL] Constructed URL:", {
        input: "/api/chat",
        base: window.location.href,
        result: apiUrl,
        alt: apiUrlAlt,
        origin: window.location.origin,
        protocol: window.location.protocol,
        hostname: window.location.hostname
      });
    } catch (e) {
      console.error("[URL] Failed to construct URL:", e);
      // Fallback варианты
      if (window.location.origin) {
        apiUrl = `${window.location.origin}/api/chat`;
      } else {
        apiUrl = "/api/chat"; // Последний fallback
      }
    }

    const accessToken = session.access_token;

    const apiMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.slice(-20).map(m => ({
        role: m.role,
        content: m.text
      })),
      { role: 'user', content: text }
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    // Добавляем токен авторизации если есть
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const requestBody = {
      "model": "xiaomi/mimo-v2-flash:free",
      "messages": apiMessages
    };

    // Предупреждение для разработчика при локальной разработке
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn("⚠️ API функции работают только на Vercel. Для локальной разработки используйте 'vercel dev'.");
    }

    console.log("🔍 AI Assistant Debug:", {
      apiUrl,
      apiUrlAlt,
      apiUrlType: typeof apiUrl,
      apiUrlLength: apiUrl.length,
      origin: window.location.origin,
      locationHref: window.location.href,
      headersCount: Object.keys(headers).length,
      hasAuth: !!headers["Authorization"],
      messagesCount: apiMessages.length,
      bodySize: JSON.stringify(requestBody).length
    });
    let lastError: any = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Выбираем URL для попытки
        const urlToUse = (attempt > 0 && apiUrlAlt) ? apiUrlAlt : apiUrl;
        
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Экспоненциальная задержка, макс 5 сек
          console.log(`[API] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`[API] Sending request to: ${urlToUse} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // Создаем новый controller для каждой попытки
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
        
        response = await fetch(urlToUse, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: retryController.signal
        });

        clearTimeout(retryTimeoutId);
        clearTimeout(timeoutId);

        // Если успешно, выходим из цикла
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`[API] Attempt ${attempt + 1} failed:`, {
          name: error.name,
          message: error.message,
          isLoadFailed: error.message?.includes('Load failed') || error.message?.includes('Failed to fetch'),
          isAbort: error.name === 'AbortError'
        });

        // Если это AbortError (timeout), не ретраим
        if (error.name === 'AbortError') {
          console.error("[API] Request timeout, not retrying");
          break;
        }

        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === maxRetries) {
          console.error("[API] All retry attempts exhausted");
          throw error;
        }

        // Для "Load failed" и "Failed to fetch" пробуем альтернативный URL на следующей попытке
        if ((error.message?.includes('Load failed') || error.message?.includes('Failed to fetch')) && apiUrlAlt && attempt === 0) {
          console.log("[API] Load failed detected, will try alternative URL on next attempt");
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response after all retries');
    }

    try {
      console.log("[API] Response status:", response.status, response.statusText);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.error("[API] Error response data:", errorData);
        } catch (parseError) {
          const textError = await response.text().catch(() => 'Unable to read error response');
          console.error("[API] Failed to parse error response:", textError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}`, raw: textError };
        }

        // Создаем ошибку с детальной информацией
        const apiError = new Error(errorData.error || `API request failed with status ${response.status}`);
        (apiError as any).code = errorData.code;
        (apiError as any).details = errorData.details;
        (apiError as any).status = response.status;
        (apiError as any).openRouterError = errorData.openRouterError;
        throw apiError;
      }

      const data = await response.json();
      console.log("[API] Response parsed successfully, choices:", data.choices?.length || 0);
      const responseText = data.choices?.[0]?.message?.content || "Извини, я не смог сгенерировать ответ. Попробуй еще раз.";

      const newAssistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newAssistantMsg]);

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      console.error("❌ API Error:", {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
        status: error.status,
        stack: error.stack,
        fullError: error
      });

      let errorText = 'Произошла ошибка соединения с нейросетью. Проверь интернет или API ключ.';
      let showDetails = false;

      // Обработка различных типов ошибок
      if (error.name === 'AbortError') {
        errorText = 'Запрос занял слишком много времени (более 30 секунд). Попробуй ещё раз или упрости вопрос.';
      } else if (error.name === 'TypeError' && (error.message?.includes('Failed to fetch') || error.message?.includes('Load failed'))) {
        // Обработка ошибок подключения (включая Safari "Load failed")
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost) {
          errorText = 'API функции недоступны локально. Используйте "vercel dev" для локальной разработки.';
        } else {
          errorText = `Ошибка подключения к API после ${maxRetries + 1} попыток. Возможные причины:\n\n1. Проблемы с сетью или интернет-соединением\n2. API функция не развернута на Vercel\n3. Проблемы с CORS или настройками Vercel\n\nПопробуйте:\n- Обновить страницу\n- Проверить интернет-соединение\n- Проверить логи Vercel Functions`;
          showDetails = true;
        }
      } else if (error.message === 'Failed to get response after all retries') {
        errorText = `Не удалось подключиться к API после ${maxRetries + 1} попыток. Проверьте:\n\n1. Интернет-соединение\n2. Что API функция развернута на Vercel\n3. Логи Vercel Functions для деталей`;
        showDetails = true;
      } else if (error.code === 'OPENROUTER_KEY_MISSING') {
        errorText = error.message || 'OpenRouter API Key не настроен на сервере.';
        if (error.details) {
          errorText += `\n\n${error.details}`;
        }
        showDetails = true;
      } else if (error.code === 'OPENROUTER_AUTH_ERROR') {
        errorText = error.message || 'Неверный API ключ OpenRouter.';
        if (error.details) {
          errorText += `\n\n${error.details}`;
        }
        showDetails = true;
      } else if (error.code === 'OPENROUTER_RATE_LIMIT') {
        errorText = error.message || 'Превышен лимит запросов к OpenRouter API. Попробуйте позже.';
      } else if (error.code === 'OPENROUTER_CONNECTION_ERROR') {
        errorText = error.message || 'Не удалось подключиться к OpenRouter API.';
        if (error.details) {
          errorText += `\n\nДетали: ${error.details}`;
        }
      } else if (error.code === 'OPENROUTER_SERVER_ERROR') {
        errorText = error.message || 'Сервис OpenRouter временно недоступен. Попробуйте позже.';
      } else if (error.message?.includes('Сессия истекла') || error.message?.includes('AUTH_REQUIRED') || error.code === 'AUTH_REQUIRED') {
        // Clear storage and suggest re-login
        cleanupStorage();
        errorText = 'Сессия истекла. Пожалуйста, перезагрузите страницу и войдите заново.';
      } else if (error.message) {
        errorText = error.message;
        // Показываем детали для других ошибок, если они есть
        if (error.details) {
          errorText += `\n\nДетали: ${error.details}`;
          showDetails = true;
        }
      }

      // Добавляем инструкцию по проверке настроек, если это ошибка конфигурации
      if (showDetails && (error.code?.includes('OPENROUTER') || error.code === 'OPENROUTER_KEY_MISSING')) {
        errorText += `\n\n💡 Проверьте:\n1. Переменная OPENROUTER_API_KEY добавлена в Vercel Dashboard (Settings -> Environment Variables)\n2. Переменная добавлена для всех окружений (Production, Preview, Development)\n3. Выполнен передеплой после добавления переменной\n4. API ключ OpenRouter действителен`;
      }

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: errorText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(inputValue);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Очистить историю переписки?')) {
        const freshMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            text: 'Чат очищен. Я готов к новым задачам!',
            timestamp: new Date()
        };

        setMessages([freshMessage]);

        // Clear in database (неблокирующе)
        if (chatId && ENABLE_SUPABASE_CHAT_SAVE) {
            try {
                const { error } = await supabase
                    .from('chats')
                    .update({ messages: [freshMessage], updated_at: new Date().toISOString() })
                    .eq('id', chatId);
                
                if (error) {
                    console.warn("[Chat] Failed to clear chat in Supabase:", error);
                }
            } catch (err) {
                console.error("[Chat] Error clearing chat:", err);
            }
        }

        // Also clear any legacy localStorage data
        try {
            localStorage.removeItem('vibes_chat_history');
        } catch (e) {
            console.warn("[Chat] Failed to clear localStorage:", e);
        }
    }
  };

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    setShowDiagnostics(true);
    
    try {
      let debugUrl: string;
      try {
        const url = new URL("/api/debug", window.location.href);
        debugUrl = url.toString();
      } catch (e) {
        debugUrl = "/api/debug";
      }

      console.log("[Diagnostics] Checking connection:", debugUrl);
      const response = await fetch(debugUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000) // 10 секунд timeout
      });

      if (response.ok) {
        const data = await response.json();
        setDiagnosticInfo(data);
        console.log("[Diagnostics] Connection check result:", data);
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        setDiagnosticInfo({
          status: 'error',
          error: `HTTP ${response.status}: ${errorText}`
        });
      }
    } catch (error: any) {
      console.error("[Diagnostics] Connection check failed:", error);
      setDiagnosticInfo({
        status: 'error',
        error: error.message || 'Не удалось проверить подключение'
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-1rem)] md:h-screen flex flex-col overflow-hidden bg-transparent">
      
      {/* --- Header --- */}
      <header className="px-4 md:px-8 py-4 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Bot size={20} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-950 animate-pulse"></div>
            </div>
            <div>
                <h1 className="font-display text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                    ВАЙБС Neural Link
                </h1>
                <div className="flex items-center gap-2">
                    <Cpu size={12} className="text-zinc-500" />
                    <span className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider">MIMO-V2-FLASH // ONLINE</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
              onClick={handleCheckConnection}
              disabled={isCheckingConnection}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              title="Проверить подключение"
          >
              <Settings size={20} className={isCheckingConnection ? "animate-spin" : ""} />
          </button>
          <button 
              onClick={handleClearChat}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Очистить историю"
          >
              <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* --- Diagnostics Modal --- */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDiagnostics(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Диагностика подключения</h2>
              <button 
                onClick={() => setShowDiagnostics(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {isCheckingConnection ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Settings size={32} className="text-violet-500 animate-spin" />
                    <p className="text-zinc-600 dark:text-zinc-400">Проверка подключения...</p>
                  </div>
                </div>
              ) : diagnosticInfo ? (
                <>
                  {/* Overall Status */}
                  <div className={`p-4 rounded-xl border-2 ${
                    diagnosticInfo.status === 'ok' 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                      : diagnosticInfo.status === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30'
                      : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {diagnosticInfo.status === 'ok' ? (
                        <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                      ) : diagnosticInfo.status === 'warning' ? (
                        <AlertCircle size={24} className="text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <XCircle size={24} className="text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">
                          Статус: {diagnosticInfo.status === 'ok' ? 'Всё в порядке' : diagnosticInfo.status === 'warning' ? 'Есть предупреждения' : 'Обнаружены ошибки'}
                        </h3>
                        {diagnosticInfo.health?.issues && diagnosticInfo.health.issues.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {diagnosticInfo.health.issues.map((issue: string, idx: number) => (
                              <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400">• {issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Environment Variables */}
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Переменные окружения</h3>
                    <div className="space-y-2">
                      {diagnosticInfo.env && Object.entries(diagnosticInfo.env).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                          <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{key}</span>
                          <div className="flex items-center gap-2">
                            {typeof value === 'object' && value.exists !== undefined ? (
                              <>
                                {value.exists ? (
                                  <CheckCircle2 size={16} className="text-emerald-500" />
                                ) : (
                                  <XCircle size={16} className="text-red-500" />
                                )}
                                <span className="text-xs text-zinc-500">
                                  {value.length > 0 ? `Длина: ${value.length}` : 'Не настроено'}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-500">{String(value)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OpenRouter Connection */}
                  {diagnosticInfo.openRouter && (
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Подключение к OpenRouter</h3>
                      <div className={`p-4 rounded-xl border ${
                        diagnosticInfo.openRouter.available
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                      }`}>
                        <div className="flex items-center gap-3 mb-2">
                          {diagnosticInfo.openRouter.available ? (
                            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle size={20} className="text-red-600 dark:text-red-400" />
                          )}
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {diagnosticInfo.openRouter.available ? 'Подключение успешно' : 'Подключение не удалось'}
                          </span>
                        </div>
                        {diagnosticInfo.openRouter.message && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 ml-8">
                            {diagnosticInfo.openRouter.message}
                          </p>
                        )}
                        {diagnosticInfo.openRouter.status && (
                          <p className="text-xs text-zinc-500 mt-2 ml-8">
                            HTTP статус: {diagnosticInfo.openRouter.status}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* System Info */}
                  {diagnosticInfo.system && (
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Системная информация</h3>
                      <div className="space-y-2">
                        {Object.entries(diagnosticInfo.system).map(([key, value]: [string, any]) => (
                          <div key={key} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="text-xs font-mono text-zinc-500">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error Info */}
                  {diagnosticInfo.error && (
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium">Ошибка:</p>
                      <p className="text-sm text-red-600 dark:text-red-500 mt-1">{diagnosticInfo.error}</p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="p-4 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl">
                    <h4 className="font-bold text-violet-900 dark:text-violet-300 mb-2">💡 Инструкция по настройке</h4>
                    <ol className="text-sm text-violet-800 dark:text-violet-400 space-y-1 list-decimal list-inside">
                      <li>Откройте Vercel Dashboard → Settings → Environment Variables</li>
                      <li>Добавьте переменную <code className="bg-violet-100 dark:bg-violet-500/20 px-1 rounded">OPENROUTER_API_KEY</code> со значением вашего API ключа</li>
                      <li>Убедитесь, что переменная добавлена для всех окружений (Production, Preview, Development)</li>
                      <li>Выполните передеплой проекта после добавления переменной</li>
                      <li>Проверьте, что API ключ OpenRouter действителен и не истек</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  Нажмите кнопку проверки для диагностики
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Chat Area --- */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-48 pt-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
        <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((msg) => (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    key={msg.id}
                    className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                    {/* Avatar */}
                    <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md ${
                        msg.role === 'assistant' 
                        ? 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10' 
                        : 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                    }`}>
                        {msg.role === 'assistant' 
                            ? <Sparkles size={16} className="text-violet-600 dark:text-violet-400" /> 
                            : <User size={16} />
                        }
                    </div>

                    {/* Bubble */}
                    <div className={`flex flex-col max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`relative px-5 py-4 md:px-6 md:py-5 rounded-3xl shadow-sm text-sm md:text-base leading-relaxed overflow-hidden ${
                            msg.role === 'assistant'
                            ? 'bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 rounded-tl-sm shadow-xl shadow-zinc-200/50 dark:shadow-none'
                            : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-lg shadow-violet-500/30 border border-white/10'
                        }`}>
                            {msg.role === 'assistant' && (
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-transparent opacity-30"></div>
                            )}
                            
                            {msg.role === 'assistant' ? (
                                <FormattedText text={msg.text} />
                            ) : (
                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 mt-2 px-1 opacity-60">
                            {formatTime(msg.timestamp)}
                        </span>
                    </div>
                </motion.div>
            ))}

            {isTyping && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-4"
                >
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-md">
                        <Sparkles size={16} className="text-violet-600 dark:text-violet-400" /> 
                    </div>
                    <div className="px-5 py-4 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md rounded-3xl rounded-tl-sm border border-zinc-200 dark:border-white/5 flex items-center gap-2 shadow-sm">
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-violet-500 rounded-full" />
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-violet-400 rounded-full" />
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-violet-300 rounded-full" />
                    </div>
                </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* --- Input Area --- */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 z-20 pointer-events-none">
         <div className="max-w-4xl mx-auto space-y-4 pointer-events-auto">
            
            {/* Quick Questions */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mask-linear px-1">
                {QUICK_QUESTIONS.map((q, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="whitespace-nowrap px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200 dark:border-white/10 hover:border-violet-400 dark:hover:border-violet-500/50 text-xs md:text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-300 transition-all shadow-sm hover:shadow-violet-500/10 flex items-center gap-2 group"
                    >
                        <Zap size={14} className="text-violet-400 group-hover:text-violet-500 transition-colors" />
                        {q}
                    </button>
                ))}
            </div>

            {/* Input Field */}
            <form 
                onSubmit={onFormSubmit}
                className="relative group rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-200 dark:border-white/10 focus-within:border-violet-500/50 dark:focus-within:border-violet-500/50 transition-all duration-300 ring-4 ring-transparent focus-within:ring-violet-500/10"
            >
                {/* Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl opacity-0 group-focus-within:opacity-30 blur-md transition-opacity duration-500 pointer-events-none" />
                
                <div className="relative flex items-end p-2 bg-white dark:bg-zinc-900 rounded-3xl">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Спроси о коде, ошибках или терминах..."
                        className="w-full max-h-48 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 p-4 pl-5 focus:outline-none resize-none text-base scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
                        rows={1}
                        style={{ minHeight: '56px' }}
                    />
                    <div className="pb-1.5 pr-1.5">
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isTyping}
                            className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg hover:shadow-zinc-500/20 flex items-center justify-center"
                        >
                            <Send size={20} className={!inputValue.trim() ? "opacity-50" : ""} />
                        </button>
                    </div>
                </div>
            </form>
            <div className="text-center pb-2">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono opacity-70">
                    ИИ может допускать ошибки. Проверяйте важный код.
                </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Assistant;
