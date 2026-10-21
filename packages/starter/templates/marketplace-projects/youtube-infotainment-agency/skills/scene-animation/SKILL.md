---
name: scene-animation
description: Build storyboard scenes as HyperFrames compositions with the house kit, locked to narration cues, and get each through `yt scene check` and critic review. Load for stage 5 animation, style frames, thumbnails, or any edit to 05-scenes/*.html.
---

# Scene animation (stage 5)

Each scene is a standalone HyperFrames composition: `episodes/<slug>/05-scenes/<scene>.html`.
The HyperFrames skills (`hyperframes`, `hyperframes-core`, `hyperframes-animation`,
`hyperframes-keyframes`, `hyperframes-registry`) are the framework reference — load
`hyperframes-core` before writing your first scene in a session. This skill is the house layer on top.

## Worked examples — read them first
`pipeline/test/fixtures/episode/05-scenes/sc01.html` (question card), `sc02.html` (mechanism diagram
with wipe), `sc03.html` (the number + Mote). They show every convention below.

## Workflow per scene
```bash
bin/yt scene scaffold <slug> <scene>      # creates 05-scenes/<scene>.html with CUES + exact duration
# … build the scene …
bin/yt scene check <slug> <scene>         # lint + runtime + layout + contrast + duration + snapshots (~17 s)
bin/yt scene snap <slug> <scene> --at 4.2,6.8   # just those moments (~7 s)
```
Then **look at** `qa/scenes/<scene>-contact.jpg` yourself before asking for review; open a single PNG
beside it only for a detail the sheet can't show (every image you open stays in your context and slows
each later step). While you fix, check the moments you changed with `bin/yt scene snap`; run the full
`bin/yt scene check` again once the scene looks done (it must pass before you report). In one test episode
six animators ran the full check 115 times between them. Judge by eye: no frame dumps, frozen-frame sweeps or pixel counts. The critic reviews it
against `rubrics/scene.md`, as a viewer would watch it.

## Conventions (the kit contract)
- Keep the scaffold's head: `kit/kit.css`, `kit/vendor/gsap.min.js`, `kit/kit.js`. No CDN links, no
  network, no `Math.random()`/`Date` (use `Kit.rng(seed)`).
- Root: `<div id="scene-root" class="k-stage …" data-composition-id="<scene>" data-duration="…">`.
  Don't edit `data-duration` or the `@cues` block by hand — `bin/yt scene retime` owns them.
- Timeline: `const tl = Kit.scene("<scene>", CUES.duration); window.__timelines["<scene>"] = tl;`
- **Sync every entrance to the voice**: `Kit.cue(CUES, "b07", "molecules", -0.2)` returns the scene
  time of that word (−0.2 s lead reads as "on the word"). Never hard-code times for narrated events.
- Helpers: `Kit.pop`, `Kit.fadeUp`, `Kit.fadeOut`, `Kit.drawOn` (SVG strokes), `Kit.typeOn`,
  `Kit.countUp`, `Kit.float`, `Kit.blink`, `Kit.camera` (world moves), `Kit.wipe`, `Kit.stars`,
  `Kit.mascot({mood,size})`, `Kit.mount`. Read `kit/kit.js` for signatures.
- Styling: palette variables only (`var(--sky)` …), type classes (`k-title`, `k-h2`, `k-label`,
  `k-stat`, `k-small`), components (`k-card`, `k-chip`, `k-callout`, `k-lower-third`, `k-line`).
  Text on light backgrounds uses `--sky-deep`/`--ink` for contrast.
- Finish: `.k-grain` on every scene; `.k-vignette` on dark scenes.
- Scene-specific assets (SVG, images, b-roll) go in `episodes/<slug>/media/scenes/<scene>/` and are
  referenced as `assets/<file>`.
- Prefer inline SVG for illustration: crisp at any zoom, animatable parts, tiny files.
- `transition_in: wipe` → put `<div class="k-wipe"></div>` last in the stage and `Kit.wipe(tl, el, 0)`.

## Craft checklist (what the critic looks for)
- One focal point per moment; clear the stage before the next idea.
- Text appears on (or just before) its word and stays ≥ 0.35 s × words + 0.6 s.
- Overlap and follow-through: stagger related elements (0.05–0.12 s), ease out on entry.
- No dead holds: the picture never sits still for more than 2 s while the narration moves on. A short
  still beat while the viewer reads is fine.
- Labels sit next to what they label; arrows/lines `k-line`; nothing touches the frame edge.
- Scale and data are honest; precise figures match claims.json.

## After a voice change
`bin/yt scene retime <slug>` rewrites CUES/durations in every scene, then re-run `bin/yt scene check`
for each scene. Because entrances use `Kit.cue`, most scenes need no edits.

## Optional: generative b-roll scenes
Only when `channel.yaml → broll.enabled` and the storyboard marks the scene `genbroll`:
`bin/yt broll gen <slug> <scene>` writes `media/scenes/<scene>/broll.mp4`; mount it with
`<video src="assets/broll.mp4" muted data-start="0" data-duration="…">` and keep house-style
overlays (grain, labels) on top.
