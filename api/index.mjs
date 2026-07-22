import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {

  const urlParts = req.url.split('?')[0].split('/');
  const functionName = urlParts[urlParts.length - 1];


  if (!functionName || functionName === 'index') {
    return res.status(400).json({ error: 'Invalid API endpoint requested.' });
  }

  try {
    const modulePath = `./${functionName}.mjs`;
    const handlerModule = await import(modulePath);

    if (typeof handlerModule.default !== 'function') {
      throw new Error(`Endpoint handler in ${functionName}.mjs is not a default function.`);
    }

    return await handlerModule.default(req, res);
  } catch (error) {
    console.error(`[Vercel Consolidator] Routing failed for /api/${functionName}:`, error);
    return res.status(404).json({ error: `API endpoint /api/${functionName} not found or failed to load.` });
  }
}
