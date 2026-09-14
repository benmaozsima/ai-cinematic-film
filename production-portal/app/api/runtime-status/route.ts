import { env } from 'cloudflare:workers';

/** Exposes only capability state; it never exposes a credential. */
export async function GET() {
  let falConfigured = false;
  try {
    falConfigured = Boolean(env.FAL_KEY);
  } catch {
    // Local preview has no managed runtime bindings; it is simply unconfigured.
  }
  return Response.json({ falConfigured }, {
    headers: { 'cache-control': 'no-store' },
  });
}
