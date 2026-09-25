// Visit https://YOUR-APP.vercel.app/api/setup?key=YOUR_WEBHOOK_SECRET once to connect Telegram.
import { tg } from '../lib/telegram.js';

export default async function handler(req, res) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.query.key !== secret) return res.status(401).send('Add ?key=YOUR_WEBHOOK_SECRET to the URL.');
  const missing = ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'].filter(k => !process.env[k]);
  if (missing.length) return res.status(400).send(`Missing settings in Vercel: ${missing.join(', ')}`);

  const url = `https://${req.headers.host}/api/telegram`;
  const result = await tg('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'channel_post', 'callback_query'],
    drop_pending_updates: true,
  });
  const me = await tg('getMe', {});
  res.setHeader('Content-Type', 'text/html');
  res.send(`<body style="font-family:system-ui;max-width:560px;margin:40px auto;line-height:1.5">
    <h2>${result.ok ? '✅ Connected' : '❌ Failed'}</h2>
    <p>Bot: <b>@${me.result?.username || '?'}</b></p>
    <p>Webhook: ${url}</p>
    <p>LinkedIn: ${process.env.LINKEDIN_ACCESS_TOKEN ? 'connected' : 'not connected yet (approvals will ask you to copy-paste)'}</p>
    <pre>${JSON.stringify(result, null, 2)}</pre>
    <p>Now open Telegram and send your bot <b>/start</b>.</p></body>`);
}
