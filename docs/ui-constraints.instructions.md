---
applyTo:
  - "public/configs/ui/**/*.yaml"
  - "src/ui/**/*.js"
  - "src/core/GameState.js"
description: >
  游戏 UI 约束规范（云笈仙田录）。
  Use when: 创建或修改 UI 页面、YAML 配置、GameState 状态、主题变量。
  Covers: 页面功能布局、交互体验、技术实现三大支柱。
---

# 游戏 UI 约束规范 · 云笈仙田录

> **AI 执行级别：BLOCKING**
> 以下所有规则在生成或修改任何 UI 相关文件时必须遵守。违反规则的代码必须被修正后才能提交。

---

## 第一章：页面功能友好布局

### 1.1 页面类型 — 必须声明

每个 YAML 配置必须在 `page.type` 中声明类型，三种类型不可混用：

| 类型 | 用途 | 示例 |
|------|------|------|
| `fullscreen` | 全屏独占，无其他页面可见 | 主菜单、游戏 HUD |
| `overlay` | 半透明覆盖，底层页面仍可见 | 暂停、设置 |
| `popup` | 居中弹窗，聚焦单一操作 | 确认框、提示 |

```yaml
# ✅ 正确
page:
  id: settings
  type: overlay

# ❌ 禁止：缺少 type
page:
  id: settings
```

### 1.2 视觉优先级区域划分

每个页面必须遵循三段式结构，从上到下：

```
┌─────────────────────────────┐
│   标识区（≤20% 高度）         │  页面标题 + 品牌标识
├─────────────────────────────┤
│                             │
│   主操作区（视觉权重最高）     │  核心功能，始终垂直居中
│                             │
├─────────────────────────────┤
│   辅助区（底部/边缘）         │  版本号、返回、次要提示
└─────────────────────────────┘
```

- 标识区组件 `id` 命名以 `header_` 开头
- 主操作区必须使用 `stack` 组件，`alignment: center`
- 辅助区组件 `id` 命名以 `footer_` 开头，`verticalAlignment: bottom`

### 1.3 主次操作分离规则

| 操作级别 | 数量上限 | 必用样式 | 位置 |
|----------|----------|----------|------|
| **主操作**（最重要 CTA） | **1 个** | `background: "$accent"` | 操作列表第一位 |
| **次级操作** | **≤ 4 个** | `background: "$primary"` | 主操作之后 |
| **危险操作**（退出/删档） | 无限制 | `background: "$danger"` | **列表末尾** |

```yaml
# ✅ 正确：主次危险分层
- id: startBtn
  type: button
  style:
    background: "$accent"        # 主操作，唯一高亮

- id: settingsBtn
  type: button
  style:
    background: "$primary"       # 次级操作

- id: exitBtn
  type: button
  style:
    background: "$danger"        # 危险操作，末尾

# ❌ 禁止：两个按钮同时使用 $accent
```

### 1.4 信息密度上限

- 单页功能模块 **≤ 5 个**
- 按钮列表 **≤ 6 项**（超出则改为分页或子菜单）
- 文字段落每行字数 **≤ 24 字**
- popup 内**禁止嵌套** popup（弹窗层级 ≤ 2）
- 组件嵌套深度 **≤ 5 层**

### 1.5 布局对齐约束

- 同级同类型组件**必须统一对齐方式**，使用 `alignment` 字段，禁止各自设置 `left`/`top` 偏移来"对齐"
- 禁止在 `stack` 容器的子组件上单独设置 `verticalAlignment`（由 stack 统一管理）

```yaml
# ✅ 正确：由父容器统一对齐
- id: buttonStack
  type: stack
  layout:
    alignment: center

# ❌ 禁止：子组件各自偏移
- id: startBtn
  style:
    left: "160px"   # 禁止用绝对偏移代替对齐
    top: "300px"
```

---

## 第二章：交互友好设计

### 2.1 按钮状态完整性

每个 `button` 组件必须定义完整的四种状态，缺少任意状态的组件**不得合并**：

```yaml
- id: startBtn
  type: button
  text: "开始游戏"
  style:
    background: "$accent"
  states:
    hover:
      animation: "$buttonHover"    # 必须引用 theme 动画变量
      borderColor: "$accentLight"
    active:
      scale: 0.96
    disabled:
      opacity: 0.4
      pointerEvents: none
```

