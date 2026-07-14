const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_TTS_URL = 'https://api.meshapi.ai/v1/audio/speech';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid text parameter' });
    }

    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'Server TTS key not configured' });
    }

    const response = await fetch(MESH_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: text, voice }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch (_) {}
      return res.status(502).json({
        error: 'TTS provider request failed',
        details: errData.error?.message || errText,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('TTS API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
