# Skinstinct Content Engine

Telegram bot that turns Meera's raw notes into LinkedIn drafts in her voice, with a human review gate.

**Flow (matches the Components Map):**
Meera drops a voice or text note in Telegram → Gemini transcribes it → Gemini scores it 0–10 against `skills/triage-rubric` → notes scoring **above 7** fetch a Google News hook and get drafted using `skills/meera-voice` → the draft arrives in Telegram with **Approve / Reject** → Approve posts to LinkedIn. Notes at 7 or below are rejected with the score breakdown and a reason.

**The Cut:** full auto-publishing. Meera rejected end-to-end tools and rewrote every post from her hired writer, so nothing goes public without her tap.

## Files
- `skills/meera-voice/SKILL.md`: voice and tone rules from her 15 published pieces
- `skills/triage-rubric/SKILL.md`: 0–10 publishability rubric plus hard-reject rules
- `api/telegram.js`: the bot
- `api/setup.js`: one-time Telegram connection
- `lib/`: Gemini, Google News, Telegram, and LinkedIn helpers

## Settings (Vercel → Settings → Environment Variables)
| Name | Where from |
|---|---|
| TELEGRAM_BOT_TOKEN | @BotFather in Telegram |
| GEMINI_API_KEY | aistudio.google.com → Get API key |
| WEBHOOK_SECRET | any long word you invent, no spaces |
| OWNER_CHAT_ID | optional: send /start to the bot, it replies with the ID; locks the bot to Meera |
| LINKEDIN_ACCESS_TOKEN | optional: LinkedIn developer app token (scopes: openid, profile, w_member_social). Without it, Approve asks you to copy-paste. |
| PUBLISH_THRESHOLD | optional, default 7 |

After deploying, visit `https://YOUR-APP.vercel.app/api/setup?key=YOUR_WEBHOOK_SECRET` once.

Note: LinkedIn tokens expire after about 60 days. When that happens, generate a new one and update the setting.
