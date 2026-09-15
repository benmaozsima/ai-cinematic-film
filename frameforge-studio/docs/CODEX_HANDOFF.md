# Frameforge handoff

## Current production

- Film: `שנה מתוקה, דרמה עסיסית — ראש השנה`
- Film ID: `2a26f6e2-a9de-473a-82d8-ba837e6eddb2`
- Format: vertical 9:16, 24 fps, six five-second shots
- Final approved export: `studio-data/exports/0e155975-da42-46a5-882c-f9b1aa66f3b4/film.mp4`
- Portal download route: `/api/exports/0e155975-da42-46a5-882c-f9b1aa66f3b4/film.mp4`
- Verified output: 30.02 seconds, 1080×1920 H.264 video, stereo 48 kHz AAC audio

The first four selected shots use full-length Sync lip-sync versions. Their separate dialogue tracks are muted in the connected mix to prevent doubled speech. SH005 keeps its native effect audio. SH006 uses the corrected four-character video and the approved final greeting track.

## Completed workflow fixes

- Connected-cut original-audio mute state persists and is respected by export.
- Audio versions keep their intended dialogue, music, ambience, or effects role when added to the cut.
- Lip-sync models accept singular video and audio reference inputs.
- Sync lip-sync defaults to `silence` padding so short dialogue does not shorten a five-second picture.
- Revision dialogs infer the workflow task from the selected model, preventing image-only models from appearing in video/lip-sync revision flows.
- Final delivery waits for current continuity checks and produces a direct MP4 download with production records.

See `AGENTS.md` for the required low-cost agent workflow and production rules.
