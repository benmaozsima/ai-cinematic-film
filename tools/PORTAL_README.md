# Local production portal

Run from the repository root:

```bash
node tools/portal_server.mjs
```

Open `http://127.0.0.1:8765/dashboard/#sequence-review`.

The server reads the media registry without caching, serves repository images and provider-hosted review videos, and streams the local assembly as a real MP4 download. Fal credentials stay server-side and generated media stays outside Git.
