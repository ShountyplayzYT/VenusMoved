# Line Haul Voice Lookup — Vercel edition

Rewrite of the Streamlit app as:

- **Frontend:** Next.js (App Router, TypeScript, Tailwind) — `app/`, `components/`, `lib/`
- **Backend:** FastAPI, deployed as a single Vercel Python serverless function —
  `api/index.py` (+ helpers in `api/_lib/`)
- **Database:** your existing Neon Postgres. `shipmentsdb` is untouched; three new
  tables (`app_users`, `geocode_cache`, `distance_cache`) replace the old
  `users.json` / `geocode_cache.json` / `distance_cache.json` local files, which
  can't persist on serverless.

Both frontend and backend deploy as **one Vercel project** — the frontend calls
`/api/...` on the same origin, so there's no CORS to configure.

## 1. Set up the database

Run `schema.sql` once against your Neon database (Neon's SQL editor, or `psql
"$DATABASE_URL" -f schema.sql`).

## 2. Configure environment variables

Copy `.env.example` to `.env.local` for local dev, and add the same keys under
your Vercel project's **Settings → Environment Variables**:

- `DATABASE_URL` — Neon **pooled** connection string
- `JWT_SECRET` — random secret (`openssl rand -hex 32`)
- `OPENAI_API_KEY`
- `OPENWEATHER_KEY` (optional — weather block shows "unavailable" without it)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` (optional fallback login)
- `NOMINATIM_CONTACT_EMAIL` — your email, sent as a courtesy per Nominatim's usage policy

## 3. Local development

```bash
npm install
npm run dev            # Next.js frontend on :3000

# in another terminal
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

For local dev, either run both and proxy `/api` to :8000 (add a `rewrites()` entry
in `next.config.js` pointing at `http://localhost:8000/api/:path*` when
`NODE_ENV === 'development'`), or just use `vercel dev`, which runs the whole
project — Next.js + the Python function — exactly like production.

## 4. Deploy

```bash
npm i -g vercel
vercel
```

Vercel auto-detects the Next.js app and the Python function under `api/`. The
`vercel.json` in this repo rewrites all `/api/*` requests to `api/index.py`
(the single FastAPI app) and raises its timeout to 60s, since the lookup
pipeline chains several outbound calls (geocoding, routing, weather, two
OpenAI calls). If you're on the Hobby plan, function duration may be capped
lower — upgrade to Pro or simplify the pipeline if you hit timeouts.

## What changed vs. the Streamlit app

- **Auth:** bcrypt-hashed passwords in `app_users`, session as an httpOnly JWT
  cookie instead of `st.session_state`.
- **Caches:** geocode/route results now cached in Postgres tables instead of
  local JSON files (serverless functions get a fresh filesystem per
  invocation, so local files never persisted anyway).
- **Voice:** browser `MediaRecorder` API records a webm clip client-side and
  posts it to `/api/transcribe`, which forwards it to Whisper — replacing
  `audio_recorder_streamlit`.
- **Rendering:** the AI report (previously `st.markdown`) renders via
  `react-markdown` in `components/ResultsPanel.tsx`.
- **Everything else** — the DB queries, city-correction fuzzy matching, the
  expert-pricing prompt, and the data-honesty rules in that prompt — is a
  direct port of your original Python logic.

## Known gaps / next steps

- The original's elaborate CSS (route-strip runner animation, noise texture,
  pulse rings) is only partially ported — the functional pieces (badges,
  panels, record pulse, hazard stripe) are there; some flourishes were
  dropped to keep this buildable without a live npm/design pass. Happy to
  keep refining the visual polish.
- Nominatim's 1 req/sec rate limit is enforced only *within* a single request
  now (serverless functions don't share memory across invocations) — under
  heavy concurrent traffic you could get more 429s than before. The retry
  logic in `api/_lib/geocode.py` handles that, but a hosted Redis/Upstash
  rate limiter would be more robust at scale.
- Signup currently has no email verification — same trust model as the
  original `users.json`-based signup.
