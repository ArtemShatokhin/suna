import { describe, expect, test } from "bun:test";
import { parseShowOutput, parseSubmitOutput } from "../src/lib/review";

describe("kortix review submit output", () => {
  test("reads review_item_id (what the CLI actually returns)", () => {
    expect(parseSubmitOutput('{"review_item_id":"55db11a2-e259-4449-bc09-ab167ec8a230","status":"needs_you"}')).toBe("55db11a2-e259-4449-bc09-ab167ec8a230");
  });
  test("still accepts id / item.id / data.id shapes", () => {
    expect(parseSubmitOutput('{"id":"a"}')).toBe("a");
    expect(parseSubmitOutput('{"item":{"id":"b"}}')).toBe("b");
    expect(parseSubmitOutput('{"data":{"review_item_id":"c"}}')).toBe("c");
  });
  test("falls back to scanning non-JSON output", () => {
    expect(parseSubmitOutput('✓ submitted\n{"review_item_id": "d"')).toBe("d");
    expect(parseSubmitOutput("nothing here")).toBeUndefined();
  });
});

describe("kortix review show output", () => {
  test("reads the real item shape: status + feedback + acted_by", () => {
    const real = JSON.stringify({
      review_item_id: "55db11a2", kind: "decision", status: "approved", agent: "sound-editor",
      acted_by: "36fda367", acted_at: "2026-10-13T12:22:19.740Z", feedback: "2",
    });
    expect(parseShowOutput(real)).toEqual({ verdict: "approved", note: "2", by: "36fda367" });
  });
  test("a pending item has no note and a needs_you status", () => {
    expect(parseShowOutput(JSON.stringify({ status: "needs_you" }))).toMatchObject({ verdict: "needs_you", note: undefined });
  });
});
