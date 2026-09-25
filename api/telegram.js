// Skinstinct Content Engine: Telegram webhook
// Flow: note → (transcribe) → triage score → if > threshold: news hook + draft → Meera reviews → Approve posts to LinkedIn
import { waitUntil } from '@vercel/functions';
import { tg, downloadFile } from '../lib/telegram.js';
import { transcribe, triage, draftPost } from '../lib/gemini.js';
import { fetchNews } from '../lib/news.js';
import { postToLinkedIn, linkedinConfigured } from '../lib/linkedin.js';

const THRESHOLD = Number(process.env.PUBLISH_THRESHOLD || 7); // drafts only when score > THRESHOLD
const SEP = '━━━━━━━━━━━━━━';
const DRAFT_MARK = '📝 DRAFT';

const buttons = {
  inline_keyboard: [[
    { text: '✅ Approve & post to LinkedIn', callback_data: 'approve' },
    { text: '🗑 Reject', callback_data: 'reject' },
  ]],
};

function allowed(chatId) {
  const owner = process.env.OWNER_CHAT_ID;
  return !owner || String(owner) === String(chatId);
}

function extractDraft(messageText = '') {
  const parts = messageText.split(SEP);
  return parts.length >= 3 ? parts[1].trim() : null;
}

async function sendDraft(chatId, draft, header) {
  const text = `${DRAFT_MARK} · ${header}\n${SEP}\n${draft}\n${SEP}\nTo edit: reply to this message with your revised text.`;
  return tg('sendMessage', { chat_id: chatId, text: text.slice(0, 4096), reply_markup: buttons, disable_web_page_preview: true });
}

async function handleNote(msg) {
  const chatId = msg.chat.id;
  let note = msg.text || msg.caption || '';

  // Meera replied to a draft with her edited version → new draft card with her text
  const replied = msg.reply_to_message;
  if (replied && (replied.text || '').startsWith(DRAFT_MARK) && note) {
    return sendDraft(chatId, note.slice(0, 2900), 'Edited by you · ready to post');
  }

  if (note.startsWith('/start') || note.startsWith('/id')) {
    return tg('sendMessage', {
      chat_id: chatId,
      text: `Skinstinct Content Engine is live.\n\nDrop a voice note or text note here. I'll score it 0–10; anything above ${THRESHOLD} comes back as a LinkedIn draft for your approval.\n\nYour chat ID: ${chatId}`,
    });
  }

  const voice = msg.voice || msg.audio;
  if (voice) {
    await tg('sendMessage', { chat_id: chatId, text: '🎙 Got it. Transcribing…' });
    const b64 = await downloadFile(voice.file_id);
    note = await transcribe(b64, voice.mime_type || 'audio/ogg');
    await tg('sendMessage', { chat_id: chatId, text: `Transcript:\n"${note.slice(0, 3500)}"` });
  }
  if (!note.trim()) return;

  const t = await triage(note);
  const b = t.breakdown || {};
  const scoreLine = `Score ${t.score}/10 (insight ${b.insight}, pillar ${b.pillar}, audience ${b.audience}, substance ${b.substance}, timely ${b.timeliness})`;

  if (t.hard_reject || Number(t.score) <= THRESHOLD) {
    return tg('sendMessage', {
      chat_id: chatId,
      text: `⏸ Not drafted. ${scoreLine}\n${t.hard_reject ? `Rejected: ${t.hard_reject}\n` : ''}${t.reason}`,
    });
  }

  await tg('sendMessage', { chat_id: chatId, text: `🟢 ${scoreLine}\nAngle: ${t.angle}\nFinding a news hook and drafting…` });
  const news = await fetchNews(t.news_query);
  const d = await draftPost(note, t, news);
  const hook = d.news_used ? `Hook: ${d.news_used.title}` : 'No news hook';
  await sendDraft(chatId, d.draft, `${t.category} · ${t.score}/10 · ${hook}`);
  if (d.news_used?.link) {
    await tg('sendMessage', { chat_id: chatId, text: `News source for your check: ${d.news_used.link}`, disable_web_page_preview: true });
  }
}

async function handleButton(cb) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  await tg('answerCallbackQuery', { callback_query_id: cb.id });
  if (!allowed(chatId)) return;

  // remove buttons so nothing is posted twice
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });

  if (cb.data === 'reject') {
    return tg('sendMessage', { chat_id: chatId, text: '🗑 Draft discarded.', reply_to_message_id: messageId });
  }

  const draft = extractDraft(cb.message.text);
  if (!draft) return tg('sendMessage', { chat_id: chatId, text: 'Could not read the draft text.' });

  if (/\[VERIFY/i.test(draft)) {
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: buttons });
    return tg('sendMessage', { chat_id: chatId, reply_to_message_id: messageId,
      text: '⚠️ This draft still has [VERIFY: …] placeholders. Reply to it with the corrected text, then approve the new version.' });
  }

  if (!linkedinConfigured()) {
    return tg('sendMessage', { chat_id: chatId, reply_to_message_id: messageId,
      text: '✅ Approved. LinkedIn isn\'t connected yet, so copy the text above and paste it into LinkedIn.' });
  }

  try {
    const link = await postToLinkedIn(draft);
    await tg('sendMessage', { chat_id: chatId, reply_to_message_id: messageId, text: `🚀 Posted to LinkedIn: ${link}` });
  } catch (e) {
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: buttons });
    await tg('sendMessage', { chat_id: chatId, text: `❌ LinkedIn post failed: ${e.message}` });
  }
}

async function processUpdate(update) {
  try {
    if (update.callback_query) return await handleButton(update.callback_query);
    const msg = update.message || update.channel_post;
    if (!msg || !allowed(msg.chat.id)) return;
    await handleNote(msg);
  } catch (e) {
    const chatId = (update.message || update.channel_post || update.callback_query?.message)?.chat?.id;
    if (chatId) await tg('sendMessage', { chat_id: chatId, text: `⚠️ Something went wrong: ${e.message.slice(0, 300)}` });
    console.error(e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Telegram webhook is running.');
  if (process.env.WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  waitUntil(processUpdate(req.body)); // reply to Telegram immediately, keep working in background
  res.status(200).json({ ok: true });
}
