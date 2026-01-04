export default function handler(req, res) {
  const envCheck = {
    VITE_SUPABASE_URL: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV
  };

  res.status(200).json({ 
    status: 'ok', 
    env: envCheck,
    timestamp: new Date().toISOString() 
  });
}
