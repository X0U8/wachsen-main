import { resolveAiConfig } from './lib/ai-config.mjs';

const MESH_API_KEY = process.env.MESH_API_KEY;
const MESH_API_URL = process.env.MESH_API_URL || 'https://api.meshapi.ai/v1/chat/completions';
const MESH_MODEL = process.env.MESH_MODEL;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, name, base64 } = req.body;

  const aiConfig = resolveAiConfig(req.body, {
    meshApiKey: MESH_API_KEY,
    meshApiUrl: MESH_API_URL,
    meshModel: MESH_MODEL
  });

  try {
    if (!url) {
      return res.status(400).json({ error: 'Missing file URL' });
    }


    const resolvedUrl = await resolveSingleB2Url(url);


    const imgUrl = base64 || resolvedUrl;
    const userMessageContent = [
      { type: 'text', text: 'You are an image analyzer. Describe what you see in the attached image in detail. Specifically, transcribe any questions, text, or equations printed in the image. If you cannot read it or if the image is empty, state so.' },
      { type: 'image_url', image_url: { url: imgUrl } }
    ];

    const messages = [
      { role: 'system', content: 'You are a professional image analyzer. Return clean descriptive text.' },
      { role: 'user', content: userMessageContent }
    ];

    console.log(`[DIAGNOSTIC SCAN] Requesting ${aiConfig.apiUrl} with model ${aiConfig.model} using resolved url: ${resolvedUrl}`);

    const response = await fetch(aiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: messages,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(200).json({
        success: false,
        resolvedUrl,
        error: `AI gateway returned status ${response.status}: ${text}`
      });
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || 'No text content returned.';

    return res.status(200).json({
      success: true,
      resolvedUrl,
      description
    });

  } catch (error) {
    console.error('Diagnostic scan error:', error);
    return res.status(500).json({ error: error.message || 'Diagnostic scan failed' });
  }
}

async function resolveSingleB2Url(urlStr) {
  const b2KeyId = process.env.B2_KEY_ID;
  const b2AppKey = process.env.B2_APPLICATION_KEY;
  const b2BucketId = process.env.B2_BUCKET_ID;
  const b2BucketName = process.env.B2_BUCKET_NAME;

  if (!b2KeyId || !b2AppKey || !b2BucketId || !b2BucketName) {
    return urlStr;
  }

  try {
    if (!urlStr.includes('/api/upload-to-b2')) {
      return urlStr;
    }

    const authCredentials = Buffer.from(`${b2KeyId}:${b2AppKey}`).toString('base64');
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${authCredentials}` }
    });
    if (!authResponse.ok) return urlStr;
    const authData = await authResponse.json();
    const { apiInfo, authorizationToken: accountToken } = authData;
    const { apiUrl, downloadUrl } = apiInfo.storageApi;

    const urlObj = new URL(urlStr, 'http://localhost');
    const fileName = urlObj.searchParams.get('path');
    if (!fileName) return urlStr;

    const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': accountToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: b2BucketId,
        fileNamePrefix: fileName,
        validDurationInSeconds: 7200
      })
    });

    if (downloadAuthResponse.ok) {
      const downloadAuthData = await downloadAuthResponse.json();
      const downloadToken = downloadAuthData.authorizationToken;
      return `${downloadUrl}/file/${b2BucketName}/${fileName}?Authorization=${downloadToken}`;
    }
    return urlStr;
  } catch (err) {
    console.error('Error resolving single B2 secure URL:', err);
    return urlStr;
  }
}
