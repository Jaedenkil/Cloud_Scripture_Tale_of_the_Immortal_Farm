import fs from "node:fs";
import path from "node:path";

const REQUIRED_STEPS = [
  { number: 1, title: "Step 1：三因分析与疑点确认" },
  { number: 2, title: "Step 2：零改码验证（不修改现有代码）" },
  { number: 3, title: "Step 3：工程化逐步修改流程与评分" },
  { number: 4, title: "Step 4：结果汇总与人工确认" },
  { number: 5, title: "Step 5：按审定流程严格执行与报告" }
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function getTasksFilePath(changeId) {
  if (!changeId) {
    fail("未提供 change-id。用法：npm run validate:openspec:tasks -- <change-id>");
  }

  const tasksPath = path.resolve(
    process.cwd(),
    "openspec",
    "changes",
    changeId,
    "tasks.md"
  );

  if (!fs.existsSync(tasksPath)) {
    fail(`未找到 tasks.md：${tasksPath}`);
  }

  return tasksPath;
}

function findStepMatches(content) {
  return REQUIRED_STEPS.map((step) => {
    const pattern = new RegExp(
      String.raw`^####\s*Step\s*${step.number}\s*[：:].*$`,
      "gim"
    );
    const match = pattern.exec(content);

    return {
      step,
      index: match ? match.index : -1,
      heading: match ? match[0].trim() : ""
    };
  });
}

function assertStepStructure(content) {
  const matches = findStepMatches(content);

  for (const item of matches) {
    if (item.index < 0) {
      fail(`缺少必填步骤标题：${item.step.title}`);
    }
  }

  for (let i = 1; i < matches.length; i += 1) {
    if (matches[i].index <= matches[i - 1].index) {
      fail("Step 标题顺序错误，必须从 Step 1 到 Step 5 递增。");
    }
  }

  return matches;
}

function assertStepChecklist(content, matches) {
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const section = content.slice(start, end);

    const hasChecklist = /^\s*-\s\[[ xX]\]\s+/m.test(section);
    const hasOrderedList = /^\s*\d+\.\s+/m.test(section);

    if (!hasChecklist && !hasOrderedList) {
      fail(
        `${matches[i].step.title} 缺少具体执行子步骤（需要 checklist 或有序列表）。`
      );
    }
  }
}

function assertNoMissingChineseTitle(matches) {
  for (const item of matches) {
    const expectedTitle = item.step.title;
    const expectedText = expectedTitle.split("：")[1];

    if (!item.heading.includes(expectedText)) {
      fail(
        `${expectedTitle} 标题不完整，请保持 8.4 原文语义（当前：${item.heading}）。`
      );
    }
  }
}

function main() {
  const changeId = process.argv[2]?.trim();
  const tasksFilePath = getTasksFilePath(changeId);
  const content = fs.readFileSync(tasksFilePath, "utf8");

  const matches = assertStepStructure(content);
  assertNoMissingChineseTitle(matches);
  assertStepChecklist(content, matches);

  console.log(`✅ OpenSpec tasks 8.4 校验通过：${tasksFilePath}`);
}

main();
