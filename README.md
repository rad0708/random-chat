
# RandomChat — Modern (KOR, No DB)

Google-like minimal UX for a Korean random 1:1 chat. Includes hCaptcha gate, rate limiting,
XSS filtering, and a sleek responsive UI. Ready for Render.

## Quick Start
```bash
npm install
npm start
# http://localhost:3000
```

## Render
- Build Command: `npm install`
- Start Command: `node server.js`
- Env Vars:
  - `HC_SITEKEY` (hCaptcha site key)
  - `HC_SECRET`  (hCaptcha secret key)
- Add your Render domain to hCaptcha site config (domain only, no https).

## Features
- Modern UI (app bar, profile menu with theme & notification)
- Dark/Light/System theme
- Floating action buttons (Next, End)
- Anti-spam (token bucket), basic profanity filter
- No DB (in-memory queue/pairs)
