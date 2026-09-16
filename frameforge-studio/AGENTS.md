# Frameforge agent workflow

- Use `gpt-5.6-luna` for routine portal navigation, screen reading, state inspection, and focused test work. Reserve stronger reasoning for architecture, difficult debugging, and final creative decisions.
- Perform media generation, review, approval, cut selection, audio mixing, and final export through the Frameforge portal UI. Shell access is for code changes, read-only diagnostics, tests, and service control.
- Read the current film state before starting a paid generation. Never repeat a successful generation merely because a polling or UI update was missed.
- Build films in short, reviewable stages: story, production bible, assets, keyframes, video, dialogue/audio, continuity review, connected cut, export.
- Preserve every version and its provenance. Revise the affected asset and keep prior versions unless the user explicitly asks to delete one.
- For visible dialogue, use one deliberate audio path: verified native dialogue, or silent video plus approved speech and lip-sync. Do not mix an embedded spoken line with a second copy of the same line.
- Review speaking shots for pronunciation, performance, mouth motion, and lip-sync before approval.
- Continue the production loop through a verified downloadable MP4. Validate duration, orientation, video stream, audio stream, continuity, and representative frames.
- Keep the human workflow clear and reversible, with the same actions available to an agent. Prefer explicit labels, previews, progress, undo/redo, and recoverable failures.
- Do not use Sites for this project.
- Follow [the production playbook](docs/AGENT_PRODUCTION_PLAYBOOK.md) for every film. A successful provider job is not evidence that the screenplay action or spoken words appear in the result.
- Before approving a speaking shot, compare the actual audio to the exact approved screenplay line and verify mouth movement against the audio onset. Before approving any video, identify the visible time span of the action promised by the script. If either is absent or uncertain, leave the version in review and revise that asset only.
