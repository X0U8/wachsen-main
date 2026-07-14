const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_TTS_URL = 'https://api.meshapi.ai/v1/audio/speech';
const MESH_STT_URL = 'https://api.meshapi.ai/v1/audio/transcriptions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'alloy', ttsModel = 'tts-1', audioBase64, sttModel = 'whisper-1' } = req.body || {};

    if (!MESH_API_KEY) {
      return res.status(500).json({ error: 'Server audio key not configured' });
    }

    // TTS branch
    if (text && typeof text === 'string') {
      const response = await fetch(MESH_TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MESH_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: ttsModel, input: text, voice }),
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
      return;
    }

    // STT branch
    if (audioBase64 && typeof audioBase64 === 'string') {
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      const form = new FormData();
      form.append('model', sttModel);
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
    }

    return res.status(400).json({ error: 'Missing required parameter: text (for TTS) or audioBase64 (for STT)' });
  } catch (error) {
    console.error('Audio API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
