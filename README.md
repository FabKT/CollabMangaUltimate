# CollabManga Ultimate

TanStack Start application for the CollabManga / Manga Forge studio.

## Render deployment

Create a Node Web Service with:

```txt
Build Command: npm ci && npm run build
Start Command: npm start
```

Required environment variables:

```env
PULSENOTE_BACKEND_URL=https://pulsenote.onrender.com
PULSENOTE_APP_TOKEN=the_same_value_as_APP_CLIENT_TOKEN_in_PulseNote
NODE_ENV=production
```

The Manga Page Creator calls the shared PulseNote AI backend from a server
function, so `PULSENOTE_APP_TOKEN` must stay server-side and must not use a
`VITE_` prefix.
