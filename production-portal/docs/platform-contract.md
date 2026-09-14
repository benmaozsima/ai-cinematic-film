# Film OS durable platform contract

This is the boundary between the Film OS UI and future authenticated Workers/API
routes. It deliberately contains no provider SDK code, credentials, or
client-side secret handling.

## Ownership and storage

- **D1** is the auditable source for projects, identities, selections, prompts,
  quotes, approvals, runs, reviews and delivery manifests.
- **R2** contains binary images, video, audio and exported cuts. D1 stores its
  immutable `storage_key`, SHA-256 and technical metadata.
- A project owns canonical `CHAR_`, `LOC_`, `PROP_`, wardrobe and style IDs.
  They are permanent production identities. A generated file is only a version
  (`assets`) and can never replace that identity implicitly.

## API/worker contract (to implement behind auth)

| Operation | Method / resource | Required behaviour |
| --- | --- | --- |
| Read project graph | `GET /api/projects/:id/production-graph` | Return canonical assets, current revisions, shots, locked selections, latest reviews and deliveries. |
| Create identity | `POST /api/projects/:id/canonical-assets` | Create only a new persistent ID; initially `draft`. Do not fabricate a reference file. |
| Select for a shot | `PUT /api/shots/:id/selections` | Validate canonical IDs, revision ownership and roles. Preserve `locked` selections unless explicit unlock is audited. |
| Store source media | `POST /api/assets/upload-intent` | Return a short-lived R2 upload intent. Server verifies MIME, decode metadata and SHA-256 before final asset row. |
| Quote generation | `POST /api/generation-quotes` | Canonicalise sanitized input, hash it, estimate a maximum charge and persist a quote with expiry. No provider invocation. |
| Approve charge | `POST /api/paid-approvals` | Require actor + idempotency key; quote must be unexpired and its hash must equal the submitted snapshot. Insert-only approval plus audit event. |
| Queue a run | `POST /api/generation-runs` | Require a valid approval for paid work. Freeze prompt/references/constraints in the run row, then enqueue a job. |
| Poll/callback | worker/internal only | Update job/run lifecycle, sanitize provider response, download output to R2, validate it and create an asset version. |
| Review asset | `POST /api/assets/:id/reviews` | Append verdict/checklist; never overwrite earlier review. |
| Render delivery | `POST /api/deliveries` | Freeze the timeline manifest, create a render job and store final output in R2. |

## Paid-operation invariants

1. The browser never receives `FAL_KEY`, any API token, or provider headers.
2. A provider adapter receives a run only after a `paid_approvals` row exists,
   points to the same quote and matches `quote_payload_hash`.
3. `paid_approvals`, prompt/reference snapshots and review rows are append-only.
   Corrections create a newer record and an audit event.
4. `idempotency_key` makes approval safe on retry; `request_hash` prevents a
   duplicate generation run from a single identical request.
5. A run stores only a scrubbed provider response. Error messages must not echo
   credentials or raw headers.
6. Final media output must be decoded and checked for dimensions/duration,
   content type, byte size and SHA-256 before it becomes an `assets` record.

## Provider adapter boundary

Implement adapters server-side only, for example `FalGenerationAdapter`, behind
one interface: `quote(snapshot)`, `submit(run)`, `getStatus(requestId)` and
`normalizeResult(response)`. The UI may list providers/models and build an
operation draft, but it must only call the quote/approval/run endpoints above.
Model-specific parameters stay in `GenerationRequestSnapshot.modelInput`, while
continuity-critical fields and references are frozen independently.

## Migration and rollout

Apply `0000_zippy_mother_askani.sql`, then
`0001_film_os_durable_platform.sql` to a fresh D1 database. Existing data may
be imported as immutable asset versions and canonical records before enabling
writes. Do not expose a “Generate” control as live until authentication,
authorization, D1/R2 access controls, rate limits, the provider adapter and
approval route are deployed and tested.
