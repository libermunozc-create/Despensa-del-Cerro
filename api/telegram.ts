// Webhook de Telegram: recibe cada mensaje y orquesta el flujo de publicación.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TELEGRAM_WEBHOOK_SECRET, isAllowed, faltantes } from '../lib/config.js';
import { sendMessage, sendPhoto, sendChatAction, answerCallback, clearButtons, getFileUrl } from '../lib/telegram.js';
import { generarCaption, generarImagen } from '../lib/openai.js';
import { subirImagen, subirDesdeUrl } from '../lib/blob.js';
import { publicar } from '../lib/publish.js';
import {
  saveDraft, getDraft, delDraft,
  savePendingPhoto, getPendingPhoto, delPendingPhoto,
  yaVisto, type Draft,
} from '../lib/state.js';

const INSTRUCCIONES =
  '¡Hola! Soy el bot de <b>Despensa del Cerro</b>.\n\n' +
  '📝 <b>Mandame texto</b> describiendo el producto u oferta → te genero imagen + texto.\n' +
  '📸 <b>Mandame una foto</b> (con descripción en el pie) → uso tu foto y te escribo el texto.\n\n' +
  'Después te muestro una vista previa y vos decidís si publicar.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('ok');

  // Verificar el secret que configuramos en setWebhook.
  if (TELEGRAM_WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).send('unauthorized');
  }

  try {
    await handleUpdate(req.body);
  } catch (e) {
    console.error('Error procesando update:', e);
  }
  // Siempre 200: si fallamos, no queremos que Telegram reintente en bucle.
  return res.status(200).send('ok');
}

async function handleUpdate(update: any): Promise<void> {
  if (!update || typeof update.update_id !== 'number') return;
  if (await yaVisto(update.update_id)) return; // anti-duplicados

  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

async function handleMessage(msg: any): Promise<void> {
  const chatId: number = msg.chat.id;
  const text: string = (msg.text ?? '').trim();

  // Comandos disponibles para cualquiera (para descubrir el chat id).
  if (text === '/id' || text === '/start') {
    const estado = isAllowed(chatId)
      ? '✅ Estás autorizado.'
      : '⛔ No estás autorizado. Agregá este id a ALLOWED_TELEGRAM_IDS en Vercel.';
    await sendMessage(chatId, `Tu chat id: <code>${chatId}</code>\n${estado}`);
    if (text === '/start' && isAllowed(chatId)) await sendMessage(chatId, INSTRUCCIONES);
    return;
  }

  if (!isAllowed(chatId)) {
    await sendMessage(chatId, '⛔ No autorizado. Mandá /id y pedile al admin que te agregue.');
    return;
  }

  const falta = faltantes();
  if (falta.length) {
    await sendMessage(chatId, `⚠️ Config incompleta en el servidor. Faltan: ${falta.join(', ')}`);
    return;
  }

  try {
    // Modo B: el cliente mandó una foto.
    if (Array.isArray(msg.photo) && msg.photo.length) {
      const fileId = msg.photo[msg.photo.length - 1].file_id; // mayor resolución
      const tgUrl = await getFileUrl(fileId);
      const imageUrl = await subirDesdeUrl(tgUrl);
      const desc = (msg.caption ?? '').trim();
      if (desc) {
        await prepararDraft(chatId, imageUrl, desc, false);
      } else {
        await savePendingPhoto(chatId, imageUrl);
        await sendMessage(chatId, '📸 Recibí la foto. Ahora mandame el texto: qué producto es, precio, oferta…');
      }
      return;
    }

    if (!text) {
      await sendMessage(chatId, 'Mandame una idea de producto (texto) o una foto con su descripción. /start para la ayuda.');
      return;
    }

    // ¿Había una foto esperando descripción? (modo B en dos pasos)
    const pending = await getPendingPhoto(chatId);
    if (pending) {
      await delPendingPhoto(chatId);
      await prepararDraft(chatId, pending, text, false);
      return;
    }

    // Modo A: texto suelto → generamos imagen + caption.
    await prepararDraft(chatId, null, text, true);
  } catch (e: any) {
    console.error(e);
    await sendMessage(chatId, `⚠️ Algo falló: ${describirError(e)}`);
  }
}

/** Mensaje de error con la causa de fondo incluida (p. ej. el motivo real de un "Connection error."). */
function describirError(e: any): string {
  const msg = e?.message ?? String(e);
  const causa = e?.cause?.message ?? e?.cause?.code;
  return causa ? `${msg} (causa: ${causa})` : msg;
}

/** Genera (o usa) la imagen + caption, guarda el borrador y manda la vista previa. */
async function prepararDraft(
  chatId: number,
  imageUrl: string | null,
  descripcion: string,
  generarImg: boolean,
): Promise<void> {
  await sendChatAction(chatId, 'upload_photo');
  await sendMessage(chatId, '⏳ Preparando el post…');

  let finalUrl = imageUrl ?? '';
  if (generarImg) {
    const buf = await generarImagen(descripcion);
    finalUrl = await subirImagen(buf);
  }
  const caption = await generarCaption(descripcion);

  const draftId = `${chatId}:${Date.now()}`;
  const draft: Draft = { chatId, imageUrl: finalUrl, caption, descripcion, generada: generarImg };
  await saveDraft(draftId, draft);

  const fila2 = generarImg ? [[{ text: '🔁 Regenerar', callback_data: `reg:${draftId}` }]] : [];
  await sendPhoto(chatId, finalUrl, caption, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Publicar', callback_data: `pub:${draftId}` },
          { text: '❌ Cancelar', callback_data: `del:${draftId}` },
        ],
        ...fila2,
      ],
    },
  });
}

async function handleCallback(cq: any): Promise<void> {
  const chatId: number = cq.message.chat.id;
  const messageId: number = cq.message.message_id;
  const data: string = cq.data ?? '';
  const idx = data.indexOf(':');
  const action = data.slice(0, idx);
  const draftId = data.slice(idx + 1);

  if (!isAllowed(chatId)) {
    await answerCallback(cq.id, 'No autorizado');
    return;
  }

  const draft = await getDraft(draftId);
  if (!draft) {
    await answerCallback(cq.id, 'Este borrador expiró, generá uno nuevo.');
    await clearButtons(chatId, messageId);
    return;
  }

  try {
    if (action === 'del') {
      await delDraft(draftId);
      await answerCallback(cq.id, 'Cancelado');
      await clearButtons(chatId, messageId);
      await sendMessage(chatId, '❌ Post cancelado.');
      return;
    }
    if (action === 'reg') {
      await answerCallback(cq.id, 'Regenerando…');
      await delDraft(draftId);
      await clearButtons(chatId, messageId);
      await prepararDraft(chatId, null, draft.descripcion, true);
      return;
    }
    if (action === 'pub') {
      await answerCallback(cq.id, 'Publicando…');
      await clearButtons(chatId, messageId);
      await publicar(draft);
      await delDraft(draftId);
      await sendMessage(chatId, '✅ ¡Publicado en Instagram!');
      return;
    }
  } catch (e: any) {
    console.error(e);
    await sendMessage(chatId, `⚠️ No pude completar la acción: ${describirError(e)}`);
  }
}
