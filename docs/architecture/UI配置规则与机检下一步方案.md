# UI 配置规则与机检下一步方案

## 1. 文档目的

沉淀前两轮确认结果：

1. 第一部分：UI 配置规则（文档规范版 V1）
2. 第二部分：机检化下一步执行路径（基于 scenes 四类目录）

本文件作为后续 Schema 校验与配置实现的统一基线。

## 2. 参考案例

参考：Stardew Valley 的 HUD 分层
实现方式：世界层与常驻信息层分离，UI 保持高层渲染优先级并按区域接管交互
适用性：适用
本项目调整：采用 world/hud/panel/system 四域 + 域内多层

参考：Terraria 的背包与弹层交互
实现方式：面板开启后接管输入，底层世界继续渲染
适用性：适用
本项目调整：引入 panel.mask 与 system.blocker，约束输入穿透

参考：Hades 的系统过渡叠层
实现方式：过渡、提示、暂停位于系统高层并可阻塞输入
适用性：适用
本项目调整：system 域承载 loading/transition/blocker/alert

## 3. UI 配置规则（文档规范版 V1）

### 3.1 顶层结构

每个 Scene 配置必须包含：

1. page：页面元信息
2. layers：层级定义
3. components：组件树
4. actions：动作声明（可选）
5. bindings：绑定声明（可选）

### 3.2 page 参数

1. page.id：string，页面唯一标识
2. page.name：string，页面显示名
3. page.type：enum，fullscreen | overlay | popup
4. page.domain：enum，world | hud | panel | system
5. page.depthBase：integer，域深度基线
6. page.responsive：object，可选，响应式策略

### 3.3 layers 参数

1. layers[].id：string，层标识（如 panel.content）
2. layers[].depth：integer，层深度
3. layers[].inputPolicy：enum，可选，passthrough | capture | block
4. layers[].visible：boolean，可选，默认 true

### 3.4 components 通用参数

1. components[].id：string，页面内唯一
2. components[].type：enum，stack | panel | rectangle | title | subtitle | text | dynamicText | button | toggle | slider | dropdown | spacer
3. components[].layer：string，必须引用已定义层
4. components[].visible：boolean，可选
5. components[].enabled：boolean，可选
6. components[].binding：string，可选，数据路径
7. components[].actionId：string，可选，动作标识
8. components[].eventId：string，可选，事件标识
9. components[].conditionId：string，可选，条件标识
10. components[].style：object，可选
11. components[].layout：object，可选
12. components[].children：array，可选（容器组件）

### 3.5 组件类型差异约束

1. button：必须有 text 或 binding，并且有 actionId 或 eventId
2. dynamicText：必须有 binding
3. toggle：必须有 binding
4. slider：必须有 binding、min、max
5. dropdown：必须有 options、binding
6. stack/panel/rectangle：允许 children

### 3.6 样式约束

1. 颜色相关字段必须使用主题 token（如 $primary）
2. 页面与卡片层禁止横向滚动
3. 带边框按钮必须使用像素风边框（直角或切角）
4. 禁止在业务页面硬编码主色与核心尺寸

### 3.7 事件动作约束

1. YAML 仅声明 actionId/eventId/conditionId
2. 运行时通过注册表映射实现
3. Scene 通信只走事件总线
4. 输入焦点切换由状态机统一管理

建议事件通道：

1. ui.openPanel
2. ui.closePanel
3. ui.switchTab
4. world.pauseInput
5. world.resumeInput
6. system.blockInput
7. system.unblockInput

### 3.8 输入优先级约束

1. system 域优先级最高
2. panel 打开时 world 输入必须降级或暂停
3. hud 仅消费命中区域输入
4. modal 打开必须启用全局 blocker

### 3.9 深度号段约束

1. world：0-999
2. hud：1000-1999
3. panel：2000-2999
4. system：3000-3999

规则：

1. 禁止跨域抢深度
2. 每层预留空槽
3. 新需求优先插槽，不改历史编号

### 3.10 命名与唯一性

1. page/layer/component 的 id 必须唯一
2. id 统一小写短横线或点分层
3. actionId/eventId/conditionId 必须可解析

### 3.11 最小机检清单

1. 必填字段完整
2. 字段类型正确
3. 域与深度号段一致
4. layer 引用存在
5. action/event/condition 可解析
6. 样式 token 合法
7. 无横向滚动违规
8. 像素风边框按钮约束满足

### 3.12 建议错误码

1. UI-CFG-001 缺少必填字段
2. UI-CFG-002 字段类型错误
3. UI-CFG-003 非法枚举值
4. UI-CFG-004 深度越界
5. UI-CFG-005 layer 引用不存在
6. UI-CFG-006 action/event/condition 未注册
7. UI-CFG-007 非法样式 token
8. UI-CFG-008 输入穿透规则冲突

## 4. 机检化下一步（执行路径）

目录基线已确认：采用 scenes 四类目录。

### 4.1 步骤 1：冻结目录与入口契约

1. 建立 scenes/world、scenes/hud、scenes/panel、scenes/system
2. 建立 scenes/index.yaml 作为唯一入口顺序索引
3. 明确每个 Scene 配置最小字段：domain、layers、depthBase、actions

### 4.2 步骤 2：主 Schema

1. 定义 Scene 主体结构与 required
2. 校验 domain-depth 号段一致性
3. 校验 layers 与 components 的引用一致性

### 4.3 步骤 3：组件子 Schema

1. 按 type 使用 oneOf 分流
2. 为 button/dynamicText/slider/dropdown 等定义差异必填
3. 约束 children 仅用于容器组件

### 4.4 步骤 4：样式与交互规则 Schema

1. 校验样式 token 格式
2. 校验输入策略枚举
3. 校验边框按钮像素风约束

### 4.5 步骤 5：校验脚本接入

1. 使用 AJV + js-yaml 读取并校验全部 Scene 配置
2. 输出统一错误码与定位信息
3. 可接入启动前校验流程

### 4.6 步骤 6：最小验收样本

1. 准备 1 份合法样本
2. 准备 1 份非法样本（如 depth 越界）
3. 验证校验器可正确拦截

## 5. 当前结论

1. 文档规范版 V1 已明确可解析字段、类型、作用与约束
2. 目录路线采用 scenes 四类目录
3. 下一阶段进入机检化（Schema + 校验脚本）
