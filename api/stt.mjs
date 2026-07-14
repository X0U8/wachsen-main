const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_STT_URL = 'https://api.meshapi.ai/v1/audio/transcriptions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64, model = 'whisper-1' } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid audioBase64 parameter' });
    }

    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'Server STT key not configured' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    const form = new FormData();
    form.append('model', model);
    form.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'recording.webm');

    const response = await fetch(MESH_STT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESH_API_KEY}`,
      },
      body: form,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        error: 'STT provider request failed',
        details: data.error?.message || 'Unknown transcription error',
      });
    }

    return res.status(200).json({ text: data.text || '' });
  } catch (error) {
    console.error('STT API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
