// Registra la URL del webhook en Telegram (apunta los mensajes a tu deploy de Vercel).
// Uso: npm run set-webhook -- https://TU-APP.vercel.app/api/telegram
import { config } from 'dotenv';
config({ path: '.env.local' });

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const url = process.argv[2];

if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN en .env.local');
  process.exit(1);
}
if (!url) {
  console.error('Uso: npm run set-webhook -- https://TU-APP.vercel.app/api/telegram');
  process.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: secret || undefined,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query'],
  }),
});
console.log(JSON.stringify(await r.json(), null, 2));
