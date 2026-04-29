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