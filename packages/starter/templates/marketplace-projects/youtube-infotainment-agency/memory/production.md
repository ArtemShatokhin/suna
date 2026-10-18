# Production notes

- **Render speed** (2026-10, HyperFrames 0.8.151, software GPU): 10 s of 1080p30 ≈ 26 s on 4 vCPU.
  The `video` sandbox is capped at 6 vCPU by the provider (an 8-vCPU build was rejected); measure
  render speed there before budgeting. Scene renders are cached by content hash.
- **HyperFrames static lint** wants a literal `window.__timelines["<id>"] = tl` in each composition
  even though `Kit.scene` registers it too — keep both.
- **Nested timed elements** (`class="clip"` wrappers with children) trigger a Studio-oriented warning;
  scenes use an untimed `#world` wrapper inside the timed root instead.
- **Contrast check** is strict and useful: sky-blue text on light backgrounds fails; use `--sky-deep`.
- **Fonts**: only mapped or @font-face fonts are deterministic; the kit ships Fredoka + Inter.
- **Timing is narration-first**: voice before storyboard; scene durations derive from beats;
  `yt scene retime` re-syncs after any re-voice because scenes reference cue words, not seconds.
- **Frame drift** (episode 001): HyperFrames rounds each scene up by ~1 frame; across 7 scenes the
  picture ran ~2 frames behind the voice. Fixed: scene windows snap to the frame grid and the concat
  re-encodes with per-scene `outpoint` (stream copy can't cut mid-GOP). Final = exactly timing × fps.
- **Free local voice**: `yt voice --provider kokoro` (pip `kokoro-onnx soundfile`) + whisper word
  timings via `hyperframes transcribe`, aligned back onto script words (ASR writes "1,600" for
  "sixteen hundred"). Good enough for drafts and gate reviews; ElevenLabs for release.
- **First frame of the hook must already be a picture** — critic caught an empty frame 0 in 001/sc01.
- **Agent model pins block dispatch (2026-10-13)**: `agents/*.md` pin `anthropic/claude-opus-5-5` /
  `claude-sonnet-5-5`, but no Anthropic key is connected to this project — `task` on a stage agent fails
  with `provider_not_connected`. The project offers only `kortix/deepseek-v4.1-flash` (default),
  `glm-5.3-flash`, `kimi-k3` (`kortix models ls`). Either connect an Anthropic key or re-pin
  `agents/*.md` (a CR against `main`); until then dispatch the role through a `general` subagent that
  reads that agent's file + skills. **Resolved**: the pins were removed — every agent follows the
  project default model chain (`kortix models default`; Anthropic's flagship once a key is connected).
- **`kortix review submit --json` returns `review_item_id`**, not `id` — `pipeline/src/lib/review.ts
  submitReview()` reads `j.id / j.item.id / j.data.id`, so it returns `undefined` and `yt cast request
  --submit` reports `submitted: false` even though the item was created (and would silently break
  `yt cast sync`/gate polls). Workaround: read the id from `kortix review show --json` and write it into
  `casting.json → review_id`. **Fixed** (`parseSubmitOutput` in `lib/review.ts` reads `review_item_id`).
- **Voice casting (2026-10-13, first run)**: `.gitignore`'s `*.mp3` needs a `!channel/voice-casting/*.mp3`
  negation or the previews can't be committed — they are the gate's evidence. `hyperframes transcribe`
  has no whisper runtime in the `video` sandbox; `hyperframes models install parakeet` (~9 s, 639 MB) is
  the fast path, and `-d /tmp/…` keeps the `transcript.json` out of the repo. Voice Design has no rate
  knob: three previews of one description came back at 167 / 153 / 164 wpm against a 150 wpm house
  target, so pace must be steered at script time or via `channel.yaml → voice.elevenlabs.speed`.
- **House voice is cast (2026-10-13)**: the human picked preview 2 on voice gate
  `55db11a2-e259-4449-bc09-ab167ec8a230` (verdict `approved`, feedback `"2"`); `yt cast sync` created
  the permanent voice **`Mote narrator`** and wrote `voice_id: <designed voice id>` into
  `channel/channel.yaml` (`voice.provider: elevenlabs`, `model_id: eleven_v3`). Note the id is *the
  same* as the preview's `generated_voice_id` — ElevenLabs' `/v1/text-to-voice` returns that id for a
  kept design preview, so an id match between `previews[].generated_voice_id` and `voice_id` is
  expected, not a bug. Every future episode narrates with this voice; the only ways narration can leave
  ElevenLabs are an explicit `yt voice --provider kokoro|stub` or `YT_OFFLINE=1` (which rewrites the
  provider to `stub` in `config.ts`).
- **ElevenLabs beats can end mid-voicing** (2026-10-13, episode 001 voice attempt 2): the
  `with-timestamps` audio is returned trimmed to the vocoder's last 10 ms frame, so a take can stop
  with real signal on the final sample (0.098 = −20 dBFS step into the 0.35 s pause = an audible
  tick). Check it cheaply per beat: the last sample's percentile among all sample-to-sample deltas
  (>99 % = suspicious) or the last-5 ms RMS (>−25 dBFS = suspicious). It is **take-dependent**, not
  systematic — re-rolling fixed all three offenders (001: b02, b05, b07). Because `yt voice` caches
  by a hash of provider + settings + **text**, an unchanged beat never re-generates: delete
  `media/narration/<beat>.{wav,mp3,json}` and re-run `yt voice`. Re-rolls are cheap (001: 3 beats =
  274 chars ≈ $0.04) and are *not* an audio-processing fix, so they stay inside the skill's rules.
  Also note ElevenLabs reports the last word's `end` as the file duration for every beat, so
  `speech_end == file duration` says nothing about truncation — measure the waveform, not the metadata.
- **`setChannelVoiceId` reflows `channel.yaml`** (2026-10-13): it round-trips the file through
  `YAML.parseDocument().toString()`, so every inline comment loses its column alignment. Expect a
  ~30-line whitespace-only diff in `channel.yaml` from `yt cast sync`; the CLI is the only sanctioned
  writer — do not hand-edit it back.
- **House fonts have no `≈` (2026-10-13, episode 001 storyboard)**: the Fredoka/Inter latin subsets in
  `pipeline/node_modules/@fontsource-variable/*` cover `×`, `²`, `—`, `·`, `°` but **not** U+2248, so
  `≈0.3%` falls back to a system face and the type stops being deterministic. Write approximations as
  `~0.3%` (tilde is in both subsets). Check a glyph before it goes on screen:
  `uv run --with fonttools --with brotli python3 -c "from fontTools.ttLib import TTFont; print(ord(ch) in TTFont(path).getBestCmap())"`.
- **Style frames are verifiable without eyes (2026-10-13)**: in a session where the image read tool
  refuses every PNG (`could not be resized below the inline image size limit`), a style frame can still
  be checked: (1) build it as a real HyperFrames composition and snapshot with
  `hyperframes snapshot <dir> --at <t> --no-end` (absolute times, no CUES needed for a still);
  (2) `hyperframes check` gives layout + WCAG contrast on the rendered pixels; (3)
  `pytesseract.image_to_string` on the frame (or a 2× crop) proves every label is legible and in the
  right place; (4) a palette-quantised or autocontrast luminance map of the frame, printed as text,
  shows composition and collisions. Fix geometry from those four signals, then hand the PNG to the
  human. Keep frames at 960 px wide (~180–200 KB) — 3 of them commit in ~550 KB.
- **GSAP vs SVG `transform` (2026-10-13, episode 001 styleframes)**: tweening `x`/`y`/`scale`/`rotation`
  on an SVG element that is positioned with a `transform="translate(...)"` attribute *replaces* that
  attribute (CSS transform wins), so the element snaps to the origin — the sc03 cup and spirit level
  silently rendered in the top-left corner. Give positioned groups absolute coordinates, or wrap them:
  `<g transform="translate(...)"><g id="animatable">…</g></g>` and tween the inner group only.
  Two companions: (1) if an SVG `clipPath` is referenced by an element inside a transformed group, the
  path's coordinates are in that element's *local* user space (the sc04 globe was invisible until the
  clip circle was expressed as local coords); (2) `tl.set("#group", {opacity: 0})` then animating the
  *children*' opacity leaves the group invisible — set the children, not the parent.
- **"Animated but never shown" is a defect class `yt scene check` cannot see (2026-10-16, episode 001 sc04 revision)**:
  sc04 shipped `#airring` as `<g id="airring" opacity="0">` that the timeline only *rotated* — lint, runtime, layout,
  motion and contrast were all 0/0 because CSS opacity 0 is invisible to every one of those audits (the layout audit
  only complained *after* the element was made visible). The critic caught it by sweeping computed opacity and by
  probing pixels. Make it mechanical: (1) grep the scene for `opacity="0"`/`opacity: 0` in markup and prove each id has
  an opacity tween that raises it; (2) after the check, sample the rendered frames for each layer's characteristic ink
  (colour mask in the region where it should be), at times on both sides of its cue. Two related traps found the same
  way: `stroke-linecap="round"` on a dashed stroke inflates each 24 px dash into a 36 px pill (gaps shrink to 12 px —
  the house dash motif needs butt caps), and a tween that does not name an ease inherits `Kit.scene`'s
  `defaults: {ease: "power3.out"}`, so a "spin at one steady pace" silently decelerates (measured: the air shell turned
  at -55 °/s decaying before the fix, a constant -104.2 °/s after `ease: "none"`).
- **Layer order is checkable against a committed still (2026-10-16, episode 001 sc04)**: the sc04 styleframe shows the
  cabin's three clouds *over* the arriving planet (their boxes are whole: 718-833 / 900-1019 / 1085-1217); with the
  clouds behind the globe only one measured whole at 0.6 s. Splitting the cabin into `#sky` (behind the planet) and
  `#clouds` (over it) reproduced the still's boxes to within 5 px. When a still pins geometry, diff your frame against
  it by mask boxes rather than assuming the z-order.
- **SVG transforms in scenes: write the attribute, don't trust `svgOrigin`/`transformOrigin` (2026-10-16, episode 001
  scenes attempt 2)**: the sc06 diagnosis repeats wherever a scene scales or rotates an SVG group. Measured again in
  sc04: `fromTo("#gwrap", {x:862,y:782,scale:0.8,svgOrigin:"0 0"}, {x:960,y:648,scale:1})` left GSAP's internal values
  at (960,648,1) but emitted `matrix(1,0,0,1,909.05,701.41)` — the planet sat 51 px left / 53 px down of the window
  centre it was supposed to fill, and nothing in lint/check flagged it. Pure-translate tweens on an SVG group are safe
  (a translate is origin-independent — that is why `Kit.spinGlobe`'s `.g-land` scroll is exact); any tween that
  combines translate with scale, or applies rotation, must be done by writing the transform yourself:
  `tl.to(proxy, {…, onUpdate: () => el.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${p.s})`)})`.
  20 lines of `xform()` in sc04 replaced every `svgOrigin` call and made the geometry exact to the pixel. Verify with a
  headless CTM probe (`getCTM()` on the group vs the intended point), not by eye.
- **A committed styleframe is the DESIGN state, not a timeline frame (2026-10-16, episode 001)**: the sc01 and sc04
  styleframes both match the composition with every entrance/animation at rest (sc01's camera at 1.00 and the punch
  settled; sc04's cabin at scale 1.00 with the planet mid-rise). So reproduce a still's measured geometry at rest, and
  time the real tweens around it — sc04 satisfies the still's pinned cloud boxes (x719-833 / 901-1019 / 1085-1217) by
  finishing the cabin's camera pull-back at 0.6 s, the moment the storyboard quotes for that frame.
- **Rotating a floor in perspective (2026-10-13, episode 001 sc06)**: a rigid screen-space rotation of a floor
  ellipse plus its peg ring is geometrically wrong — the ellipse tilts and the pegs drift 60-65 px off the rim
  (q = 0.71-1.22 where 1.0 is the rim). The correct construction for a disc turning in a squashed view is
  **rotate in plane, then squash**: draw the ring on a circle of r = R about the centre, put it in
  `<g transform="translate(cx,cy) scale(1, ry/R)"><g id="spin">…</g></g>` and animate `#spin` with a pure
  `rotation` (GSAP `transformOrigin: "0px 0px"`, no other transform on that element, since a CSS transform
  replaces the SVG attribute). Then peg(theta) -> (cx + R cos(theta+phi), cy + ry sin(theta+phi)) and every peg
  stays exactly on the rim (measured q = 0.99-1.00). Keep the floor's own ellipse OUT of the rotating group —
  a circle turning about its own centre must not visibly move. Verified with a rim test rather than by eye.
