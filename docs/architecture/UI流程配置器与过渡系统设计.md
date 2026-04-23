# UI 流程配置器与过渡系统设计

## 1. 目标

构建一套基于本地 YAML 静态配置的 UI 流程配置器，用于描述页面关系树、页面跳转规则与过渡效果。

核心目标：

1. 页面关系配置化：页面跳转关系由 YAML 管理，不在页面代码中硬编码。
2. 过渡效果配置化：支持渐隐、滑动、遮罩揭示等转场及其时长、延迟、缓动配置。
3. 可扩展与可复用：支持过渡预设与守卫条件，便于统一风格与后续扩展。
4. 可嵌入游戏主循环：通过运行时流程引擎与现有 UI action/event 体系联动。

## 2. 参考案例

参考：Stardew Valley 的启动与主菜单流程
实现方式：品牌/开场后进入主菜单，主菜单分流到新建、读档、设置等页面
适用性：适用
本项目调整：将页面分流关系抽象为流程树节点与跳转边

参考：Hades 的菜单、设置与返回链
实现方式：主菜单、设置、确认弹窗具备统一路由关系与返回路径
适用性：适用
本项目调整：引入流程历史栈与 fallback 兜底节点

参考：Terraria 的面板交互阻塞策略
实现方式：面板开启时接管输入，底层世界保留渲染
适用性：适用
本项目调整：转场执行时支持 blockInput，避免跳转期间误触

## 3. 系统范围

本系统负责：

1. 页面节点建模（node/page/domain）
2. 页面关系建模（transition）
3. 跳转触发（trigger）
4. 条件守卫（guard）
5. 转场执行（transition effects）
6. 返回链与兜底（history/fallback）

本系统不负责：

1. 页面组件绘制细节
2. 业务系统内核逻辑（农场、战斗等）
3. 存档读写实现细节（仅调用守卫或副作用接口）

## 4. 架构总览

## 4.1 配置层

