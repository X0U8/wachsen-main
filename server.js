import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockResponse = (res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = (data) => {
    res.end(data);
    return res;
  };
  return res;
};

app.all('/api/:functionName', async (req, res) => {
  const { functionName } = req.params;
  try {
    const modulePath = path.join(__dirname, 'api', `${functionName}.mjs`);
    const { default: handler } = await import(modulePath);
    await handler(req, mockResponse(res));
  } catch (error) {
    console.error(`Error executing API function /api/${functionName}:`, error);
    res.status(500).json({ error: `Failed to load or execute API function /api/${functionName}` });
  }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Local API server running on http://localhost:${PORT}`);
});
