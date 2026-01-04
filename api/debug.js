// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
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

  // Разрешаем только GET запросы
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envCheck = {
      VITE_SUPABASE_URL: {
        exists: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        value: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || null,
        length: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').length
      },
      VITE_SUPABASE_ANON_KEY: {
        exists: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        value: '***hidden***', // Не показываем ключ
        length: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').length
      },
      OPENROUTER_API_KEY: {
        exists: !!process.env.OPENROUTER_API_KEY,
        value: '***hidden***', // Не показываем ключ
        length: (process.env.OPENROUTER_API_KEY || '').length
      },
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      VERCEL: process.env.VERCEL === '1',
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      VITE_SITE_URL: process.env.VITE_SITE_URL || 'not set'
    };

    // Проверка подключения к OpenRouter API
    let openRouterCheck = {
      available: false,
      error: null,
      status: null,
      message: null
    };

    if (process.env.OPENROUTER_API_KEY) {
      try {
        const testResponse = await fetch("https://openrouter.ai/api/v1/models", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(5000) // 5 секунд timeout
        });

        openRouterCheck.status = testResponse.status;
        openRouterCheck.available = testResponse.ok;

        if (testResponse.ok) {
          try {
            const data = await testResponse.json();
            openRouterCheck.message = `Подключение успешно. Доступно моделей: ${data.data?.length || 0}`;
          } catch (e) {
            openRouterCheck.message = 'Подключение успешно, но не удалось прочитать ответ';
          }
        } else {
          const errorData = await testResponse.json().catch(() => ({}));
          openRouterCheck.error = errorData.error?.message || `HTTP ${testResponse.status}`;
          openRouterCheck.message = `Ошибка подключения: ${openRouterCheck.error}`;
        }
      } catch (fetchError) {
        openRouterCheck.error = fetchError.message;
        openRouterCheck.message = `Не удалось подключиться: ${fetchError.message}`;
      }
    } else {
      openRouterCheck.message = 'API ключ не настроен, проверка подключения пропущена';
    }

    // Общая информация о системе
    const systemInfo = {
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      nodeVersion: process.version,
      platform: process.platform
    };

    // Определение статуса здоровья системы
    const healthStatus = {
      overall: 'ok',
      issues: []
    };

    if (!envCheck.OPENROUTER_API_KEY.exists) {
      healthStatus.overall = 'error';
      healthStatus.issues.push('OPENROUTER_API_KEY не настроен');
    } else if (!openRouterCheck.available) {
      healthStatus.overall = 'warning';
      healthStatus.issues.push(`OpenRouter API недоступен: ${openRouterCheck.message}`);
    }

    if (!envCheck.VITE_SUPABASE_URL.exists) {
      healthStatus.overall = healthStatus.overall === 'error' ? 'error' : 'warning';
      healthStatus.issues.push('VITE_SUPABASE_URL не настроен');
    }

    res.status(200).json({ 
      status: healthStatus.overall,
      health: healthStatus,
      env: envCheck,
      openRouter: openRouterCheck,
      system: systemInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
