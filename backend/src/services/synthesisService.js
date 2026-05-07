import { synthesizeWithLlmIfConfigured } from './aiClientService.js';
import { parseCaptionRecipe } from './captionParseService.js';
import { evaluateConsistency } from './consistencyService.js';

function inferStepTime(instruction) {
  const m = instruction.match(/(\d+\s*(?:-|to)?\s*\d*\s*(?:hours?|hrs?|minutes?|mins?))/i);
  return m ? m[1] : '~unknown';
}

function parseGeneralTimes(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('3-4 hours') || lower.includes('4-5 hours') || lower.includes('slow cooker')) {
    return { prepTime: '~20 min', cookTime: '3-5 hours' };
  }
  return { prepTime: '~10 min', cookTime: '~12 min' };
}

function buildGroundedFromCaption(parsed) {
  const ingredients = parsed.ingredients.map((it) => ({
    name: it.name,
    quantity: it.quantity,
    confidence: 0.93,
    source: ['caption'],
    evidence: { source: 'caption', snippet: `${it.name} ${it.quantity}` },
    inferred: false
  }));

  const steps = parsed.steps.map((step) => ({
    stepNumber: step.stepNumber,
    instruction: step.instruction,
    estimatedTime: inferStepTime(step.instruction),
    confidence: 0.9,
    evidence: { source: 'caption', snippet: step.instruction }
  }));

  return { ingredients, steps };
}

function mergeWithLlm(base, llm) {
  if (!llm?.ok || !llm.data) return base;
  return {
    ...base,
    title: llm.data.title || base.title,
    description: llm.data.description || base.description,
    cuisine: llm.data.cuisine || base.cuisine,
    difficulty: llm.data.difficulty || base.difficulty,
    prepTime: llm.data.prepTime || base.prepTime,
    cookTime: llm.data.cookTime || base.cookTime,
    servings: llm.data.servings || base.servings
  };
}

export async function synthesizeRecipe({ metadata, transcript, ocr, vision }) {
  const safeTranscript = {
    provider: transcript?.provider || 'fallback_mock',
    confidence: Number(transcript?.confidence ?? 0.4),
    segments: Array.isArray(transcript?.segments) ? transcript.segments : [],
    notes: Array.isArray(transcript?.notes) ? transcript.notes : [],
    providerError: transcript?.providerError || null
  };
  const safeOcr = {
    provider: ocr?.provider || 'fallback_mock',
    confidence: Number(ocr?.confidence ?? 0.4),
    providerError: ocr?.providerError || null
  };
  const safeVision = {
    confidence: Number(vision?.confidence ?? 0.4),
    ingredientsSeen: Array.isArray(vision?.ingredientsSeen) ? vision.ingredientsSeen : []
  };

  const parsedCaption = parseCaptionRecipe(metadata.caption || '');
  const llm = await synthesizeWithLlmIfConfigured({ metadata, transcript: safeTranscript, ocr: safeOcr, vision: safeVision, parsedCaption });

  let ingredients = [];
  let steps = [];
  let warnings = [
    'No private or authenticated content was accessed.'
  ];

  if (parsedCaption.hasStructuredRecipe) {
    const grounded = buildGroundedFromCaption(parsedCaption);
    ingredients = grounded.ingredients;
    steps = grounded.steps;
    warnings.push('Recipe primarily extracted from explicit caption structure (ingredients + directions).');
  } else {
    warnings.push('Structured caption recipe not detected. Output is partial and may be incomplete.');
    ingredients = safeVision.ingredientsSeen.map((it) => ({
      name: it.name,
      quantity: '~to taste (estimated)',
      confidence: 0.45,
      source: ['vision'],
      evidence: { source: 'vision', snippet: `Visible ingredient: ${it.name}` },
      inferred: true
    }));
    steps = safeTranscript.segments.slice(0, 5).map((seg, idx) => ({
      stepNumber: idx + 1,
      instruction: seg.text,
      estimatedTime: '~unknown',
      confidence: 0.45,
      evidence: { source: 'audio', snippet: seg.text }
    }));
  }

  const timeHint = parseGeneralTimes(metadata.caption || '');
  const consistency = evaluateConsistency({
    caption: parsedCaption.normalizedCaption,
    ingredients,
    steps,
    servings: parsedCaption.servings || null,
    cookTime: timeHint.cookTime
  });

  if (consistency.issues.length > 0) {
    warnings.push(...consistency.issues);
  }

  const providerPenalty = [safeTranscript, safeOcr].reduce((acc, src) => acc + (src.provider === 'fallback_mock' ? 0.12 : 0), 0);
  const base = parsedCaption.hasStructuredRecipe ? 0.9 : 0.52;
  const overall = Math.max(0.15, Number((base - providerPenalty - consistency.contradictionPenalty).toFixed(2)));

  const baseRecipe = {
    title: parsedCaption.titleFromCaption || metadata.titleHint || 'Reel Recipe (Extracted)',
    description: parsedCaption.hasStructuredRecipe
      ? 'Grounded extraction from explicit caption recipe text with multimodal support signals.'
      : 'Partial extraction from available multimodal signals; verify manually before cooking.',
    ingredients,
    steps,
    prepTime: timeHint.prepTime,
    cookTime: timeHint.cookTime,
    servings: parsedCaption.servings || '~unknown',
    difficulty: parsedCaption.hasStructuredRecipe ? 'Medium' : 'Unknown',
    cuisine: /chipotle|enchilada|tajin|adobo/i.test(parsedCaption.normalizedCaption) ? 'Mexican-inspired' : 'Unspecified',
    confidenceSummary: { overall },
    signals: {
      warnings,
      stageConfidence: {
        metadata: metadata.provider === 'instagram_og' ? 0.8 : 0.55,
        transcription: safeTranscript.confidence,
        ocr: safeOcr.confidence,
        vision: safeVision.confidence,
        synthesis: parsedCaption.hasStructuredRecipe ? 0.9 : 0.45
      }
    },
    trace: {
      stages: [
        'metadata_extraction',
        'audio_transcription',
        'ocr_frame_analysis',
        'visual_cooking_analysis',
        'recipe_synthesis'
      ],
      transcriptNotes: safeTranscript.notes,
      providers: {
        metadata: metadata.provider,
        transcript: safeTranscript.provider || 'unknown',
        ocr: safeOcr.provider || 'unknown',
        synthesis: llm.ok ? 'gemini_live' : 'grounded_rules'
      },
      providerStatus: {
        metadata: { active: metadata.provider === 'instagram_og', error: metadata.providerError || null },
        transcript: { active: safeTranscript.provider !== 'fallback_mock', error: safeTranscript.providerError || null },
        ocr: { active: safeOcr.provider !== 'fallback_mock', error: safeOcr.providerError || null },
        synthesis: { active: llm.ok, error: llm.error || null }
      },
      groundingCoverage: {
        ingredientEvidenceRatio: ingredients.length > 0 ? 1 : 0,
        stepEvidenceRatio: steps.length > 0 ? 1 : 0,
        contradictionCount: consistency.issues.length
      }
    }
  };

  return mergeWithLlm(baseRecipe, llm);
}
