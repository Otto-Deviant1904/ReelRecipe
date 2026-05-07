import { useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const STAGE_LABELS = {
  queued: 'Queued',
  metadata_extraction: 'Extracting metadata',
  audio_transcription: 'Transcribing audio',
  ocr_frame_analysis: 'Analyzing frame text',
  visual_cooking_analysis: 'Inferring cooking actions',
  recipe_synthesis: 'Synthesizing recipe',
  complete: 'Complete'
};

function toMarkdown(recipe) {
  const lines = [`# ${recipe.title}`, '', recipe.description, '', '## Ingredients'];
  recipe.ingredients.forEach((item) => lines.push(`- ${item.quantity} ${item.name}`));
  lines.push('', '## Steps');
  recipe.steps.forEach((step) => lines.push(`${step.stepNumber}. ${step.instruction}`));
  return lines.join('\n');
}

export default function App() {
  const [url, setUrl] = useState('');
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('queued');
  const [events, setEvents] = useState([]);
  const [playbackMode, setPlaybackMode] = useState('video');

  const stageTitle = useMemo(() => STAGE_LABELS[stage] || 'Processing', [stage]);
  const reliabilityState = useMemo(() => {
    if (!recipe) return { label: 'Awaiting input', tone: 'neutral' };
    const c = recipe.confidenceSummary?.overall ?? 0;
    if (c < 0.45) return { label: 'Low reliability', tone: 'low' };
    if (c < 0.75) return { label: 'Moderate reliability', tone: 'medium' };
    return { label: 'High reliability', tone: 'high' };
  }, [recipe]);

  const providerSummary = useMemo(() => {
    if (!recipe?.trace?.providerStatus) return [];
    return Object.entries(recipe.trace.providerStatus).map(([name, status]) => ({
      name,
      active: Boolean(status?.active),
      error: status?.error || null
    }));
  }, [recipe]);

  function addEvent(message) {
    setEvents((prev) => [...prev.slice(-4), message]);
  }

  function startStreamExtraction(targetUrl) {
    return new Promise((resolve, reject) => {
      const streamUrl = `${API_BASE}/api/extract/stream?url=${encodeURIComponent(targetUrl)}`;
      const source = new EventSource(streamUrl);

      source.addEventListener('progress', (event) => {
        const payload = JSON.parse(event.data);
        setStage(payload.stage || 'queued');
        setProgress(payload.progress || 0);
        addEvent(payload.detail || STAGE_LABELS[payload.stage] || 'Processing');
      });

      source.addEventListener('result', (event) => {
        const payload = JSON.parse(event.data);
        setRecipe(payload);
        setProgress(100);
        setStage('complete');
        source.close();
        resolve(payload);
      });

      source.addEventListener('pipeline_error', (event) => {
        const payload = JSON.parse(event.data);
        reject(new Error(payload.message || 'Extraction failed.'));
        source.close();
      });

      source.onerror = () => {
        reject(new Error('Stream disconnected. Check backend availability and retry.'));
        source.close();
      };
    });
  }

  async function handleExtract(event) {
    event.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setRecipe(null);
    setError('');
    setProgress(5);
    setStage('queued');
    setEvents(['Starting extraction request']);

    try {
      await startStreamExtraction(url.trim());
    } catch (err) {
      setError(err.message || 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  }

  function copyRecipe() {
    if (!recipe) return;
    navigator.clipboard.writeText(toMarkdown(recipe));
  }

  function exportText() {
    if (!recipe) return;
    const blob = new Blob([toMarkdown(recipe)], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${recipe.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="page">
      <main className="shell">
        <section className="hero card">
          <p className="kicker">ReelRecipes AI</p>
          <h1>Recipe Intelligence Dashboard</h1>
          <p className="sub">Paste a public Instagram Reel URL to extract ingredients, steps, timings, and confidence-aware estimates.</p>

          <form className="extract-form" onSubmit={handleExtract}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..." />
            <button disabled={loading}>{loading ? 'Analyzing...' : 'Extract Recipe'}</button>
          </form>

          {error ? <div className="error">{error}</div> : null}
        </section>

        <section className="card pipeline">
          <div className="pipeline-head">
            <h2>{stageTitle}</h2>
            <span>{progress}%</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="events">{events.map((e) => <p key={e}>{e}</p>)}</div>
        </section>

        {recipe ? (
          <section className={`card result reliability-${reliabilityState.tone}`}>
            <div className="result-top">
              <div>
                <h2>{recipe.title}</h2>
                <p>{recipe.description}</p>
                <div className="meta-row">
                  <span>Prep: {recipe.prepTime}</span>
                  <span>Cook: {recipe.cookTime}</span>
                  <span>Servings: {recipe.servings}</span>
                  <span>Difficulty: {recipe.difficulty}</span>
                  <span>Cuisine: {recipe.cuisine}</span>
                  <span className="badge">Confidence {recipe.confidenceSummary.overall}</span>
                  <span className={`badge badge-${reliabilityState.tone}`}>{reliabilityState.label}</span>
                </div>
              </div>
              {recipe.thumbnailUrl ? <img src={recipe.thumbnailUrl} alt="Reel preview" /> : null}
            </div>

            {providerSummary.some((p) => !p.active) ? (
              <div className="fallback-banner">
                <strong>Fallback mode active</strong>
                <p>One or more providers were unavailable. Extraction is grounded but may be incomplete.</p>
              </div>
            ) : null}

            <h3>Reel Reference Playback</h3>
            <div className="playback-controls">
              <button type="button" className={playbackMode === 'video' ? 'chip active' : 'chip'} onClick={() => setPlaybackMode('video')}>Video</button>
              <button type="button" className={playbackMode === 'audio' ? 'chip active' : 'chip'} onClick={() => setPlaybackMode('audio')}>Audio only</button>
            </div>
            <div className="playback-panel">
              {playbackMode === 'video' ? (
                recipe.references?.videoUrl ? (
                  <video controls preload="metadata" src={recipe.references.videoUrl} poster={recipe.thumbnailUrl} />
                ) : (
                  <iframe src={recipe.references?.embedUrl} title="Instagram Reel embed" loading="lazy" allow="autoplay; encrypted-media" />
                )
              ) : recipe.references?.audioAvailable ? (
                <audio controls preload="metadata" src={recipe.references.videoUrl} />
              ) : (
                <p className="nutrition">Audio-only mode is unavailable for this reel because public media audio stream was not accessible.</p>
              )}
            </div>

            <div className="provider-strip">
              {providerSummary.map((provider) => (
                <div key={provider.name} className={`provider-pill ${provider.active ? 'ok' : 'down'}`}>
                  <span>{provider.name}</span>
                  <small>{provider.active ? 'live' : 'fallback'}</small>
                </div>
              ))}
            </div>

            <h3>Ingredients</h3>
            <div className="ingredients-grid">
              {recipe.ingredients.map((item) => (
                <article key={`${item.name}-${item.quantity}`} className={`ingredient ${item.confidence < 0.7 ? 'low' : ''}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity}</span>
                    <small>source: {item.source.join(', ')}</small>
                    {item.evidence?.snippet ? <small>evidence: {item.evidence.snippet}</small> : null}
                    <div className="meter"><div style={{ width: `${Math.round(item.confidence * 100)}%` }} /></div>
                  </div>
                </article>
              ))}
            </div>

            <h3>Cooking Steps</h3>
            <ol className="steps">
              {recipe.steps.map((step) => (
                <li key={step.stepNumber}>
                  <p>{step.instruction}</p>
                  <small>{step.estimatedTime} · confidence {step.confidence}</small>
                </li>
              ))}
            </ol>

            <h3>Uncertainty Notes</h3>
            <ul className="warnings">{recipe.signals.warnings.map((w) => <li key={w}>{w}</li>)}</ul>

            <h3>Source Provenance</h3>
            <div className="provenance-grid">
              <p><strong>Transcript:</strong> {recipe.trace?.providers?.transcript || 'unknown'}</p>
              <p><strong>OCR:</strong> {recipe.trace?.providers?.ocr || 'unknown'}</p>
              <p><strong>Synthesis:</strong> {recipe.trace?.providers?.synthesis || 'unknown'}</p>
              <p><strong>Reference URL:</strong> <a href={recipe.references?.reelUrl} target="_blank" rel="noreferrer">Open reel</a></p>
              <p><strong>Provider errors:</strong> {providerSummary.filter((p) => p.error).map((p) => `${p.name}: ${p.error}`).join(' | ') || 'none'}</p>
            </div>

            <h3>Estimated Nutrition</h3>
            <p className="nutrition">Nutrition model integration placeholder: estimated calories/macros will appear here in a future revision.</p>

            <div className="actions">
              <button onClick={copyRecipe}>Copy Recipe</button>
              <button onClick={exportText}>Export Markdown</button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
