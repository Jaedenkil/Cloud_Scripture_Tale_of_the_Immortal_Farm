import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function inGitRepo() {
  try {
    const output = execSync("git rev-parse --is-inside-work-tree", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    }).trim();
    return output === "true";
  } catch {
    return false;
  }
}

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (!inGitRepo()) {
  console.log("[hooks] 当前目录不是 Git 仓库，跳过 hooks 安装。");
  process.exit(0);
}

const repoRoot = process.cwd();
const hooksDir = path.join(repoRoot, ".githooks");
const commitMsgHook = path.join(hooksDir, "commit-msg");

if (!fs.existsSync(commitMsgHook)) {
  console.error("[hooks] 未找到 .githooks/commit-msg，无法安装提交门禁。");
  process.exit(1);
}

run("git config core.hooksPath .githooks");

try {
  fs.chmodSync(commitMsgHook, 0o755);
} catch {
  // Windows 可能忽略 chmod，属于预期行为。
}

console.log("[hooks] 已启用 core.hooksPath=.githooks");
console.log("[hooks] commit-msg 门禁已安装");
