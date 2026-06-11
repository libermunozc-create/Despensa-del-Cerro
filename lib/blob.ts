// Sube imágenes a Vercel Blob para tener una URL pública estable que make.com pueda leer.
import { put } from '@vercel/blob';

function nombre(ext: string): string {
  return `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/** Sube un buffer PNG (imagen generada por OpenAI) y devuelve su URL pública. */
export async function subirImagen(buffer: Buffer): Promise<string> {
  const { url } = await put(nombre('png'), buffer, { access: 'public', contentType: 'image/png' });
  return url;
}

/** Descarga una imagen desde una URL (p. ej. la foto que mandó el cliente por Telegram)
 *  y la re-sube a Blob, porque las URLs de Telegram son temporales y llevan el token. */
export async function subirDesdeUrl(srcUrl: string): Promise<string> {
  const resp = await fetch(srcUrl);
  if (!resp.ok) throw new Error(`No pude descargar la imagen (${resp.status})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const ct = resp.headers.get('content-type') ?? 'image/jpeg';
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const { url } = await put(nombre(ext), buf, { access: 'public', contentType: ct });
  return url;
}
