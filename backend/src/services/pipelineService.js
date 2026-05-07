import pino from 'pino';
import { validateVideoUrl } from './urlValidationService.js';
import { extractMetadata } from './metadataService.js';
import { transcribeAudio } from './transcriptionService.js';
import { extractOnScreenText } from './ocrService.js';
import { analyzeVisualCookingActions } from './visionService.js';
import { synthesizeRecipe } from './synthesisService.js';

const logger = pino({ name: 'reelrecipes-pipeline' });

function emitProgress(onProgress, stage, progress, detail) {
  if (typeof onProgress === 'function') {
    onProgress({ stage, progress, detail });
  }
}

export async function runExtractionPipeline(url, onProgress) {
  const validation = validateVideoUrl(url);
  if (!validation.valid) {
    const error = new Error(validation.reason);
    error.status = 400;
    throw error;
  }

  logger.info({ url: validation.normalizedUrl }, 'Starting extraction pipeline');
  emitProgress(onProgress, 'metadata_extraction', 15, 'Reading public reel metadata');

  const metadata = await extractMetadata(validation.normalizedUrl);
  emitProgress(onProgress, 'audio_transcription', 35, 'Transcribing spoken cues');

  const transcriptPromise = transcribeAudio(metadata);
  emitProgress(onProgress, 'ocr_frame_analysis', 55, 'Scanning on-screen text overlays');
  const ocrPromise = extractOnScreenText(metadata);
  emitProgress(onProgress, 'visual_cooking_analysis', 75, 'Inferring visible cooking actions');
  const visionPromise = analyzeVisualCookingActions(metadata);

  const [transcript, ocr, vision] = await Promise.all([transcriptPromise, ocrPromise, visionPromise]);

  logger.info({
    providerStatus: {
      metadata: metadata.provider,
      transcript: transcript.provider,
      transcriptError: transcript.providerError || null,
      ocr: ocr.provider,
      ocrError: ocr.providerError || null
    }
  }, 'Provider activation status');

  emitProgress(onProgress, 'recipe_synthesis', 90, 'Combining multimodal signals into recipe');
  const result = await synthesizeRecipe({ metadata, transcript, ocr, vision });
  result.thumbnailUrl = metadata.thumbnailUrl;
  result.references = {
    reelUrl: metadata.url,
    embedUrl: metadata.embedUrl,
    videoUrl: metadata.videoUrl || null,
    audioAvailable: Boolean(metadata.videoUrl)
  };

  emitProgress(onProgress, 'complete', 100, 'Recipe generated');
  logger.info({ overallConfidence: result.confidenceSummary.overall }, 'Pipeline finished');
  return result;
}
