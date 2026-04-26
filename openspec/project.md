# Project Context

## Purpose

`Cloud Scripture: Tale of the Immortal Farm（云笈仙田录）` 是一个以“修仙 + 田园 + 配置驱动 UI 流程”为核心的 Electron 桌面游戏项目。

当前阶段目标：

- 先跑通配置驱动 MVP 闭环（页面流程、设置面板、退出确认、输入阻塞、基础世界/HUD/面板/系统分层）。
- 建立稳定的 YAML 配置加载、校验、运行时渲染与动作分发链路。
- 以最小改动持续迭代玩法系统（种植、采集、任务、角色交互、建造等）。

## Tech Stack

- Runtime / App Shell

  - Electron `^28.1.0`
  - Node.js（主进程 + 构建脚本）

- Frontend / Game Runtime

  - JavaScript（ESM `.mjs` + 部分 CommonJS）
  - Vite `^5.0.10`
  - Phaser `^3.80.1`

- Config & Validation

  - YAML（`js-yaml`）
  - `ajv` + `ajv-formats`
  - `json-logic-js`
  - `xstate`

- Data / Utility

  - `electron-store`
  - `eventemitter3`
  - `deepmerge`
  - `fast-glob`
  - `chokidar`

- Media

  - `howler`
  - `@esotericsoftware/spine-canvas`

- Testing & Packaging
  - Vitest `^1.6.1`
  - jsdom `^29.0.2`
  - electron-builder `^24.9.1`

## Project Conventions

### Code Style

- 采用“服务化 + 配置驱动”代码风格，核心逻辑集中在 `scripts/services/*.mjs`。
- 优先使用结构化断言与错误对象：`assert` + `CommonError` + `app-codes`（禁止散装字符串错误）。
- 运行时入口保持薄层：渲染进程 `src/renderer/main.js` 仅负责装配 `AppBootstrap`。
- 变更遵循最小改动原则：不做与需求无关的重构与风格漂移。
- 命名与组织：
  - 文件：kebab-case（如 `flow-runtime.mjs`）
  - YAML id：语义化短横线命名（如 `home-page`、`exit-confirm`）
  - 配置与实现一一映射（registry/flow/theme/scene 分离）

### Architecture Patterns

- 配置分层（单一职责）：

  - `scenes/ui-registry.yaml`：页面注册与别名
  - `scenes/ui-flow.yaml`：节点、跳转、fallback、转场预设
  - `scenes/theme.yaml`：主题 token
  - `scenes/{world,hud,panel,system}/*.yaml`：具体场景

- 服务分层（运行时管线）：

  - `RegistryService`：页面与别名解析
  - `FlowService`：流程节点/跳转查询
  - `SceneService`：场景与主题加载、最小结构校验
  - `FlowValidator`：启动前流程与场景门禁校验
  - `FlowRuntime`：动作/定时器/fallback 驱动跳转
  - `UIRenderer`：多 Domain DOM 渲染与输入优先级控制
  - `ActionBus` + `ButtonActionExecutor`：动作通道与处理器映射

- 启动门禁（必须全部通过）：

  1. Registry 加载
  2. Flow 加载
  3. Theme 加载
  4. FlowValidator 校验
  5. Runtime 启动

- 四域分层（由下到上）：`world < hud < panel < system`，并有固定深度号段与输入阻塞策略。

### Testing Strategy

- 测试框架：Vitest（`npm test`），UI 相关使用 jsdom 环境。
- 测试分层：
  - 流程集成测试：验证 `FlowRuntime` 节点跳转与 modal 交互（如 `exit-modal-flow.spec.mjs`）。
  - 渲染层测试：验证 Domain 层级优先级、输入阻塞、设置面板交互（如 `layer-priority.spec.mjs`、`blocker.spec.mjs`、`settings-panel.spec.mjs`）。
  - 校验器测试：验证场景层 inputPolicy 与组件约束（如 `layer-input-policy.spec.mjs`）。
- 变更要求：涉及运行时、流程、UI 交互的改动应补充或更新对应测试，至少保证相关测试文件通过。

### Git Workflow

- OpenSpec 驱动：

  - 新功能/破坏性变更/架构调整：先走 proposal（`openspec/changes/*`），审批后实现。
  - 缺陷修复、文档/格式小改：可直接修复。

- 提交门禁（由 `.githooks/commit-msg` + `scripts/dev/validate-commit-msg.mjs` 执行）：

  - 提交信息格式：`<类型>: <描述>`
  - 类型限定：`功能/修复/文档/样式/重构/测试/构建/杂项`
  - 描述必须包含中文且不能过于笼统。

- Hooks 安装：`prepare` / `setup:hooks` 自动配置 `core.hooksPath=.githooks`。

- 分支实践（建议）：`main` 保持稳定，开发任务使用 `feature/*` 与 `fix/*` 分支。

## Domain Context

- 世界观与玩法定位：修仙题材下的田园经营与成长循环。
- 当前范围（MVP）：种植、采集、任务、角色交互、建造，以及围绕这些系统的 UI 流程与设置交互。
- UI 交互特征：
  - 使用四域 Scene 分层（world/hud/panel/system）
  - 系统层可触发全局输入阻塞（如退出确认 modal）
  - 设置页存在“草稿-应用-返回确认”的状态交互
- 配置优先：尽量通过 YAML 调整页面关系、主题与场景，而不是在运行时代码硬编码页面流转。

## Important Constraints

- 单一规范源：功能实现与 BUG 修复流程、技能命中与读取门禁，统一以 `docs/代码约束规范.md` 为准。
- 文档优先级：若其他约束文档与 `docs/代码约束规范.md` 发生冲突，以 `docs/代码约束规范.md` 为最高优先级。
- 执行前置：进入实现前必须先读取 `docs/代码约束规范.md`，并在结果中附带技能命中报告。

## External Dependencies

- 当前阶段以本地离线能力为主，暂无强依赖云端 API。
- 核心第三方依赖：
  - 渲染与交互：Phaser、Spine Canvas、Howler
  - 配置与规则：js-yaml、ajv、json-logic-js、xstate
  - 桌面与存储：Electron、electron-store
  - 测试与构建：Vitest、jsdom、Vite、electron-builder
- 运行环境依赖：Node.js + npm（用于脚本、测试、构建与 hooks 安装）。
