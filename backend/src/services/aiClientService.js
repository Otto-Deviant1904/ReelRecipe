import axios from 'axios';

export async function synthesizeWithLlmIfConfigured(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, provider: 'gemini', error: 'GEMINI_API_KEY missing', data: null };

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const prompt = [
    'You are a careful recipe extraction assistant.',
    'Return JSON only with keys: title, description, cuisine, difficulty, prepTime, cookTime, servings, ingredients, steps, warnings.',
    'Use conservative estimated quantities and prefix uncertain quantities with ~.',
    'Do not fabricate precision.',
    `Input JSON: ${JSON.stringify(payload)}`
  ].join('\n');

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1600,
          responseMimeType: 'application/json'
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, provider: 'gemini', error: 'empty LLM response', data: null };
    return { ok: true, provider: 'gemini', error: null, data: JSON.parse(text) };
  } catch (error) {
    return { ok: false, provider: 'gemini', error: error.message || 'llm request failed', data: null };
  }
}