- `hover` 必须有视觉变化（动画或描边），不允许与 `normal` 完全相同
- `disabled` 必须设置 `opacity: 0.4`，并且**不触发任何 action**
- 按钮文字在所有状态下对比度必须 ≥ 4.5:1

### 2.2 操作反馈规范

| 操作类型 | 最低反馈要求 | 反馈时长 |
|------------|------------|---------|
| 普通点击 | 颜色变化 或 缩放动画 | 150–300ms |
| 切换类（toggle/slider） | 即时视觉更新 + 当前值显示 | 立即 |
| 异步操作（存档/加载） | 加载状态 → 成功/失败提示 | 加载中不限，提示 ≥ 1.5s |
| 页面切换 | `fadeIn` 或 `slideIn` 过渡 | 200–400ms |

```yaml
# ✅ 正确：切换页面时声明过渡动画
page:
  id: settings
  type: overlay
  enterAnimation: "$fadeIn"
  exitAnimation: "$fadeOut"
```

### 2.3 破坏性操作确认规范

以下 action 触发前**必须**前置 `popup` 类型的确认弹窗：

- `exitGame`（退出游戏）
- `deleteArchive`（删除存档）
- `resetSettings`（重置设置）
- 任何 `id` 包含 `delete`、`reset`、`clear`、`exit` 的 action

确认弹窗结构要求：

```yaml
- id: confirmPopup
  type: popup
  children:
    - id: confirmText
      type: text
      text: "确认要退出吗？未保存的进度将丢失。"
    - id: confirmActions
      type: stack
      layout:
        direction: horizontal
      children:
        - id: confirmOkBtn
          type: button
          text: "确认退出"
          action: exitGame
          style:
            background: "$danger"     # 危险色，主操作
        - id: confirmCancelBtn
          type: button
          text: "取消"
          action: closePopup
          style:
            background: "$primary"    # 次级，排后
```

### 2.4 导航与返回规范

- 页面导航层级 **≤ 3 层**（主菜单 → 设置 → 子设置，不得再深）
- 每个非首页（非 `MAIN_MENU` 状态）页面**必须提供返回路径**：
  - 使用 `action: goBack` 绑定返回按钮，或
  - 明确声明 `action: setState` + 目标状态
- 禁止"单向跳转"（跳入后无法通过 UI 返回）

```yaml
# ✅ 正确：设置页有明确返回
- id: backBtn
  type: button
  text: "返回"
  action: goBack
```

### 2.5 空状态与错误提示规范

- 列表/容器数据为空时**必须显示占位文本**，禁止渲染空容器

```yaml
# ✅ 正确：空存档列表占位
- id: emptyArchiveHint
  type: text
  text: "暂无存档，开始新的修仙之旅吧"
  style:
    color: "$textMuted"
  binding:
    showWhen: "archive.list.length === 0"
```

- 配置加载失败必须渲染降级 UI（使用 UIManager 内置 `UITheme` 备用主题），**禁止白屏**
- 禁止将技术报错（如 `TypeError`、`undefined`）直接展示为 UI 文字

### 2.6 加载状态规范

- 按需加载页面（`preload: false`）**必须**有加载占位组件
- 存档/设置等异步 IO 操作期间，触发按钮必须切换为 `disabled` 状态，防止重复触发

### 2.7 键盘与手柄输入规范

- 所有可交互组件必须设置合理的 `tabIndex`（顺序与视觉顺序一致）
- popup 弹出时**焦点自动移入**弹窗内第一个可交互组件
- popup 关闭时焦点**回到触发元素**
- 关键操作必须支持：
  - 键盘 `Enter` / `Space`：确认
  - 键盘 `Escape`：返回/关闭
  - 手柄 `A`：确认，手柄 `B`：返回

---

## 第三章：技术实现约束

### 3.1 文件组织规范

```
public/configs/ui/
├── index.yaml          # 所有页面注册表，唯一入口
├── theme.yaml          # 全局主题变量，唯一样式来源
├── <page-name>.yaml    # 页面配置，kebab-case 命名
└── (禁止子目录)
```

