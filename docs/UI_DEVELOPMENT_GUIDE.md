# UI 开发规范

## 概述

本项目采用 **配置驱动的 UI 开发模式**，所有页面 UI 通过 YAML 静态配置文件定义，实现了界面与逻辑分离，支持快速迭代和主题统一管理。

## 核心理念

### 设计原则

1. **配置优先**：UI 结构、样式、交互全部通过 YAML 配置
2. **主题统一**：所有颜色、字体、尺寸由主题配置集中管理
3. **组件化**：UI 由可复用的组件组合而成
4. **声明式**：描述"是什么"而非"怎么做"
5. **热更新友好**：修改配置文件即可调整 UI，无需重新编译

### 视觉风格

**关键词**：空灵、古意、静谧、仙气、克制

- **色调**：玄青（主色）+ 金色（点睛）
- **字体**：楷体/仿宋（标题）+ 微软雅黑（正文）
- **排版**：留白充足、层次分明、不拥挤
- **动画**：轻柔、自然、不花哨

## 文件结构

```
public/
└── configs/
    └── ui/
        ├── index.yaml         # UI 配置索引（必需）
        ├── theme.yaml         # 主题配置（必需）
        ├── main-menu.yaml     # 主菜单页面
        ├── settings.yaml      # 设置页面
        ├── pause-menu.yaml    # 暂停菜单
        ├── game-hud.yaml      # 游戏 HUD
        └── dev-tools.yaml     # 开发工具
```

### 配置文件职责

| 文件 | 职责 | 何时修改 |
|------|------|----------|
| `index.yaml` | 页面列表、预加载策略、状态映射 | 新增/删除页面时 |
| `theme.yaml` | 颜色、字体、尺寸、动画全局变量 | 调整整体视觉风格时 |
| `xxx-menu.yaml` | 具体页面的组件树、布局、交互 | 调整页面内容时 |

## 配置文件详解

### 1. index.yaml - UI 索引配置

**作用**：注册所有页面，定义加载策略和状态映射

```yaml
version: "1.0.0"
theme: theme.yaml  # 主题文件路径

# 页面列表
pages:
  main_menu:
    file: main-menu.yaml
    state: MAIN_MENU      # 对应的游戏状态
    preload: true         # 是否预加载

  settings:
    file: settings.yaml
    state: SETTINGS
    preload: true
  
  game_hud:
    file: game-hud.yaml
    state: PLAYING
    preload: true

# 初始状态
initialState: MAIN_MENU
```

**字段说明**：

- `version`：配置文件版本，用于兼容性检查
- `theme`：主题文件路径（相对于 `configs/ui/` 目录）
- `pages`：页面配置对象
  - `file`：页面配置文件路径
  - `state`：游戏状态枚举值（定义在 `GameState.js`）
  - `preload`：是否在启动时预加载（`true` = 启动加载，`false` = 按需加载）
- `initialState`：游戏启动时的初始界面状态

### 2. theme.yaml - 主题配置

**作用**：定义全局设计变量，所有页面配置通过 `$变量名` 引用

```yaml
theme:
  name: 仙韵
  version: "1.0.0"

# 颜色变量
colors:
  primary: "#1a3a4a"           # 玄青
  accent: "#d4af37"            # 金色
  
  bgDark: "rgba(10, 15, 25, 0.95)"
  bgMedium: "rgba(20, 30, 45, 0.9)"
  bgLight: "rgba(35, 45, 60, 0.8)"
  
  textPrimary: "#e8e4d9"       # 米白
  textSecondary: "#a8a498"
  textMuted: "#6a6a5a"
  
  success: "#4a7c59"
  warning: "#c9a227"
  danger: "#8b4049"

# 字体配置
fonts:
  title: "SimSun, 'Noto Serif SC', serif"
  body: "'Microsoft YaHei', 'Noto Sans SC', sans-serif"
  mono: "Consolas, 'Source Code Pro', monospace"

# 尺寸配置
sizes:
  buttonWidth: "280px"
  buttonHeight: "52px"
  buttonFontSize: 18
  buttonCornerRadius: 6
  
  panelCornerRadius: 12
  panelPadding: "20px"
  
  spacingMd: "16px"
  spacingLg: "24px"

# 动画配置
animations:
  fadeIn:
    duration: 300
    easing: easeOutQuad

# 组件默认样式
components:
  button:
    width: "$buttonWidth"
    height: "$buttonHeight"
    fontSize: "$buttonFontSize"
    background: "$primary"
    color: "$textPrimary"
    hoverBackground: "rgba(30, 60, 80, 0.9)"
```

