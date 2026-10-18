---
name: youtube-publishing
description: Upload an approved episode to YouTube privately with captions, thumbnail and correct disclosure, publish the sources page, and schedule or publish only after the human final gate. Load for stage 8 publication or any change to a live video's metadata.
---

# YouTube publishing (stage 8)

## Preconditions (check, don't assume)
- `bin/yt episode status <slug>` shows the **final gate approved** by a human.
- `qa/final-qa.json` ok; `08-publish/description.txt` and `media/thumbnail.png` exist.
- Credentials: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` in the environment.

## Steps
```bash
bin/yt media push <slug>                         # archive media + final cut (if storage configured)
bin/yt youtube upload <slug>                     # PRIVATE upload + captions (SRT) + thumbnail
```
`upload` writes `08-publish/publish.json` (video id/url) and refuses to upload twice. A 403 on the
thumbnail means the channel isn't verified for custom thumbnails — report it, don't retry.

Sources page: publish `08-publish/sources.md` where `channel.yaml → publish.sources_base_url` points
(e.g. the repo's public mirror or a docs site). Put the final URL in `publish.json → sources_url`,
re-run `bin/yt sources <slug>` if the description should link it, then `bin/yt youtube update <slug>`.

Scheduling — only with an explicit human instruction in the final gate notes or the session:
```bash
bin/yt youtube schedule <slug> --at 2026-11-03T15:00:00Z   # stays private until then
bin/yt youtube schedule <slug> --now                        # public immediately
```

## Compliance (YouTube 2025–26)
- **Altered/synthetic content disclosure**: `contains_synthetic_media` must be true if the video shows
  realistic generated people, places or events. Stylised animation doesn't need it. When in doubt,
  disclose.
- **Inauthentic content** (YPP): each video must be substantively original — the research, script
  and visuals are episode-specific. Never batch-publish near-duplicates; keep ≥ several days between
  uploads.
- No AI likeness of real people; no misleading metadata.

## After publishing
Commit `publish.json` and push the episode branch; the episode CR can now be merged by a human.