- 文件名必须使用 `kebab-case`，与 `page.id`（下划线版）对应
- 新 YAML 文件**必须在 `index.yaml` 注册**后才能使用
- 禁止创建 `public/configs/ui/` 的子目录

### 3.2 命名约定规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 `id` | `camelCase`，多层用 `_` 分段 | `settingsPanel_audioGroup_masterSlider` |
| `page.id` | `snake_case` | `pause_menu` |
| `action` 名称 | `camelCase` 动词开头 | `openSettings`、`saveArchive` |
| 主题变量 | `$camelCase` | `$textPrimary`、`$spacingMd` |

- `action` 名称必须与 `UIManager.js` 中注册的 handler 函数名**完全一致**
- 禁止使用无意义 id（`div1`、`container2`、`btn`）

### 3.3 主题与样式约束

- **所有颜色、字号、间距必须引用 `$变量名`**，禁止硬编码任何数值或十六进制色值

```yaml
# ✅ 正确
style:
  color: "$textPrimary"
  fontSize: "$fontSizeMd"
  background: "$primary"

# ❌ 禁止
style:
  color: "#d4af37"
  fontSize: 18
  background: "#1a3a4a"
```

- 新增主题变量**必须先写入 `theme.yaml`**，命名后才能在页面 YAML 中引用
- 主题变量命名分层：`$colorName`（颜色）/ `$fontName`（字体）/ `$spacingSize`（间距）/ `$animName`（动画）
- 禁止在页面 YAML 中覆盖已有主题变量的默认值

### 3.4 组件使用规范

| 组件类型 | 适用场景 | 禁止场景 |
|----------|----------|----------|
| `stack` | 线性排列的同类型子组件 | 混排不同功能区域 |
| `panel` | 独立功能卡片，内有标题和内容 | 单一文字或单一按钮 |
| `rectangle` | 纯背景/装饰层 | 承载交互子组件 |
| `dynamicText` | 实时变化的绑定数据 | 静态文字 |
| `text` | 静态文字 | 绑定频繁变化的数值 |
| `popup` | 单一聚焦操作 | 大量内容展示 |

- 禁止创建游离在 `components` 树之外的孤立组件
- `slotGrid` 单页格子数 **≤ 64**

### 3.5 数据绑定规范

- `binding` 路径**必须**来自 `GameState.js` 中 `gameState.data` 已有字段
- 禁止绑定运行时临时变量或 `undefined` 路径

```yaml
# ✅ 正确：绑定 gameState.data.player.level
- id: levelText
  type: dynamicText
  binding: "player.level"

# ❌ 禁止：绑定不存在的字段
- id: levelText
  binding: "player.exp_ratio"   # data 中未定义
```

- 格式化输出使用 `format` 字段，不允许在 binding 路径中拼接字符串

```yaml
# ✅ 正确
binding: "player.level"
format: "修为 Lv.{value}"

# ❌ 禁止
binding: "player.levelDisplay"  # 在 JS 中预拼接字符串
```

- 禁止在 `dynamicText` 绑定**每帧更新**的值（如实时坐标、FPS）——此类数据使用 canvas 组件

### 3.6 状态管理规范

- 新增游戏页面**必须**先在 `GameState.js` 的 `GameStates` 枚举中添加对应状态，再在 `index.yaml` 注册
- `action` 触发的状态跳转目标**必须**是 `GameStates` 枚举的已有成员

```yaml
# ✅ 正确
action: setState
target: SETTINGS          # GameStates 枚举中已有

# ❌ 禁止
action: setState
target: SHOP              # 未在 GameStates 中注册
```

- `goBack()` 只允许回退一级，禁止连续多次 `goBack` 模拟跳转

### 3.7 性能约束

- 非常用页面（功能解锁后才用）必须设置 `preload: false`

```yaml
# index.yaml 示例
- id: shop
  file: shop.yaml
  preload: false          # 按需加载
```

- 同一生命周期内，`dynamicText` 绑定的字段**更新频率 ≤ 1次/秒**
- `slotGrid` 初次渲染格子数超过 32 时必须实现虚拟渲染（懒加载可视区域）
- 禁止在 `init()` 阶段执行同步 IO 操作（存档读取必须异步）

### 3.8 扩展与自定义规范

