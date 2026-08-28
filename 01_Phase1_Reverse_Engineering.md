# Phase 1 - Reverse Engineering

## Objective

Analyze the reference AI film as a production-method case study. The goal is to extract a reusable AI cinematic production pipeline, not to reproduce Red Alert 2 or its creative content.

## Material Needed

Primary material:

- Full video file of the reference film at the best available quality.
- Original source link if available.
- All repost links and captions, especially ones naming the creator, title, tools, or production process.
- Any comments/interviews/posts by lyxw1327 about workflow.

Optional material:

- Screenshots from key shots that impressed you.
- Any examples of AI films you feel are close in quality.
- Your notes on what specifically feels cinematic: pacing, camera, realism, nostalgia, character continuity, sound, or scale.

## Analysis Method

1. Source verification
   - Identify original upload if possible.
   - Record all reposts and captions.
   - Separate source evidence from social-media assumptions.

2. Technical video prep
   - Save a local analysis copy.
   - Extract frames at shot boundaries.
   - Generate low-resolution contact sheets for fast review.
   - Detect scene/shot cuts, then manually correct.

3. Shot-by-shot analysis
   - Assign IDs: REF_SCENE_### and REF_SHOT_###.
   - Record duration, composition, shot size, camera angle, camera motion, lens/look, lighting, environment, objects, character motion, transitions, visual effects, audio, and apparent AI artifacts.

4. Consistency analysis
   - Track repeated character designs, uniforms, vehicles, locations, color palette, lighting rules, camera grammar, and editing rhythm.
   - Identify where continuity is preserved by reference images, keyframes, first/last-frame control, repeated prompts, or post-production.

5. Tool/method inference
   - Label each method as confirmed, strong inference, or speculation.
   - Estimate text-to-video vs image-to-video vs keyframe/image sequence workflow.
   - Map visible shot requirements to current 2026 tools.

## Shot Analysis Fields

| Field | Description |
| --- | --- |
| Reference ID | REF_SHOT_### |
| Duration | Timecode start/end and seconds |
| Composition | Framing, staging, foreground/midground/background |
| Shot Size | Extreme wide, wide, medium, close-up, insert, etc. |
| Camera Angle | Eye-level, low, high, aerial, Dutch, POV |
| Camera Movement | Static, dolly, crane, pan, tilt, handheld, tracking |
| Lens/Look | Wide, telephoto, anamorphic feel, depth of field, grain |
| Lighting | Direction, quality, contrast, color temperature |
| Environment | Location, weather, atmosphere, scale |
| Characters/Objects | Who/what appears and continuity notes |
| Motion | Subject motion and world motion |
| Transitions | Cut, match cut, dissolve, whip, screen transition |
| VFX | Explosions, smoke, electricity, aircraft, particles |
| AI Artifacts | Warping, identity drift, object errors, physics issues |
| Consistency Techniques | Likely reuse of references, prompts, keyframes, editing |
| Likely Method | T2V, I2V, keyframe-to-video, compositing, stock/audio edit |
| References | Possible source/reference image or clip type |
| Audio | Sound design, dialogue, music, mix notes |
| Confidence | Confirmed / strong inference / speculation |

## Initial Web Findings

| Finding | Classification | Source |
| --- | --- | --- |
| Multiple reposts credit the AI Red Alert 2 cinematic to lyxw1327 on Douyin. | Strong inference | Instagram and Facebook repost captions; LinkedIn repost text |
| Some reposts describe the creator as Chinese and the film as made by one person with AI. | Strong inference | LinkedIn/Facebook/Instagram repost text |
| Reddit discussions refer to the short as "22 Minutes" and describe a premise: holding out for 22 minutes until reinforcements arrive. | Strong inference | Reddit repost discussions |
| Exact tools used by lyxw1327 are not yet confirmed. | Confirmed absence so far | Initial search did not find a primary workflow post |

## Clip Pass 001 - Uploaded Screen Recording

Material: `ScreenRecording_08-28-2026 20-51-06_1.mp4`

