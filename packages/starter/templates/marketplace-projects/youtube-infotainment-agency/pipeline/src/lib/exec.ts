import { existsSync } from "node:fs";
import { join } from "node:path";
import { PIPELINE } from "./paths";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a command, capturing output. Throws on non-zero exit unless `allowFail`. */
export async function run(
  cmd: string[],
  opts: { cwd?: string; allowFail?: boolean; env?: Record<string, string>; quiet?: boolean } = {},
): Promise<RunResult> {
  if (!opts.quiet && process.env.YT_VERBOSE) console.error(`$ ${cmd.join(" ")}`);
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0 && !opts.allowFail) {
    const tail = (stderr || stdout).split("\n").slice(-25).join("\n");
    throw new Error(`command failed (${code}): ${cmd.join(" ")}\n${tail}`);
  }
  return { code, stdout, stderr };
}

/** The pinned HyperFrames CLI from pipeline/node_modules (falls back to npx). */
export function hyperframes(): string[] {
  const local = join(PIPELINE, "node_modules", ".bin", "hyperframes");
  return existsSync(local) ? [local] : ["npx", "-y", "hyperframes@0.8.151"];
}

export async function ffprobeDuration(path: string): Promise<number> {
  const { stdout } = await run([
    "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path,
  ]);
  return Number.parseFloat(stdout.trim());
}

export async function ffprobeJson(path: string): Promise<any> {
  const { stdout } = await run([
    "ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path,
  ]);
  return JSON.parse(stdout);
}
