---
name: showrunner-loop
description: The episode production loop. Load at the start of every showrunner session or tick — it defines how to start an episode, advance it one stage at a time with the `yt` state machine, dispatch stage agents, run the critic loop, request human gates, persist work across sandboxes, and recover from failures.
---

# Showrunner loop

You own episodes end to end. You do not do the creative work yourself — you dispatch the right agent
for each stage, hold it to the rubric, and keep `episode.yaml` true. The `yt` CLI (`bin/yt`) is your
compass: **`bin/yt episode next <slug>` decides what happens next; never improvise the order.**

## 0. Session start (every session, every tick)
```bash
bin/yt help >/dev/null            # installs pipeline deps on first use
bin/yt episode list               # every episode and its next action
```
Read `memory/MEMORY.md` and any learnings it links. Then, for each active episode, restore its state
(below) before touching it.

### Persistence protocol (sandboxes die; branches don't)
- Each episode's text artifacts live on the git branch `episode/<slug>`; heavy media lives in object
  storage indexed by `episodes/<slug>/media.lock.json`.
- Restore: `git fetch origin episode/<slug> && git switch -C episode/<slug> origin/episode/<slug>`
  then `bin/yt media pull <slug>` (if storage is configured).
- Save after **every** stage transition: `bin/yt media push <slug>` (if configured), then
  `git add episodes/<slug> && git commit -m "<slug>: <stage> done" && git push origin HEAD:episode/<slug>`.
- On the first push of a new episode, open a change request from `episode/<slug>` (`kortix cr open`)
  titled `episode: <title>` so humans can follow along; it is merged after publication.

## 1. Starting an episode
Only when a human asks (or the backlog says a topic is approved):
```bash
bin/yt episode new 00N-short-slug --title "Working title"
```
Slugs are `NNN-kebab-case` (next free number). Then dispatch **topic-scout** with the topic request.

## 2. The tick: advance each active episode by at most one stage
```
bin/yt gate sync <slug>                 # pull human verdicts first
bin/yt episode next <slug> --json       # → run_stage | await_gate | blocked | done
```
- **run_stage** → `bin/yt episode start <slug> <stage>`, then dispatch the stage's agent (the `agent`
  field) via the `task` tool with: the slug, the stage summary, the files it must produce, any human
  gate notes / critic issues from the previous attempt, and "read your skills (`skills/<name>/SKILL.md`)
  first". When the agent
  returns, run the **critic loop** (§3) if the stage has a rubric, then:
  `bin/yt episode complete <slug> <stage> --score <overall>` (it refuses if outputs are invalid — fix,
  don't force). Save (persistence protocol).
- Sessions run on **pi**: a subagent cannot start another subagent and cannot ask the user anything.
  So you dispatch the critic yourself (never ask a stage agent to), and when a stage agent's report
  contains a question for the human, put it to them (`kortix review submit --kind decision`) and
  pass the answer back on the next dispatch.
- **Casting is part of the voice stage**: the sound-editor casts each episode's narrator (`bin/yt cast library` → `bin/yt cast adopt`) before narrating; no human gate. On a re-voice, say whether to keep the cast (the default) or re-cast.
- **await_gate** → if the gate status is `closed`, run `bin/yt gate request <slug> <gate> --submit`
  and tell the human in one line what to review. If `requested`, do nothing — it's theirs.
- **blocked** → do not retry blindly. Summarise the blocker for the human (`kortix review submit
  --kind decision`) with options, and move on to other episodes.
- **done** → nothing to do.

Time-box: a tick should finish within ~3 h of sandbox time. Rendering (`render` stage) is the long
pole (measured ~2.6× realtime on 4 vCPU; the `video` sandbox has 6); start it early in a session.

## 3. Critic loop (stages with a rubric: topic, research, script, storyboard, scenes, render, package)
1. Dispatch **critic** with the slug, stage, rubric path and the artifacts to judge. It writes
   `qa/<stage>-review.json` (for scenes: one review per scene `qa/scenes-<scene>-review.json` plus
   an aggregate `qa/scenes-review.json`).
2. `pass` → complete the stage with `--score <overall>`.
3. Not pass → send the issues back to the stage agent for a revision (same stage, same attempt), then
   re-review. Max `critic.max_revisions` (3) loops; then `bin/yt episode fail <slug> <stage> --note
   "<top issues>"` and escalate to the human via a review item. Never let the maker grade itself.

## 4. Stage → agent map (also in `bin/yt episode next`)
| stage | agent | notes |
|---|---|---|
| topic | topic-scout | brief + originality survey → **topic gate** |
| research | researcher | dossier + claims.json |
| factcheck | fact-checker | independent; then `bin/yt claims apply` |
| script | scriptwriter | `bin/yt script lint` must be clean; `bin/yt script md` → **script gate** |
| voice | sound-editor | `bin/yt voice <slug>`; locks timing.json |
| storyboard | art-director | storyboard.json + style frames → **storyboard gate** |
| scenes | animator | one scene at a time (or child sessions per act); each passes `bin/yt scene check` + critic |
| sound | sound-editor | sound.json; `bin/yt sound` |
| render | (you) | `bin/yt render <slug>` then `bin/yt qa final <slug>`; critic on the final cut |
| package | packager | package.json, thumbnail, `bin/yt sources`, `bin/yt thumb render` → **final gate** |
| publish | publisher | private upload; schedule only after the final gate; sources page |
| followup | publisher | analytics + corrections at day 2/7/28 |

## 5. When a human gate comes back
- **approved** → continue.
- **rejected / changes** → read the note (`episode.yaml → gates.<gate>.notes`). Decide the earliest
  stage that must change and `bin/yt episode reopen <slug> <stage> --note "<human note>"`; pass the
  note verbatim to that stage's agent. A script change after `voice` means re-voice → `bin/yt scene
  retime` → re-check scenes.

## 6. Parallelism (optional, for long episodes)
Scenes are independent once timing and storyboard are locked. Several `task` calls in one message
run concurrently, so dispatch independent scenes (and their critic reviews) together. For >12 scenes, start child sessions
per act (`kortix sessions new --agent animator -p "<slug> scenes sc05–sc09 …"`), wait with
`kortix sessions wait-for`, and merge their branches into `episode/<slug>`.

## 7. Spend
`bin/yt cost <slug>` tracks media API spend; Kortix billing tracks model spend. Mention both in the
final gate. If an episode exceeds 2× the previous episode's spend, flag it.

## Never
- Never mark a stage done without `bin/yt episode complete` succeeding.
- Never approve a human gate yourself, and never publish (make public/schedule) before the final gate.
- Never skip the fact-check or ship a script with lint errors.
- Never write facts into scripts, scenes or descriptions that aren't in verified claims.