- 所有自定义交互逻辑**必须**通过 `ConfigurablePage.registerHandler(name, fn)` 注册

```javascript
// ✅ 正确
page.registerHandler('customAction', (data) => { ... });

// ❌ 禁止：直接 patch UIManager
UIManager.prototype.onStateChange = ...
```

- 禁止在 YAML 文件中内嵌 JavaScript 表达式（`action` 只允许字符串 handler 名称）
- 新增组件类型**必须**先在 `ConfigurablePage.js` 的 `createComponent()` 工厂方法中实现并测试，再在 YAML 中使用

---

## 第四章：界面设计原则

> 在动手写任何 YAML 之前，必须先完成本章的功能分析与布局规划。分析结果决定组件结构，**不允许跳过分析直接写配置**。

---

### 4.1 功能分析步骤（必做）

每个新页面或重构页面开始前，必须完成以下四步分析，并在注释中保留结论：

```
步骤 1：列出该页面承载的所有功能点
步骤 2：按「重要程度」分级（见 4.2）
步骤 3：按「功能类型」分类（见 4.3）
步骤 4：根据分级和分类确定布局区块的位置与尺寸（见 4.4）
```

YAML 文件顶部必须包含分析注释：

```yaml
# ── 功能分析 ──────────────────────────────────────────
# 页面：设置页
# 功能点：主音量、音乐音量、音效音量、画质、全屏、语言
# 功能分类：参数调节类（全部）
# 层级划分：
#   L1 — 页面标题（标识）
#   L2 — 分类标签（音频 / 画面 / 语言）
#   L3 — 单项设置（滑块 / 开关 / 选择器）
#   L0 — 操作按钮（应用 / 取消，不属于内容层级）
# 布局结论：顶部横向标签 + 中部内容区切换 + 底部固定操作栏
# ─────────────────────────────────────────────────────
```

---

### 4.2 功能层级定义

所有页面内的功能元素按以下四个层级划分，每级有固定的视觉权重和尺寸约束：

| 层级 | 含义 | 典型组件 | 高度 | 视觉权重 |
|------|------|----------|------|---------|
| **L1** | 页面标识 / 一级入口 | 页面标题、英雄 Banner | 48–80px | 最高 |
| **L2** | 功能分组 / 二级导航 | 标签栏、分区标题、侧边菜单 | 36–48px | 次高 |
| **L3** | 功能个体 / 三级条目 | 设置行、列表项、卡片行 | 40–52px | 中等 |
| **L4** | 子项 / 内联元素 | 下拉子选项、展开详情 | 28–36px | 最低 |
| **L0** | 操作按钮（独立于内容层级） | 应用、保存、返回、删除 | 44–52px | 由重要程度决定颜色 |

**规则**：
- 同一页面中不允许出现两个 L1 元素
- L2 元素数量 ≤ 5（超出改为下拉或分页）
- L3 元素每个分组 ≤ 8 条（超出加滚动，不堆砌）
- L4 元素仅在展开状态下可见，默认折叠

---

### 4.3 功能类型分类

将功能点按性质归入以下类型，不同类型在布局中的位置规则不同：

| 类型 | 描述 | 布局位置 |
|------|------|---------|
| **标识类** | 说明当前页面是什么 | 顶部标识区（三段式第一段） |
| **导航类** | 进入其他页面/功能区 | L2 标签栏或左侧菜单，始终可见 |
| **参数调节类** | 修改游戏数值（音量/画质等） | L3 内容区，按分组组织 |
| **展示类** | 只读信息（角色面板/状态）| L3 内容区，禁止放操作按钮 |
| **操作类** | 触发动作（保存/删除/跳转）| L0 固定操作栏（底部或右侧）|
| **辅助类** | 装饰/提示/版本号 | 辅助区（三段式第三段），透明度降低 |

**规则**：
- **参数调节类**和**展示类**禁止混在同一 L3 行内（不允许同行既有数值显示又有编辑控件的情况，除非是「标签 + 对应控件」的标准行格式）
- **操作类**（L0）禁止散落在内容区中间，必须集中在操作栏
- **导航类**（L2）必须始终可见，不随内容滚动而消失

---

### 4.4 区块位置与尺寸规划

