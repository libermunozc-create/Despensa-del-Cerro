// Wrappers mínimos de la Bot API de Telegram (sin librería, solo fetch).
import { TELEGRAM_BOT_TOKEN } from './config.js';

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function call(method: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await r.json()) as any;
  if (!json.ok) console.error(`Telegram ${method} falló:`, JSON.stringify(json));
  return json;
}

export function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

export function sendPhoto(chatId: number, photo: string, caption: string, extra: Record<string, unknown> = {}) {
  return call('sendPhoto', { chat_id: chatId, photo, caption, ...extra });
}

export function answerCallback(callbackQueryId: string, text = '') {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export function sendChatAction(chatId: number, action = 'upload_photo') {
  return call('sendChatAction', { chat_id: chatId, action });
}

export function clearButtons(chatId: number, messageId: number) {
  return call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
}

/** Resuelve la URL temporal de descarga de un archivo de Telegram. */
export async function getFileUrl(fileId: string): Promise<string> {
  const r = await call('getFile', { file_id: fileId });
  const path = r?.result?.file_path;
  if (!path) throw new Error('No pude obtener el archivo de Telegram');
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${path}`;
}
