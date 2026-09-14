# Frameforge Studio

A local AI film production workspace. Create independent films, develop scripts and shot lists, maintain a production bible, generate with FAL, review every version, assemble a connected cut, and render a shareable MP4.

## Open the studio

On this Mac, double-click **Open Frameforge.command**, or:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3210**. Requires **Node.js 24+**, **FFmpeg**, and **ffprobe** on PATH. On macOS, FFmpeg is available with `brew install ffmpeg`. The launcher installs dependencies and builds the app if needed. Close its terminal / press Control-C to stop both servers. Use `npm run dev` for development with live updates.

### Internet bridge

`scripts/internet-bridge.mjs` provides a server-side login in front of the local studio, including its API and MP4 downloads. Start it with `FRAMEFORGE_BRIDGE_PASSWORD` and optional `FRAMEFORGE_BRIDGE_USER` (default Ben), then point `cloudflared tunnel --url http://127.0.0.1:3212 --no-autoupdate` at it. Login uses a Secure, HttpOnly, SameSite cookie valid for 24 hours; sessions end on bridge restart. The bridge checks browser origins before forwarding authenticated requests to localhost. Provider credentials remain on the Mac.

This is a temporary bridge, not independent remote hosting: the studio, bridge, tunnel, and Mac must stay running. A new quick tunnel may have a different URL. The public screening site's entry redirect must be updated when that happens. The original published screenings remain at `/screening.html`. In the studio, **Film downloads / הורדות הסרטים** opens the current film's delivery panel.

Add provider keys through **Models & settings**. On macOS they are saved in the **Frameforge Studio** item in your Keychain, so they survive restart and never enter the film database, exports, browser storage, Git, or the UI response. The screen lists a provider label, environment-variable name, and configuration state; it never returns the secret value. Existing environment variables such as `FAL_KEY` still work, including a local `.env` file, but new keys are saved to Keychain instead. A configured key has not necessarily been validated by a provider; the first paid request validates access. Nothing generates or spends money automatically.

On macOS, local startup also prepares a private Node certificate bundle from the system keychain and the public Google Trust Services roots at `pki.goog`. This solves a known Node certificate-chain issue affecting Fal on some Macs. The generated `studio-data/macos-certificates.pem` contains public certificates only, is ignored by Git, and is not part of any film or export.

### Credentials and future remote deployment

The credential layer uses environment-variable names, so provider adapters can depend on a stable name without knowing where the secret came from. FAL currently consumes `FAL_KEY`; adding a new provider adapter can consume its own name, such as `OPENAI_API_KEY` or `RUNWAY_API_KEY`.

For a remote server, set `FRAMEFORGE_DEPLOYMENT_MODE=remote`, set a comma-separated allowlist of browser origins in `FRAMEFORGE_TRUSTED_ORIGINS`, and add each provider secret in the hosting platform’s secret manager. Put their variable names in `FRAMEFORGE_CREDENTIALS`, for example `FAL_KEY,OPENAI_API_KEY,RUNWAY_API_KEY`. The remote settings screen becomes read-only and reports whether each variable is configured. This prevents a browser user from writing deployment secrets into SQLite or the server filesystem. Remote hosting still needs authentication and a persistent volume/object store before it should be exposed to collaborators.

## A complete production workflow

### Guided AI creation (Hebrew and English)

The studio opens on **Guided creation / יצירה מודרכת**. Its eight stages are story, screenplay and characters, shot planning for one scene, keyframes, dialogue, motion and lip-sync, effects/music, and the connected cut with captions.

