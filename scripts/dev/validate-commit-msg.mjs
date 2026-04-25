import fs from "node:fs";
import path from "node:path";

const ALLOWED_TYPES = ["功能", "修复", "文档", "样式", "重构", "测试", "构建", "杂项"];
const GENERIC_DESCRIPTIONS = new Set([
  "提交当前全部改动",
  "提交当前全部变更",
  "提交全部改动",
  "提交全部变更",
  "同步改动",
  "同步变更",
  "更新",
  "修改",
  "杂项更新"
]);

function fail(message) {
  console.error(`❌ ${message}`);
  console.error("提交信息必须使用格式：<类型>: <描述>");
  console.error(`允许类型：${ALLOWED_TYPES.join("/")}`);
  process.exit(1);
}

function readCommitMessage(filePath) {
  if (!filePath) {
    fail("未提供 commit message 文件路径。");
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`commit message 文件不存在：${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines[0] ?? "";
}

function validate(message) {
  if (!message) {
    fail("提交信息为空。");
  }

  // 允许 Git 自动生成的合并/回滚提交。
  if (message.startsWith("Merge ") || message.startsWith("Revert ")) {
    return;
  }

  const formatMatch = message.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (!formatMatch) {
    fail(`提交信息格式不正确：${message}`);
  }

  const [, type, descriptionRaw] = formatMatch;
  const description = descriptionRaw.trim();

  if (!ALLOWED_TYPES.includes(type)) {
    fail(`提交类型不合法：${type}`);
  }

  if (description.length < 4) {
    fail("提交描述过短，请明确说明改动内容（至少 4 个字符）。");
  }

  if (!/[\u4e00-\u9fff]/.test(description)) {
    fail("提交描述必须包含中文。");
  }

  if (GENERIC_DESCRIPTIONS.has(description)) {
    fail(`提交描述过于笼统：${description}`);
  }
}

const commitMessageFile = process.argv[2];
const message = readCommitMessage(commitMessageFile);
validate(message);
console.log("✅ commit message 校验通过");
