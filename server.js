import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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


  const pyPath = path.join(__dirname, 'api', `${functionName}.py`);
  if (fs.existsSync(pyPath)) {
    const payload = JSON.stringify({
      method: req.method,
      body: req.body,
      query: req.query,
    });

    const py = spawn('python3', [pyPath], { env: { ...process.env } });
    let stdout = '';
    let stderr = '';

    py.stdin.write(payload);
    py.stdin.end();

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (stderr) console.error(`[Python ${functionName}] stderr:`, stderr);
      if (code !== 0 || !stdout) {
        return res.status(500).json({ error: `Python handler failed: ${stderr}` });
      }
      try {
        const result = JSON.parse(stdout);
        res.status(result.status || 200).json(result.body !== undefined ? result.body : result);
      } catch {
        res.status(500).json({ error: 'Invalid JSON from Python handler', raw: stdout });
      }
    });
    return;
  }


  try {
    const modulePath = path.join(__dirname, 'api', `${functionName}.mjs`);
    const fileUrl = `file://${modulePath}?t=${fs.statSync(modulePath).mtimeMs}`;
    const { default: handler } = await import(fileUrl);
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