**变量引用规则**：

- 使用 `$变量名` 引用主题变量
- 支持嵌套引用（主题变量可以引用其他主题变量）
- 变量解析在配置加载时进行，运行时已是最终值

### 3. 页面配置 - 以 main-menu.yaml 为例

**作用**：定义具体页面的组件树、样式和交互

```yaml
# 页面元数据
page:
  id: main_menu
  name: 主菜单
  type: fullscreen

# 根容器样式
container:
  width: "100%"
  height: "100%"
  background: transparent

# 组件树
components:
  # 背景遮罩
  - id: bgOverlay
    type: rectangle
    width: "100%"
    height: "100%"
    style:
      background: "rgba(15, 25, 40, 0.85)"
      thickness: 0

  # 内容堆栈
  - id: contentStack
    type: stack
    layout:
      isVertical: true
      horizontalAlignment: center
      verticalAlignment: center
    children:
      # 标题
      - id: title
        type: title
        text: "云笈仙田录"
        style:
          fontSize: 56
          color: "$textPrimary"
          shadowColor: "$accent"
          shadowBlur: 20
          height: "100px"

      # 副标题
      - id: subtitle
        type: subtitle
        text: "Cloud Scripture: Tale of the Immortal Farm"
        style:
          fontSize: 16
          color: "$textSecondary"
          height: "40px"

      # 间隔
      - id: spacer1
        type: spacer
        height: "60px"

      # 按钮组
      - id: buttonStack
        type: stack
        layout:
          isVertical: true
          spacing: 16
        children:
          - id: startBtn
            type: button
            text: "开始游戏"
            action: startGame

          - id: continueBtn
            type: button
            text: "继续游戏"
            action: continueGame

          - id: settingsBtn
            type: button
            text: "设置"
            action: openSettings

  # 版本信息
  - id: version
    type: text
    text: "v0.1.0"
    style:
      fontSize: 12
      color: "$textMuted"
    position:
      horizontalAlign: right
      verticalAlign: bottom
      left: "-20px"
      top: "-20px"

# 键盘绑定
keybindings:
  Escape: closeMenu
  S: openSettings
```

## 支持的组件类型

### 容器组件

#### stack（堆栈容器）

垂直或水平排列子组件

```yaml
- id: myStack
  type: stack
  layout:
    isVertical: true       # 是否垂直排列
    spacing: 16            # 子元素间距（像素）
    horizontalAlignment: center  # left | center | right
    verticalAlignment: center    # top | center | bottom
  children:
    - # 子组件配置...
```

#### panel（面板容器）

带背景和边框的容器

```yaml
- id: myPanel
  type: panel
  width: "400px"
  height: "300px"
  style:
    background: "$bgMedium"
    cornerRadius: "$panelCornerRadius"
    borderWidth: 1
    borderColor: "$accent"
  children:
    - # 子组件配置...
```

#### rectangle（矩形容器）

基础矩形容器，最灵活

```yaml
- id: myRect
  type: rectangle
  width: "100%"
  height: "200px"
  style:
    background: "rgba(0, 0, 0, 0.5)"
    thickness: 0  # 边框粗细，0 为无边框
```

### 文本组件

#### title（主标题）

```yaml
- id: gameTitle
  type: title
  text: "云笈仙田录"
  style:
    fontSize: 56
    color: "$textPrimary"
    fontFamily: "$title"
    shadowColor: "$accent"
    shadowBlur: 20
```

#### subtitle（副标题）

```yaml
- id: gameSubtitle
  type: subtitle
  text: "修仙田园 RPG"
  style:
    fontSize: 18
    color: "$textSecondary"
```

#### text（普通文本）

```yaml
- id: versionText
  type: text
  text: "版本 v0.1.0"
  style:
    fontSize: 14
    color: "$textMuted"
```

#### dynamicText（动态文本）

绑定到游戏状态，自动更新

