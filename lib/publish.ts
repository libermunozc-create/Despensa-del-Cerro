// Publica el post enviando el payload al webhook de make.com.
import { MAKE_WEBHOOK_URL } from './config.js';
import type { Draft } from './state.js';

export async function publicar(draft: Draft, comentario = ''): Promise<void> {
  const resp = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      image_url: draft.imageUrl,
      caption: draft.caption,
      comentario,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`make.com respondió ${resp.status}: ${body}`);
  }
}
