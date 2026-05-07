import express from 'express';
import { z } from 'zod';
import { runExtractionPipeline } from '../services/pipelineService.js';

const schema = z.object({
  url: z.string().url()
});

export const extractRouter = express.Router();

extractRouter.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid URL payload' });
    }

    const recipe = await runExtractionPipeline(parsed.data.url);
    res.status(200).json(recipe);
  } catch (error) {
    next(error);
  }
});

extractRouter.get('/stream', async (req, res) => {
  const parsed = schema.safeParse({ url: req.query.url });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid URL payload' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('progress', { stage: 'queued', progress: 5, detail: 'Starting extraction request' });

  try {
    const recipe = await runExtractionPipeline(parsed.data.url, (progress) => {
      send('progress', progress);
    });
    send('result', recipe);
    res.end();
  } catch (error) {
    send('pipeline_error', { message: error.message || 'Extraction failed' });
    res.end();
  }
});
