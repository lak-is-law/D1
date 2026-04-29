# D1

## Render Backend Deploy

This repo includes `render.yaml` for one-click backend deployment on Render.

### Steps

1. In Render, click **New +** -> **Blueprint** and connect this GitHub repo.
2. Render will detect `render.yaml` and create service `d1-backend`.
3. Fill required env vars in Render dashboard:
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
4. Deploy and verify health:
   - `https://<your-render-service>.onrender.com/api/health`

### Connect GitHub Pages frontend to Render backend

Open your Pages URL with:

`https://lak-is-law.github.io/D1/?apiBase=https://<your-render-service>.onrender.com`

The frontend stores this value and uses it for all `/api/*` calls.

## Google Sign-In setup

Google OAuth is now fully wired.

### 1) Configure Google Cloud OAuth credentials

- Create OAuth 2.0 Client (Web application)
- Authorized JavaScript origins:
  - `https://d1-backend-x7eg.onrender.com` (or your Render backend URL)
  - `https://lak-is-law.github.io`
- Authorized redirect URIs:
  - `https://d1-backend-x7eg.onrender.com/api/auth/google/callback`

### 2) Add env vars in Render service

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL=https://lak-is-law.github.io/D1/?apiBase=https://d1-backend-x7eg.onrender.com`
- `GOOGLE_CALLBACK_URL=https://d1-backend-x7eg.onrender.com/api/auth/google/callback`

### 3) Redeploy Render service

Then Google Sign-In from the frontend login card will work and return users to Pages with JWT automatically.