import { beforeEach, describe, expect, test } from "bun:test";
import { brollBudget } from "../src/broll";
import { channel, setChannel } from "../src/config";
import { completeStage, decideGate, newEpisode, nextAction, reopen, requestGate, startStage, failStage } from "../src/episode";
import { Storyboard } from "../src/schemas";
import { fixture, tempEpisode } from "./helpers";

beforeEach(() => tempEpisode());

describe("episode state machine", () => {
  test("starts at topic", () => {
    expect(nextAction(newEpisode("_smoke", "t"))).toMatchObject({ action: "run_stage", stage: "topic", agent: "topic-scout" });
  });
  test("a human gate blocks the next stage until approved", () => {
    const st = newEpisode("_smoke", "t");
    startStage(st, "topic");
    completeStage(st, "topic");
    expect(nextAction(st)).toMatchObject({ action: "await_gate", gate: "topic", mode: "human" });
    expect(() => startStage(st, "research")).toThrow(/gate topic/);
    expect(() => decideGate(st, "topic", true, "critic")).toThrow(/human/);
    decideGate(st, "topic", true, "reviewer");
    expect(nextAction(st)).toMatchObject({ action: "run_stage", stage: "research" });
  });
  test("an approved gate can't be re-requested", () => {
    const st = newEpisode("_smoke", "t");
    startStage(st, "topic");
    completeStage(st, "topic");
    requestGate(st, "topic");
    decideGate(st, "topic", true, "reviewer");
    expect(() => requestGate(st, "topic")).toThrow(/already approved/);
  });
  test("cannot skip ahead", () => {
    const st = newEpisode("_smoke", "t");
    expect(() => startStage(st, "script")).toThrow(/topic is pending/);
  });
  test("completing requires the declared outputs", () => {
    const st = newEpisode("_smoke", "t");
    startStage(st, "topic");
    completeStage(st, "topic");
    decideGate(st, "topic", true, "reviewer");
    startStage(st, "research");
    process.env.YT_EPISODES_DIR = "/nonexistent";
    expect(() => completeStage(st, "research")).toThrow(/missing outputs/);
  });
  test("repeated failures block and escalate", () => {
    const st = newEpisode("_smoke", "t");
    for (let i = 0; i < 4; i++) { startStage(st, "topic"); failStage(st, "topic", "weak angle"); }
    expect(nextAction(st, 4)).toMatchObject({ action: "blocked", stage: "topic" });
  });
  test("rejected gate blocks; reopen resets downstream", () => {
    const st = newEpisode("_smoke", "t");
    startStage(st, "topic");
    completeStage(st, "topic");
    decideGate(st, "topic", false, "reviewer", "too generic");
    expect(nextAction(st)).toMatchObject({ action: "blocked" });
    reopen(st, "topic", "too generic");
    expect(st.gates.topic.status).toBe("closed");
    expect(nextAction(st)).toMatchObject({ action: "run_stage", stage: "topic", attempt: 2 });
  });
  test("auto gates don't wait", () => {
    const cfg = structuredClone(channel());
    cfg.gates.topic = "auto";
    setChannel(cfg);
    const st = newEpisode("_smoke", "t");
    startStage(st, "topic");
    completeStage(st, "topic");
    expect(nextAction(st)).toMatchObject({ action: "run_stage", stage: "research" });
    setChannel(undefined);
  });
});

describe("b-roll caps", () => {
  test("genbroll scenes need broll.enabled and stay under the runtime cap", () => {
    const sb = Storyboard.parse(fixture("04-visual/storyboard.json"));
    sb.scenes[1]!.type = "genbroll";
    const wins = [{ id: "sc01", start: 0, end: 5, duration: 5, beats: ["b01"] }, { id: "sc02", start: 5, end: 15, duration: 10, beats: ["b02"] }, { id: "sc03", start: 15, end: 20, duration: 5, beats: ["b03"] }];
    const b = brollBudget(sb, wins, 20);
    expect(b.ok).toBe(false);
    expect(b.problems.join()).toMatch(/disabled|enabled is false/);
    expect(b.problems.join()).toMatch(/50% of runtime/);
  });
});
