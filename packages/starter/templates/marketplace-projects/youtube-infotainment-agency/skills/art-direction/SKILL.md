---
name: art-direction
description: Turn a locked script + timing into a storyboard of scenes (storyboard.json) with visual concepts, archetypes, cue-word motion plans, SFX and style frames. Load for stage 4 visual concepting, or when re-planning scenes after a script change.
---

# Art direction (stage 4)

You decide what the viewer **sees**. The bar: a muted viewer should still follow the idea. Read
`channel/design.md` (palette meanings, archetypes, motion rules) and `channel/brand.md` first.

## Inputs
`03-script/script.json` (visual intents), `03-script/timing.json` (locked narration timing — scene
lengths come from it), `02-research/dossier.md` (visual leads), `bin/yt scene list <slug>` after a
first draft to see real durations.

## Plan scenes
- A scene covers **one or more consecutive beats** with one visual idea. Every beat is covered exactly
  once, in order (the CLI enforces this).
- Typical scene: 4–20 s. Over ~25 s, plan internal progression (camera moves, staged reveals) — the
  validator warns at 45 s. Under 2 s only for deliberate punches.
- Pick an archetype per scene (question card, mechanism diagram, scale journey, the number,
  comparison, timeline/map, analogy world, misconception shot) and vary them — wide/close,
  busy/quiet, dark/light — so the film has rhythm.
- Assign colour meanings once and keep them (e.g. the misconception is always coral).
- Recurring motifs: introduce a visual element early and pay it off later (the same molecule, the
  same ruler, Mote's reaction).
- `type`: `title`, `diagram`, `hf-2d` (illustrated scene), `hf-3d` (Three.js in HyperFrames — use
  sparingly), `genbroll` (atmosphere only, needs `broll_prompt`, off unless channel.yaml enables it;
  never for facts; total ≤20 % of runtime).
- `motion` — what moves on which cue words ("sun pops on 'sunlight'; rays draw on 'scattered'").
- `on_screen_text` — exact strings; ≤7 words each; precise figures belong here.
- `sfx` — at most one per meaningful event: `{prompt, beat, at_word, duration, volume}`.
- `transition_in` — cut (default), wipe (new chapter), zoom (scale), match (shared shape), fade.

## Style frames
For the hook, the number/climax, and any novel visual: build a still with HyperFrames (the animator's
kit) or as a quick scene draft, snapshot it, and save PNGs to `04-visual/styleframes/<scene>.png`
(keep each <1 MB; `ffmpeg -i in.png -vf scale=960:-2 out.png`). Reference them in `styleframe`.
Look at them yourself before handing off — would a stranger understand the frame in 2 seconds?

## Output & checks
`04-visual/storyboard.json` (schema `Storyboard`: `style_notes`, `scenes[]`), then:
```bash
bin/yt validate <slug> storyboard     # coverage, durations, b-roll caps
bin/yt broll budget <slug>
```
The storyboard gate shows the human your table and style frames — make `concept` lines vivid.
