// Estado de conversación en Redis (Upstash / Vercel KV).
// Serverless = sin memoria entre mensajes, así que guardamos los borradores acá.
import { Redis } from '@upstash/redis';

function makeRedis(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Falta config de Redis: definí KV_REST_API_URL/KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL/TOKEN).');
  }
  return new Redis({ url, token });
}

const redis = makeRedis();

export interface Draft {
  chatId: number;
  imageUrl: string;
  caption: string;
  descripcion: string; // para poder regenerar
  generada: boolean; // true = imagen creada por IA; false = foto del cliente
}

const TTL = 1800; // 30 min de vida para un borrador
const TTL_PENDING = 600; // 10 min esperando la descripción de una foto

export async function saveDraft(id: string, d: Draft): Promise<void> {
  await redis.set(`draft:${id}`, d, { ex: TTL });
}
export async function getDraft(id: string): Promise<Draft | null> {
  return await redis.get<Draft>(`draft:${id}`);
}
export async function delDraft(id: string): Promise<void> {
  await redis.del(`draft:${id}`);
}

// Foto recibida que espera que el cliente mande la descripción (modo B en 2 pasos).
export async function savePendingPhoto(chatId: number, imageUrl: string): Promise<void> {
  await redis.set(`pending:${chatId}`, imageUrl, { ex: TTL_PENDING });
}
export async function getPendingPhoto(chatId: number): Promise<string | null> {
  return await redis.get<string>(`pending:${chatId}`);
}
export async function delPendingPhoto(chatId: number): Promise<void> {
  await redis.del(`pending:${chatId}`);
}

/** Evita procesar dos veces el mismo update si Telegram reintenta. Devuelve true si ya se vio. */
export async function yaVisto(updateId: number): Promise<boolean> {
  const res = await redis.set(`upd:${updateId}`, 1, { nx: true, ex: 600 });
  return res === null; // null = la clave ya existía
}
