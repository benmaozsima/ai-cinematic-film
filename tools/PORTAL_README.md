# Local production portal

Run from the repository root:

```bash
node tools/portal_server.mjs
```

Open `http://127.0.0.1:8765/dashboard/#sequence-review`.

The server reads the media registry without caching, serves repository images and provider-hosted review videos, and streams the local assembly as a real MP4 download. Fal credentials stay server-side and generated media stays outside Git.

## Local orchestration API

The server also exposes a safe, provider-neutral API for future portal controls:

* `GET /api/registry` — current media registry.
* `GET /api/models` — versioned provider/model capability matrix from `data/model_capabilities_v0.1.json`.
* `GET /api/jobs` and `GET /api/jobs/:id` — redacted local job journal (stored in ignored `.portal/jobs.json`).
* `POST /api/estimate` — exact cost estimate for a provider/model request.
* `POST /api/jobs` — creates an immutable queued proposal. Paid models enter `awaiting_approval`.
* `POST /api/jobs/:id/approve` with `{ "approved": true }` — records explicit approval, but does not submit a provider call. Provider adapters must be enabled deliberately in a later implementation.

No endpoint sends a paid request. `FAL_KEY` is never returned to the browser and is not read by this proposal-only layer.
