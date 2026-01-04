import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase перенесена внутрь handler для безопасности
// const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  const requestId = Date.now().toString(36);
  console.log(`[API] [${requestId}] ${req.method} /api/chat`);
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.status(200).end();
    }

    // Set CORS headers for all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Разрешаем только POST запросы
    if (req.method !== 'POST') {
      console.log(`[API] [${requestId}] Method not allowed: ${req.method}`);
      return res.status(405).json({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    console.log(`[API] [${requestId}] Starting request processing`);

    // --- Аутентификация ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[API] [${requestId}] Missing or invalid authorization header`);
      return res.status(401).json({
        error: 'Сессия истекла. Пожалуйста, перезагрузите страницу и войдите заново.',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log(`[API] [${requestId}] Authorization token received (length: ${token.length})`);

    // Проверка токена через Supabase (если ключи настроены)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        console.log(`[API] [${requestId}] Verifying token with Supabase`);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          console.log(`[API] [${requestId}] Token verification failed:`, error?.message || 'No user');
          return res.status(401).json({ 
            error: 'Недействительный токен авторизации',
            code: 'INVALID_TOKEN'
          });
        }
        console.log(`[API] [${requestId}] Token verified for user: ${user.id}`);
      } catch (authError) {
        console.error(`[API] [${requestId}] Auth verification error:`, authError);
        // Продолжаем если Supabase не настроен (для локальной разработки) или ошибка клиента
      }
    } else {
        console.warn(`[API] [${requestId}] Supabase credentials missing - skipping auth verification`);
    }

    // --- Валидация входных данных ---
    console.log(`[API] [${requestId}] Request body type:`, typeof req.body);
    
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
            console.log(`[API] [${requestId}] Parsed JSON body successfully`);
        } catch (e) {
            console.error(`[API] [${requestId}] Failed to parse request body:`, e);
            return res.status(400).json({ 
              error: 'Invalid JSON body',
              code: 'INVALID_JSON'
            });
        }
    }

    if (!body) {
      console.log(`[API] [${requestId}] Empty request body`);
      return res.status(400).json({ 
        error: 'Empty request body',
        code: 'EMPTY_BODY'
      });
    }

    const { messages, model } = body;
    console.log(`[API] [${requestId}] Model: ${model || 'default'}, Messages count: ${messages?.length || 0}`);

    if (!messages) {
      console.log(`[API] [${requestId}] Missing messages parameter`);
      return res.status(400).json({ 
        error: 'Параметр messages обязателен',
        code: 'MISSING_MESSAGES'
      });
    }

    if (!Array.isArray(messages)) {
      console.log(`[API] [${requestId}] Messages is not an array`);
      return res.status(400).json({ 
        error: 'messages должен быть массивом',
        code: 'INVALID_MESSAGES_TYPE'
      });
    }

    if (messages.length === 0) {
      console.log(`[API] [${requestId}] Messages array is empty`);
      return res.status(400).json({ 
        error: 'messages не может быть пустым',
        code: 'EMPTY_MESSAGES'
      });
    }

    if (messages.length > 100) {
      console.log(`[API] [${requestId}] Messages limit exceeded: ${messages.length}`);
      return res.status(400).json({ 
        error: 'Превышен лимит сообщений (максимум 100)',
        code: 'MESSAGES_LIMIT_EXCEEDED'
      });
    }

    // Проверка структуры каждого сообщения
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.role || !msg.content) {
        console.log(`[API] [${requestId}] Message ${i} missing role or content`);
        return res.status(400).json({ 
          error: 'Каждое сообщение должно содержать role и content',
          code: 'INVALID_MESSAGE_STRUCTURE'
        });
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        console.log(`[API] [${requestId}] Message ${i} has invalid role: ${msg.role}`);
        return res.status(400).json({ 
          error: 'role должен быть system, user или assistant',
          code: 'INVALID_ROLE'
        });
      }
      if (typeof msg.content !== 'string') {
        console.log(`[API] [${requestId}] Message ${i} content is not a string`);
        return res.status(400).json({ 
          error: 'content должен быть строкой',
          code: 'INVALID_CONTENT_TYPE'
        });
      }
      if (msg.content.length > 32000) {
        console.log(`[API] [${requestId}] Message ${i} content too long: ${msg.content.length}`);
        return res.status(400).json({ 
          error: 'Превышен лимит длины сообщения (максимум 32000 символов)',
          code: 'CONTENT_TOO_LONG'
        });
      }
    }
    
    console.log(`[API] [${requestId}] Input validation passed`);

    // --- Вызов OpenRouter API ---
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error(`[API] [${requestId}] OpenRouter API Key is missing`);
      console.error(`[API] [${requestId}] Available env vars:`, {
        hasViteSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasOpenRouterKey: false,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      });
      return res.status(500).json({ 
        error: 'OpenRouter API Key не настроен на сервере. Проверьте переменную окружения OPENROUTER_API_KEY в настройках Vercel и выполните передеплой.',
        code: 'OPENROUTER_KEY_MISSING',
        details: 'Убедитесь, что переменная OPENROUTER_API_KEY добавлена в Vercel Dashboard (Settings -> Environment Variables) для всех окружений (Production, Preview, Development) и выполнен передеплой.'
      });
    }

    console.log(`[API] [${requestId}] OpenRouter API Key found (length: ${apiKey.length})`);
    console.log(`[API] [${requestId}] Preparing OpenRouter API request`);

    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
    const requestPayload = {
      model: model || "xiaomi/mimo-v2-flash:free",
      messages: messages
    };

    console.log(`[API] [${requestId}] Sending request to OpenRouter:`, {
      url: openRouterUrl,
      model: requestPayload.model,
      messagesCount: requestPayload.messages.length
    });

    let response;
    try {
      response = await fetch(openRouterUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.VITE_SITE_URL || "https://vibes-platform.vercel.app",
          "X-Title": "Vibes Platform",
        },
        body: JSON.stringify(requestPayload)
      });

      console.log(`[API] [${requestId}] OpenRouter response status: ${response.status} ${response.statusText}`);
    } catch (fetchError) {
      console.error(`[API] [${requestId}] Failed to fetch from OpenRouter:`, {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack
      });
      return res.status(500).json({
        error: 'Не удалось подключиться к OpenRouter API. Проверьте интернет-соединение или попробуйте позже.',
        code: 'OPENROUTER_CONNECTION_ERROR',
        details: fetchError.message
      });
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        const textError = await response.text().catch(() => 'Unable to read error response');
        errorData = { raw: textError };
      }

      console.error(`[API] [${requestId}] OpenRouter API Error:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      // Обработка различных типов ошибок от OpenRouter
      let errorMessage = 'Произошла ошибка при обработке запроса. Попробуйте позже.';
      let errorCode = 'OPENROUTER_API_ERROR';

      if (response.status === 401) {
        errorMessage = 'Неверный API ключ OpenRouter. Проверьте переменную окружения OPENROUTER_API_KEY в настройках Vercel.';
        errorCode = 'OPENROUTER_AUTH_ERROR';
      } else if (response.status === 429) {
        errorMessage = 'Превышен лимит запросов к OpenRouter API. Попробуйте позже.';
        errorCode = 'OPENROUTER_RATE_LIMIT';
      } else if (response.status === 400) {
        errorMessage = errorData.error?.message || 'Неверный запрос к OpenRouter API.';
        errorCode = 'OPENROUTER_BAD_REQUEST';
      } else if (response.status >= 500) {
        errorMessage = 'Сервис OpenRouter временно недоступен. Попробуйте позже.';
        errorCode = 'OPENROUTER_SERVER_ERROR';
      }

      return res.status(500).json({
        error: errorMessage,
        code: errorCode,
        details: errorData.error?.message || errorData.message || `HTTP ${response.status}`,
        openRouterError: errorData
      });
    }

    let data;
    try {
      data = await response.json();
      console.log(`[API] [${requestId}] OpenRouter response parsed successfully`);
      console.log(`[API] [${requestId}] Response has ${data.choices?.length || 0} choices`);
      return res.status(200).json(data);
    } catch (parseError) {
      console.error(`[API] [${requestId}] Failed to parse OpenRouter response:`, parseError);
      return res.status(500).json({
        error: 'Не удалось обработать ответ от OpenRouter API.',
        code: 'OPENROUTER_PARSE_ERROR',
        details: parseError.message
      });
    }

  } catch (error) {
    console.error(`[API] [${requestId}] Unexpected error:`, {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
