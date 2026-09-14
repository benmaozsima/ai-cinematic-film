declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    /** Runtime-only secret. Never return this value to the browser. */
    FAL_KEY?: string;
  }
}
