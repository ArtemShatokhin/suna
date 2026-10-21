/**
 * Storyboard helpers. The style frame sheet tiles every scene's style frame into one image, so the art
 * director and the critic look at the whole board once instead of opening each PNG while they work.
 */
import { isAbsolute, join } from "node:path";
import { run } from "./lib/exec";
import { ensureDir, load } from "./lib/io";
import { ep } from "./lib/paths";
import { Storyboard } from "./schemas";

/** Tile width; 3 columns of 640 px keep a 6-scene sheet readable in one image. */
const COLUMNS = 3;
const TILE = { w: 640, h: 360 };

export async function styleframeSheet(slug: string): Promise<{ sheet: string; scenes: string[] }> {
  const p = ep(slug);
  const frames = load(Storyboard, p.storyboard).scenes
    .filter((s) => s.styleframe)
    .map((s) => ({ id: s.id, file: isAbsolute(s.styleframe!) ? s.styleframe! : join(p.root, s.styleframe!) }));
  if (!frames.length) throw new Error(`no style frames in ${p.storyboard}: set scenes[].styleframe first`);

  const rows = Math.ceil(frames.length / COLUMNS);
  const fit = `scale=${TILE.w}:${TILE.h}:force_original_aspect_ratio=decrease,pad=${TILE.w}:${TILE.h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  const graph = [
    ...frames.map((_, i) => `[${i}:v]${fit}[f${i}]`),
    `${frames.map((_, i) => `[f${i}]`).join("")}concat=n=${frames.length}:v=1:a=0,tile=${COLUMNS}x${rows}:padding=4:color=black`,
  ].join(";");
  ensureDir(p.qa);
  const sheet = join(p.qa, "styleframes.jpg");
  await run(["ffmpeg", "-y", "-v", "error", ...frames.flatMap((f) => ["-i", f.file]), "-filter_complex", graph, "-frames:v", "1", "-q:v", "3", sheet]);
  return { sheet, scenes: frames.map((f) => f.id) };
}
