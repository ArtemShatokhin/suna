# Rubrics — the quality bar, written down

The critic scores every stage output against the matching rubric and writes
`episodes/<slug>/qa/<stage>-review.json` (schema: `Review` in `pipeline/src/schemas.ts`).

- Each criterion is scored **1–5** using the anchors (1 = amateur, 3 = solid YouTube, 5 = Kurzgesagt /
  Veritasium level). Score what is on the page, not what was intended.
- `overall` = mean of criteria. `pass` = overall ≥ `channel.yaml → critic.pass_threshold` (4.0) **and**
  no auto-fail **and** no `blocker` issue.
- Every score below 4 needs at least one issue with a concrete, actionable `fix`.
- Auto-fails are listed per rubric; any one fails the review regardless of scores.

| stage | rubric |
|---|---|
| topic | [topic.md](topic.md) |
| research | [research.md](research.md) |
| script | [script.md](script.md) |
| storyboard | [storyboard.md](storyboard.md) |
| scenes (each scene) | [scene.md](scene.md) |
| render (final cut) | [final-cut.md](final-cut.md) |
| package | [packaging.md](packaging.md) |

Rubrics evolve: when a human rejects something the critic passed, the harness-reflector proposes a
rubric change so the critic catches it next time.
