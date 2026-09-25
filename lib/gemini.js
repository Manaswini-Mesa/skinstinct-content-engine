// Gemini API: transcription, triage scoring, and drafting.
import { loadSkill } from './skills.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

async function callGemini({ system, parts, json = false }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: json ? { responseMimeType: 'application/json' } : {},
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
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
