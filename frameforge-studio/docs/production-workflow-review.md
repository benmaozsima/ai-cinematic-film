# Production workflow review — 2026-09-09

The application should keep the filmmaker oriented around a scene and shot. Stages are tools for that shot, not a requirement to finish every scene before seeing an image.

## Implemented in this pass

- Scene/shot board with numbered scenes, summaries, media previews and direct image/video/sound actions. Working scene and shot are remembered per film on this device; current film survives refresh.
- Asset gallery inside each bible entry: current generations, ready images, failures, direct review, archive and restore. After submission, return to that asset rather than dismissing into an unrelated page. Asset definitions are secondary to the gallery.
- Separate reference prompts for characters, locations and props. One view per generation, avoiding ambiguous multi-panel collages. Film-wide narrative style no longer automatically contaminates asset-reference requests. Canonical descriptions still need user review if they contain temporary emotions/action.
- Reversible archive replaces destructive version deletion. Media files and original metadata remain stored. Versions used by selections, references, descendants, active jobs or sound tracks cannot be archived until dependencies are resolved.
- Persistent undo/redo for cut selection, shot order, in-point and duration. Field-level commands preserve unrelated completed jobs. Conflicting later state blocks undo rather than overwriting it. New edit clears redo; last 100 commands kept.
- Explicit camera cut vs continuation. Continuation extracts the source cut endpoint into a new keyframe belonging to the next shot, retaining source/version/time. The frame requires review. Guided video creation requires that approved frame; changed predecessor, trim or duration makes the connection stale. Final export includes the stale-link continuity warning.

## Open-source research and decisions

- [AI Video Production Editor design](https://github.com/LudwigKienle/ai-video-production-editor/blob/main/DESIGN.md): a calm workspace, prominent next action, and progressive disclosure. Applied by moving images before metadata and exposing a shot-oriented working surface. Its [repository](https://github.com/LudwigKienle/ai-video-production-editor) is a relevant production-workflow reference, not an integrated dependency.
- [OpenCut command manager](https://github.com/OpenCut-app/opencut-classic/blob/main/apps/web/src/core/managers/commands.ts) and [media removal command](https://github.com/OpenCut-app/opencut-classic/blob/main/apps/web/src/commands/media/remove-media-asset.ts): reviewed execute/undo/redo and retained asset state. Our server implements smaller persistent field-level commands, because restoring a whole film snapshot would lose asynchronous generation results. No source code was copied. The classic repository is archived; do not depend on it as an actively maintained editor package.
- Existing FFmpeg extraction/export is reused. A shared frame is a useful continuity constraint, not proof of seamless motion. Velocity, camera direction, lighting, sound and generated first-frame adherence still need review. A reference-to-video endpoint is not necessarily a hard first-frame constraint.

## Remaining items from the conversation — not certified complete

| Area | Remaining work |
| --- | --- |
| Full Fal selection | Catalog browsing is not executable integration. Each endpoint needs schema, input/output mapping, reference limits, pricing and retry tests. Do not label all catalog entries usable. |
| All-page undo | Current new undo covers cut choices/order/timing; archive has restore. Screenplay drafts retain their own history. There is no universal undo for every form or provider request. |
| Location preparation | Implemented: new shots prepare/reuse the scene location during a write operation. Existing shots have an explicit preparation action. Reads and startup do not relink removed assets. New links increment shot continuity revision. |
| Identity bundles | Master, body, profile, back/detail and location views can now be prepared individually from an approved source, with reference-capable models. Actual multi-view identity quality still requires generated-image review; costume variants are not a separate typed workflow yet. |
| Review ergonomics | Every review surface needs consistent return context, localized labels, media-specific numbering, reference roles and batch actions. Existing older panels still differ. |
| Cinematic transitions | Add adjacent-shot playback and review of motion/audio at each seam; test a complete newly generated film. This pass does not certify any generated result as seamless. |
| Asset generation failures | Gallery now exposes state and results. Provider rejection/likeness restrictions require supported inputs/models, not silent retries or bypasses. |
| Hosting | Existing app is Node/SQLite/FFmpeg with an authenticated internet bridge. `.openai/hosting.json` is an unregistered scaffold, not a deployed full portal. Preserve runtime and originals; independent hosting requires storage/render-worker migration. |
| Export and playback | Existing automated export tests run. Full mobile/public-link download and playback QA remains separate from this workflow pass. |

## Validation

TypeScript and production build. Automated suite includes archive/restore, protected dependencies, cut history through HTTP, conflict protection, preserving background results, and trimmed endpoint extraction to a different shot. Browser interactions on the real project verified the scene board, direct SH002 video navigation and both courtyard image versions in its gallery. No paid generation was submitted in this pass.

## Follow-up: shot assets and review context

- Per-shot asset cards show approved references, pending images, running requests and missing pictures. Open the asset gallery directly; link existing assets or remove a link without deleting the asset.
- New shot creation and newly approved shot plans prepare/reuse their scene location. Manual location links survive shot-plan revisions. Removed links remain removed on GET and restart.
- Approved draft records retain their original request context hash and a separate applied context hash, so automatically prepared locations do not make the draft stale against its own result. Actual upstream changes still block approval.
- Review close returns to its originating modal. Revising an entity image opens that entity's generator, retaining parent/version history.
- Revision preview rejects a different media kind or an unrelated entity/shot before submission.
- 38 tests pass, including HTTP read purity, explicit location preparation, shared location reuse and revision model routing. Browser QA: SH002 → interior-dog location gallery → review → close returns to the same gallery. No paid generation or approval of user media was performed.

## Follow-up: individual reference views

- Asset gallery offers a master reference and type-appropriate individual views. Additional views require an approved image of the same entity and a reference-capable image model; the server validates both.
- View and source version are recorded with each generation. One image is requested per view, rather than a multi-panel collage.
- Asset generator shows only images of the current entity. Closing it returns to that entity gallery.
- 39 tests and TypeScript pass. Browser preparation on Adam selected the approved Qwen v3 source and FLUX.2 Edit for a left profile. No paid generation was submitted, so output identity fidelity is not yet certified.
