# ReelRecipes

AI-powered recipe extraction app that converts public short-form video URLs (starting with Instagram Reels) into structured, cookable recipes.

## What this project demonstrates

- Full-stack architecture (React + Vite + Node + Express)
- Multimodal extraction pipeline design (metadata, transcript, OCR, visual cues)
- Explainable recipe synthesis with confidence scoring
- Uncertainty-aware UX (estimated quantities clearly labeled)

## Stack

- Frontend: React, Vite, Axios
- Backend: Node.js, Express, Axios, Zod, Pino
- AI Layer: provider-agnostic service interfaces with optional Gemini + Whisper + OCR provider integration

## Quick start

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on `http://localhost:5000`.

Environment variables (`backend/.env`):

- `GEMINI_API_KEY` for recipe synthesis
- `OPENAI_API_KEY` for Whisper transcription (when public video URL is accessible)
- `OCR_SPACE_API_KEY` for thumbnail OCR fallback

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`.

## API

`POST /api/extract`

`GET /api/extract/stream?url=<encoded_reel_url>` (SSE progress events + final result)

Request body:

```json
{ "url": "https://www.instagram.com/reel/abc123/" }
```

Response shape:

```json
{
  "title": "...",
  "description": "...",
  "ingredients": [
    { "name": "", "quantity": "", "confidence": 0.0, "source": ["audio", "ocr"] }
  ],
  "steps": [
    { "stepNumber": 1, "instruction": "", "estimatedTime": "", "confidence": 0.0 }
  ],
  "prepTime": "",
  "cookTime": "",
  "servings": "",
  "difficulty": "",
  "cuisine": "",
  "confidenceSummary": { "overall": 0.0 },
  "signals": { "warnings": [], "stageConfidence": {} },
  "trace": { "stages": [] }
}
```

## Notes on realism and constraints

- This repo does **not** bypass private/authenticated Instagram content.
- If video assets are unavailable, the app degrades to caption/metadata-based extraction.
- Quantities inferred with low certainty are prefixed using `~` and marked as estimated.
- Reel playback panel supports `video` or `audio-only` mode when public media URL is available; otherwise it falls back to Instagram embed + clear messaging.

## Tests

```bash
cd backend
npm test
```