- **`Kit.cue` silently takes the FIRST occurrence of a repeated word (2026-10-16, episode 001 sc03)**: the scene
  scaffold's `const C = (beat, word, off) => Kit.cue(CUES, beat, word, off)` drops `Kit.cue`'s 5th argument (`nth`),
  so `C("b03","you",-0.2)` for the line "…the cup, the air, and **you** all move together" matched the "you" of
  "What **you** can feel" at 0.167 and fired the mint arrow at t≈0 — the arrow sat on screen for the whole scene
  and only a frame measurement caught it (`Kit.cue`'s own `max(0, …)` clamp hides the mistake in the timeline).
  Fix: pass `nth` through (`const C = (beat, word, off, nth) => Kit.cue(CUES, beat, word, off, nth)`) whenever a
  word repeats in the beat ("you"/"the"/"a"/"in"/"little"), and check for stray elements in early frames.
- **GSAP's dash-based `Kit.drawOn` merges with an existing `stroke-dasharray` attribute (2026-10-16, episode 001 sc06)**:
  on a line that already has `stroke-dasharray="24 24"`, `gsap.set(el,{strokeDasharray: len, strokeDashoffset: len})`
  writes `stroke-dasharray: 1250px, 24px` — GSAP keeps the second component of the complex string — so the pattern is
  "1250 on / 24 off" and the offset lands on an *on* segment: the "hidden until its cue" dashed line is fully solid
  from t=0. Build dashed lines as real segments (one `<line>` per dash) and draw those on with a stagger
  (`Kit.drawOn(tl, "#plane line", at, 0.3, {stagger: 0.014})`), or set the pattern after the draw completes.
  Same family: a **round linecap leaks a visible blob** at the path end while the dash offset hides the stroke
  (sc06's sun rim arc showed a 14 px sun dot at t=3.2 s until the cap became butt).
- **An SVG `clipPath` is evaluated in the local space of the element that carries it (2026-10-16, episode 001 sc03)**:
  `clip-path` on the same `<g>` whose `transform` is animated makes the clip *drift with the element* (the sc03
  clouds escaped the porthole and only the clip's rect moved with them) and inside a CSS-scaled container the
  clipping also misbehaved mid-push. Put the clip on an untransformed parent — or, cheaper and safer under a camera
  scale, do the masking in HTML: a `border-radius: 50%; overflow: hidden` window div holding the sky/cloud band
  clipped exactly and at any scale. Layering needs the HTML window *between* two SVGs (back wall SVG → window HTML →
  furniture SVG) so the tray still sits in front of the wall.
- **A scene's frame 0 must already be a picture (2026-10-16, episode 001 sc03)**: with the title fading up at 0.0 and
  the dial popping at 0.2, the first frame rendered as an empty paper field (0.0 % content). Carry the *motif* element
  in at rest (the dial is "carried from sc02", so it is simply there with a one-pixel settle) and let only the text
  fade up on its word. Cheap detector: `(abs(lum - median) > 25 | sat > 60).mean()` per snapshot — 0.00 means empty.
- **ElevenLabs Music comes back ~13-17 dB under the house narration level, so `audio.md`'s "0.2–0.3 volume" is
  inaudible (2026-10-16, episode 001 sound attempt 2)**: four act cues measured −18.0 / −20.1 / −20.0 /
  −21.7 LUFS integrated (peak −2.6…−8.8 dBFS). At cue volume 0.22 the premix music bus sits −32.8 dBFS RMS
  against a −18.5 dBFS narration and the *ducked* bed lands 21.6 dB under the voice: measured contribution to
  the programme was **≤ 0.2 dB in every 1 s window of the 78 s film**, i.e. the score's own arc (LRA 16 LU on
  the climax cue) is invisible. At volume 0.40 / 0.44 / 0.52 / 0.40 (the same arc, ×2) the bed sits 12.5–18.6 dB
  under the voice per beat (b06 climax −12.5 dB, the most present), and the programme loudness barely moves
  (−18.3 → −18.4 LUFS premix), so the voice loses nothing: two-pass loudnorm's gain is +4.40 dB either way.
  Until `channel/audio.md`'s music line is recalibrated to the provider, per-cue volume 0.4–0.55 is the number
  that makes a score audible; `duck_db: 10` (used as the side-chain *ratio*) gives −14.8 dB GR during speech
  (measured) and works fine at that level. Rebuild the premix with the same filter graph to check this without
  rendering: voice/music/SFX buses kept apart, then measure each; loudnorm simulated two-pass predicts the
  render's −14.0 LUFS / −1.5 dBTP exactly.
- **ElevenLabs sound-generation take level tracks the mood words in the prompt (2026-10-16, episode 001)**:
  one approved SFX prompt ("soft muffled clock tick… quiet, clean, wooden", 0.8 s) came back 26 times spanning
  **−41.6 … −11.9 dBFS peak** (median ≈ −26); the restrained briefs ("quiet", "soft", "clipped", "gentle") are
  the quiet ones, while "whoosh/bell" briefs arrive at −2…−10 dBFS peak. The storyboard's per-cue `volume`
  (0.4–0.5 in 001) is applied by `prepareSound` with **no take-level normalization**, so the quiet-brief cues
  land 15–23 dB under the local programme (−19.8 dBFS tick peak vs a −18.4 dBFS bed) and are effectively
  absent. The sound stage's only lever is best-of-N re-rolling (delete `media/sfx/<sc>-<nn>.{wav,json}` and
  re-run `yt sound` — the cache key is prompt+duration, so any take can be installed and re-runs stay free).
  Cost $3.9 for 49 generations in 001; a one-line mix-time normalization (reference peak before storyboard
  volume) would remove the need. Prefer "short, crisp, wooden" over "quiet, soft" when writing SFX prompts at
  the storyboard gate.
- **Dynamic-arc wording in a music prompt works when it describes *growth*, not *absence* (2026-10-16)**: for
  001's twist+climax cue, "quiet and thoughtful at first: … almost no pulse; then a slow warm build" produced a
  flat, −16.8 dBFS-peak cue with a 1.6 s fade-in and no climax; rewritten as "wonder growing out of stillness,
  … opening sparse and intimate with one sustained celesta note, then swelling warmly … to the fullest, most
  wondering climax of the score in the last quarter", take 2 nailed the shape: 9.4 s sparse (−34…−28 dBFS),
  9–19 s full, then a decay — the arc was *measured* on the take (1 s RMS envelope) before it was accepted.
  Check every generated cue's envelope against the act it covers; "climax in the last quarter" is a request the
  model honours only sometimes (001's take peaked at 60 % of the cue, 6 dB down by the visual peak).
- **A camera "wide view" needs a world bigger than the frame (2026-10-16, episode 001 sc03 revision)**: `Kit.camera`
  scaling a `inset:0` layer by 0.55 shrinks a 1920x1080 picture to a card in the middle of the stage — the reviewer
  measured "a white wash with a 1.3-2.8 % detail card". If the move is a *push into a room*, draw the room in a world
  box the size of the widest view (sc03: 3600x2025, i.e. 1920/0.55 x 1080/0.55) whose SVG user space equals frame
  coordinates (`left:-840px; top:-472.5px` on the SVG, no clipping ancestor), so at 0.55 the frame is *all* cabin and
  the detail that lives beyond the 1.0 frame (seams, rivets, neighbour windows, ceiling curve) slides out as the
  camera arrives. All four corners measured the wall tone afterwards, 42 RGB levels from the stage paper.
- **`Kit.drawOn` + a round linecap leaves a visible blob at the path start (2026-10-16, episode 001 revision)**: the
  dash offset hides the *stroke* but not the half-disc a round cap paints at the endpoint — sc03's mint turn-arc left a
  9 px dot at (1102,332) for the four seconds before its cue, sc05's gravity shaft a 16 px paper nub at (470,316).
  Butt caps on every drawOn target (or a `gsap.set(..., {opacity:0})` plus a cue-time fade) make the reveal clean;
  check by sampling a small window around the path's start in a pre-cue frame (0 px expected).
- **Sibling/text overlap is invisible to `yt scene check` (2026-10-16, episode 001 revision)**: `#chips` was a 0x0
  absolutely positioned container with absolute children, so the pills shrank to min-content, wrapped to two lines
  (224x110) and overlapped the next row by 6.0 px — the check's layout pass only looks for overflow. Two cheap
  guards now live in `episodes/001-.../qa/scene-overlap-check.mjs` (run: `node <file> sc03 4.6 ...`): pairwise text-box
  intersection and a real line count via `Range.getClientRects()` (a `h/lineHeight` heuristic false-positives on
  `line-height: normal`). It also caught an 18 px `m/s²` line-box overlap inside sc06's plates.
- **Derive a pinned position from the formula, not from a comfortable convention (2026-10-16, episode 001 sc06 revision)**:
  the two knocked-flat posts were placed at the angles that give *screen* x 802/1117 **for their dots**, but the code
  put the dot at `theta + 9` while the list held the *stroke's* angles — so the dots rendered at 696/1007 while my own
  verification script (which added the same +9) confirmed them. A self-consistent harness verifies your convention,
  not the plan's numbers: check the *absolute* storyboard value in the frame (x 801/1116 measured, pinned 802/1117).
- **`sidechaincompress` ends with its shorter input, so an unpadded ducking key silently mutes the end of the
  film (2026-10-16, episode 001 final cut 3.9/FAIL)**: `mixMaster`'s `[musicraw][vkey]sidechaincompress=…`
  truncated the ducked music bus at the last narration sample (76.430 s in a 78.28 s cut), the final `amix`
  then had nothing but silence to carry, and `apad` padded the tail with digital zeros — measured: 100 % of the
  88 800 samples after the last word were exactly zero (RMS −240 dBFS), so the resolution cue's written decay
  never played. Fix (**shipped**): pad the *narration bus* to the film length in `bus()` (`amix…,apad,atrim=0:total`),
  upstream of `asplit`, so the key is the full timeline. **The trap:** padding the key *branch* — the obvious
  `[vkey]apad,atrim=0:total[vkeypad]` — fixes the truncation but **livelocks ffmpeg**: the graph writes a complete
  output file and then spins at 100 % CPU for ever (no exit after 200 s; the identical graph without the key pad
  exits in 0.6 s; `apad=whole_dur=` on the key branch hangs the same way). It reproduces with 17 inputs on a real
  episode and *not* on a 2-input toy graph, so always check that a mix filtergraph **exits**, not just that the
  file appears. Regression net: `/tmp`-style edge cases through the real `mixMaster` (no voice / no music / no sfx /
  voice longer than `total` / music ending mid-film) must all exit in < 2 s at the exact duration.
- **Take-level normalisation landed in the mix (2026-10-16, episode 001)**: `mixMaster` now measures every placed
  music/SFX take (one `loudnorm … print_format=json` call per file → `input_i` = integrated LUFS, `input_tp` = true
  peak) and folds a gain into the clip's `volume`: music → `music.reference_lufs` (−20) with a −3 dBFS peak ceiling,
  SFX → `sfx.reference_peak_db` (−4), both clamped ±24 dB; the voice is deliberately *not* normalised. The gains are
  returned from `mixMaster` as `normalised[]` and land in `qa/render.json`, which is the fastest way to see what a
  mix did. On 001 the ten takes needed −1.97…+1.94 dB (music) and −1.72…+10.56 dB (SFX) — i.e. the SFX bus was
  7–11 dB out of family before this and the quiet-brief prompts were inaudible in the mix, exactly as the sound
  stage had reported. New channel knobs, all with schema defaults so a config that omits them still gets the fixed
  behaviour: `music.duck_db` (side-chain *ratio*, now 2), `music.reference_lufs`, `sfx.reference_peak_db`,
  `mix.duck_threshold_db` (was hard-coded −34 dBFS), `mix.duck_release_ms` (was hard-coded 400 ms).
- **Tune score-vs-voice on *speech-active frames*, never on whole-beat averages (2026-10-16, episode 001)**:
  a whole-beat measurement of the same mix reads 8.8–14.5 dB under the voice, while the number that matters —
  energy over frames where the voice is active — was 21–24 dB on the cut the critic failed and 14.5 dB after the
  fix. Recipe: load the voice and ducked-music stems, 50 ms/25 ms frames, mark the voice active at
  `> max(V) − 30 dB`, then take `median(M − V)` and the energy ratio `10log10(ΣM²/ΣV²)`; target **12–16 dB** with
  a duck of ~8 dB GR during speech. The verdict on the fix came from reproducing the critic's own metric (they
  measured 20.8–23.7 dB; the same metric on the same material read −23.5 dB). Build the tuning harness as a
  *replica* of the mix graph and prove it against the real `mixMaster` premix (001 agreed to −126 dBFS), so the
  stems you tune on are the stems that ship. Reference points for this channel: score 6–7 dB under the voice
  pre-duck, ~8 dB of duck GR, 6–11 dB under the local voice peak for punctuation SFX.
- **A generated music cue resolves ~1–3 s *inside* its beat window, so adjacent cues must be crossfaded, not
  faded (2026-10-16, episode 001 seam polish)**: ElevenLabs Music writes its resolution at the end of the length
  you request (`render.ts` asks for `window + 2 s`), which means the *audible* musical content of a cue dies
  before its act ends — measured on 001's takes, m01/m02/m03 lose 30–37 dB in their last 3–4 s and m02 is
  effectively gone 1 s before its window ends. The old mix faded each cue to zero and the next one in from zero
  (`afade` in 1.5 / out 2.5 per cue), so once the score was loud enough to hear it vanished for ~0.5 s at every
  act seam (bus dips to −76…−103 dBFS). **Fix (shipped):** an equal-power crossfade centred on the seam
  (`mix.music_crossfade_s`, 1.5 s) — each cue but the first starts half of it early, each cue but the last plays
  half of it long, both sides `afade … curve=qsin`, so both sit at −3 dB on the boundary and the sum is constant;
  the last cue keeps its resolution fade anchored to the film's end, and one cue (or crossfade 0) reproduces the
  old behaviour exactly. `qsin` measured ±0.00 dB power sum on two crossfaded tones where `tri` dips −3.01 dB.
  Result on 001: seam minima −103/−98/−94 → −51/−60/−55 dBFS, `< −55 dBFS` stretches 1.20/1.05/0.80 s → 0.00/0.30/0.05 s.
  **The invariant to know:** for any *uniform* shift (pre/post split 0/1.5, 0.75/0.75, 1.0/1.0, 1.0/0.5, 1.25/0.75)
  the position of a take's own decay relative to the seam after it never changes — so a seam whose outgoing cue
  resolves early cannot be fixed by crossfading alone, only by (a) a differential shift that changes the approved
  musical design, or (b) regenerating that cue with a technical "no fade-out/ending" prompt suffix. The 0.30 s
  −60 dBFS notch that remains at 001's m02→m03 seam is (b)-class work, not mix work; in the mix it is ~−68 dBFS.
  Cost of the fix, measured: every cue's material plays 0.75 s earlier, so a cue's internal events move 0.75 s —
  001's m03 swell (the score's return after the number) went 53.5 → 52.8 s, still after the figure and inside the act.

