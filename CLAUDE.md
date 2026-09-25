# Project: Skinstinct Content Engine

Telegram bot on Vercel (Node serverless, no framework) that turns founder Meera Pillai's raw notes into LinkedIn drafts.

## Architecture (matches the case Components Map)
Trigger: Meera drops a voice/text note in Telegram
Input: `api/telegram.js` receives the webhook; `lib/gemini.js#transcribe` converts voice to text
Processing: `lib/gemini.js#triage` scores 0–10 using `skills/triage-rubric/SKILL.md`; score <= PUBLISH_THRESHOLD (7) is rejected with a reason
Context: `lib/news.js` fetches a Google News RSS hook (no key needed)
AI: `lib/gemini.js#draftPost` drafts in Meera's voice using `skills/meera-voice/SKILL.md`
Output: draft sent to Telegram with Approve/Reject buttons (review gate); Approve → `lib/linkedin.js` posts to LinkedIn

## Rules
- Never auto-publish. The Approve button is the only path to LinkedIn (this is the case's "Cut").
- The `skills/` folder is read at runtime. Do not move or rename it; `vercel.json` bundles it via includeFiles.
- Never commit secrets. All keys live in Vercel environment variables (see `.env.example`).
- Gemini model defaults to `gemini-3.5-flash` (2.5 models shut down 16 Oct 2026).