```yaml
- id: currentTime
  type: dynamicText
  binding: "gameTime.formatted"  # 绑定到 gameState.gameTime.formatted
  prefix: "时间: "
  style:
    fontSize: 16
    color: "$textPrimary"
```

### 交互组件

#### button（按钮）

```yaml
- id: startButton
  type: button
  text: "开始游戏"
  action: startGame           # 触发的动作名称
  style:
    width: "$buttonWidth"
    height: "$buttonHeight"
    fontSize: "$buttonFontSize"
    background: "$primary"
    color: "$textPrimary"
    hoverBackground: "rgba(30, 60, 80, 0.9)"
    cornerRadius: "$buttonCornerRadius"
```

#### toggle（开关）

```yaml
- id: soundToggle
  type: toggle
  text: "音效"
  binding: "settings.soundEnabled"
  action: toggleSound
  style:
    width: "200px"
```

#### slider（滑块）

```yaml
- id: volumeSlider
  type: slider
  label: "音量"
  binding: "settings.volume"
  min: 0
  max: 100
  step: 1
  action: changeVolume
  style:
    width: "300px"
```

#### dropdown（下拉菜单）

```yaml
- id: qualityDropdown
  type: dropdown
  label: "画质"
  binding: "settings.quality"
  options:
    - { value: "low", text: "低" }
    - { value: "medium", text: "中" }
    - { value: "high", text: "高" }
  action: changeQuality
```

### 布局组件

#### spacer（间隔）

空白占位符

```yaml
- id: spacer1
  type: spacer
  height: "40px"  # 或 width: "40px"
```

## 样式系统

### 通用样式属性

所有组件都支持以下样式属性：

```yaml
style:
  # 颜色
  background: "$primary"           # 背景色
  color: "$textPrimary"            # 文字颜色
  borderColor: "$accent"           # 边框颜色
  
  # 字体
  fontSize: 18                     # 字号（数字）
  fontFamily: "$body"              # 字体族
  fontWeight: "bold"               # 粗细
  
  # 边框
  thickness: 1                     # 边框粗细
  cornerRadius: 6                  # 圆角半径
  
  # 阴影
  shadowColor: "$accent"
  shadowBlur: 15
  shadowOffsetX: 0
  shadowOffsetY: 2
  
  # 尺寸
  width: "280px"                   # 宽度
  height: "52px"                   # 高度
  
  # 内边距
  padding: "20px"
  paddingTop: "10px"
  paddingLeft: "20px"
```

### 定位属性

```yaml
position:
  horizontalAlign: center   # left | center | right
  verticalAlign: middle     # top | middle | bottom
  left: "20px"              # 偏移量
  top: "20px"
```

### 尺寸单位

- **像素值**：`"280px"`, `"52px"`
- **百分比**：`"100%"`, `"50%"`
- **数字**：`18`（字号等无单位属性）

## 交互系统

### action（动作）

每个交互组件都有 `action` 属性，指定触发的动作名称。

```yaml
- id: startBtn
  type: button
  text: "开始游戏"
  action: startGame  # 动作名称
```

### 预定义动作

这些动作在 `ConfigurablePage.js` 中已实现：

| 动作名 | 说明 |
|--------|------|
| `startGame` | 开始新游戏 |
| `continueGame` | 继续游戏 |
| `openSettings` | 打开设置 |
| `openDevTools` | 打开开发工具 |
| `closeMenu` | 关闭菜单 |
| `exitGame` | 退出游戏 |
| `toggleFullscreen` | 切换全屏 |

### 自定义动作

如果需要自定义动作，在页面类中注册处理器：

```javascript
// src/ui/pages/MyCustomPage.js
class MyCustomPage extends ConfigurablePage {
  constructor(config) {
    super(config)
    
    // 注册自定义动作
    this.registerHandler('myCustomAction', () => {
      console.log('自定义动作触发!')
      // 执行业务逻辑...
    })
  }
}
```

然后在 YAML 中使用：

```yaml
- id: customBtn
  type: button
  text: "自定义按钮"
  action: myCustomAction
```

### 键盘绑定

在页面配置中定义快捷键：

```yaml
keybindings:
  Escape: closeMenu
  S: openSettings
  F: toggleFullscreen
  F11: toggleFullscreen
```

**键名规范**：

