// Estado de conversación en Redis (Upstash / Vercel KV).
// Serverless = sin memoria entre mensajes, así que guardamos los borradores acá.
import { Redis } from '@upstash/redis';

// Lazy: si creamos el cliente al importar y faltan las variables, la función
// entera muere con 500 antes de poder avisar nada. Diferido, el error llega
// como mensaje claro al chat en vez de tumbar el endpoint.
let _redis: Redis | null = null;
function redisClient(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Falta config de Redis: definí KV_REST_API_URL/KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL/TOKEN).');
  }
  _redis = new Redis({ url, token });
  return _redis;
}

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
  await redisClient().set(`draft:${id}`, d, { ex: TTL });
}
export async function getDraft(id: string): Promise<Draft | null> {
  return await redisClient().get<Draft>(`draft:${id}`);
}
export async function delDraft(id: string): Promise<void> {
  await redisClient().del(`draft:${id}`);
}

// Foto recibida que espera que el cliente mande la descripción (modo B en 2 pasos).
export async function savePendingPhoto(chatId: number, imageUrl: string): Promise<void> {
  await redisClient().set(`pending:${chatId}`, imageUrl, { ex: TTL_PENDING });
}
export async function getPendingPhoto(chatId: number): Promise<string | null> {
  return await redisClient().get<string>(`pending:${chatId}`);
}
export async function delPendingPhoto(chatId: number): Promise<void> {
  await redisClient().del(`pending:${chatId}`);
}

/** Evita procesar dos veces el mismo update si Telegram reintenta. Devuelve true si ya se vio. */
export async function yaVisto(updateId: number): Promise<boolean> {
  const res = await redisClient().set(`upd:${updateId}`, 1, { nx: true, ex: 600 });
  return res === null; // null = la clave ya existía
}
