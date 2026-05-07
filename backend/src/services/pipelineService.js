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
    onProgress({ stage, progress, detail, ts: Date.now() });
  }
}

export async function runExtractionPipeline(url, onProgress) {
  const pipelineStart = Date.now();
  const stageTimers = {};
  const startStage = (name) => { stageTimers[name] = Date.now(); };
  const stageDuration = (name) => Date.now() - (stageTimers[name] || Date.now());

  const validation = validateVideoUrl(url);
  if (!validation.valid) {
    const error = new Error(validation.reason);
    error.status = 400;
    throw error;
  }

  logger.info({ url: validation.normalizedUrl }, 'Starting extraction pipeline');
  startStage('metadata_extraction');
  emitProgress(onProgress, 'metadata_extraction', 15, 'Reading public reel metadata');

  const metadata = await extractMetadata(validation.normalizedUrl);
  emitProgress(onProgress, 'metadata_extraction_done', 24, `Metadata extracted in ${stageDuration('metadata_extraction')}ms`);

  startStage('audio_transcription');
  emitProgress(onProgress, 'audio_transcription', 35, 'Transcribing spoken cues');

  const transcriptPromise = transcribeAudio(metadata);
  startStage('ocr_frame_analysis');
  emitProgress(onProgress, 'ocr_frame_analysis', 55, 'Scanning on-screen text overlays');
  const ocrPromise = extractOnScreenText(metadata);
  startStage('visual_cooking_analysis');
  emitProgress(onProgress, 'visual_cooking_analysis', 75, 'Inferring visible cooking actions');
  const visionPromise = analyzeVisualCookingActions(metadata);

  emitProgress(onProgress, 'provider_wait', 79, 'Waiting on provider responses (latency depends on external APIs)');

  const [transcript, ocr, vision] = await Promise.all([transcriptPromise, ocrPromise, visionPromise]);

  emitProgress(onProgress, 'audio_transcription_done', 82, `Audio stage completed in ${stageDuration('audio_transcription')}ms`);
  emitProgress(onProgress, 'ocr_frame_analysis_done', 84, `OCR stage completed in ${stageDuration('ocr_frame_analysis')}ms`);
  emitProgress(onProgress, 'visual_cooking_analysis_done', 86, `Vision stage completed in ${stageDuration('visual_cooking_analysis')}ms`);

  if (transcript.providerError || ocr.providerError) {
    emitProgress(onProgress, 'provider_retry', 88, 'Provider unavailable detected. Falling back to grounded extraction path.');
  }

  logger.info({
    providerStatus: {
      metadata: metadata.provider,
      transcript: transcript.provider,
      transcriptError: transcript.providerError || null,
      ocr: ocr.provider,
      ocrError: ocr.providerError || null
    }
  }, 'Provider activation status');

  startStage('recipe_synthesis');
  emitProgress(onProgress, 'recipe_synthesis', 90, 'Combining multimodal signals into recipe');
  const result = await synthesizeRecipe({ metadata, transcript, ocr, vision });
  result.thumbnailUrl = metadata.thumbnailUrl;
  result.references = {
    reelUrl: metadata.url,
    embedUrl: metadata.embedUrl,
    videoUrl: metadata.videoUrl || null,
    audioAvailable: Boolean(metadata.videoUrl)
  };

  emitProgress(onProgress, 'recipe_synthesis_done', 97, `Synthesis completed in ${stageDuration('recipe_synthesis')}ms`);
  emitProgress(onProgress, 'complete', 100, `Recipe generated in ${Date.now() - pipelineStart}ms`);
  logger.info({ overallConfidence: result.confidenceSummary.overall }, 'Pipeline finished');
  return result;
}
