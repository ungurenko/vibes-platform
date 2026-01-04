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
  console.log(`[API] ${req.method} /api/chat`);
  
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
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- Аутентификация ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Сессия истекла. Пожалуйста, перезагрузите страницу и войдите заново.',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Проверка токена через Supabase (если ключи настроены)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          return res.status(401).json({ error: 'Недействительный токен авторизации' });
        }
      } catch (authError) {
        console.error('Auth verification error:', authError);
        // Продолжаем если Supabase не настроен (для локальной разработки) или ошибка клиента
      }
    } else {
        console.warn('Supabase credentials missing - skipping auth verification');
    }

    // --- Валидация входных данных ---
    console.log('[API] Request body type:', typeof req.body);
    
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            console.error('[API] Failed to parse request body:', e);
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    if (!body) {
        return res.status(400).json({ error: 'Empty request body' });
    }

    const { messages, model } = body;

    if (!messages) {
      return res.status(400).json({ error: 'Параметр messages обязателен' });
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages должен быть массивом' });
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages не может быть пустым' });
    }

    if (messages.length > 100) {
      return res.status(400).json({ error: 'Превышен лимит сообщений (максимум 100)' });
    }

    // Проверка структуры каждого сообщения
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: 'Каждое сообщение должно содержать role и content' });
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'role должен быть system, user или assistant' });
      }
      if (typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'content должен быть строкой' });
      }
      if (msg.content.length > 32000) {
        return res.status(400).json({ error: 'Превышен лимит длины сообщения (максимум 32000 символов)' });
      }
    }

    // --- Вызов OpenRouter API ---
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('OpenRouter API Key is missing');
      return res.status(500).json({ error: 'OpenRouter API Key is missing on server' });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.VITE_SITE_URL || "https://vibes-platform.vercel.app", // Твой домен
        "X-Title": "Vibes Platform", // Название твоего проекта
      },
      body: JSON.stringify({
        model: model || "xiaomi/mimo-v2-flash:free",
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API Error:', errorData);
      return res.status(500).json({
        error: 'Произошла ошибка при обработке запроса. Попробуйте позже.'
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