- Write a brief, choose a writing model, preview its request and confirm the Fal charge. Writing uses `fal-ai/any-llm` with Gemini 2.5 Flash, Claude Sonnet 4.5, or GPT-5 mini. No additional provider key is required.
- Read the resulting draft, edit its fields, save feedback, or ask AI for a revised draft. Every AI/manual revision has its own record and parent. Approval applies the text to the film; it never launches the next generation. Planning is limited to 12 scenes per screenplay and 12 shots for one selected scene per request, so large films should be developed in bounded portions.
- Select a scene and shot, then use the task-specific buttons. Each opens a prefilled, editable request with a cost confirmation. The guided motion stage requires a currently approved keyframe; lip-sync requires currently approved video and dialogue from that shot.
- Hebrew dialogue uses Eleven v3 with `language_code: he`, a chosen voice and exact spoken text. Speaker names and stage directions remain outside the spoken text. Generate one speaker's line at a time and listen before syncing. Kling 2.6's native dialogue is offered for English/Chinese; use separate speech for Hebrew. Sync uses `cut_off`, so review both input durations first.
- Music and effects are separate versions and mixer tracks. Adding an approved audio take places it at that shot's start; adjust timing and gain in Sound studio. A lip-sync/native-audio video already carries sound, so avoid duplicating the same dialogue in the mixer.
- Review media with timecoded/spatial notes, quick feedback suggestions, and **Save & correct this take**. Image corrections use the reference-edit adapter; previous media and edit choices are retained. QC is filmmaker review, not an automatic AI quality verdict.
- Add precise Hebrew/English captions with shot-relative timecodes. UTF-8 SRT downloads follow the current cut order, and each new rendered export freezes its own SRT alongside MP4/JSON/CSV. Starting captions from dialogue gives rough whole-shot timing that must be reviewed. SRT is a sidecar, not burned into MP4; titles/signs inside the picture still need compositing in an editor.

Writing requests, raw outputs (including invalid/truncated responses), approvals, feedback, and manual revisions live in the production record. Queued text jobs resume polling after restart. An ambiguous submission requires reconciliation with its Fal request ID rather than automatic resubmission. Source changes prevent stale drafts from being applied over newer direction. Record actual writing charges in each draft's billing section; these are included in the displayed spend and known-cost media budget checks. Unknown token pricing still needs explicit confirmation and cannot guarantee a hard spending cap.

