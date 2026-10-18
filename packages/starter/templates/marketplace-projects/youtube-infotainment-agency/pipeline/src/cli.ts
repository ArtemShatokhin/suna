#!/usr/bin/env bun
/**
 * `yt` — the deterministic half of the pipeline. Agents do the creative work and call these commands
 * for everything that must be exact: state, validation, timing, rendering, QA, upload.
 * Run `bun pipeline/src/cli.ts help` (or `yt help` once linked) for usage.
 */
import { existsSync } from "node:fs";
import { applyFactCheck, primaryShare } from "./claims";
import { channel } from "./config";
import {
  completeStage, decideGate, failStage, loadEpisode, newEpisode, nextAction, reopen, saveEpisode, startStage,
  STAGES, totalCost, GATES, type Gate, type Stage,
} from "./episode";
import * as gate from "./gate";
import { load, writeJson, writeText } from "./lib/io";
import { ep, episodesDir } from "./lib/paths";
import { qaFinal } from "./qa";
import { assemble, prepareSound } from "./render";
import { Brief, Claims, FactCheck, Script } from "./schemas";
import { buildScene, checkScene, retimeScenes, scaffoldScene, windows } from "./scenes";
import { lintScript, scriptMarkdown } from "./script";
import { writeSources } from "./sources";
import * as storage from "./storage";
import { renderThumbnail, scaffoldThumbnail } from "./thumbnail";
import { validateStage } from "./validate";
import { voice } from "./voice";
import { voiceReport } from "./prosody";
import { Timing } from "./schemas";
import * as cast from "./audio/voicecast";
import * as yt from "./youtube";
import { brollBudget, generateBroll } from "./broll";
import { smoke } from "./smoke";
import { readdirSync } from "node:fs";

const HELP = `yt — edutainment pipeline CLI

Episode state
  yt episode new <slug> --title "<title>"     create episodes/<slug>/episode.yaml
  yt episode list                             all episodes and where they are
  yt episode status <slug> [--json]           stages, gates, spend
  yt episode next <slug> [--json]             what should happen next (the showrunner's compass)
  yt episode start <slug> <stage>             mark a stage in progress (checks predecessors + gates)
  yt episode complete <slug> <stage> [--score n] [--note ..]   validate outputs, mark done
  yt episode fail <slug> <stage> --note ..    record a failed attempt
  yt episode reopen <slug> <stage> --note ..  re-open a stage and invalidate everything after it
  yt validate <slug> <stage>                  run a stage's exit checks without changing state

Gates (human review via the Kortix review inbox)
  yt gate request <slug> <gate> [--submit]    write qa/gate-<gate>.md; --submit sends it to \`kortix review\`
  yt gate sync <slug>                         pull verdicts from the review inbox
  yt gate approve|reject <slug> <gate> --by <who> [--note ..]
  yt gate critic <slug> <gate>                decide a critic-mode gate from the stage review

Research & script
  yt claims apply <slug>                      merge fact-check.json verdicts into claims.json
  yt claims stats <slug>
  yt script lint <slug> [--json]              structure + citation integrity
  yt script md <slug>                         render 03-script/script.md for humans

Voice casting (per episode — the sound-editor picks the narrator; channel.yaml voice.casting is the rule)
  yt cast library <slug>                      eligible Voice Library narrators for this episode, most-used first
  yt cast adopt <slug> <voice_id> --by <agent> --reason ".."   cast the episode's narrator (03-script/voice.json)
  yt cast status <slug>                       the episode's narrator

Voice, scenes, sound
  yt voice <slug> [--provider elevenlabs|kokoro|stub]   narrate beats (cached) and lock timing.json
  yt voice report <slug>                      measured pacing: wpm and the pause after every punctuation mark
  yt scene list <slug>                        scene windows from storyboard × timing
  yt scene scaffold <slug> [<scene>]          create 05-scenes/<scene>.html from the kit template
  yt scene retime <slug>                      refresh CUES + durations after a voice change
  yt scene build <slug> <scene>               self-contained HyperFrames project in build/
  yt scene check <slug> <scene>               hyperframes check + duration lock + snapshots/contact sheet
  yt sound <slug> [--provider elevenlabs|stub] generate music cues + SFX (cached)
  yt broll budget <slug> | yt broll gen <slug> <scene>

Assembly, QA, packaging, publishing
  yt render <slug> [--draft]                  render scenes (cached), concat, mix, mux → build/<slug>/final.mp4
  yt qa final <slug>                          objective checks + contact sheet
  yt thumb scaffold <slug> --text ".." | yt thumb render <slug>
  yt sources <slug>                           sources.md + description.txt (chapters, sources, credit)
  yt media push|pull <slug>                   mirror media/ + final render to object storage
  yt youtube search "<query>"                 existing coverage (originality research)
  yt youtube upload <slug>                    resumable upload as PRIVATE + captions + thumbnail
  yt youtube schedule <slug> --at <ISO> | --now
  yt youtube update <slug>                    push edited title/description/tags
  yt youtube analytics <slug>                 retention + totals + comments → 08-publish/analytics/

  yt cost <slug>                              spend ledger
  yt smoke [--keep]                           offline end-to-end test (no API keys)
`;

