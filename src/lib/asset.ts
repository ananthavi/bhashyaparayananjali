/**
 * Build a URL relative to the deployed app's base path.
 *
 * The app fetches its own static data files (`data/...`, `images/...`)
 * with absolute paths starting from the site root. When served from a
 * subpath like `https://user.github.io/bhashyaparayananjali/`, those naive `/data/...`
 * URLs resolve against the host root and 404. This helper prefixes
 * every path with the Vite-injected `BASE_URL`, which is `/` in the
 * default build and `/bhashyaparayananjali/` (or whatever) when `PUBLIC_BASE` was set
 * at build time.
 *
 * Capacitor builds keep BASE_URL = `/` so the WebView's
 * `capacitor://localhost/data/...` resolution still works.
 *
 * Usage:
 *   fetch(asset('data/index.json'))
 *   <img src={asset('images/advaita/logo-circle.png')} />
 */
export function asset(p: string): string {
  const base = import.meta.env.BASE_URL || '/';
  // Normalize: drop a leading slash on `p` so we don't end up with `//data/`.
  const cleaned = p.replace(/^\/+/, '');
  return base.endsWith('/') ? base + cleaned : `${base}/${cleaned}`;
}
