# Change: 新增开发工具聚合页与工具占位页

## Why

当前 `home` 页缺少“开发工具”统一入口，导致后续工具（如物块编辑器、资源管理器、任务编辑器等）无法形成稳定的导航骨架与一致的占位结构。先建立配置驱动的开发工具入口页与占位页模板，可以在不引入真实工具逻辑的前提下，先打通页面流转闭环并降低后续并行开发冲突。

## What Changes

- 在 `home` 页新增“开发工具”入口按钮，点击后进入开发工具聚合页。
- 新增开发工具聚合页（开发页）：
  - 统一陈列开发工具入口按钮。
  - 提供“返回”按钮返回 `home` 页。
- 为每个开发工具入口新增对应空白占位页模板：
  - 上区：工具名称 + 工具功能介绍。
  - 中区：空白占位区域（预留后续开发）。
  - 下区：`保存` 与 `后退` 按钮。
- 占位页点击 `后退` 必须返回开发工具聚合页。
- 本变更仅定义 OpenSpec 需求与执行清单，不在审批前实施代码或配置改动。

## Impact

- Affected specs:
  - `dev-tools-navigation`（新增能力）
- Affected code (planned, after approval):
  - `scenes/panel/home.yaml`
  - `scenes/ui-registry.yaml`
  - `scenes/ui-flow.yaml`
  - `scenes/panel/` 下开发工具聚合页与工具占位页 YAML
  - 相关 flow/ui 测试文件（按最终实现范围补充）
