# {{projectName}} — YouTube Infotainment Agency

An agent studio for **science-explainer YouTube videos** in the Kurzgesagt / Veritasium style. A showrunner
drives eleven specialised agents through the whole production, a critic scores every stage against a
rubric, and a person approves the topic, script, storyboard and final cut.

**1** topic & framing → **2** research & fact-check → **3** script → **4** storyboard → **5** animation →
**6** narration, score & SFX → **7** packaging → **8** publishing, sources & follow-up → learnings → 1

- **Visuals are code-rendered**: [HyperFrames](https://github.com/heygen-com/hyperframes) HTML + GSAP scenes
  built from a house kit (`kit/`), so diagrams and numbers stay exact. Generative b-roll is supported but
  capped and off by default.
- **Narration, music and SFX** come from ElevenLabs (Eleven v4). The sound-editor casts a narrator for each
  episode from the ElevenLabs Voice Library, writes pauses into the script and measures them.
- **Every fact is traceable**: claims are verified by an independent fact-checker before a script, scene or
  description may use them; each video ships a sources page.
- **Deterministic plumbing**: the `yt` CLI (`pipeline/`, TypeScript on bun) owns the episode state machine,
  validation, timing, render, mix (−14 LUFS), QA, packaging and YouTube upload.

Demo — an episode made end to end by these agents (83 s):
https://github.com/ArtemShatokhin/kortix-YT-infotainment/blob/main/docs/demo/ep001-why-we-dont-feel-earth-spin.mp4

## Agents
| Agent | Stage |
|---|---|
| `showrunner` (default) | runs the loop, dispatches stages, owns the human gates |
| `topic-scout` | finds and frames topics |
| `researcher`, `fact-checker` | builds the dossier; independently verifies every claim |
| `scriptwriter` | beat-by-beat script, every fact citing a verified claim |
| `art-director`, `animator` | storyboard + style frames; HyperFrames scenes |
| `sound-editor` | narrator casting, narration, score, SFX |
| `packager`, `publisher` | title, thumbnail, description, chapters; upload and follow-up |
| `critic` | scores every stage against `rubrics/` |

## Setup
Agents use the project's default Kortix model, so no model key is needed. Set secrets with
`kortix secrets set NAME=-` (never paste keys into chat).

| Secret | Needed for | Required? |
|---|---|---|
| `ELEVENLABS_API_KEY` | narration, music and sound effects. A paid plan (Starter or above allows commercial use) with Text to Speech, Sound Effects, Music and Voices (read, for Voice Library casting) | **yes** |
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` | uploading and analytics. Create the YouTube channel first, and phone-verify it at youtube.com/verify for custom thumbnails. Then make the three values in the browser (Google Cloud + OAuth Playground) by [skills/youtube-publishing/SKILL.md](skills/youtube-publishing/SKILL.md#credentials-one-time-done-by-a-person-in-the-browser) → Credentials; `bin/yt youtube whoami` confirms the channel | to publish |
| `YT_API_KEY` | YouTube search during topic research without the OAuth secrets | no |
| `MEDIA_S3_ENDPOINT`, `MEDIA_S3_BUCKET`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`, `MEDIA_S3_PREFIX` | S3-compatible storage (e.g. Cloudflare R2) so narration, music and renders survive between sessions. Without it an episode must finish in the session that started it | no |
| `FAL_KEY` | generative b-roll, off by default (`channel.yaml → broll.enabled`) | no |

Then:
1. **Sandbox.** Every agent runs in the `video` template (`Dockerfile.video`: ffmpeg, Chromium, bun,
   HyperFrames), 6 vCPU / 12 GB.
2. **HyperFrames skills.** The setup session downloads the eight skills the art-director and animator use
   (`scripts/sync-hyperframes-skills.sh`, see `install.md`) and opens a change request; approve it before
   the first episode.
3. **Your channel.** "Mote" is an example channel and mascot: edit `channel/` (brand, design, audio,
   `channel.yaml`) and `episodes/backlog.md`. The `rates` in `channel.yaml` are cost estimates for the
   spend ledger; check them against your plans.
4. **Start an episode:** `kortix sessions new --agent showrunner -p "Start a new episode from the top of
   episodes/backlog.md"`, then review the gates in the Kortix review inbox. Triggers ship disabled.

Try the pipeline offline first: `cd pipeline && bun install && bun test`, then `bin/yt smoke` renders a
22-second QA'd episode with stub voice and music.

## Known limits
- The default Kortix models can't see images or hear audio: the critic checks visuals by measurement and
  OCR and narration with `yt voice report`, not by eye or ear. An audio/vision-capable reviewer would help.
- Nothing is published without a human approving the final gate, and uploads start private.