Technical facts:

- Duration: 00:02:11.23.
- Format: iPhone screen recording of an Instagram repost.
- Video: 512x1112 vertical, 30fps, H.264.
- Audio: AAC stereo, 44.1kHz.
- Limitation: the original cinematic frame is embedded inside a social UI, with visible overlays, captions, and right-side engagement buttons. This reduces visual confidence for fine details and makes automatic cut detection unreliable.

Direct visual observations:

- The clip is built from many short cinematic shots rather than one continuous generated scene.
- Dominant palette is cold gray/green, wet black, steel, mud, smoke, and orange fire.
- The setting appears as a war-torn industrial/military battlefield with forests, rail/tracked vehicles, bunkers, tanks, cranes, smoke columns, and storm clouds.
- Recurring continuity anchors include Soviet-style uniforms, red shoulder boards, red stars/hammer-sickle markings, tracked vehicles, muddy ground, smoke, fires, and stormy overcast sky.
- Dialogue is carried heavily by subtitles and radio-style exchanges. Visible English subtitles include lines such as "Radio interference", "What's going on?", "Einstein's Lightning Storm", "Take cover! Quick!", "Run!", "Is anyone still alive?", "K-17, come in", "ETA: 23 minutes", "Hold your position", "K-17, engage the enemy!", "Two tanks!", "Ambush!", "They're here!", "All units, prepare for battle!", and "Switch to armor-piercing rounds!"

Initial method inferences:

- Strong inference: the film was assembled in editing from many short generated clips, likely 2-5 seconds each, rather than generated as a single continuous video.
- Strong inference: visual consistency is achieved through repeated design anchors: limited palette, consistent uniforms, recurring environment motifs, and repeated vehicle silhouettes.
- Strong inference: many shots are better suited to image-to-video or keyframe-driven video than pure text-to-video, especially repeated vehicles, close-up faces, and battlefield geography.
- Speculation: character close-ups may have been generated from stable face references or repeated source images, then animated shot by shot.
- Speculation: vehicles and faction symbols may have used reference images from game units, fan art, 3D renders, or prior generated concept frames.
- Speculation: first/last-frame control may have been used for shots with flashes, impacts, and matching directional movement, but this is not confirmed from the screen recording alone.

Consistency techniques visible in the clip:

- Keep the world narrow: muddy battlefield, gray storm light, smoke, industrial ruins.
- Repeat silhouettes: tracked transports, Soviet tanks, soldiers in dark/olive uniforms, cranes, bunkers.
- Use camera language rather than exposition: wide battlefield shots establish geography, close-ups carry stress, vehicle interiors add urgency.
- Let subtitles stabilize story logic even when generated dialogue or lips are imperfect.
- Use smoke, rain/haze, low contrast, and motion blur to hide generation flaws and unify clips.
- Cut on explosions, flashes, smoke, and movement to make separate clips feel connected.

Immediate next analysis pass:

1. Create a shot boundary table from the 1-second contact sheet.
2. Extract clean representative frames for each likely shot group.
3. Identify repeatable production lessons: reference design, keyframe planning, shot duration, camera language, and post-production glue.
4. Compare these lessons against current 2026 tool capabilities before we design our own film.

## Research Questions Before Original Development

- What is the original Douyin creator profile URL for lyxw1327?
- Is the film title officially "22 Minutes" or is that a repost title?
- Did lyxw1327 publish workflow notes, prompts, tool names, behind-the-scenes clips, or making-of posts?
- Was the film generated as isolated shots, scene sequences, or a full narrative edit from many clips?
- Are character and vehicle designs stabilized through reference images, game captures, 3D renders, LoRA/fine-tuning, image generation, or repeated prompting?
- Which current 2026 tools best match the visible shot types: war scale, vehicles, explosions, human faces, dialogue, cinematic camera, and continuity?
- Which parts were likely solved in post-production: editing, sound design, color grade, subtitles, stabilization, upscaling, and music?
