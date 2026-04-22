# 依赖清单（方案 A：Phaser 路线）

## 0. 方案目标

目标：在 Electron + JS 下，快速跑通 2D 等距伪3D配置驱动游戏的 MVP。
核心原则：避免重复造轮子，优先使用成熟稳定依赖。

## 1. 必装依赖（当前阶段）

### 1.1 渲染与运行时
- phaser@^3.80.1
  - 职责：2D 游戏循环、渲染、输入、相机、场景管理。

### 1.2 配置驱动与热更新
- ajv@^8.17.1
  - 职责：配置 Schema 校验（类型、必填、约束、引用合法性）。
- fast-glob@^3.3.3
  - 职责：批量扫描配置目录，生成配置索引。
- chokidar@^3.6.0
  - 职责：监听本地配置变更，驱动热重载。

### 1.3 规则与状态
- xstate@^5.30.0
  - 职责：任务流、对话流、UI 流转状态机。
- json-logic-js@^2.0.5
  - 职责：任务条件、技能触发、掉落条件等规则表达式执行。

### 1.4 测试（最小保障）
- vitest@^1.6.1
  - 职责：配置编译、规则执行、状态流的单元测试。

## 2. 已有依赖（建议保留）

- js-yaml@^4.1.1：YAML 解析。
- electron-store@^8.1.0：本地设置与轻量存档。
- howler@^2.2.4：音频播放。
- simplex-noise@^4.0.1：程序化噪声。
- alea@^1.0.1：可复现随机数。
- @esotericsoftware/spine-canvas@^4.2.110：Spine 动画运行时。

## 3. 延后安装（MVP 后）

- playwright
  - 职责：核心流程冒烟测试（建造 -> 采集 -> 种植 -> 任务触发）。
- better-sqlite3
  - 职责：当存档和任务规模扩大后做结构化持久化。

## 4. 可移除依赖（若明确走 2D 方案 A）

- @babylonjs/core
- @babylonjs/gui
- noa-engine

说明：以上 3 个依赖偏 3D 体素路线，若当前阶段确认不走真3D体素，可移除以降低复杂度和维护成本。

## 5. 安装命令（新增）

```bash
npm install phaser@^3.80.1 fast-glob@^3.3.3 xstate@^5.30.0 json-logic-js@^2.0.5
npm install -D ajv@^8.17.1 chokidar@^3.6.0 vitest@^1.6.1
```

## 6. 移除命令（可选）

```bash
npm uninstall @babylonjs/core @babylonjs/gui noa-engine
```

## 7. 完成定义（DoD）

- 配置改动可被监听并触发热更新。
- 配置在启动前可通过 ajv 完整校验。
- 至少 1 条任务和 1 个技能规则通过 json-logic-js 执行。
- 至少 1 条任务流通过 xstate 管理并可视化日志追踪。
- vitest 覆盖配置编译和规则执行的关键路径。

## 8. 采纳建议

- 先安装必装依赖并跑通最小闭环。
- 再根据阶段进度决定是否移除 3D 路线依赖。
- 里程碑稳定后补充 playwright 自动化冒烟。