- 字母：大写形式 `A-Z`
- 功能键：`Escape`, `Enter`, `Space`, `Tab`
- 功能键：`F1-F12`
- 修饰符：`Shift`, `Ctrl`, `Alt`（暂未支持组合键）

## 数据绑定

### binding（数据绑定）

将 UI 组件绑定到游戏状态，实现自动更新。

```yaml
- id: playerName
  type: dynamicText
  binding: "player.name"        # 路径：gameState.player.name
  prefix: "玩家: "
  style:
    fontSize: 16
```

**绑定路径规则**：

- 路径以 `gameState` 为根对象
- 使用点号分隔属性：`player.name`, `farm.level`, `gameTime.formatted`
- 系统会自动监听变化并更新 UI

### 支持绑定的组件

| 组件类型 | 绑定目标 | 更新时机 |
|----------|----------|----------|
| `dynamicText` | 文本内容 | 数据变化时 |
| `toggle` | 开关状态 | 双向绑定 |
| `slider` | 滑块值 | 双向绑定 |
| `dropdown` | 选中值 | 双向绑定 |

## 开发工作流

### 1. 新增页面

#### 步骤 1：创建页面配置文件

在 `public/configs/ui/` 创建 `my-page.yaml`：

```yaml
page:
  id: my_page
  name: 我的页面
  type: fullscreen

container:
  width: "100%"
  height: "100%"
  background: transparent

components:
  - id: title
    type: title
    text: "我的页面"
    style:
      fontSize: 42
      color: "$textPrimary"

  - id: backBtn
    type: button
    text: "返回"
    action: closeMenu
    style:
      width: "$buttonWidth"
      height: "$buttonHeight"
```

#### 步骤 2：注册到索引文件

编辑 `public/configs/ui/index.yaml`：

```yaml
pages:
  # ... 其他页面
  
  my_page:
    file: my-page.yaml
    state: MY_PAGE         # 需在 GameState.js 中定义
    preload: false

```

#### 步骤 3：定义游戏状态（如需要）

编辑 `src/core/GameState.js`：

```javascript
export const GameStates = {
  // ... 其他状态
  MY_PAGE: 'MY_PAGE'
}
```

#### 步骤 4：测试

启动游戏，通过代码切换到新页面：

```javascript
gameState.setState(GameStates.MY_PAGE)
```

### 2. 修改现有页面

直接编辑对应的 YAML 文件，刷新页面即可看到效果（支持热更新）。

### 3. 调整全局样式

编辑 `public/configs/ui/theme.yaml`，修改颜色、字体、尺寸变量，所有页面自动应用新主题。

### 4. 添加自定义组件类型

如果需要新的组件类型，需要在代码中扩展：

**步骤 1**：在 `ConfigurablePage.js` 中添加创建方法

```javascript
createMyCustomComponent(config) {
  const component = new GUI.Rectangle(config.id)
  // 自定义逻辑...
  this.applyCommonStyles(component, config.style)
  return component
}
```

**步骤 2**：在 `createComponent` 的 switch 中注册

```javascript
createComponent(config, parent) {
  switch (config.type) {
    // ... 其他类型
    case 'myCustomComponent':
      component = this.createMyCustomComponent(config)
      break
  }
}
```

**步骤 3**：在 YAML 中使用

```yaml
- id: myWidget
  type: myCustomComponent
  # 自定义属性...
```

## 最佳实践

### 1. 优先使用主题变量

❌ **不推荐**：硬编码颜色

```yaml
style:
  background: "#1a3a4a"
  color: "#e8e4d9"
```

✅ **推荐**：使用主题变量

```yaml
style:
  background: "$primary"
  color: "$textPrimary"
```

**好处**：统一风格、方便换肤、减少重复

### 2. 合理使用堆栈容器

❌ **不推荐**：手动计算位置

```yaml
- id: btn1
  type: button
  position:
    top: "100px"

- id: btn2
  type: button
  position:
    top: "168px"  # 100 + 52 + 16

- id: btn3
  type: button
  position:
    top: "236px"  # 168 + 52 + 16
```

✅ **推荐**：使用 stack 自动排列

```yaml
- id: buttonStack
  type: stack
  layout:
    isVertical: true
    spacing: 16
  children:
    - id: btn1
      type: button
    - id: btn2
      type: button
    - id: btn3
      type: button
```

