/**
 * The episode state machine. `episode.yaml` is the single source of truth for where an episode is;
 * every stage is idempotent and resumable because sandboxes die (~4h) and sessions are re-keyed.
 */
import { existsSync } from "node:fs";
import { z } from "zod";
import { channel, GateMode } from "./config";
import { load, writeYaml } from "./lib/io";
import { ep, type EpisodePaths } from "./lib/paths";

export const STAGES = [
  "topic", "research", "factcheck", "script", "voice", "storyboard", "scenes", "sound", "render", "package", "publish", "followup",
] as const;
export type Stage = (typeof STAGES)[number];

export const GATES = ["topic", "script", "storyboard", "final"] as const;
export type Gate = (typeof GATES)[number];

/** Which gate (if any) must be approved after a stage completes, before the next stage may start. */
export const GATE_AFTER: Partial<Record<Stage, Gate>> = {
  topic: "topic",
  script: "script",
  storyboard: "storyboard",
  package: "final",
};

export interface StageSpec {
  agent: string;
  skills: string[];
  rubric?: string;
  outputs: (p: EpisodePaths) => string[];
  summary: string;
}

export const STAGE_SPECS: Record<Stage, StageSpec> = {
  topic: {
    agent: "topic-scout", skills: ["editorial-framing"], rubric: "rubrics/topic.md",
    outputs: (p) => [p.brief], summary: "Pick and frame the question; prove originality against existing YouTube coverage.",
  },
  research: {
    agent: "researcher", skills: ["research-dossier"], rubric: "rubrics/research.md",
    outputs: (p) => [p.dossier, p.claims], summary: "Build the dossier and claims.json from primary sources.",
  },
  factcheck: {
    agent: "fact-checker", skills: ["claim-verification"],
    outputs: (p) => [p.factcheck], summary: "Independently re-fetch every source and verify every claim; `yt claims apply`.",
  },
  script: {
    agent: "scriptwriter", skills: ["edutainment-scriptwriting"], rubric: "rubrics/script.md",
    outputs: (p) => [p.script, p.scriptMd], summary: "Write script.json beat by beat; every fact cites verified claims.",
  },
  voice: {
    agent: "sound-editor", skills: ["narration-and-sound"],
    outputs: (p) => [p.timing], summary: "Generate narration per beat (`yt voice`) and lock timing.json.",
  },
  storyboard: {
    agent: "art-director", skills: ["art-direction"], rubric: "rubrics/storyboard.md",
    outputs: (p) => [p.storyboard], summary: "Storyboard scenes over locked timing, with style frames.",
  },
  scenes: {
    agent: "animator", skills: ["scene-animation", "hyperframes", "hyperframes-core", "hyperframes-animation"],
    rubric: "rubrics/scene.md",
    outputs: () => [], summary: "Build every scene as a HyperFrames composition; each passes `yt scene check` + critic.",
  },
  sound: {
    agent: "sound-editor", skills: ["narration-and-sound"],
    outputs: (p) => [p.sound], summary: "Music cues + SFX (`yt music`, `yt sfx`).",
  },
  render: {
    agent: "showrunner", skills: ["showrunner-loop"], rubric: "rubrics/final-cut.md",
    outputs: (p) => [p.final], summary: "`yt render` then `yt qa final`; critic watches the contact sheet.",
  },
  package: {
    agent: "packager", skills: ["packaging"], rubric: "rubrics/packaging.md",
    outputs: (p) => [p.pkg, p.thumbnailHtml], summary: "Titles, thumbnail, description, tags; `yt sources`, `yt thumb`.",
  },
  publish: {
    agent: "publisher", skills: ["youtube-publishing"],
    outputs: (p) => [p.publish], summary: "Upload private, captions, thumbnail; schedule only after the final gate.",
  },
  followup: {
    agent: "publisher", skills: ["post-mortem"],
    outputs: () => [], summary: "48h/7d analytics + comments → corrections, learnings in memory/.",
  },
};

const StageState = z.object({
  status: z.enum(["pending", "in_progress", "done", "failed", "skipped"]).default("pending"),
  attempts: z.number().default(0),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  score: z.number().optional(),
  note: z.string().optional(),
});
const GateState = z.object({
  mode: GateMode,
  status: z.enum(["closed", "requested", "approved", "rejected"]).default("closed"),
  by: z.string().optional(),
  at: z.string().optional(),
  notes: z.string().optional(),
  review_id: z.string().optional(),
});
const CostEntry = z.object({
  at: z.string(),
  stage: z.string(),
  provider: z.string(),
  item: z.string(),
  units: z.number(),
  unit: z.string(),
  usd: z.number(),
});

export const EpisodeState = z.object({
  slug: z.string(),
  title: z.string(),
  created_at: z.string(),
  stages: z.record(z.enum(STAGES), StageState),
  gates: z.record(z.enum(GATES), GateState),
  costs: z.array(CostEntry).default([]),
  log: z.array(z.object({ at: z.string(), msg: z.string() })).default([]),
});
export type EpisodeState = z.infer<typeof EpisodeState>;

const now = () => new Date().toISOString();

export function newEpisode(slug: string, title: string): EpisodeState {
  const gates = channel().gates;
  return {
    slug,
    title,
    created_at: now(),
    stages: Object.fromEntries(STAGES.map((s) => [s, { status: "pending", attempts: 0 }])) as EpisodeState["stages"],
    gates: Object.fromEntries(GATES.map((g) => [g, { mode: gates[g], status: "closed" }])) as EpisodeState["gates"],
    costs: [],
    log: [{ at: now(), msg: "episode created" }],
  };
}

export function loadEpisode(slug: string): EpisodeState {
  return load(EpisodeState, ep(slug).state);
}

