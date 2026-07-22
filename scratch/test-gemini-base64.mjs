import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const meshApiKey = 'rsk_01KX0VC0RBM4RG7J5NMBBQN0BR';
const meshApiUrl = 'https://api.meshapi.ai/v1/chat/completions';
const meshModel = 'google/gemini-2.5-flash';

async function runTest() {
  console.log('--- starting inline base64 gemini test ---');
  try {
    const imagePath = '/Users/kankan/.gemini/antigravity-ide/brain/969a9965-bb18-49ef-9247-c02f96a4fdbe/.tempmediaStorage/media_969a9965-bb18-49ef-9247-c02f96a4fdbe_1784049038554.png';


    const fileBuffer = fs.readFileSync(imagePath);
    const base64String = fileBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64String}`;

    console.log(`Base64 data URL length: ${dataUrl.length} chars (approx ${(dataUrl.length / 1024).toFixed(1)} KB)`);


    const userMessageContent = [
      { type: 'text', text: 'Transcribe the questions and header title of this exam paper page exactly as you see them.' },
      { type: 'image_url', image_url: { url: dataUrl } }
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
