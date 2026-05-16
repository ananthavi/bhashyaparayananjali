# Deploying Pārāyaṇāñjali

The app is a fully static PWA — no server, no database, no API keys.
Any static-file host with HTTPS will run it. Below are three free
options ranked by setup friction.

## Option A — GitHub Pages (recommended; one click)

You're already on GitHub. Pages is free for public repos, automatic
HTTPS, and a workflow at `.github/workflows/deploy-pages.yml` already
builds + deploys on every push to `main` or any `claude/**` branch.

**One-time setup (you do this; can't be done from code):**

1. Open the repo on GitHub → **Settings** → **Pages**.
2. Under **Source**, choose **GitHub Actions**.
3. Save. (No URL to copy yet — wait for the next push to finish.)

That's it. Every subsequent push to a watched branch redeploys. The
URL Pages gives you is shown at the top of the **Settings → Pages**
page after the first successful deploy:

```
https://<owner>.github.io/<repo>/
```

For `ananthavi/bhashyaparayananjali` that's `https://ananthavi.github.io/bhashyaparayananjali/`.

### Custom domain (optional)

1. Drop a file at `public/CNAME` containing the domain (e.g.
   `parayananjali.example.com`) on one line.
2. In your DNS provider, add a CNAME record pointing the subdomain
   to `<owner>.github.io`.
3. Push. Pages auto-provisions a Let's Encrypt cert.

### Limits

Free GitHub Pages: 1 GB repo size, 100 GB bandwidth/month, soft cap
of 10 builds/hour. We're well under all of these — `dist/` builds to
~34 MB and the precache fits inside 100 MB even with all four
dictionaries.

## Option B — Cloudflare Pages

Cloudflare's free tier is unlimited bandwidth, 500 builds/month,
free custom domain + HTTPS. No file-size cap to worry about.

**One-time setup:**

1. Sign up at <https://dash.cloudflare.com/sign-up> (free).
2. Workers & Pages → **Create application** → **Pages** → **Connect
   to Git**.
3. Authorize Cloudflare to read this repo.
4. Build settings:
   - **Framework preset**: None
   - **Build command**: `npm ci && npm run build`
   - **Output directory**: `dist`
5. Environment variables:
   - `NODE_VERSION = 22`
   - `PUBLIC_BASE = /`
6. Save & Deploy.

Cloudflare also accepts the `wrangler.toml` shipped at the repo root
if you prefer CLI deploys: `npm i -g wrangler && wrangler pages
deploy dist`.

## Option C — Netlify

Free tier: 100 GB bandwidth/month, 300 build min/month, custom
domain + HTTPS.

**One-time setup:**

1. Sign up at <https://app.netlify.com/signup>.
2. **Add new site** → **Import an existing project** → **GitHub**.
3. Pick this repo. The settings are auto-detected from `netlify.toml`
   already in the repo:
     - Build command: `npm ci && npm run build`
     - Publish directory: `dist`
     - Node version: 22
4. Deploy.

## What I (the assistant) can and can't do

I can:
- Write and push every workflow / config file (already done).
- Tune the Vite base path so the same code runs at `/`, `/bhashyaparayananjali/`, or
  any custom subpath via the `PUBLIC_BASE` env var.
- Verify the build output and confirm precache contents.

I can't:
- Sign in to GitHub on your behalf.
- Create accounts on Cloudflare or Netlify.
- Click the "Enable Pages" toggle in repo settings — that's the one
  manual step you have to do, exactly once.

After that toggle, every push autodeploys.

## Verifying the deploy

After the first successful Pages deploy, sanity-check:

1. Open the URL → the Library page renders with the Acharya icon and
   13 text cards.
2. Open any text → the manifest loads, the first chapter chunk loads,
   the position pill shows the right reference.
3. Open Search → autocomplete fires after 1 char of input.
4. Open dev-tools → Application → Service Workers → Pārāyaṇāñjali.
   Confirm 30 + entries are precached.

If any asset 404s, the most common cause is a stale `BASE_URL` —
clear the service worker (`Application → Storage → Clear site data`)
and reload.
