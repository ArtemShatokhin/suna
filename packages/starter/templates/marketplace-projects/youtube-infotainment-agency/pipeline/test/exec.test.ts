import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { channel, setChannel } from "../src/config";
import { heavyJobSlots, withHeavySlot } from "../src/lib/exec";

/** One heavy job's measured cost, scaled so the sandbox fits exactly `n` of them. */
function fitSlots(n: number) {
  const cfg = structuredClone(channel());
  cfg.parallel.heavy_job.cores = cpus().length / n;
  setChannel(cfg);
}

describe("heavy-job slots", () => {
  beforeEach(() => {
    process.env.YT_HEAVY_SLOTS_DIR = mkdtempSync(join(tmpdir(), "yt-slots-"));
    setChannel(undefined);
  });
  afterEach(() => setChannel(undefined));

  test("slots follow the sandbox's cores and the measured cost of one job", () => {
    fitSlots(3);
    expect(heavyJobSlots()).toBe(3);
    fitSlots(1);
    expect(heavyJobSlots()).toBe(1);
  });

  test("with one slot, heavy jobs run one at a time", async () => {
    fitSlots(1);
    const spans: [number, number][] = [];
    const job = () => withHeavySlot(async () => { const s = Date.now(); await Bun.sleep(150); spans.push([s, Date.now()]); });
    await Promise.all([job(), job(), job()]);
    spans.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]);
  });

  test("with two slots, two jobs overlap", async () => {
    fitSlots(2);
    const spans: [number, number][] = [];
    const job = () => withHeavySlot(async () => { const s = Date.now(); await Bun.sleep(300); spans.push([s, Date.now()]); });
    await Promise.all([job(), job()]);
    spans.sort((a, b) => a[0] - b[0]);
    expect(spans[1]![0]).toBeLessThan(spans[0]![1]);
  });

  test("a slot left by a dead process is reclaimed", async () => {
    fitSlots(1);
    const slot = join(process.env.YT_HEAVY_SLOTS_DIR!, "slot-0");
    mkdirSync(slot);
    writeFileSync(join(slot, "pid"), "999999999");
    expect(await withHeavySlot(async () => "ran")).toBe("ran");
  });
});
