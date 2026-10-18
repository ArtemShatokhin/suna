# Rubric — animated scene (`05-scenes/<id>.html`, judged on `qa/scenes/<id>-contact.jpg` + check)

| criterion | 1 | 3 | 5 |
|---|---|---|---|
| `readability` | Cluttered, tiny text | Clear | Instantly readable at phone size; one focal point per moment; text inside safe area |
| `explanation` | Decorative | Illustrates the narration | The visual *carries* the explanation; a muted viewer would still get the idea |
| `sync` | Motion ignores voice | Roughly aligned | Key motions land on cue words (Kit.cue); nothing important appears after it's mentioned |
| `motion_quality` | Linear, janky, static | Smooth | Purposeful easing, overlap and follow-through; subtle life in every frame; no dead holds |
| `craft` | Off-palette, misaligned | Clean | Polished flat-vector finish: consistent line weights, shading, grain/vignette, spacing |
| `accuracy` | Wrong diagram/data | Correct | Correct and honest (scale, units, labels); simplifications flagged |

Auto-fail: `yt scene check` not ok (lint/runtime/layout/contrast errors, duration mismatch); text
clipped or overlapping; a factual visual that contradicts claims.json.