export function saveEpisode(state: EpisodeState) {
  writeYaml(ep(state.slug).state, state);
}

export type NextAction =
  | { action: "run_stage"; stage: Stage; agent: string; skills: string[]; rubric?: string; summary: string; attempt: number }
  | { action: "await_gate"; gate: Gate; mode: z.infer<typeof GateMode>; status: string }
  | { action: "blocked"; stage: Stage; reason: string }
  | { action: "done" };

/** Pure decision function: what should happen next for this episode? */
export function nextAction(state: EpisodeState, maxAttempts = channel().critic.max_revisions + 1): NextAction {
  for (const stage of STAGES) {
    const s = state.stages[stage];
    if (s.status === "done" || s.status === "skipped") {
      const gate = GATE_AFTER[stage];
      if (gate && state.gates[gate].status !== "approved") {
        const g = state.gates[gate];
        if (g.mode === "auto") continue;
        if (g.status === "rejected") {
          return { action: "blocked", stage, reason: `gate ${gate} rejected: ${g.notes ?? "(no notes)"}; reopen with \`yt episode reopen\`` };
        }
        return { action: "await_gate", gate, mode: g.mode, status: g.status };
      }
      continue;
    }
    if (s.status === "failed" && s.attempts >= maxAttempts) {
      return { action: "blocked", stage, reason: `failed ${s.attempts} times: ${s.note ?? ""}`.trim() };
    }
    const spec = STAGE_SPECS[stage];
    return {
      action: "run_stage",
      stage,
      agent: spec.agent,
      skills: spec.skills,
      rubric: spec.rubric,
      summary: spec.summary,
      attempt: s.attempts + (s.status === "in_progress" ? 0 : 1),
    };
  }
  return { action: "done" };
}

export function startStage(state: EpisodeState, stage: Stage) {
  const s = state.stages[stage];
  if (s.status === "done") throw new Error(`${stage} already done; use \`yt episode reopen\``);
  const idx = STAGES.indexOf(stage);
  for (const prev of STAGES.slice(0, idx)) {
    const p = state.stages[prev];
    if (p.status !== "done" && p.status !== "skipped") throw new Error(`cannot start ${stage}: ${prev} is ${p.status}`);
    const gate = GATE_AFTER[prev];
    if (gate && state.gates[gate].mode !== "auto" && state.gates[gate].status !== "approved") {
      throw new Error(`cannot start ${stage}: gate ${gate} is ${state.gates[gate].status}`);
    }
  }
  if (s.status !== "in_progress") s.attempts += 1;
  s.status = "in_progress";
  s.started_at = now();
  log(state, `start ${stage} (attempt ${s.attempts})`);
}

/** Mark done only when every declared output exists. Schema validation is done by the caller (`yt validate`). */
export function completeStage(state: EpisodeState, stage: Stage, opts: { score?: number; note?: string } = {}) {
  const missing = STAGE_SPECS[stage].outputs(ep(state.slug)).filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`cannot complete ${stage}; missing outputs:\n  ${missing.join("\n  ")}`);
  const s = state.stages[stage];
  if (s.status !== "in_progress") throw new Error(`${stage} is ${s.status}, not in_progress`);
  s.status = "done";
  s.finished_at = now();
  if (opts.score !== undefined) s.score = opts.score;
  if (opts.note) s.note = opts.note;
  const gate = GATE_AFTER[stage];
  if (gate && state.gates[gate].mode !== "auto") state.gates[gate].status = "closed";
  log(state, `done ${stage}${opts.score !== undefined ? ` (score ${opts.score})` : ""}`);
}

export function failStage(state: EpisodeState, stage: Stage, note: string) {
  const s = state.stages[stage];
  s.status = "failed";
  s.note = note;
  log(state, `failed ${stage}: ${note}`);
}

/** Re-open a stage (and everything after it) — e.g. after a rejected gate or a factual correction. */
export function reopen(state: EpisodeState, stage: Stage, reason: string) {
  const idx = STAGES.indexOf(stage);
  for (const later of STAGES.slice(idx)) {
    const s = state.stages[later];
    if (s.status !== "pending") s.status = "pending";
    s.note = later === stage ? reason : `invalidated by reopen of ${stage}`;
  }
  for (const [stg, gate] of Object.entries(GATE_AFTER) as [Stage, Gate][]) {
    if (STAGES.indexOf(stg) >= idx) state.gates[gate].status = "closed";
  }
  log(state, `reopen ${stage}: ${reason}`);
}

export function requestGate(state: EpisodeState, gate: Gate, reviewId?: string) {
  const g = state.gates[gate];
  if (g.status === "approved") throw new Error(`gate ${gate} is already approved; reopen a stage to change it`);
  g.status = "requested";
  g.at = now();
  if (reviewId) g.review_id = reviewId;
  log(state, `gate ${gate} requested (${g.mode})`);
}

export function decideGate(state: EpisodeState, gate: Gate, approve: boolean, by: string, notes?: string) {
  const g = state.gates[gate];
  if (g.mode === "human" && by === "critic") throw new Error(`gate ${gate} needs a human decision`);
  g.status = approve ? "approved" : "rejected";
  g.by = by;
  g.at = now();
  g.notes = notes;
  log(state, `gate ${gate} ${g.status} by ${by}${notes ? `: ${notes}` : ""}`);
}

export function addCost(state: EpisodeState, entry: Omit<z.infer<typeof CostEntry>, "at">) {
  state.costs.push({ at: now(), ...entry });
}

export function totalCost(state: EpisodeState): number {
  return Math.round(state.costs.reduce((a, c) => a + c.usd, 0) * 100) / 100;
}

function log(state: EpisodeState, msg: string) {
  state.log.push({ at: now(), msg });
}