1. 流程配置文件：定义 flow、nodes、transitions、guards、transitionPresets
2. 页面配置文件：维持既有 scenes/* 页面结构
3. 主题配置文件：维持 theme token 体系

## 4.2 运行时层

1. FlowConfigLoader：加载并校验流程配置
2. FlowRuntime：维护当前节点、历史栈、分发事件
3. GuardResolver：解析并执行 guard
4. TransitionManager：执行转场动画与输入阻塞
5. EffectRunner：执行进入/离开副作用
6. FlowBridge：对接 UI actionId 与事件总线

## 4.3 集成层

1. 应用启动时初始化流程引擎
2. 进入 entry 节点并渲染首屏
3. UI 动作仅发 actionId/eventId，交由 FlowRuntime 决策

## 5. 流程配置模型

## 5.1 顶层结构建议

1. flow：流程元信息与全局默认值
2. nodes：节点列表
3. guards：守卫定义
4. transitionPresets：转场预设

## 5.2 节点（node）字段

1. id：节点唯一标识
2. pageId：目标页面标识
3. domain：world/hud/panel/system
4. onEnter：进入节点副作用
5. onExit：离开节点副作用
6. transitions：跳转规则数组
7. fallback：无可用跳转时兜底节点

## 5.3 跳转（transition）字段

1. trigger：auto/timer/uiAction/event
2. fromActionId：当 trigger=uiAction 时使用
3. eventId：当 trigger=event 时使用
4. afterMs：当 trigger=timer 时使用
5. guard：守卫 ID 或表达式
6. to：目标节点 ID
7. effects：本次跳转附加副作用
8. transition：本次跳转转场配置（可覆盖预设）

## 6. 过渡系统设计

## 6.1 过渡描述模型

1. type：转场类型
2. durationMs：时长
3. delayMs：延迟
4. easing：缓动曲线
5. blockInput：是否阻塞输入
6. skippable：是否可跳过
7. phase：enter/exit/between
8. params：类型参数

## 6.2 基础转场类型

1. fade：淡入淡出
2. crossFade：交叉淡变
3. wipe：方向擦除
4. slide：滑入滑出
5. zoom：缩放切换
6. blurFade：轻模糊过渡
7. maskReveal：遮罩揭示
8. cut：硬切
9. hold：停顿占位
10. flash：短闪切换

## 6.3 古风预设建议（示例）

1. xianxia_soft_fade：柔和淡入淡出
2. scroll_unfold：卷轴展开
3. ink_wipe：墨迹擦除
4. mist_reveal：薄雾揭示
5. talisman_flash：符箓短闪

说明：以上为预设示例，底层映射到基础转场组合，后续可继续扩展。

## 6.4 配置优先级

1. transition 显式配置（最高）
2. node 默认 transition
3. flow.defaults.transition
4. 系统兜底（建议 fade + 200ms）

## 7. 运行时流程

1. 启动：FlowConfigLoader 读取 YAML 并校验
2. 入口：FlowRuntime 进入 flow.entry 对应节点
3. 触发：接收 actionId/event/timer
4. 匹配：按 transitions 顺序匹配 trigger 与 guard
5. 执行：TransitionManager 执行过渡、控制输入阻塞
6. 切换：PageRouter 切换 pageId
7. 收尾：执行 onEnter/onExit/effects
8. 记录：维护 historyStack 与 lastTransition

## 8. 嵌入现有项目的方式

## 8.1 可复用基础

1. scripts/utils/read-yaml.mjs：本地 YAML 安全读取
2. scripts/utils/style-parser.mjs：样式 token 解析模式
3. scenes/*：现有页面配置基础目录

## 8.2 接入建议

1. 新增流程配置目录与入口索引
2. 新增 FlowRuntime 及相关模块（loader/guard/transition/bridge）
3. 在 UI action 分发点接入 FlowBridge
4. 在启动流程中先初始化 flow，再进入首节点
5. 将存档判断接入 GuardResolver（如 hasSaveFiles/noSaveFiles）

## 9. 验收标准

1. 修改流程 YAML 可改变页面关系，无需改代码
2. 支持 logo 到主菜单自动跳转
3. 支持开始游戏、设置、读档等 actionId 跳转
4. 支持守卫分流（有存档/无存档）
5. 支持节点返回链与 fallback 兜底
6. 支持配置化转场（类型、时长、阻塞、可跳过）

## 10. 风险与防错

1. 无路可走：节点必须具备 fallback 或至少一条可达边
2. guard 缺失：启动校验 guard 引用完整性
3. actionId 拼写错误：运行时报错并附路径
4. 过渡循环：同帧跳转次数限制与防抖
5. 过长转场：设置 duration 上限

## 11. 后续落地建议（分阶段）

1. 第一阶段：流程 YAML 最小可跑通（entry + uiAction + timer + fade）
2. 第二阶段：guard 分流与 fallback
3. 第三阶段：过渡预设与可跳过策略
4. 第四阶段：完整校验器与错误码体系

## 12. 推荐字段设计（稳定可扩展）

### 12.1 顶层字段

1. flow：流程基础信息与全局默认值
2. nodes：节点列表（页面关系树核心）
3. guards：守卫集合（可选）
4. transitionPresets：转场预设集合（可选）

### 12.2 flow 字段

1. flow.id：string，流程唯一标识
2. flow.version：number，配置版本号
3. flow.entry：string，入口节点 id
4. flow.defaults.transition：object，全局默认转场
5. flow.defaults.backActionId：string，统一返回动作 id（建议值 back）

### 12.3 node 字段

1. nodes[].id：string，节点唯一标识
2. nodes[].pageId：string，页面 ID（由 ui-registry 映射到 scenePath）
3. nodes[].domain：enum，world|hud|panel|system
4. nodes[].meta：object，可选，节点元信息（标题、分组、标签）
5. nodes[].onEnter：array，可选，进入副作用
6. nodes[].onExit：array，可选，离开副作用
7. nodes[].transition：object，可选，节点默认转场
8. nodes[].transitions：array，节点跳转规则
9. nodes[].fallback：string，可选，兜底节点

### 12.4 transition 字段

1. transitions[].id：string，跳转规则 id
2. transitions[].trigger：enum，auto|timer|uiAction|event
3. transitions[].fromActionId：string，trigger=uiAction 时必填
4. transitions[].eventId：string，trigger=event 时必填
5. transitions[].afterMs：number，trigger=timer 时必填
6. transitions[].guard：string，可选，守卫 id
7. transitions[].to：string，目标节点 id
8. transitions[].priority：number，可选，冲突时优先级
9. transitions[].effects：array，可选，跳转附加副作用
10. transitions[].transition：object|string，可选，内联配置或引用 preset

### 12.5 guard 字段

1. guards.<id>.type：string，守卫类型
2. guards.<id>.params：object，可选，守卫参数
3. guards.<id>.invert：boolean，可选，反转结果

### 12.6 transitionPresets 字段

1. transitionPresets.<name>.type：string，转场类型
2. transitionPresets.<name>.durationMs：number，时长
3. transitionPresets.<name>.delayMs：number，可选，延迟
4. transitionPresets.<name>.easing：string，可选，缓动
5. transitionPresets.<name>.blockInput：boolean，可选，是否阻塞输入
6. transitionPresets.<name>.skippable：boolean，可选，是否可跳过
7. transitionPresets.<name>.phase：string，可选，enter|exit|between
8. transitionPresets.<name>.params：object，可选，效果参数

### 12.7 约束建议

1. nodes[].pageId 必须在 ui-registry 中存在
2. transitions[].to 必须指向有效 node id
3. 每个 node 至少具备一条 transition 或 fallback
4. flow.entry 必须存在于 nodes[].id
5. durationMs 建议限制在 0-10000 以内
