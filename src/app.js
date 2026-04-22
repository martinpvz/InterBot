import express from 'express';

import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { webhookRouter } from './routes/webhook.js';

const app = express();

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  },
}));

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      ok: true,
      service: 'whatsapp-bot',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use('/webhook', webhookRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