根据功能层级，区块尺寸和位置遵循以下约束：

#### 面板总尺寸基准

| 页面类型 | 推荐面板宽度 | 推荐面板高度 |
|----------|------------|------------|
| `fullscreen` 主菜单 | 全画布（1920×1080） | 全画布 |
| `overlay` 单功能（如暂停）| 480–600px | 按内容自适应，最高 70vh |
| `overlay` 多功能（如设置）| 680–800px | 按内容自适应，最高 75vh |
| `popup` 确认框 | 400–480px | 固定 220–280px |

#### 各层级区块高度

```
┌──────────────────────────────────────────┐  ← 面板顶边
│  L1 标识区   paddingTop: 20px             │  高度：48–80px
│  ─────── 装饰分割线（$accent, 1px）────── │
│  L2 导航区   marginTop: 12px              │  高度：36–48px
│  ─────── 内容区分隔（$bgLight, 1px）───── │
│                                          │
│  L3 内容区   paddingTop: 20px             │  撑满剩余高度
│    每个 L3 条目高度：40–52px              │
│    条目间距（spacing）：$spacingMd(16px)  │
│                                          │
│  ─────── 操作区分隔（$bgLight, 1px）───── │
│  L0 操作栏   paddingBottom: 24px          │  高度：固定 68–80px
└──────────────────────────────────────────┘  ← 面板底边
```

---

### 4.5 边距计算规范

所有边距**必须使用主题变量**，按以下层级关系取值：

| 位置 | 变量 | 数值 | 说明 |
|------|------|------|------|
| 面板内侧左右 padding | `$spacingXl` | 40px | 内容距面板边缘 |
| L1 区顶部 padding | `$spacingMd` | 16px | 标题距面板顶边 |
| L1 区底部（到 L2）| `$spacingMd` | 16px | 标题到标签栏 |
| L2 条目间距 | `$spacingSm` | 8px | 标签按钮之间 |
| L2 区底部（到 L3）| `$spacingMd` | 16px | 标签栏到内容区 |
| L3 条目间距 | `$spacingMd` | 16px | 设置行之间 |
| L3 分组间距（不同 L2 切换）| `$spacingLg` | 24px | 同一分组内的小节间 |
| L0 操作栏顶部（到 L3）| `$spacingMd` | 16px | 内容区底到操作栏 |
| L0 操作栏底部 padding | `$spacingLg` | 24px | 操作按钮距面板底边 |
| 操作按钮之间 | `$spacingMd` | 16px | 应用与取消之间 |

**计算示例（设置页 overlay 面板）**：
```
面板总高度 = L1(60px) + 间距(16px) + L2(40px) + 间距(16px)
           + L3内容区(3条 × 52px + 2间距 × 16px)(= 188px)
           + 间距(16px) + L0(68px) + 底部padding(24px)
           = 60+16+40+16+188+16+68+24 = 428px → 取 480px（留呼吸空间）
```

- **禁止**在没有计算依据的情况下写任意 `px` 高度（如 `600px`）
- **禁止**同一层级内出现不同间距值（必须统一使用同一个 `$spacing*` 变量）

---

### 4.6 分类子类功能入口规范

功能入口（导航到下一层功能的元素）按位置和表现形式划分：

#### L2 导航入口（分类标签 / 菜单项）

```
适用场景：页面内功能≥2个分类，需要切换显示
位置：面板顶部，紧贴 L1 标识区下方
形式：横向标签按钮（≤5个分类）/ 纵向菜单（内容区左侧，面板宽≥800px时）
激活态：background: "$accent"，文字 color: "$bgDark"（深色反白）
非激活：background: "$bgLight"，文字 color: "$textSecondary"
```

```yaml
# ✅ 标签栏标准写法
- id: tabBar
  type: stack
  layout:
    isVertical: false
    spacing: "$spacingSm"
  children:
    - id: tab_audio          # 激活态，唯一主操作色
      type: button
      style:
        background: "$accent"
        color: "$bgDark"
    - id: tab_graphics       # 非激活态
      type: button
      style:
        background: "$bgLight"
        color: "$textSecondary"
```

#### L3 子功能入口（展开 / 跳转子页）

