import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    const result = {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : null,
      connectivity: null,
      error: null
    };

    if (!supabaseUrl || !supabaseAnonKey) {
      result.error = 'Missing environment variables';
      return res.status(200).json(result);
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      // Try a simple query to test connectivity
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      
      if (error && error.code !== 'PGRST116') {
        result.connectivity = 'error';
        result.error = error.message;
      } else {
        result.connectivity = 'ok';
      }
    } catch (e) {
      result.connectivity = 'failed';
      result.error = e.message;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
