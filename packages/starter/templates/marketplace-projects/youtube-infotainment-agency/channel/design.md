# Channel bible — visual design

The house style is **flat-vector illustration with purposeful motion**, built in code (HyperFrames +
`kit/`). Tokens live in `kit/kit.css`; this page says how to use them. The animator and critic both
read it.

## Palette (colour carries meaning)
| token | hex | meaning |
|---|---|---|
| `--ink` | #0e1b3d | night / space / the unknown — default background |
| `--deep` / `--dusk` | #162a5c / #24407f | panels, far layers, depth |
| `--sky` (`--sky-deep` on light bg) | #3fa7f5 / #1554b8 | the main subject, "science blue", light |
| `--mint` | #3fe0b0 | life, growth, correct answers |
| `--sun` | #ffc94a | energy, heat sources, Mote, the payoff number |
| `--coral` | #ff6b5e | danger, heat, **the misconception** |
| `--violet` | #8e6cf0 | the invisible: fields, quantum, probabilities |
| `--paper` / `--muted` | #f6f1e7 / #9fb0d6 | text and line art / secondary text |

Rules: at most 3 accent colours per shot; the same concept keeps the same colour for the whole video;
never encode meaning in colour alone (label it too). Text must pass WCAG 3:1 for large text
(`yt scene check` enforces contrast).

## Typography
- Display: **Fredoka** (rounded, friendly) for titles, labels, numbers. Body: **Inter** for small text.
- Scale: title 104, h2 72, label 38, small 28, stat 180 px (classes in kit.css).
- ≤ 7 words of on-screen text per idea; on screen at least `0.35 s × words + 0.6 s`.
- Text lives inside the safe area: 120 px sides, 90 px top/bottom.

## Illustration
- Flat shapes, rounded corners, 2-tone shading (base + one darker shade, offset highlight), 6 px
  line art in `--paper`. No photoreal textures, no lens flares, no stock-AI gloss.
- Print grain (`.k-grain`) and vignette (`.k-vignette`) on every scene for the "illustrated" finish.
- Scale honesty: when sizes or quantities are compared, draw them to scale or say "not to scale".

## Motion principles
1. **Every movement is on a cue.** Entrances hit narration words via `Kit.cue(CUES, beat, word)`.
   Nothing moves just because.
2. One idea per moment. Bring elements in, let them be read, then clear the stage.
3. Easing vocabulary: entrances `power3.out` / `back.out(1.8)` for pops; exits `power2.in`; camera
   `power2.inOut`; continuous drift `none` or `sine.inOut`. No linear entrances.
4. Life in every frame: something subtle always moves (drifting clouds, floating Mote, twinkling
   stars), but it must not compete with the subject.
5. Camera moves (`Kit.camera`) signal changes of scale or focus — zoom in to go small, out to go big.
6. Transitions: `cut` by default; `wipe` for a new chapter; `zoom` for scale journeys; `match` when two
   scenes share a shape. Never use a transition just to fill time.

## Scene archetypes (pick, then make it specific)
- **Question card** — the cold-open question over an evocative world shot.
- **Mechanism diagram** — the process drawn on step by step, labels on cue.
- **Scale journey** — camera zoom through orders of magnitude with a ruler/units.
- **The number** — one big stat counting up, with a tangible comparison.
- **Comparison** — two things side by side, same scale, one variable changed.
- **Timeline / map** — history or geography, revealed left-to-right / place-by-place.
- **Analogy world** — the abstract idea re-cast as a toy world (marbles, roads, crowds), then mapped
  back explicitly to the real thing.
- **Misconception shot** — the wrong model drawn in `--coral`, then visibly corrected.

## Don't
- No walls of text, bullet lists or slides. If it reads like PowerPoint, redraw it.
- No clip-art icons with no relationship to the narration.
- No generative b-roll for anything factual (diagrams, data, maps, real people, real events).
- No identical scene templates across episodes; reuse components, not compositions.