Implementation sources: [Fal text model API](https://fal.ai/models/fal-ai/any-llm/api), [Fal Eleven v3 API](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api), [ElevenLabs language support](https://elevenlabs.io/docs/overview/models), [Sync Lip-sync 2 API](https://fal.ai/models/fal-ai/sync-lipsync/v2/api).

### Production tools

1. **Create a production.** Each film has separate scenes, shots, bible definitions, media versions, tracks, and decisions.
2. **Develop the story.** Save the logline and screenplay. Add scene headings and story beats. Previous saved text remains in the production record.
3. **Define the world.** Add character identities, locations, props, voices, and style rules. Import source media, attach references to bible entries, and lock canonical definitions.
4. **Plan each shot.** Link bible entries. Specify action, camera, lens, lighting, duration, dialogue, and continuity requirements.
5. **Create picture.** Generate a storyboard or keyframe with FLUX.2, or use FLUX.2 Edit to consume up to four image references. Animate a frame with Kling, with native sound on or off. Import existing media as additional versions.
6. **Review the take.** Inspect the original media, compare versions, complete each quality category, and add corrections with timecodes and normalized frame coordinates. No automatic visual, audio, or lip-sync judgment is claimed. Approvals require all categories to pass or be explicitly N/A, with notes resolved.
7. **Revise precisely.** Generate from a specific version and its correction notes. The parent version, original prompt, compiled prompt, canonical reference snapshot, model request, and cost remain in the record.
8. **Choose the cut.** Select a picture version for each shot. Reorder shots and adjust in-points and duration. A replacement preserves the rest of the edit. Rejecting a selected version removes it from the cut; it never deletes the original.
9. **Build sound.** Generate or import dialogue, music, and effects. Use consistent ElevenLabs voices. Run Sync Lip-sync with a video and an audio reference, or add independent audio tracks at timeline offsets with gain controls.
10. **Deliver.** Render a working cut / animatic, or an approved final film. Final delivery requires approved reviewed videos, valid trims, approved active audio, and no unresolved readiness warnings. Export uses H.264, AAC stereo, the selected aspect ratio, and frame rate. Every render keeps a frozen production JSON and CSV edit list.

## FAL adapters

| Adapter                  | Purpose                                         | Reference input              |
| ------------------------ | ----------------------------------------------- | ---------------------------- |
| FLUX.2                   | Storyboards and keyframes                       | Text only                    |
| FLUX.2 Edit              | Identity references and precise image revisions | 1–4 images                   |
| Kling 2.6 image-to-video | Animate picture; optional native sound          | Start and optional end image |
| Kling 2.6 text-to-video  | Motion exploration; optional native sound       | Text only                    |
| Seedance 2.5 image-to-video | Continuation with native sound, 4–30 seconds | Start and optional end image |
| Seedance 2.5 text-to-video | Original motion with native sound, 4–30 seconds | Text only |
| Seedance 2.0 Mini text/reference-to-video | Fast lower-cost exploration or up to nine image references, native sound, 4–15 seconds | Text or image references |
| ElevenLabs v3            | Speech and voice performances                   | Voice name / ID              |
| Stable Audio 2.5         | Music, ambience, and effects                    | Text                         |
| Sync Lip-sync 2          | Apply separate dialogue to picture              | One video + one audio        |

Model definitions and request mapping are in `server/models.mjs`. The FAL provider factory is isolated in `server/generation.mjs`; additional provider factories can be introduced without changing the film's source records. Adding a vendor also requires its task-specific input mapping, queue lifecycle, output archiver, and credential configuration. Arbitrary endpoints are deliberately not submitted without an adapter.

The Generator ranks compatible models for the current task, references, and native-audio requirement. The recommendation is a convenience only; the filmmaker can choose any compatible adapter. Seedance Mini pricing is left unknown until confirmed in the Fal account, so its request always requires explicit cost acknowledgement.

Published cost estimates are dated September 6, 2026. FLUX and Sync requests require acknowledgement of unverified pricing. Budget checks use known estimates or manually recorded actual costs; unknown-price requests cannot be fully budget-enforced. Record actual FAL charges in an asset's review panel. FAL billing is authoritative.

## Storage and recovery

Everything lives inside `studio-data/` by default:

- `production.sqlite`: films, version provenance, reviews, accounting, and append-only application events. It contains no provider secret values.
- `media/`: archived original media with SHA-256 hashes; imports and completed generations are retained.
- `exports/`: render snapshots, edit lists, intermediate picture, and final MP4 files.

The data directory can be moved using `FRAMEFORGE_DATA_DIR` in `.env`. It is independent of source code and ignored by Git. `.env` is also ignored. Keychain credential metadata is stored separately in `credential-bindings.json` with owner-only file permissions; it records labels and variable names, not keys. Lint covers application-owned code; unmodified scaffold components are excluded. Source media uses native image/video elements to retain original fidelity. Automatic captions and the React compiler are not enabled.

The new app does not migrate or change the surrounding workspace's existing films.

Run `npm run backup` to create a consistent SQLite snapshot and copy its referenced assets and completed exports into `backups/`. Copy that backup to another disk for disaster recovery. To restore, stop the app, keep the current data folder as a fallback, and copy the backup into the configured data directory. API keys are excluded: Keychain credentials must be added again on another Mac. A production JSON download preserves metadata; it is **not** a backup of the original media files.

Queue requests are saved before submission. Polling resumes after restart. An interrupted/ambiguous submission becomes `submission_unknown`; use the FAL dashboard request ID in the version card to recover it without resubmitting. Do not blindly regenerate an unknown request. Completed outputs are archived before they become reviewable. Failed exports retain their snapshot and can be rerun.

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run lint
```

The 32 automated tests exercise real SQLite persistence, film isolation, source imports, review gates, correction-note preservation, bible invalidation, reference mapping, cost recording, generation idempotency, submission reconciliation, shot replacement, and actual FFmpeg rendering. Provider submission tests use mocks and make no paid calls.

## Current boundaries

This is a single-user local application, bound to loopback. It is not deployed online and does not provide multi-user authentication, collaborative conflict resolution, or a cloud rendering farm. It uses the Sites UI scaffold with a Node/SQLite/FFmpeg runtime because local originals and full video export are central to this version.

- Continuity checking combines canonical prompt/reference snapshots, readiness rules, and a human quality gate. It does not automatically detect anatomical errors, visual glitches, acting quality, or lip-sync failures.
- Guided creation uses an AI writing model through FAL for staged story, screenplay, and shot drafts. Drafts require explicit review and approval before entering production.
- Cut editing supports ordered shots, source in-points, durations, hard cuts, and layered audio. It is not a full NLE: no transitions, retiming, grading, subtitle burn-in, or arbitrary multi-track picture editing.
- Separate-audio preview uses browser playback and clamps preview gain to 1×. FFmpeg export applies the specified gain (up to 3×), mixes active tracks, and peak-limits the result. Export is authoritative for synchronization and sound.
- Assets are limited to 250 MB per import/output. The library currently registers one output per request; make separate generations for separate versions.
- Visual references are consumed only by compatible adapters. Text-to-image/video models cannot guarantee identity from references they do not accept. Review remains essential.
- Live production requests have been exercised through the portal. Model availability and provider acceptance remain external constraints; a schema-valid request can still fail provider output review. Estimated costs are not confirmed charges.
- A read-only WebMCP film tool is feature-detected. No supported WebMCP validation context was available, so that optional integration is unverified.

## Sources and open source

The application uses React, Vinext/Vite, shadcn/Base UI, Lucide, SQLite, the official FAL JavaScript SDK, and local FFmpeg. Their respective licenses apply. Review your FFmpeg distribution's licensing for redistribution.

Adapter schemas: [FLUX.2](https://fal.ai/models/fal-ai/flux-2/api), [FLUX.2 Edit](https://fal.ai/models/fal-ai/flux-2/edit/api), [Kling image-to-video](https://fal.ai/models/fal-ai/kling-video/v2.6/pro/image-to-video/api), [Kling text-to-video](https://fal.ai/models/fal-ai/kling-video/v2.6/pro/text-to-video/api), [ElevenLabs v3](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api), [Stable Audio](https://fal.ai/models/fal-ai/stable-audio-25/text-to-audio/api), [Sync Lip-sync](https://fal.ai/models/fal-ai/sync-lipsync/v2/api).

### Playback and continuity implementation notes (September 7, 2026)

The connected cut now follows native video `currentTime`, pausing timeline progress during loading. It no longer repeatedly seeks video to catch a wall clock. Separate audio waits while picture buffers. This follows the buffering/clock design discussed in [Remotion’s Player guide](https://www.remotion.dev/docs/player/buffer-state) and [media playback source](https://github.com/remotion-dev/remotion/blob/main/packages/core/src/use-media-playback.ts). Remotion was studied, not installed or copied; the player uses native HTML media. FFmpeg remains responsible for the exported, unified MP4.

The video review panel can save the current frame or end frame as a new image version using FFmpeg. It preserves the source video ID, frame time, and provenance, and does not approve or select that image automatically. Select this extracted image as the next shot’s start reference in a compatible image-to-video adapter. This improves continuity but still requires inspection of the generated transition.

Seedance adapters use [Fal’s text-to-video schema](https://fal.ai/models/bytedance/seedance-2.5/text-to-video/api) and [image-to-video schema](https://fal.ai/models/bytedance/seedance-2.5/image-to-video/api). Duration, resolution, reference count, and estimated price are model-specific. Provider validation errors preserve the actionable message without echoing the full provider input into the error display.
