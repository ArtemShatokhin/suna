---
name: youtube-publishing
description: Upload an approved episode to YouTube privately with captions, thumbnail and correct disclosure, publish the sources page, and schedule or publish only after the human final gate. Load for stage 8 publication or any change to a live video's metadata.
---

# YouTube publishing (stage 8)

## Preconditions (check, don't assume)
- `bin/yt episode status <slug>` shows the **final gate approved** by a human.
- `qa/final-qa.json` ok; `08-publish/description.txt` and `media/thumbnail.png` exist.
- Credentials: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` in the environment, and
  `bin/yt youtube whoami` names the intended channel. Missing? Follow **Credentials** below.

## Credentials (one-time, done by a person in the browser)
Agents can't sign in to Google, so a person does steps 1–4; an agent does 5–6.
1. console.cloud.google.com → new project → APIs & Services → Library: enable **YouTube Data API
   v3** and **YouTube Analytics API**.
2. Google Auth Platform → **Branding**: app name and support email. **Audience**: External, then
   **Publish app** (In production). An app left in Testing gets a refresh token that expires after
   7 days. Verification is not needed for your own channel.
3. **Clients** → Create client → **Web application**, authorized redirect URI
   `https://developers.google.com/oauthplayground`. Keep the client ID and secret. A
   `redirect_uri_mismatch` right after creating it means wait a few minutes.
4. developers.google.com/oauthplayground → gear icon → tick **Use your own OAuth credentials**
   (OAuth flow Server-side, access type Offline) and paste the ID and secret. Step 1: paste
   `https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly`
   into the scope box → **Authorize APIs** → sign in as the channel (pick the Brand Account if the
   channel is one) → on "Google hasn't verified this app": Advanced → Go to … → allow. Step 2:
   **Exchange authorization code for tokens** → copy the **Refresh token**. With your own
   credentials the Playground does not auto-revoke it.
5. Mint a secrets link (`kortix secrets request YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN
   --scope runtime`) and give it to the person; they paste the values there, never in chat.
   `kortix secrets ls` must then show delivery **environment**. A connector secret never reaches
   the sandbox and its delivery can't be switched: `kortix secrets unset` it and request again.
6. `kortix secrets sync`, then `bin/yt youtube whoami`: it must name the intended channel.

`YT_API_KEY` is optional: it lets `yt youtube search` run without the OAuth secrets. It adds no
quota, because quota belongs to the Cloud project.

## Troubleshooting
- `OAuth refresh 400 … invalid_grant`: the token was revoked, or the app is still in Testing
  (7-day expiry). Ask a person to redo step 4 (and step 2 if needed); don't retry.
- Quota (Google defaults, Oct 2026): 100 uploads and 100 searches per day per Cloud project; other
  calls share 10,000 units per day.

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
