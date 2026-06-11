// Configuración central: lee variables de entorno y la lista de autorizados.

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
export const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
export const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL ?? '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini';
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';

const ALLOWED = (process.env.ALLOWED_TELEGRAM_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Solo los chat ids listados pueden publicar. Vacío = nadie (seguro por defecto). */
export function isAllowed(chatId: number): boolean {
  return ALLOWED.includes(String(chatId));
}

/** Devuelve los nombres de variables obligatorias que falten, para avisar en setup. */
export function faltantes(): string[] {
  const req: Record<string, string> = {
    TELEGRAM_BOT_TOKEN,
    MAKE_WEBHOOK_URL,
    OPENAI_API_KEY,
  };
  return Object.entries(req)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}
