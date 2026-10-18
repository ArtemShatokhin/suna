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
1. Add `ELEVENLABS_API_KEY` (a paid ElevenLabs plan: Starter or above allows commercial use):
   `kortix secrets set ELEVENLABS_API_KEY=-`.
2. Optional: YouTube OAuth (`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` via
   `bun scripts/youtube-oauth.ts`) to publish, and `MEDIA_S3_*` (e.g. Cloudflare R2) so media survives
   between sessions. Without object storage an episode must finish in the session that started it.
3. The sessions use the `video` sandbox template (`Dockerfile.video`: ffmpeg, Chromium, bun, HyperFrames).
4. The setup session downloads the eight HyperFrames skills the art-director and animator use
   (`scripts/sync-hyperframes-skills.sh`, see `install.md`) and opens a change request for them;
   approve it before the first episode.
5. Start an episode: `kortix sessions new --agent showrunner -p "Start a new episode from the top of
   episodes/backlog.md"`, then review the gates in the Kortix review inbox.

Try the pipeline offline first: `cd pipeline && bun install && bun test`, then `bin/yt smoke` renders a
22-second QA'd episode with stub voice and music.

## Known limits
- The default Kortix models can't see images or hear audio: the critic checks visuals by measurement and
  OCR and narration with `yt voice report`, not by eye or ear. An audio/vision-capable reviewer would help.
- Nothing is published without a human approving the final gate, and uploads start private.
