// Muestra el estado actual del webhook (URL, último error, updates pendientes).
import { config } from 'dotenv';
config({ path: '.env.local' });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN en .env.local');
  process.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
console.log(JSON.stringify(await r.json(), null, 2));
