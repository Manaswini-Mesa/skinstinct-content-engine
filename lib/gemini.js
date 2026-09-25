// Gemini API: transcription, triage scoring, and drafting.
import { loadSkill } from './skills.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
// Used when the main model is overloaded (503/429) or unavailable.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
const RETRYABLE = new Set([408, 429, 500, 503, 504]);
// Each call (triage, draft) gets this much time in total, so a note finishes
// well inside the 60s Vercel limit even when Gemini is slow or hangs.
const BUDGET_MS = 24000;
const MAIN_TIMEOUT_MS = 10000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGemini(opts) {
  // Try the main model twice, then the fallback with whatever time is left.
  const attempts = [[MODEL, 0], [MODEL, 1000], [FALLBACK_MODEL, 0], [FALLBACK_MODEL, 1000]];
  const deadline = Date.now() + BUDGET_MS;
  let lastErr;
  for (const [model, wait] of attempts) {
    if (wait) await sleep(wait);
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    const timeout = model === MODEL ? Math.min(remaining, MAIN_TIMEOUT_MS) : remaining;
    try {
      return await callModel(model, opts, timeout);
    } catch (err) {
      lastErr = err;
      if (!RETRYABLE.has(err.status) && err.status !== 404) throw err;
      console.warn(`Gemini ${model} failed with ${err.status}, retrying`);
    }
  }
  throw lastErr || new Error('Gemini is busy right now. Please try again in a few minutes.');
}

async function callModel(model, { system, parts, json = false }, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: json ? { responseMimeType: 'application/json' } : {},
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    data = await res.json();
  } catch (e) {
    if (e.name !== 'TimeoutError' && e.name !== 'AbortError') throw e;
    const err = new Error(`Gemini ${model} timed out after ${Math.round(timeoutMs / 1000)}s`);
    err.status = 408;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Gemini error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!json) return text;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function transcribe(base64Audio, mimeType) {
  return callGemini({
    parts: [
      { inline_data: { mime_type: mimeType, data: base64Audio } },
      { text: 'Transcribe this voice note verbatim in English. Output only the transcript, no commentary. Keep technical skincare terms (pH, CoA, niacinamide, etc.) accurate.' },
    ],
  });
}

export async function triage(note) {
  return callGemini({
    system: loadSkill('triage-rubric'),
    parts: [{ text: `Score this note:\n\n"""${note}"""` }],
    json: true,
  });
}

export async function draftPost(note, triageResult, newsItems) {
  const news = newsItems.length
    ? newsItems.map((n, i) => `${i + 1}. ${n.title} (${n.source}, ${n.date}) ${n.link}`).join('\n')
    : 'No news items found.';
  return callGemini({
    system: loadSkill('meera-voice'),
    parts: [{ text:
`Write a LinkedIn post draft for Meera from this raw note.

RAW NOTE:
"""${note}"""

TRIAGE: category=${triageResult.category}; angle=${triageResult.angle}

CURRENT NEWS (pick the single most relevant one as a hook, or none if nothing fits):
${news}

Return JSON only:
{"draft": "the full post text, plain text, max 2800 characters", "news_used": {"title": "...", "link": "..."} or null}` }],
    json: true,
  });
}
