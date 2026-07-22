import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const b2KeyId = '005f311108a277f0000000001';
const b2AppKey = 'K00535zyOJo8PwYvcsl2hQIxkyFYdo0';
const b2BucketId = '7f33a1018120780a92f7071f';
const b2BucketName = 'Wachsen';

const meshApiKey = 'rsk_01KX0VC0RBM4RG7J5NMBBQN0BR';
const meshApiUrl = 'https://api.meshapi.ai/v1/chat/completions';
const meshModel = 'google/gemini-2.5-flash';

async function runTest() {
  console.log('--- starting b2 upload and gemini test ---');
  try {

    const authCredentials = Buffer.from(`${b2KeyId}:${b2AppKey}`).toString('base64');
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${authCredentials}` }
    });
    const authData = await authResponse.json();
    const { apiInfo, authorizationToken: accountToken } = authData;
    const { apiUrl, downloadUrl } = apiInfo.storageApi;


    const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        'Authorization': accountToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bucketId: b2BucketId })
    });
    const uploadUrlData = await uploadUrlResponse.json();
    const { uploadUrl, authorizationToken: uploadToken } = uploadUrlData;


    const imagePath = '/Users/kankan/.gemini/antigravity-ide/brain/969a9965-bb18-49ef-9247-c02f96a4fdbe/.tempmediaStorage/media_969a9965-bb18-49ef-9247-c02f96a4fdbe_1784049038554.png';
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = `diagnostics/test_image_${Date.now()}.png`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadToken,
        'X-Bz-File-Name': encodeURIComponent(fileName),
        'Content-Type': 'image/png',
        'X-Bz-Content-Sha1': 'do_not_verify'
      },
      body: fileBuffer
    });
    const uploadResult = await uploadResponse.json();
    console.log('Uploaded to B2 successfully:', uploadResult.fileName);


    const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': accountToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: b2BucketId,
        fileNamePrefix: fileName,
        validDurationInSeconds: 3600
      })
    });
    const downloadAuthData = await downloadAuthResponse.json();
    const downloadToken = downloadAuthData.authorizationToken;
    const secureUrl = `${downloadUrl}/file/${b2BucketName}/${fileName}?Authorization=${downloadToken}`;
    console.log('Secure URL generated:', secureUrl);


    const userMessageContent = [
      { type: 'text', text: 'Transcribe the questions and header title of this exam paper page exactly as you see them.' },
      { type: 'image_url', image_url: { url: secureUrl } }
    ];

    const response = await fetch(meshApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${meshApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: meshModel,
        messages: [
          { role: 'system', content: 'You are a professional transcriber.' },
          { role: 'user', content: userMessageContent }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    console.log('\n--- Gemini Response ---');
    console.log(data.choices?.[0]?.message?.content);

  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTest();
