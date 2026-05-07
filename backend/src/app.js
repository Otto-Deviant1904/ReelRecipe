import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { extractRouter } from './routes/extractRoute.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/extract', extractRouter);

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      code: err.code || null
    });
  });

  return app;
}
