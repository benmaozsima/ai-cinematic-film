# Production Portal Orchestration Architecture v0.1

## Goal

The portal is the production control surface for this film and future films. It must be able to plan, submit, monitor, review, compare, and assemble media without exposing provider credentials or making an unapproved paid call.

## Provider adapter contract

Every provider is an adapter behind one internal interface:

```text
capabilities() -> models, modes, resolutions, durations, audio/lip-sync support
estimate(request) -> price range, limits, warnings
prepare(request) -> immutable payload + input manifest
submit(request) -> job id (only after approval)
poll(job id) -> queued/running/succeeded/failed
fetch(job id) -> durable media record + checksum
```

Initial adapters: Fal (Seedance image-to-video). Future adapters may include Replicate, Runway, Veo, or local models without changing shot data.

## Manual and automatic model choice

- **Manual:** the user chooses provider, model, version, audio mode, and quality tier.
- **Auto:** the portal filters models by shot requirements (image-to-video/reference-to-video, dialogue/audio, duration, aspect ratio, continuity references), ranks by continuity fit, cost, latency, and prior QC score, then shows the proposed model and exact estimated cost before submission.
- Auto mode never silently changes provider after approval. A fallback is a new proposal requiring approval.

## Jobs and parallelism

Each generation is an immutable job containing shot id, version, prompt, negative constraints, reference checksums, provider/model, parameters, estimated and actual cost, and parent job. A queue supports parallel jobs with configurable concurrency and provider rate limits. Jobs are cancelable before submission and retry only as a new version.

## Quality and review gates

1. Validate payload and cost cap.
2. Submit only after explicit approval for the exact batch.
3. Run technical QC (decode, dimensions, codec, duration, audio streams, SHA-256).
4. Run visual QC (identity, gender/age, duplicate people, props, blocking, first/last handoff).
5. Keep every result and rejected attempt; only an explicit review decision makes a version canonical.

## Storage and security

The browser never receives FAL_KEY or another provider secret. The local portal server owns credentials and serves a redacted job view. Generated media lives in durable object storage/provider CDN or local outputs; Git stores code, manifests, prompts, and checksums, not large outputs or secrets.

## Portal screens

- Project/film selector and canonical source status.
- Shot board with versions, references, dialogue, constraints, and review controls.
- Model lab: capability matrix, manual/auto choice, exact cost preview, approval gate.
- Job queue: parallel progress, retries, failures, provider/request ids.
- Side-by-side review: prompt/input/output, frame contact sheet, QC report, Approve/Revise/Reject.
- Assembly: select one version per shot, preload preview, export one downloadable MP4.

## Persistence

The registry is the canonical API-shaped data contract. Local review decisions and job state are written to a local project database/JSON journal and can be exported as a versioned manifest. Provider responses are never the source of truth by themselves.
