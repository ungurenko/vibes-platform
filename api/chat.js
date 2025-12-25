
export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API Key is missing on server' });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "xiaomi/mimo-v2-flash:free",
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: 'OpenRouter API Error', 
        details: errorData 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("Server API Error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