```
适用场景：L3 条目点击后进入 L4 详情，或跳转子页面
位置：条目行最右侧，使用「>」箭头图标文字或 chevron button
尺寸：28×28px，不得超出所在行高度
禁止：将子页面跳转按钮（text: ">"）与操作按钮（text: "删除"）放在同一行
```

#### 跨页面导航入口

```
适用场景：从当前页跳转到另一个完整页面
位置：L0 操作栏，或辅助区（仅次要跳转）
禁止：将跨页跳转伪装成 L3 条目（如把"前往商店"放在设置列表里）
```

---

### 4.7 操作按钮位置规范

所有操作按钮（L0）必须遵循以下位置和顺序规则：

#### 位置规则

```
┌────────────────────────────────────────┐
│                                        │
│   内容区（L3）                          │
│                                        │
├────────────── 分割线 ───────────────────┤
│  [取消/返回]        [次级]  [主操作]   │  ← L0 操作栏
└────────────────────────────────────────┘
         左对齐                  右对齐
```

- **主操作**（保存/应用/确认）：**右侧**，使用 `$accent` 色
- **次级操作**（另存/导出）：主操作左侧，使用 `$primary` 色
- **取消/返回**：**左侧**，使用 `$bgLight` 色，文字 `$textSecondary`
- **危险操作**（删除/重置）：**单独一行**，位于其他按钮上方，使用 `$danger` 色，且必须前置确认弹窗

#### 按钮尺寸与间距

| 按钮类型 | 宽度 | 高度 | 字号 |
|----------|------|------|------|
| 主操作 | 140–180px | 44px | 16px |
| 次级操作 | 120–140px | 44px | 15px |
| 取消/返回 | 100–120px | 44px | 15px |
| 危险操作 | 与其他按钮同宽 | 44px | 15px |

#### popup 弹窗按钮顺序

popup 内操作按钮顺序固定为：**「确认（危险色）」在左，「取消」在右**——与常规页面相反，目的是降低误操作。

```yaml
# popup 内按钮顺序（固定）
- id: popup_confirmBtn    # 危险操作确认，左侧
  type: button
  style:
    background: "$danger"
- id: popup_cancelBtn     # 取消，右侧
  type: button
  style:
    background: "$primary"
```

---

### 4.8 界面设计原则自查（精简版）

在写 YAML 前先完成：

- [ ] 已完成功能分析（见 4.1），注释写入 YAML 顶部
- [ ] 已对所有功能点标注层级（L0–L4）
- [ ] 已对所有功能点标注类型（标识/导航/参数/展示/操作/辅助）
- [ ] 已根据分级和分类确定各区块高度和位置
- [ ] 面板总高度有计算依据，不是拍脑袋的整数
- [ ] L2 导航入口样式（激活/非激活）已正确区分
- [ ] L3 子功能入口（`>`箭头）未与 L0 操作按钮混放
- [ ] L0 操作栏中：主操作右对齐、取消左对齐、危险操作独行
- [ ] popup 弹窗按钮顺序为：确认（危险色）在左、取消在右

---

## 附录：自查清单

在提交任何 UI 相关改动前，逐项确认：

### 布局检查

- [ ] `page.type` 已声明（`fullscreen` / `overlay` / `popup`）
- [ ] 主操作按钮只有 1 个，使用 `$accent`
- [ ] 危险操作按钮排在列表末尾，使用 `$danger`
- [ ] 单页按钮列表 ≤ 6 项
- [ ] 非首页有明确返回路径

### 交互检查

- [ ] 所有 `button` 定义了 `hover`、`active`、`disabled` 三种状态
- [ ] 破坏性操作有确认弹窗前置
- [ ] 页面切换有 `enterAnimation` / `exitAnimation`
- [ ] 空状态有占位文本

### 技术检查

- [ ] 无任何硬编码颜色（`grep '#'` 结果为空）
- [ ] 无任何硬编码 px 数值（间距/字号）
- [ ] 新页面已在 `index.yaml` 注册
- [ ] 新状态已在 `GameState.js` 的 `GameStates` 枚举中添加
- [ ] `binding` 路径能在 `gameState.data` 中找到对应字段
- [ ] 自定义逻辑通过 `registerHandler` 注册，未直接 patch UIManager
