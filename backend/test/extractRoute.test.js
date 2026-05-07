import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

test('rejects malformed payload', async () => {
  const res = await request(app).post('/api/extract').send({ url: 'nope' });
  assert.equal(res.statusCode, 400);
});

test('rejects unsupported host', async () => {
  const res = await request(app).post('/api/extract').send({ url: 'https://example.com/video/1' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Unsupported platform/i);
});

test('extracts grounded recipe ingredients', async () => {
  const res = await request(app).post('/api/extract').send({ url: 'https://www.instagram.com/reel/abc123/' });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.ingredients));
  assert.ok(res.body.ingredients.every((i) => typeof i.name === 'string' && typeof i.quantity === 'string'));
});