### 3. 组件 ID 命名规范

- 使用驼峰命名：`mainMenuTitle`, `startGameBtn`
- 见名知意：`playerNameText`, `volumeSlider`
- 避免缩写：`settingsButton` 优于 `setBtn`

### 4. 文件组织

- 每个页面一个配置文件
- 复杂页面可拆分为多个组件配置（未来支持）
- 配置文件顶部添加注释说明用途

```yaml
# 主菜单页面配置
# 视觉论：空灵、古意、静谧的修仙氛围

page:
  id: main_menu
  # ...
```

### 5. 样式继承

组件会继承主题中的默认样式，只需覆盖差异部分：

```yaml
# theme.yaml 中定义了 button 默认样式
components:
  button:
    width: "$buttonWidth"
    background: "$primary"
    color: "$textPrimary"

# 页面配置中只覆盖特殊属性
- id: dangerBtn
  type: button
  text: "删除"
  style:
    background: "$danger"  # 只覆盖背景色
    # 其他属性继承默认值
```

### 6. 合理使用预加载

- **预加载**（`preload: true`）：启动时加载，适合主菜单、设置等常用页面
- **按需加载**（`preload: false`）：首次显示时加载，适合开发工具等低频页面

### 7. 动态内容优先使用绑定

❌ **不推荐**：代码中查找 UI 并更新

```javascript
// 在代码中操作 UI
const nameText = uiManager.findComponent('playerName')
nameText.text = gameState.player.name
```

✅ **推荐**：使用数据绑定

```yaml
- id: playerName
  type: dynamicText
  binding: "player.name"
```

## 常见问题

### Q1: 修改 YAML 后没有生效？

**A:** 检查以下几点：

1. YAML 语法是否正确（缩进必须用空格，不能用 Tab）
2. 浏览器是否有缓存（硬刷新：Ctrl+Shift+R）
3. 变量名是否正确（大小写敏感）
4. 检查浏览器控制台是否有错误信息

### Q2: 如何调试配置？

**A:** 在浏览器控制台查看加载日志：

```
[ConfigLoader] 初始化配置系统...
[ConfigLoader] 主题加载完成: 仙韵
[ConfigLoader] 预加载页面: main_menu
[ConfigurablePage] 页面初始化完成: main_menu
```

也可以在控制台查看解析后的配置：

```javascript
console.log(configLoader.cache)
console.log(configLoader.theme)
```

### Q3: 变量引用不生效？

**A:** 确保：

1. 变量定义在 `theme.yaml` 中
2. 引用格式正确：`"$variableName"`（必须加引号）
3. 变量路径正确：`colors.primary` 引用为 `$primary`（不含路径前缀）

### Q4: 如何实现响应式布局？

**A:** 目前支持：

- 百分比宽度：`width: "80%"`
- 对齐方式：`horizontalAlignment: center`
- Stack 自动排列

未来将支持更多响应式特性。

### Q5: 能否在运行时修改主题？

**A:** 可以通过代码切换主题：

```javascript
// 重新加载主题
await configLoader.loadConfig('theme-dark.yaml')
// 重新渲染所有页面
uiManager.reloadAllPages()
```

但目前需要编写额外代码，未来会提供内置支持。

## 技术实现

本配置系统基于以下技术栈：

- **配置格式**：YAML（使用 `js-yaml` 解析）
- **渲染引擎**：Babylon.js GUI
- **状态管理**：集中式 `GameState`
- **变量解析**：递归解析 `$变量名` 占位符
- **组件创建**：工厂模式

核心文件：

- `src/core/ConfigLoader.js` - 配置加载器
- `src/ui/ConfigurablePage.js` - 配置驱动的页面渲染器
- `src/ui/UIManager.js` - UI 管理器

## 未来规划

- [ ] 支持配置片段复用（`include` 语法）
- [ ] 支持动画配置
- [ ] 支持条件渲染（`if` 语法）
- [ ] 支持循环渲染（`for` 语法）
- [ ] 可视化配置编辑器
- [ ] 运行时主题切换
- [ ] 响应式布局系统
- [ ] 国际化支持（i18n）

---

**编写日期**：2026 年 4 月 14 日  
**版本**：v1.0.0  
**维护者**：项目团队
