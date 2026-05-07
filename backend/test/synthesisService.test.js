import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeRecipe } from '../src/services/synthesisService.js';

test('marks low confidence quantities as estimated', async () => {
  const recipe = await synthesizeRecipe({
    metadata: { titleHint: 'Test Recipe', caption: '' },
    transcript: { confidence: 0.7, notes: [], segments: [{ text: 'mix ingredients' }] },
    ocr: { confidence: 0.65 },
    vision: { confidence: 0.6, ingredientsSeen: [{ name: 'onion', confidence: 0.7 }] }
  });

  const uncertain = recipe.ingredients.find((i) => i.confidence < 0.7);
  assert.ok(uncertain);
  assert.match(uncertain.quantity, /^~/);
});
