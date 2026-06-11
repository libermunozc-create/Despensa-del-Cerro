# Despensa del Cerro — Bot de publicación

Bot de Telegram que publica posts de Instagram para **Despensa del Cerro**.
Corre como función serverless en **Vercel** y usa **OpenAI** (imagen + texto) y **make.com** (publicar en IG).

## Cómo funciona

```
Telegram (vos) ──► Vercel /api/telegram ──► OpenAI (imagen + caption)
                          │                         │
                          │                  Vercel Blob (URL pública)
                          ▼                         │
                  vista previa + botones ◄──────────┘
                          │  ✅ Publicar
                          ▼
                   webhook de make.com ──► Instagram (CreatePostPhoto)
```

**Dos modos:**
- **Texto** → genera imagen (`gpt-image-1`) + caption y muestra preview.
- **Foto** (con descripción en el pie) → usa tu foto, solo escribe el caption.

Siempre hay **vista previa + confirmar** antes de publicar (publicar es irreversible).
Solo los chat ids en `ALLOWED_TELEGRAM_IDS` pueden usar el bot.

## Estructura

```
api/telegram.ts        # webhook de Telegram (orquesta todo)
lib/
  config.ts            # variables de entorno + autorizados
  telegram.ts          # Bot API de Telegram
  openai.ts            # caption (chat) + imagen (gpt-image-1)
  persona.ts           # voz del caption y estilo de imagen (editable)
  blob.ts              # subir imágenes a Vercel Blob
  state.ts             # borradores y dedupe en Redis/Upstash
  publish.ts           # POST al webhook de make.com
scripts/               # set/delete/info del webhook de Telegram
make/                  # blueprint para importar en make.com
```

## Puesta en marcha

### 1. Dependencias (local)
```bash
npm install
```

### 2. make.com
1. Importá `make/DespensaDelCerro_publish.blueprint.json` (Scenarios → ⋯ → Import Blueprint).
2. Conectá tu Instagram Business de Despensa del Cerro y creá el webhook.
3. Copiá la **URL del webhook** → será `MAKE_WEBHOOK_URL`.
4. Activá el scenario.

### 3. Subir a GitHub y desplegar en Vercel
```bash
git init && git add . && git commit -m "scaffold inicial"
git branch -M main
git remote add origin https://github.com/libermunozc-create/Despensa-del-Cerro.git
git push -u origin main
```
En Vercel: **Add New → Project → importá el repo**.

### 4. Storage en Vercel
- **Storage → Create → Blob** → Connect al proyecto (inyecta `BLOB_READ_WRITE_TOKEN`).
- **Storage → Create → Upstash (Redis)** → Connect al proyecto (inyecta `KV_REST_API_URL/TOKEN`).

### 5. Variables de entorno (Vercel → Settings → Environment Variables)
Agregá a mano (las del storage ya las puso Vercel):
```
TELEGRAM_BOT_TOKEN        # de @BotFather
TELEGRAM_WEBHOOK_SECRET   # openssl rand -hex 32
OPENAI_API_KEY            # de OpenAI (con límite de gasto)
MAKE_WEBHOOK_URL          # del paso 2
ALLOWED_TELEGRAM_IDS      # tu chat id (mandale /id al bot para verlo)
```
Después **Redeploy** para que tome las variables.

### 6. Conectar el webhook de Telegram
Bajá las variables y registrá el webhook apuntando a tu deploy:
```bash
vercel env pull .env.local
npm run set-webhook -- https://TU-APP.vercel.app/api/telegram
npm run webhook-info   # verificar que quedó OK (sin last_error)
```

### 7. Probar
- Mandale `/id` al bot → agregá ese id a `ALLOWED_TELEGRAM_IDS` (y redeploy).
- Mandá un texto de producto → revisá la preview → **Publicar**.

## Afinar
- **Voz del caption / estilo de imagen:** editá `lib/persona.ts`.
- **Primer comentario automático** (ej. WhatsApp de pedidos): agregá un módulo
  *Instagram → Create a Comment* en make.com (`Media ID = {{34.id}}`, `Message = {{1.comentario}}`)
  y pasá `comentario` en `lib/publish.ts`.

## Seguridad
- Los secretos viven **solo** en variables de entorno (`.env.local` está en `.gitignore`).
- El webhook valida el header `X-Telegram-Bot-Api-Secret-Token`.
- Si una key se filtra (p. ej. en un chat), **revocala y generá una nueva**.
