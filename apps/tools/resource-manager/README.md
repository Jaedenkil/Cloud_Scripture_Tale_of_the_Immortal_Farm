# 资源管理器模块（首版）

## 首版目标

- 生成统一资源索引。
- 按规则执行资源命名校验（地块资源优先）。
- 为 UI 工作面提供稳定数据接口输入。

## 非目标

- 不做复杂图像编辑。
- 不做 Spine 骨骼编辑替代。
- 不做发布流水线。

## 模块文件

- `resource-index.schema.json`：索引结构契约。
- `resource-naming-rules.yaml`：命名规则与地块校验规则。
- `resource-indexer.js`：目录扫描与索引构建。
- `resource-validator.js`：命名与地块部位完整性校验。

## 说明

- 输出对象统一带 `issues` 字段，供 UI 层直接展示。
- 首版以静态扫描为主，后续再补热更新与增量索引。
