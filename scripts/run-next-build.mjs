import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const projectRoot = process.cwd();
const buildDir = path.join(projectRoot, "build");

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function prepareWindowsBuildDirectory() {
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "arqive-ai-next-build-"));

  removeIfExists(buildDir);
  fs.symlinkSync(targetDir, buildDir, "junction");

  return targetDir;
}

const env = { ...process.env };
if (process.platform === "win32") {
  prepareWindowsBuildDirectory();
  env.NODE_PATH = path.join(projectRoot, "node_modules");
  env.NEXT_BUILD_DIST_DIR = "build";
}

const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  cwd: projectRoot,
  env,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);