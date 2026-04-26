# UI 配置器多层 Scene 分层架构方案（四类多层）

## 1. 目标

为配置驱动 UI（本地静态 YAML）建立可扩展的四类 Scene 分层体系。
原则是“先预留层级，再按需启用”，避免后期新增需求时改动已有深度与交互链路。

## 2. 参考案例

参考：Stardew Valley 的主世界与 HUD 分层
实现方式：世界渲染与常驻 UI 分离，UI 保持高优先级显示与交互
适用性：适用
本项目调整：采用 Phaser 多 Scene + 每个 Scene 内多 Layer 的双层分层

参考：Terraria 的背包/面板叠加交互
实现方式：打开面板后，局部 UI 接管输入，世界层保留渲染
适用性：适用
本项目调整：引入输入屏蔽层与交互焦点状态机，避免穿透点击

参考：Hades 的过渡与提示叠层
实现方式：战斗层上叠加过渡、提示、暂停界面
适用性：适用
本项目调整：单独建立系统与过渡类 Scene，统一承载转场与阻塞层

## 3. 四类 Scene 总览

1. 世界与模拟类 Scene（World Domain）
2. 常驻信息类 Scene（HUD Domain）
3. 交互面板类 Scene（Panel Domain）
4. 系统与过渡类 Scene（System Domain）

建议顺序（由下到上）：
World Domain < HUD Domain < Panel Domain < System Domain

## 4. 每类 Scene 的多层规划

### 4.1 世界与模拟类 Scene

职责：地图、角色、世界内特效、世界内可交互物。
建议层级：

1. world.base：地形底图、背景块
2. world.tile：地块与装饰瓦片
3. world.entity：角色、NPC、可采集物
4. world.fx：世界粒子、天气、法术效果
5. world.overlay：选中框、路径预览、建造预览
6. world.debug：网格、碰撞盒、开发调试可视化

### 4.2 常驻信息类 Scene

职责：常驻 HUD，不阻塞主流程。
建议层级：

1. hud.bg：HUD 背板与分区底色
2. hud.primary：核心信息（生命、灵力、时间、资源）
3. hud.secondary：任务追踪、状态图标、增益减益
4. hud.message：非阻塞通知、浮动提示
5. hud.debug：帧率、内存、开关状态

### 4.3 交互面板类 Scene

职责：可开关的功能面板、弹窗、配置器页面。
建议层级：

1. panel.mask：半透明遮罩与输入拦截底层
2. panel.shell：面板外框、标题栏、页签容器
3. panel.content：表单、列表、树、滚动容器
4. panel.floating：下拉、日期选择、局部二级浮层
5. panel.tooltip：悬浮说明、快捷提示
6. panel.modal：二次确认、危险操作弹窗（最高优先级）

### 4.4 系统与过渡类 Scene

职责：全局流程控制与系统级覆盖层。
建议层级：

1. system.loading：加载进度、资源校验提示
2. system.transition：淡入淡出、场景切换动画
3. system.cutscene：剧情字幕、过场遮罩
4. system.blocker：全局输入阻塞层（强制）
5. system.alert：致命错误、恢复引导、崩溃前提示

## 5. 深度号段预留（防后期难改）

为每个 Domain 预留固定号段，后续只在号段内扩层：

1. World Domain：0 - 999
2. HUD Domain：1000 - 1999
3. Panel Domain：2000 - 2999
4. System Domain：3000 - 3999

规则：

1. 不允许跨 Domain 抢深度号段
2. 每层预留至少 20 个空槽
3. 新需求优先插入空槽，不改历史层级编号

## 6. 事件与动作分发规范（id 驱动）

1. YAML 只声明 actionId、eventId、conditionId
2. 运行时通过 action 注册表映射到函数实现
3. Scene 间通信只走事件总线，不直接互调对象方法
4. 输入焦点切换统一走状态机，不允许面板自行抢焦点

建议事件通道：

1. ui.openPanel
2. ui.closePanel
3. ui.switchTab
4. world.pauseInput
5. world.resumeInput
6. system.blockInput
7. system.unblockInput

## 7. 输入优先级与穿透规则

1. System Domain 默认最高输入优先级
2. Panel Domain 打开时，World Domain 输入降级或暂停
3. HUD Domain 仅处理自身交互区域，未命中时不阻塞下层
4. 任何 modal 层打开时，必须启用全局 blocker

## 8. 配置文件映射建议（YAML）

建议在配置上保持“四类一索引”：

1. scenes/world/\*.yaml
2. scenes/hud/\*.yaml
3. scenes/panel/\*.yaml
4. scenes/system/\*.yaml

统一入口索引：

1. scenes/index.yaml 维护加载顺序
2. 每个 Scene 配置包含 domain、layers、depthBase、actions
3. 公共样式从 style-params 引用，不在页面里重复定义

## 9. 演进策略（避免后期返工）

1. 先把四类骨架全部建好，即使部分层暂时为空
2. 需求新增时只扩本 Domain 内层级
3. 禁止“临时层”直接放到最高层
4. 每次新增层都要登记 depth 与职责，保持可追踪

## 10. 验收清单

1. 四类 Scene 均可独立启停
2. 每类 Scene 至少 3 层可正常叠加渲染
3. 面板打开后无点击穿透到世界层
4. 转场与系统阻塞层可覆盖全部下层
5. 新增一个面板需求时无需改动既有层级编号