## House voice (17 Oct 2026): Allison – Inviting and Velvety, Eleven v4
- Owner judged 001's final cut "doesn't even sound human and no natural pauses"; CR #10 put narration on
  Eleven v4 and casting on the rule (channel.yaml voice.casting: en / narrative_story / most-used first /
  eleven_v4, no human voice gate — the owner's decision, recorded in channel.yaml + SKILL.md).
- `yt cast library` + `yt cast adopt` → **Allison – Inviting and Velvety** (`<library voice id>`),
  10.24 B chars/1y, en-GB, verified on eleven_v4, rate 1, notice_period 730. Nothing higher-usage was
  excluded (the one exclusion, Sally Ford, sat far below the pick). Written by the CLI into channel.yaml
  (voice_id + model_id = eleven_v4) and voice-casting/casting.json (source "library"); old design casting
  (<designed voice id>, eleven_ttv_v3) fully replaced in casting.json; its preview MP3s stay as history.
- Cast v3-era settings (stability 0.5, similarity 0.75, style 0.3, speed 1.0) now go to eleven_v4 verbatim
  in tts.ts — check how they behave when the voice stage next runs; a new narrator also means every
  unpublished episode is re-voiced (001's beat cache invalidates automatically: the hash includes voice_id + model).
- **Re-voice done (2026-10-17, 001 attempt 3, Allison on eleven_v4)**: the owner's "no natural pauses"
  mapped exactly onto the report's numbers — sentence-end silence 0.11–0.32 s → 0.48–1.39 s, clause
  median 0.05 → 0.32 s, between-beat air 0.35 → 0.51–0.84 s, total 78.28 → 82.92 s at 143 wpm. What
  worked, per `channel/audio.md → Pauses`: full stop + `[short pause]` at idea turns (b02's hold went
  0.08 → 0.72 s when its swallowed `...` was swapped for `. [short pause]`), ellipsis mid-clause for a
  held payoff (`at... nearly seventeen hundred` → 0.52 s), comma chain → two sentences (b03). But the
  marks are directions, not guarantees: one ellipsis (`anything... Your`) came back 0.08 s — always
  re-measure with `yt voice report` after each text change and swap the device when a gap stays near zero.
- **List-internal comma gaps of 0.08–0.24 s are natural prosody, not the owner's complaint** (b04 "the
  ground, the oceans, and the air"): don't reword gate-approved text to chase them — re-roll the take or
  add `pause_after` instead. Leave per-beat wpm 130–156 alone at the edges (slow b07 resolution is intent).
- **"Still robotic?" is checkable without ears**: autocorrelation F0 (40 ms frames, 80–400 Hz) per beat —
  a flat synthetic read shows an IQR of a few Hz; Allison read 203–259 → 225–304 Hz across beats with a
  21–26 dB energy-envelope span (p10–p90, 50 ms RMS), brightest on the twist (260 Hz), lowest on the
  resolution (231 Hz). Re-voice page flow that worked: baseline report → `qa/voice-report-before.json`
  → edit only `narration`/`pause_after` → voice → report → ≤3 iterations → last-5 ms truncation check →
  Parakeet ASR audit per beat (fold ASR number/spelling formats: "1700", "kilometers", "polls", hyphen
  splits/merges) → `yt validate <slug> voice` → regenerate `script.md` → listen-through MP3 for the
  owner (beats + pause_after + tail via anullsrc spacers). Allison's takes ended cleanly on their own
  (tails −82…−87 dBFS; attempt 2 needed 3 re-rolls, attempt 3 needed 0). Voice spend: $0.20 for 1311 chars.
- **Retime pass on the built scenes (2026-10-17, 001 attempt 3, sc03/sc05/sc06)**: `yt scene retime` rewrites only
  `data-duration` + the `@cues` block; every *scene body* that used `Kit.cue` re-syncs for free, and the work left is
  (1) the hard-coded timestamps an attempt-2 builder left behind (001: sc03's slide exit 12.9/12.92, sc06's lapse exit
  10.75 and `Kit.float` windows) — convert them to cue-relative expressions so the next re-voice cannot desync them;
  (2) derived *targets* whose design value is a rate or a pinned geometry, not an absolute (001 sc06: the creep is
  "~1.3 °/s" so the endpoint must follow the window — 5.9° at 13.967 s became **6.17° at 13.866 s**; the two lying
  posts' angles then had to be re-derived (+0.27°) so their critic-verified dots stay at screen x 802/1117 at the cut);
  (3) `Kit.float(..., from, to)` — the leg count is `floor((to-from)/(period/2)) - 1`, so the tween really ends
  `(1+reps)*period/2` after `from`, NOT at `to` (001 sc06's "float to 5.0" ended at 4.4); re-aim `to` at the next
  rounded leg boundary when the window grows. Snapshot frames for a 6-frame check are at
  `i/(n-1)*duration` with the last replaced by `duration - max(0.05, 0.03*duration)` (13.866 s → 13.450 s), which is
  the "committed contact frame" a peg/geometry claim must be measured on.
- **GSAP `seek(t)` suppresses events by default (2026-10-17, 001 attempt 3, sc06)**: `tl.seek(t)` (one arg) sets
  `suppressEvents = true` in GSAP 3, so onUpdate-driven proxies (sc06's creep `rotate(phi)`, the oculus breathe, the
  dust motes; sc04's `xform()`) look STALE under a plain seek — `#spin`'s transform attribute read `null`. HyperFrames'
  own player calls `totalTime/seek(t, suppressEvents=false)` (default false), so callbacks DO fire in
  render/snapshot — the rendered phi measured exactly 1.3°/s. Probe rule: DOM probes must `tl.seek(t, false)`; the
  shared `qa/scene-overlap-check.mjs` was fixed the same way (sc01's onUpdate readout read stale text under it).
  Companion: the k-vignette (ink overlay ~0.21 at the rim) turns paper (246,241,231) into (195,195,196) — the r−b
  signature collapses, so a LOCAL luminance threshold (max > 185) is what separates full-opacity ink from 0.9 lines
  (~176) and 0.8 strokes (~157) in rendered sc06 pixels.
- **Lint's line-count warning is on the BUILT composition (2026-10-17, 001 attempt 3, sc06)**: verbose build comments
  pushed the built `index.html` past 300 lines and produced a NEW `composition_file_too_large` warning (the source
  grew +21 lines; the built file is the source minus compiler-stripped lines) with zero behavioural change — compress
  comment text to keep the built file ≤ 300 in the richest scene. Also learned twice the hard way: 001 sc06's standing
  peg dots sit at `pol(deg, R)` (only the two FLAT posts' dots are at `deg+9`), and a peg-dot q check must exclude the
  window behind a mascot (Mote read 0.961 vs 0.991-1.001 elsewhere).
- **Lint's line budget is structural, and comment trims can eat code (2026-10-17, 001 fix round, sc06)**:
  `MAX_COMPOSITION_LINES = 300` counts STRUCTURAL lines (physical minus the `<style>` block's inner lines + 1 —
  the CSS budget is free), so sc06 at 304 physical lines passed while 308 structural warned. Two traps in one trim
  session: (1) an edit whose oldText ends with a newline but newText doesn't JOINS the next statement into the
  comment (`const R = 700` silently became part of a `//` line → runtime `R is not defined`, while lint's own
  static pass still read 0 errors because the file parsed) — always re-run the check after comment trims; (2) keep
  every decision-stating comment when compressing (the rounds kept tick orientation, the dwell bound, the creep
  rate, the flat-post derivation, the stagger, the staged chip and the peak fix).
- **Frozen-frame evidence must quote settings AND the longest run (2026-10-17, 001 fix round)**: the attempt-3
  claim "min 0.147 % / 0.075 %" used 1/30 s PAIRS sampled every 0.6 s — the step let parks hide BETWEEN samples
  (an identical 12 fps sweep read 0.0000 % at sc03 6.417 s: a real 0.18 s park between the life tweens' 6.2/6.3
  stops and the push at 6.48). Fix the class, not the instance: sc03's two `breathe()` life tweens now run to
  `clearAt` (cue-relative), and near-parks from `Kit.float`'s sine.inOut turning points (sc06: 0.0125 % at 5.75 s
  = mote1's own turn at 0.5+4x1.3) are removed by the house triangle drift (constant speed through the turn; sc06
  names it `driftY` because the oculus-glow proxy owns `breathe`). Reproducing numbers (001, 1920x1080,
  |delta| > 2 levels): 12 fps full-window sweeps — sc03 min 0.1270 % (at 0.417→0.500), sc06 min 0.0959 %
  (5.667→5.750), both 0 intervals <=0.02 %, longest run 0; stricter 1/30 s pairs at a 0.25 s step — sc03
  0.0732 %, sc06 0.0710 %, same verdicts. Instrument: `qa/scene-frozen-check.py sweep|pairs` (settings in header).
- **Weighted-word peaks are measured on visual strings (2026-10-17, 001 fix round, qa/label-peak-check.mjs)**:
  the ~8-word bound instrument = Σ (space-separated tokens x effective opacity) over strings at effective
  opacity > 0.1, where ADJACENT text-bearing spans with no whitespace between them are ONE string (the plates'
  `<span class=m9>9.</span><span>780</span>` is the numeral 9.780 — one word; the dim is intra-string emphasis, so
  a merged group's visibility opacity is its PARENT's chain) and strings in different containers never merge.
  Sweep to the ROOT's data-duration, not `tl.totalDuration()` (sc06's swing runs past the cut by design and
  extends totalDuration to 14.373). After the peak fix, sc06's climax max is 8.00 ('67 m' + 'swing plane fixed' +
  'the floor turns'), 0 s over; the whole-scene max 13 is part 1's approved composition (two readout plates +
  caption + chip) — a scope note for the human, since the bound instrument has only ever swept the climax.
- **Timing-only storyboard re-time protocol (2026-10-17, 001 attempt 3)**: when a re-voice moves `timing.json` but the script's words/beats are unchanged, the storyboard is re-opened with `attempt+1` and re-timed, never re-designed. What worked: (1) scene windows need no edit — `sceneWindows()` derives them from each scene's first/last beat, so only the *quoted* scene-relative seconds inside `motion`/`elements` go stale (audit them mechanically: extract `'word' (t)` pairs, resolve each against the new beat's word list, flag deltas > 0.06 s); (2) re-time by *intent*: big movers are words after a written pause (`001: b01 still? +1.35 s, b07 Only +1.42 s, b05 third +1.07 s`); a cue quote that is a *relative* value (chips leading their verb by ~0.16 s, an exit `day. +0.1`) moves with its word, while a purely relative pause value that still holds (sc07's label at 1.5) is left alone; (3) derived dwells/exits re-check against the text rule `0.35x words + 0.6` — the tighter beats (b03 −0.16, b06 −0.09) nibble the *tail*, so 001/sc03's bracket label fell 0.02 s under the 3-word minimum (kept the cue on 'all', stated the shortfall with its mitigation in `motion`, flagged to the human); (4) SFX and `Kit.cue` blocks re-resolve automatically (beat+word keyed — verify each word still exists, note that `cueTime` matches the FIRST occurrence, so repeated words like b03 'you' must quote the intended nth); (5) keep the diff at one JSON line per touched field (raw string replacement on the indented file, not a `json.dump` round-trip) and append one sentence to `style_notes` saying "timing-only update" so the regenerated gate packet is self-describing. Stage-5 companion: `yt scene retime` refreshes the scenes' CUES blocks from the new `timing.json`.
- **Stage-5 re-time landmines (2026-10-17, 001 attempt 3, scenes)**: (1) *Probe seek must fire events*: `tl.seek(t)` defaults `suppressEvents: true`, so `Kit.countUp`'s onUpdate never runs and DOM probes read stale text (sc01's readout read "0 km/h" forever); the film's renderer fires events on seek, so every probe (`scene-overlap-check.mjs`, `scene-frame-sweep.mjs`) must `seek(t, false)`. (2) *GSAP group-cycle stagger*: with `stagger` + `yoyo` + `repeat` on one tween, the stagger re-applies per repeat cycle — total = `[dur + stagger*(n-1)] * (repeat+1)`, so 001 sc01's gust wave (stagger 0.14, dur 0.9, repeat 4 on 3 targets) ran 3.5→9.4 s, not 3.5→8.28; verify with `qa/scene-timing-probe.mjs <scene>` (animation map with start/dur/end/targets) instead of assuming per-target offsets. (3) *`Kit.float` under-covers by design* (`reps = floor((to-from)/(period/2)) - 1`): on a stretched beat the bob stops a cycle short — sc02's Mote went static 9.7→cut (1.07 s) and 0→0.7 s at the open, sitting at the frozen-frame threshold; fixed inside the design with one explicit `fromTo("#mote",{y:-5},{y:5,duration:1.5,yoyo:true,repeat:7},0)` (frame 0 renders the same y the old tween's immediateRender gave it). The frozen-frame checker is `qa/frozen-frame-check.py <sweepdir>` (per-interval changed-px fraction, |dLum|>6, flags runs ≤0.02%) over frames from `qa/scene-frame-sweep.mjs <scene> <fps> <w> <h> <t0> <t1> <outdir>` (seek+ Puppeteer screenshot; 1920x1080 @30fps for flagged windows, 960x540 @12fps for whole-scene runs). (4) *`.k-line` CSS overrides stroke attributes*: sc02's "coral" strike drew `stroke="var(--coral)"` but `.k-line` sets `stroke: var(--paper)` + `width 6` — CSS beats the presentation attribute, so it ships paper-white; pre-existing since attempt 2 (the critic read the code, not pixels), reported to the showrunner, not unilaterally fixed. (5) *DOM box overlaps need a glyph-row verdict*: sc01's `still?` punch (scale 1.16, origin 100% 50%) overlaps the line-2 box by 8.6 px, but on pixels the glyph gap is +24 px (bright-ink rows minus sky rows, window right of the globe at x1300+); the box detector's flag is line-box padding — document, don't shrink the pinned punch.
- **001 scenes attempt 3 (2026-10-17) — my four scenes re-timed onto the Allison read (82.92 s)**: sc01 camera push 3→4.3 s (carries the readout's "0" window; 30fps min 0.75%/frame in 2.4-4.25) + trail gust wave (both flagged lulls alive: 0.67%/frame in 6.3-7.8); sc02 pulse repeat 3→5 (1.79→4.97 s, carries the 1.14 s pause; 30fps min 0.082%/frame in 3.4-5.0) + bob phased 0→cut; sc04 chip exits re-aimed (flight 3.2→2.8 = gone by 3.30, clears 0.18 s before 'ground' 3.48; pace 9.0→9.5 = gone by 9.90, holds through 'day.' 9.83) — ring/clip verified on pixels: box 1122,17 615x615 @0s and 545,233 830x830 @0.6s, clouds 719-833/900-1017/1085- (exact), air ring 22.8/22.8 px dashes turning -105.2±3 °/s constant vs DOM -104.05, spin rate kept per brief (so the turn ends 0.38 s before 'day.', a 12% marker-vs-turn mismatch documented as the brief's choice); sc07 word-by-word reveals re-synced per word (`Kit.cue` times, `nth` for b07's 'it') because the uniform 0.5 s step drifted 0.76 s behind the fast tail read and pushed 'away.' into the quiet tail — last reveal now 8.45, tail 9.0-10.9 quiet (30fps min 0.217%/frame), needle flick verified on pixels (centroid angle -179.2 → 171.9 → -179.2). Probes live in `qa/scene-probes.py` (colour-mask + OCR pixel checks per scene).
- **sc04 '1 turn' adjudication (2026-10-17, post attempt-3 gate 4.7 PASS)**: the critic adjudicated the attempt-3 "keep −104 °/s" choice a MAJOR regression (land froze 9.447, marker drew to 9.877, land ink byte-identical 9.583→10.417 while the storyboard pins both "marker closes on 'day.'" and "the co-rotation is the last thing read"). Fix = the critic's one number: land + airring rotate for `turn − spin` = 3.890 s (airring −92.54 °/s CCW, land −185.09 px/s, ease "none"), so turn == marker == close at 'day.'+0.05 — one constant rate beats the old 1.4 %/12 % coordination. Lesson: when a retime moves word gaps, any duration derived from a word pair (`day − spin`) that shipped as a *literal* goes stale and silently un-coordinates paired elements — derive paired spans from the cues in code, never keep the attempt's literal. Pixel-verified post-fix (30fps 1920×1080 |dLum|>6): critic's freeze window splits 9.583–9.877 min 6.12 %/frame turning; close in the 9.867→9.900 frame interval; tail 0.010–0.012 %/frame 0.67 s; 0.6 s styleframe boxes exact (1122,17 615×615 / 545,233 830×830 / clouds 719-833/902-1017/1085-). Probe gotcha repeated: `scene-probes.py` reads `/tmp/sweep/<scene>-12fps`, so re-copy fresh sweep frames into those paths or it silently re-measures the stale build.
- **sc02 strike adjudication (2026-10-17)**: keep the paper-white strike (documented deviation, storyboard unchanged) — coral-on-coral glyphs is 1.0:1 (invisible exactly where it crosses), paper is 2.5:1 on glyphs / 14.3:1 on night, and paper = the measurement/truth family crossing out the coral misconception. Copy-pasteable note lives in `qa/scenes-attempt3-animator-notes.md` (sc02 section).
- **Critic 001 scenes attempt 3 (2026-10-17, first pass 4.7/5 PASS; confirmation pass 4.8/5 PASS — stage closed)**: every maker claim re-measured independently held (match-cut boxes to the pixel; sc06 peg q mean 0.9952 / mean disp (−1.06, −0.48) px reproduced exactly; sc07 flick 180.8°→171.9°; sc01 readout lands 1,674 on 'hour.' 6.52 — note GSAP `power2.out` is *cubic*, so 1,307 @ 5.0 is per-code, not an anomaly). **One major (new, sc04)**: a scene mechanic whose *duration* is pinned to a word pair must be re-derived when the re-voice moves the words — the −104°/s rate was pinned and `#turn-arc` re-timed to 'day.', so the turn (3.46 s) ended 0.43 s before the marker (3.89 s) closed and the co-rotation froze ~1.1 s before the cut; land ink byte-identical 9.583→10.417 s proved it. Fix = rotate for `turn − spin` (−92.5 °/s), or the human amends the storyboard line. Rule: after any retime, grep for *durations* computed from word times (count windows, turn lengths, dwell bounds), not just cue starts. Also: frozen-frame minima are phase-sensitive at 12 fps (sc03 0.0000 % vs claimed 0.147 %, sc06 0.0125 % vs 0.075 % — both single intervals) — quote the settings or the longest run, not the min. The `.k-line`→paper strike adjudicated minor (art-director's call; report-first was the right call); sc06's climax peak is 9.45 weighted words at 10.85 s for ~0.25 s (fix: exit 'Paris, 1851' at 10.55). The scene-overlap tool still lacks the ancestor/descendant skip (carried three rounds now). **Confirmation pass (same day)**: sc04 fix re-measured in DOM (land −185.09 px/s, ring −92.55 °/s, ease none, −720 px/−360° by 9.877) and pixels (land ink changes 2,526→6,247 px through 9.583–9.833, freezes 9.917; tail 0.69 s at 0.030–0.036 %/interval 12 fps); sc06 climax now exactly 8.00 weighted words (Paris exits 10.353–10.553) with mote1's sine park replaced by a triangle drift; sc03 breathe to clearAt — my 1920×1080 |Δ|>2 12 fps replication gives sc03 min 0.1383 % (makers 0.1270) and sc06 min 0.0995 % (makers 0.0959), same intervals, 0 runs ≤0.02 %. Stage closed at 4.8/5 (sc03 4.9, sc04/sc06 4.8); residuals are the adjudicated paper strike, three carried cosmetics and the overlap-tool nit.

## Final-gate mechanics after a reopen (2026-10-17, 001 re-voice pass)

- **A gate verdict does not reopen on its own** (2026-10-17, 001): the `final` gate stayed `closed` (old review
  `d1f8ac35`, the 78.28 s cut) while `voice reopen` invalidated publish/followup — `episode next` reports
  `await_gate` and `gate request` without `--submit` silently no-ops the send (writes the packet,
  `submitted: false`). Re-running `gate request … final --submit` after the maker stages re-complete creates a NEW
  review (`9f64910f`) and flips the gate to `requested`; the packet must state it **supersedes** the old review id,
  or the inbox shows two finals for one episode.
- **The gate packet embeds `qa/gate-final-notes.md` verbatim** — after any re-open, rewrite the notes (old-cut
  seconds, old narrator name, old chapters survive verbatim inside the packet otherwise; grep it for the old
  duration before submitting). Packet facts to refresh: QA numbers, spend, supersede line, watch list, chapters.
- **The critic review of a re-render is revision 4, not 3** (2026-10-17, 001): the critic subagent returned an
  empty task_result on first dispatch and wrote nothing — its stale rev-3 review (78.28 s) sat in `qa/*.json`
  looking fresh. Check the review file's mtime/duration against the delivered cut before trusting any verdict;
  resume the same task id to get the report.

## Sound attempt 3 (2026-10-17, 001 sound stage, re-placement onto the 82.92s Allison read)
- **Regenerating a music take at a new length re-rolls EVERY descriptor, not just the ending** (2026-10-17, 001):
  `makeMusic` requests `window+2 s`, so a beat-window change invalidates the cache and the provider
  composes a NEW cue whose interior holes, swell positions and peak positions are fresh dice. 001's four takes at
  attempt-3: m01 lost its hook coverage (interior hole −59…−69 dBFS at 8–11 s + a +47 dB step at 11 s), m03 lost
  its sparse opening (full under the number where the approved take was sparse) — the same prompts that produced
  the approved takes. Re-measure EVERY descriptor on every regeneration (1 s RMS envelope + peak position + the
  ending), never assume the class carried over.
- **ElevenLabs Music's ending decay start is systematic, not take-dependent** (2026-10-17, 001): across 7 takes,
  the resolution decay starts 5.5–6.5 s before the requested end (`window+2`), so every cue is 30+ dB down 1–2 s
  before its act ends. The dispatch-style fix "re-roll with a sustained-tail suffix" was TRIED and did not move
  the decay start (measured on the suffixed roll: decay from take 22 of 27.61). Seam coverage therefore depends
  on the INCOMING cue's opening level: a seam reads clean (≤0.3 s below −55 dBFS pre-duck) iff the incoming cue's
  sec-0 body is real content (001's approved m03 opened at −34.3; rolls that opened at −66…−72 produced 1.4–2.0 s
  dips). The real fix is a pipeline one: request `window+N` with N ~ 7–9 so the mix's trim (window+1.5 s) cuts
  BEFORE the written resolution — shared code + an arc re-approval; recorded for the showrunner.
- **Best-of-N protocol: save takes before every roll** (2026-10-17, 001): the winning m03 roll (the approved
  sparse class, 1 hit in 6) was consumed by the next roll pass because its files were deleted to force
  regeneration — takes are atomic, no splicing, and a lost roll cannot be regenerated (each roll is a fresh
  sample). `cp media/music/<id>.* /tmp/save-<id>-<n>/` BEFORE `rm`. The cache key is prompt+ms, so re-installing
  a saved take's files = a cache hit, no spend, no regen.
- **No uniform volume trim can land a per-beat band wider than the takes' own spread** (2026-10-17, 001): the
  dispatch band was 12.5–18.6 dB under (width 6.1 dB); the dense rolls' per-beat speech-active spread was 6.4 dB
  → the trim intersection was EMPTY (b05 needed ≥5.0 dB, b01 ≤4.7). Take classes must return first (the approved
  dynamic classes), then the uniform trim closes the rest (001: −5.0 dB, ratios preserved, landed the overall
  speech-active median/energy on the approved −15.6/−14.5 exactly). Calibration: when takes are ~5 dB denser than
  the approved rolls, the same cue volumes read ~5 dB hot — the sanctioned "measurement says otherwise" move is a
  uniform trim to the approved overall placement, not a per-cue re-derivation.
- **Suffix lessons (2026-10-17, 001)**: a technical prompt suffix is sanctioned when a take fails, but (a) the
  m02 ending-suffix did not move the systematic decay (the provider writes its resolution at requested-end−(4–6 s)
  regardless), and (b) an m03 reinforcement suffix ("for the first third of the cue only the one celesta note and
  the slow low pad sound…") was ignored entirely (the swell arrived at 4% of the cue) — positive duration language
  ("the first third… then the swell begins") did not raise the sparse-opening hit rate (~1/6). Revert failed
  suffixes to the byte-exact approved prompt before installing best-of-N takes: the prompt is the design, the take
  is the dice.
- **A voice change moves the duck GR reference** (2026-10-17, 001): the approved cut's "duck GR 8.3–8.4 dB median"
  was measured on the old Mote v3 voice (typical active frames ~−13 dBFS); Allison's read has typical active
  frames ~−18 dBFS → the same ducker measures 6.0 dB median GR. Don't chase GR medians after a re-voice; the
  invariant is the bed-vs-voice placement (speech-active median/energy), which is voice-independent.
- **ffmpeg uses a filtergraph output label at most once overall** (2026-10-17, 001 sound): `-map [x]` fails with
  "Output with label 'x' does not exist… or was already used elsewhere" when [x] is ALSO consumed by a later
  filter (e.g. [musicraw] into sidechaincompress). Add a pure-copy `asplit` for every label you map
  (`[musicraw]asplit=2[mrawin][mrawout]`, map [mrawout]) — the [out] copy of the premix is then the equivalence
  proof against the engine (001: max |Δ| 2.2e-05 ≈ −93 dBFS vs real `mixMaster`). The reproducible premix+stem
  harness lives at `episodes/001-…/qa/sound-premix-check.ts` (real `prepareSound` + real `mixMaster` + stem maps);
  run `bun <file>` from the repo root, stems land in /tmp/snd.
- **Derive stage-input numbers from the state files, not from the dispatch** (2026-10-17, 001): the attempt-3
  dispatch quoted "b05+b06 23.86 s" while its own seam times implied 24.22 (47.81→72.03); `prepareSound` derives
  `beat(from).start → beat(to).end` from timing.json, so 24.22 was generated. Quote the derivation in the report.
- **001 sound attempt 3 shipped state** (2026-10-17): 4 cues 0.315/0.349/0.411/0.315 (−5.0 dB from attempt-2's
  0.56/0.62/0.73/0.56, the +2.3 dB climax arc preserved), prompts byte-identical to approved except m02's
  sustained-tail suffix (kept, instructed); takes m01/m02/m04 = 11:04/11:08 regens, m03 = the 11:08 roll
  re-installed; overall speech-active median −15.5/energy −14.3 (approved −15.6/−14.5); per-beat whole-beat
  −16.3/−15.6/−10.5/−13.3/−9.8/−9.7/−12.2 vs approved −13.4/−14.0/−11.1/−11.0/−14.5/−8.8/−10.2 (b06 most
  present ✓; b05's figure rides the take's full section — the stage's main residual, ~2–4 dB under the voice on
  its strongest words vs approved 10–13); seams 0.80/2.00/0.95 s < −55 pre-duck (approved 0.00/0.30/0.05,
  inaudible: −61…−80 ducked); SFX bus byte-identical, placements re-verified exactly on the new word onsets;
  tail RMS −53/peak −36.7/0.18% zeros (real decay; deeper than approved's −36.9 RMS — geometry + trim); master
  −14.1 LUFS/−1.49 dBTP; validate ok; spend $4.01 (13 music gens, SFX $0).
