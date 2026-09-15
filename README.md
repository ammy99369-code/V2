# PyaarKaMeter ❤️ — Render-ready Telegram Mini App

This package is prepared for deployment as a single Node.js Web Service on Render.

## Files
- `index.html` — Telegram Mini App UI
- `server.js` — HTTPS web server + Telegram webhook receiver
- `package.json` — Node.js package/start configuration
- `setup-webhook.js` — optional webhook setup helper
- `render.yaml` — Render Blueprint configuration
- `.env.example` — environment variable reference

## Render setup (phone-friendly)
1. Upload these files to the ROOT of a GitHub repository. Do not upload only the ZIP file.
2. In Render, create a New Web Service and connect the GitHub repository.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add environment variables:
   - `BOT_TOKEN` = your BotFather token (keep private)
   - `OWNER_CHAT_ID` = `7341356155`
6. Deploy and copy the HTTPS `onrender.com` URL.
7. Set the Telegram webhook to `https://YOUR-RENDER-URL/telegram-webhook`.
8. Configure the Telegram bot's Menu Button/Web App URL to `https://YOUR-RENDER-URL/`.

## Optional automatic webhook setup
If you add `PUBLIC_URL=https://YOUR-RENDER-URL` as an environment variable, you can run:
`npm run set-webhook`

## Security/privacy
- Never publish `BOT_TOKEN` in GitHub or send it in chat.
- The app does not request camera, microphone, contacts, or precise location.
- The owner receives only the match submission fields implemented by the app.
- Adult-labelled categories are intended for 18+ users and should remain non-explicit.
