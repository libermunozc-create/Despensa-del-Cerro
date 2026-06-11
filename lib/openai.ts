// Generación de texto (caption) e imagen (gpt-image-1) con OpenAI.
import OpenAI from 'openai';
import { OPENAI_API_KEY, OPENAI_TEXT_MODEL, OPENAI_IMAGE_MODEL } from './config.js';
import { PERSONA_CAPTION, promptImagen } from './persona.js';

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/** Redacta el caption en la voz de Despensa del Cerro. */
export async function generarCaption(descripcion: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    temperature: 0.8,
    max_tokens: 400,
    messages: [
      { role: 'system', content: PERSONA_CAPTION },
      { role: 'user', content: descripcion },
    ],
  });
  const txt = res.choices[0]?.message?.content?.trim();
  if (!txt) throw new Error('OpenAI no devolvió caption');
  return txt;
}

/** Genera la ilustración del producto. gpt-image-1 devuelve base64. */
export async function generarImagen(descripcion: string): Promise<Buffer> {
  const res = await client.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt: promptImagen(descripcion),
    size: '1024x1024',
    quality: 'medium',
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI no devolvió imagen');
  return Buffer.from(b64, 'base64');
}
