# Frameforge handoff

## Current production

- Film: `שנה מתוקה, דרמה עסיסית — ראש השנה`
- Film ID: `2a26f6e2-a9de-473a-82d8-ba837e6eddb2`
- Format: vertical 9:16, 24 fps, six five-second shots
- Final approved export: `studio-data/exports/b156f95e-7fb3-4f62-a396-bf1beab30fd5/film.mp4`
- Portal download route: `/api/exports/b156f95e-7fb3-4f62-a396-bf1beab30fd5/film.mp4`
- Verified output: 30.02 seconds, 1080×1920 H.264 video, stereo 48 kHz AAC audio

The first four selected shots use full-length Sync lip-sync versions. Their separate dialogue tracks are muted in the connected mix to prevent doubled speech. SH005 keeps its native effect audio. SH006 uses the corrected four-character video and the approved final greeting track.

SH001 now says exactly `נו... איך אני נראית?`. SH002 now shows the apple run, brake, and skid toward honey. The earlier export above is superseded. Media and production database live in `studio-data/` and are not part of the GitHub code snapshot; use the archive/backup workflow to move an actual film to another machine.

## Completed workflow fixes

- Connected-cut original-audio mute state persists and is respected by export.
- Audio versions keep their intended dialogue, music, ambience, or effects role when added to the cut.
- Lip-sync models accept singular video and audio reference inputs.
- Sync lip-sync defaults to `silence` padding so short dialogue does not shorten a five-second picture.
- Revision dialogs infer the workflow task from the selected model, preventing image-only models from appearing in video/lip-sync revision flows.
- Final delivery waits for current continuity checks and produces a direct MP4 download with production records.
- The portal pre-fills approved screenplay dialogue when revising a voice take and warns on any mismatch. Review and final export reject generated speech or lip-sync whose source text disagrees with the approved screenplay. Video approval requires an explicit pass for the scripted visible action. The connected cut shows the action and exact line beside each selected take.

See `AGENTS.md` and `docs/AGENT_PRODUCTION_PLAYBOOK.md` for the required low-cost agent workflow and production rules.