function parse(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      const next = argv[i + 1];
      if (v !== undefined) flags[k!] = v;
      else if (next !== undefined && !next.startsWith("--")) { flags[k!] = next; i++; }
      else flags[k!] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

const out = (data: unknown) => console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
const need = (v: string | undefined, name: string): string => {
  if (!v) throw new Error(`missing <${name}>\n\n${HELP}`);
  return v;
};
const asStage = (s: string | undefined): Stage => {
  if (!s || !(STAGES as readonly string[]).includes(s)) throw new Error(`stage must be one of ${STAGES.join(", ")}`);
  return s as Stage;
};
const asGate = (s: string | undefined): Gate => {
  if (!s || !(GATES as readonly string[]).includes(s)) throw new Error(`gate must be one of ${GATES.join(", ")}`);
  return s as Gate;
};

function statusTable(slug: string) {
  const st = loadEpisode(slug);
  const lines = [`${st.title} (${slug}) — spend $${totalCost(st)}`, ""];
  for (const s of STAGES) {
    const x = st.stages[s];
    lines.push(`  ${x.status === "done" ? "✔" : x.status === "in_progress" ? "▶" : x.status === "failed" ? "✖" : "·"} ${s.padEnd(11)} ${x.status}${x.attempts ? ` ×${x.attempts}` : ""}${x.score !== undefined ? ` score ${x.score}` : ""}${x.note ? ` — ${x.note}` : ""}`);
  }
  lines.push("", "  gates: " + GATES.map((g) => `${g}=${st.gates[g].status}(${st.gates[g].mode})`).join("  "));
  const next = nextAction(st);
  lines.push("", `  next: ${JSON.stringify(next)}`);
  return lines.join("\n");
}

async function main() {
  const { pos, flags } = parse(process.argv.slice(2));
  const [cmd, sub, a1, a2] = pos;
  const json = !!flags.json;

  switch (cmd) {
    case undefined:
    case "help":
      return out(HELP);

    case "episode": {
      if (sub === "list") {
        const dir = episodesDir();
        const eps = existsSync(dir) ? readdirSync(dir).filter((d) => existsSync(ep(d).state)) : [];
        return out(eps.map((slug) => ({ slug, next: nextAction(loadEpisode(slug)) })));
      }
      const slug = need(a1, "slug");
      if (sub === "new") {
        if (existsSync(ep(slug).state)) throw new Error(`${slug} exists`);
        const st = newEpisode(slug, String(flags.title ?? slug));
        saveEpisode(st);
        return out({ created: ep(slug).state });
      }
      const st = loadEpisode(slug);
      if (sub === "status") return out(json ? st : statusTable(slug));
      if (sub === "next") return out(nextAction(st));
      if (sub === "start") { startStage(st, asStage(a2)); saveEpisode(st); return out(nextAction(st)); }
      if (sub === "complete") {
        const stage = asStage(a2);
        const findings = validateStage(slug, stage);
        const errors = findings.filter((f) => f.level === "error");
        if (errors.length) {
          out({ completed: false, findings });
          process.exitCode = 1;
          return;
        }
        completeStage(st, stage, { score: flags.score ? Number(flags.score) : undefined, note: flags.note as string | undefined });
        saveEpisode(st);
        return out({ completed: true, warnings: findings, next: nextAction(st) });
      }
      if (sub === "fail") { failStage(st, asStage(a2), String(flags.note ?? "")); saveEpisode(st); return out(nextAction(st)); }
      if (sub === "reopen") { reopen(st, asStage(a2), String(flags.note ?? "")); saveEpisode(st); return out(nextAction(st)); }
      throw new Error(`unknown: episode ${sub}`);
    }

    case "validate": {
      const findings = validateStage(need(sub, "slug"), asStage(a1));
      out(findings.length ? findings : "ok");
      if (findings.some((f) => f.level === "error")) process.exitCode = 1;
      return;
    }

    case "gate": {
      const slug = need(a1, "slug");
      if (sub === "request") return out(await gate.request(slug, asGate(a2), { submit: !!flags.submit }));
      if (sub === "sync") return out(await gate.sync(slug));
      if (sub === "critic") return out(gate.decideFromReview(slug, asGate(a2)));
      if (sub === "approve" || sub === "reject") {
        const st = loadEpisode(slug);
        decideGate(st, asGate(a2), sub === "approve", String(flags.by ?? "human"), flags.note as string | undefined);
        saveEpisode(st);
        return out(nextAction(st));
      }
      throw new Error(`unknown: gate ${sub}`);
    }

    case "claims": {
      const slug = need(a1, "slug");
      const p = ep(slug);
      if (sub === "apply") {
        const { claims, summary } = applyFactCheck(load(Claims, p.claims), load(FactCheck, p.factcheck));
        writeJson(p.claims, claims);
        return out(summary);
      }
      if (sub === "stats") {
        const c = load(Claims, p.claims);
        const by = c.claims.reduce<Record<string, number>>((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {});
        return out({ sources: c.sources.length, claims: c.claims.length, ...by, primary_share: Number(primaryShare(c).toFixed(2)) });
      }
      throw new Error(`unknown: claims ${sub}`);
    }

    case "script": {
      const slug = need(a1, "slug");
      const p = ep(slug);
      const script = load(Script, p.script);
      const claims = load(Claims, p.claims);
      if (sub === "lint") {
        const res = lintScript(script, claims, existsSync(p.brief) ? load(Brief, p.brief) : undefined);
        out(json ? res : [`${res.stats.beats} beats, ${res.stats.words} words, ~${res.stats.est_seconds}s (hook ${res.stats.hook_seconds}s), ${res.stats.cited_claims} claims cited`, ...res.issues.map((i) => `${i.level.padEnd(5)} ${i.where}: ${i.msg}`)].join("\n"));
        if (res.issues.some((i) => i.level === "error")) process.exitCode = 1;
        return;
      }
      if (sub === "md") { writeText(p.scriptMd, scriptMarkdown(script, claims)); return out({ wrote: p.scriptMd }); }
      throw new Error(`unknown: script ${sub}`);
    }

    case "voice":
      if (sub === "report") {
        const p = ep(need(a1, "slug"));
        return out(voiceReport(load(Script, p.script), load(Timing, p.timing)));
      }
      return out(await voice(need(sub, "slug"), flags.provider as any));

    case "cast": {
      const slug = need(a1, "slug");
      if (sub === "library") return out(await cast.searchLibrary(slug));
      if (sub === "adopt") {
        return out(await cast.adoptLibrary(slug, need(a2, "voice_id"), { by: need(flags.by as string | undefined, "--by"), reason: need(flags.reason as string | undefined, "--reason") }));
      }
      if (sub === "status") return out(cast.episodeCast(slug));
      throw new Error(`unknown: cast ${sub}`);
    }

    case "scene": {
      const slug = need(a1, "slug");
      if (sub === "list") return out(windows(slug).windows);
      if (sub === "scaffold") {
        const ids = a2 ? [a2] : windows(slug).windows.map((w) => w.id);
        return out(ids.map((id) => scaffoldScene(slug, id)));
      }
      if (sub === "retime") return out(retimeScenes(slug));
      if (sub === "build") return out({ dir: buildScene(slug, need(a2, "scene")) });
      if (sub === "check") {
        const res = await checkScene(slug, need(a2, "scene"), { frames: flags.frames ? Number(flags.frames) : undefined });
        out(json ? res : { ...res, hyperframes: { ...res.hyperframes, output: res.hyperframes.ok ? "(ok)" : res.hyperframes.output } });
        if (!res.ok) process.exitCode = 1;
        return;
      }
      throw new Error(`unknown: scene ${sub}`);
    }

    case "sound": {
      const prov = flags.provider as any;
      const r = await prepareSound(need(sub, "slug"), prov ? { music: prov, sfx: prov } : undefined);
      return out({ music: r.music.length, sfx: r.sfx.length, total: r.total });
    }

    case "broll": {
      const slug = need(a1, "slug");
      const { storyboard, windows: wins, timing } = windows(slug);
      if (sub === "budget") return out(brollBudget(storyboard, wins, timing.total));
      if (sub === "gen") {
        const id = need(a2, "scene");
        const scene = storyboard.scenes.find((s) => s.id === id);
        if (!scene?.broll_prompt) throw new Error(`${id} has no broll_prompt`);
        const budget = brollBudget(storyboard, wins, timing.total);
        if (!budget.ok) throw new Error(budget.problems.join("; "));
        return out(await generateBroll(slug, id, scene.broll_prompt, wins.find((w) => w.id === id)!.duration));
      }
      throw new Error(`unknown: broll ${sub}`);
    }

    case "render":
      return out(await assemble(need(sub, "slug"), { draft: !!flags.draft }));

    case "qa": {
      if (sub !== "final") throw new Error("usage: yt qa final <slug>");
      const r = await qaFinal(need(a1, "slug"));
      out(r);
      if (!r.ok) process.exitCode = 1;
      return;
    }

    case "thumb": {
      const slug = need(a1, "slug");
      if (sub === "scaffold") return out({ wrote: scaffoldThumbnail(slug, String(flags.text ?? "")) });
      if (sub === "render") return out(await renderThumbnail(slug));
      throw new Error(`unknown: thumb ${sub}`);
    }

    case "sources":
      return out(writeSources(need(sub, "slug")));

    case "media": {
      const slug = need(a1, "slug");
      if (sub === "push") return out(await storage.push(slug));
      if (sub === "pull") return out(await storage.pull(slug));
      if (sub === "link") return out(storage.presign(slug, String(flags.path ?? "render/final.mp4")));
      throw new Error(`unknown: media ${sub}`);
    }

    case "youtube": {
      if (sub === "search") return out(await yt.search(need(a1, "query"), flags.max ? Number(flags.max) : undefined));
      const slug = need(a1, "slug");
      if (sub === "upload") return out(await yt.upload(slug));
      if (sub === "schedule") return out(await yt.schedule(slug, { at: flags.at as string | undefined, now: !!flags.now }));
      if (sub === "update") return out(await yt.updateMetadata(slug));
      if (sub === "analytics") return out(await yt.analytics(slug));
      throw new Error(`unknown: youtube ${sub}`);
    }

    case "cost": {
      const st = loadEpisode(need(sub, "slug"));
      return out({ total_usd: totalCost(st), entries: st.costs });
    }

    case "config":
      return out(channel());

    case "smoke":
      return out(await smoke({ keep: !!flags.keep }));

    default:
      throw new Error(`unknown command ${cmd}\n\n${HELP}`);
  }
}

main().catch((e) => {
  console.error(`yt: ${(e as Error).message}`);
  process.exit(1);
});
