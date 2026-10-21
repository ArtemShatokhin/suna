import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { run } from "../src/lib/exec";
import { readJson, writeJson } from "../src/lib/io";
import { ep } from "../src/lib/paths";
import { styleframeSheet } from "../src/storyboard";
import { tempEpisode } from "./helpers";

/** A solid-colour 960×540 PNG, the size the art-direction skill asks for. */
const still = (path: string, color: string) =>
  run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", `color=c=${color}:s=960x540`, "-frames:v", "1", path]);

describe("style frame sheet", () => {
  beforeEach(() => tempEpisode());

  test("tiles every scene's style frame, in storyboard order, into one image", async () => {
    const p = ep("_smoke");
    const sb = readJson<any>(p.storyboard);
    mkdirSync(join(p.root, "04-visual", "styleframes"), { recursive: true });
    await still(join(p.root, "04-visual/styleframes/sc01.png"), "red");
    await still(join(p.root, "04-visual/styleframes/sc03.png"), "blue");
    sb.scenes[0].styleframe = "04-visual/styleframes/sc01.png";
    sb.scenes[2].styleframe = "04-visual/styleframes/sc03.png";
    writeJson(p.storyboard, sb);

    const r = await styleframeSheet("_smoke");
    expect(r.scenes).toEqual(["sc01", "sc03"]);
    expect(existsSync(r.sheet)).toBe(true);
  });

  test("a storyboard without style frames is an error, not an empty sheet", async () => {
    await expect(styleframeSheet("_smoke")).rejects.toThrow(/no style frames/);
  });
});
