import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { api, HttpError } from './routes.js';
import { initRealtime } from './realtime.js';
import { ready } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

// Production: tayyor frontendni shu serverning o'zi beradi
const dist = path.resolve(import.meta.dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map((i) => i.message).join('; ') });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Serverda xatolik' });
});

const server = http.createServer(app);
initRealtime(server);

const PORT = Number(process.env.PORT ?? 4000);
await ready;
server.listen(PORT, () => console.log(`API: http://localhost:${PORT}`));
