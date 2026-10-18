# Installing the YouTube Infotainment Agency

Follow these steps in order in the setup session. Step 1 makes the project valid: until it runs,
`kortix.yaml` grants eight HyperFrames skills that are not yet in `skills/`, and `kortix validate`
reports them missing.

1. **Download the HyperFrames skills.** Run `scripts/sync-hyperframes-skills.sh` from the repo root. It
   fetches `hyperframes`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-keyframes`,
   `hyperframes-registry`, `hyperframes-cli`, `hyperframes-creative` and `hyperframes-audio` with the
   HyperFrames CLI, at the version `pipeline/package.json` pins, into `skills/`. Then run
   `kortix validate`; it must pass. Commit `skills/` and open a change request ("Install HyperFrames
   skills"). Sessions only see the skills once that change request is merged.
2. **Secrets.** `ELEVENLABS_API_KEY` is required (a paid ElevenLabs plan; Starter or above allows
   commercial use). Optional: the YouTube secrets (`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`,
   made with `bun scripts/youtube-oauth.ts`; `YT_API_KEY`), `MEDIA_S3_*` and `FAL_KEY` — see the README's
   Setup table. No model key is needed. Mint setup links with `kortix secrets request`; never ask for a key
   in chat.
3. **Sandbox.** Every agent uses the `video` sandbox template (`Dockerfile.video`: ffmpeg, Chromium, bun,
   HyperFrames). It asks for 6 vCPU / 12 GB.
4. **Check.** In a session on the `video` sandbox: `cd pipeline && bun install && bun test`, then
   `bin/yt smoke` (a 22-second offline episode with stub voice and music).
5. **Channel.** Tell the person to edit `channel/` (brand, design, audio, `channel.yaml`) and
   `episodes/backlog.md` for their channel before the first episode. Leave every trigger off.
