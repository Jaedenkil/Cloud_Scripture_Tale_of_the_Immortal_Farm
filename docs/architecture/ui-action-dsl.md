# UI Action DSL 说明

## 目标

将页面交互从渲染层硬编码分支迁移到静态配置，通过动作定义与规则求值实现配置驱动执行。

## 单一配置源

- UI 索引: configs/ui/index.yaml
- 动作定义: configs/ui/actions/action-definitions.yaml
- 页面配置: configs/ui/pages/*.yaml

## 动作定义结构

```yaml
actions:
  action-id:
    precondition:
      and:
        - exists: state.someField
        - var: capabilities.someFlag
    blockedNotice: 条件不满足时提示
    effects:
      - type: setState
        key: activePage
        value: main-menu
      - type: callHandler
        name: someHandler
      - type: closeWindow
```

## 页面动作引用

页面内仅通过 action id 声明行为，不在渲染层新增 if(action===...) 分支。

```yaml
actions:
  - id: apply-resolution
    text: 应用分辨率
    type: primary
    disabled:
      not:
        exists: state.selectedResolutionId
```

## 支持的规则字段

- visible: 控制是否渲染
- disabled: 控制是否可点击
- precondition: 动作执行前校验

## 执行链路

1. renderer 读取页面动作 id 与可选覆盖字段
2. 通过 getActionDefinition 获取动作定义
3. RuleEngine 对 visible/disabled/precondition 求值
4. ActionExecutor 顺序执行 effects
5. onAfterExecute 统一触发页面重渲染

## 验证门禁

1. 编译检查: get_errors 为 0
2. 运行检查: npm start 启动稳定，无新增错误
3. 行为回归: 主菜单、设置、游戏内、开发台关键动作可执行
4. 收敛检查: 移除渲染层动作硬编码分支
