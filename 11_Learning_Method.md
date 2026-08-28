# Learning Method

Date started: 2026-08-28

Purpose: define how we learn from reference films, creators, papers, and our own experiments without copying creative content.

## Goal

Extract reusable production methodology for high-end cinematic AI film.

We study:

- what creators did,
- why it worked,
- how they preserved consistency,
- where AI failed,
- how editing and sound solved problems,
- how to reproduce the method with current tools.

We do not copy:

- plot,
- characters,
- world,
- vehicles,
- locations,
- dialogue,
- distinctive visual designs.

## Learning Loop

```text
Observe
-> classify evidence
-> extract technique
-> convert to production rule
-> design test
-> run only with approval if paid
-> review result
-> update bible/database
```

## Evidence Levels

| Level | Meaning | Can It Drive Decisions? |
| --- | --- | --- |
| Confirmed | Direct source, creator statement, official docs, or visible frame/audio evidence | Yes |
| Strong inference | Repeated credible evidence or highly likely visual/technical pattern | Yes, but mark confidence |
| Speculation | Plausible but unverified | Only as a test hypothesis |

## Reference Film Analysis Method

For each reference clip:

1. Identify source and quality.
2. Extract contact sheets.
3. Break into shot groups.
4. Analyze composition, camera, light, motion, VFX, artifacts, sound, and editing.
5. Identify continuity anchors.
6. Infer likely generation method with confidence label.
7. Extract reusable production lesson.
8. Add lesson to Research Log, Consistency Rules, or Shot Database.

## Creator Workflow Research Method

For each creator/case study:

| Question | Why |
| --- | --- |
| What tools did they confirm using? | Avoid guessing workflow from output. |
| Did they use references or text-only prompts? | Determines consistency strategy. |
| Did they use first/last-frame or keyframes? | Determines controllability. |
| How long were generated clips? | Helps plan edit rhythm and cost. |
| How much was solved in post? | Prevents over-crediting the video model. |
| What failed? | Failed attempts save us money. |
| What was the cost/time? | Helps build a realistic production plan. |

## Research Paper Method

For each technical paper:

1. Record the problem it addresses.
2. Extract the principle, not only the algorithm.
3. Translate it to a practical production rule.
4. Note whether the method is available in consumer/API tools today.
5. If not available, turn it into a prompt/reference/editing workaround.

Example:

| Paper Principle | Production Translation |
| --- | --- |
| Identity-aware memory improves long video consistency | Use persistent IDs, reference packs, and continuity logs. |
| First frame acts as an anchor | Use approved keyframes before video generation. |
| Motion control improves coherence | Separate camera motion, subject motion, and environment motion. |

## Experiment Method

Every paid or unpaid generation test must record:

- `TEST_ID`,
- `SHOT_ID`,
- model/provider,
- prompt,
- references,
- settings,
- duration,
- resolution,
- estimated cost,
- actual cost when available,
- result,
- problems,
- decision,
- next fix.

## Cost Discipline

No paid generation without explicit approval from Ben.

Default sequence:

```text
draft payload
-> dry-run validation
-> estimate
-> Ben approval
-> one generation
-> review
-> decide next move
```

No blind batches.

## First Learning Sprint

Sprint goal: understand the Red Alert-style methodology deeply enough to design our own original pipeline.

Tasks:

1. Finish shot grouping for uploaded 2:11 reference clip.
2. Extract the top 10 production lessons from that clip. - Completed in `12_Red_Alert_Clip_Top_10_Production_Lessons.md`.
3. Research 5-8 strong creator/case-study workflows. - Started in `13_Creator_Workflow_Case_Studies.md`.
4. Research 5-8 technical papers on consistency/control.
5. Build a model-routing test matrix for Fal without running paid generation.
6. Define the first safe visual test: one still keyframe, no paid video unless approved.

## Output Of Each Sprint

Each sprint should produce:

- new research sources,
- updated production rules,
- updated model-routing assumptions,
- experiment candidates,
- unresolved questions,
- next recommended action.
