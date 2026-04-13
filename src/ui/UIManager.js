/**
 * UI 管理器
 * 使用 Babylon.js GUI 管理所有游戏界面
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../core/GameState.js'

/**
 * UI 主题配置
 * 视觉论：空灵、古意、仙气、静谧
 */
export const UITheme = {
  // 颜色系统（克制的配色）
  colors: {
    // 主色调 - 玄青
    primary: '#2d4a5e',
    primaryLight: '#4a7a8a',
    primaryDark: '#1a2e3a',
    
    // 强调色 - 金
    accent: '#c9a227',
    accentLight: '#e8c547',
    accentDark: '#8a6f1a',
    
    // 背景
    bgDark: 'rgba(15, 20, 30, 0.95)',
    bgMedium: 'rgba(25, 35, 50, 0.9)',
    bgLight: 'rgba(40, 55, 75, 0.85)',
    
    // 文字
    textPrimary: '#e8e4d9',
    textSecondary: '#a0a8b0',
    textMuted: '#6a7280',
    
    // 功能色
    success: '#4a9e6a',
    warning: '#c9a227',
    danger: '#a84040',
    
    // 边框
    border: 'rgba(200, 200, 200, 0.15)',
    borderHover: 'rgba(200, 180, 100, 0.4)'
  },
  
  // 字体
  fonts: {
    title: 'KaiTi, STKaiti, serif',
    body: 'Microsoft YaHei, sans-serif',
    mono: 'Consolas, monospace'
  },
  
  // 尺寸
  sizes: {
    titleLarge: 48,
    titleMedium: 32,
    titleSmall: 24,
    textLarge: 18,
    textMedium: 16,
    textSmall: 14,
    
    buttonWidth: 240,
    buttonHeight: 50,
    buttonSpacing: 16,
    
    padding: 20,
    borderRadius: 4
  }
}

class UIManager {
  constructor() {
    this.advancedTexture = null
    this.currentPage = null
    this.pages = new Map()
    this.scene = null
  }

  /**
   * 初始化 UI 系统
   */
  init(scene) {
    this.scene = scene
    
    // 创建全屏 UI
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene)
    this.advancedTexture.idealWidth = 1920
    this.advancedTexture.idealHeight = 1080
    
    // 监听状态变化
    gameState.on('stateChange', ({ to }) => this.onStateChange(to))
    
    console.log('[UIManager] 初始化完成')
  }

  /**
   * 状态变化处理
   */
  onStateChange(newState) {
    // 隐藏当前页面
    if (this.currentPage) {
      this.hidePage(this.currentPage)
    }
    
    // 显示对应页面
    switch (newState) {
      case GameStates.MAIN_MENU:
        this.showPage('mainMenu')
        break
      case GameStates.SETTINGS:
        this.showPage('settings')
        break
      case GameStates.PAUSED:
        this.showPage('pause')
        break
      case GameStates.DEV_TOOLS:
        this.showPage('devTools')
        break
      case GameStates.PLAYING:
        this.showPage('hud')
        break
    }
  }

  /**
   * 注册页面
   */
  registerPage(name, pageInstance) {
    this.pages.set(name, pageInstance)
    pageInstance.init(this.advancedTexture, this)
  }

  /**
   * 显示页面
   */
  showPage(name) {
    const page = this.pages.get(name)
    if (page) {
      page.show()
      this.currentPage = name
    }
  }

  /**
   * 隐藏页面
   */
  hidePage(name) {
    const page = this.pages.get(name)
    if (page) {
      page.hide()
    }
  }

  /**
   * 创建标准按钮
   */
  createButton(text, options = {}) {
    const button = GUI.Button.CreateSimpleButton(options.name || text, text)
    
    // 尺寸
    button.width = options.width || `${UITheme.sizes.buttonWidth}px`
    button.height = options.height || `${UITheme.sizes.buttonHeight}px`
    
    // 样式
    button.color = options.color || UITheme.colors.textPrimary
    button.background = options.background || UITheme.colors.bgMedium
    button.cornerRadius = UITheme.sizes.borderRadius
    button.thickness = 1
    button.hoverCursor = 'pointer'
    
    // 文字样式
    const textBlock = button.textBlock
    if (textBlock) {
      textBlock.fontFamily = UITheme.fonts.body
      textBlock.fontSize = options.fontSize || UITheme.sizes.textLarge
    }
    
    // 悬停效果
    button.onPointerEnterObservable.add(() => {
      button.background = UITheme.colors.bgLight
      button.thickness = 2
      button.color = UITheme.colors.accent
    })
    
    button.onPointerOutObservable.add(() => {
      button.background = options.background || UITheme.colors.bgMedium
      button.thickness = 1
      button.color = options.color || UITheme.colors.textPrimary
    })
    
    // 点击效果
    button.onPointerDownObservable.add(() => {
      button.background = UITheme.colors.primaryDark
    })
    
    button.onPointerUpObservable.add(() => {
      button.background = UITheme.colors.bgLight
    })
    
    return button
  }

  /**
   * 创建标题文本
   */
  createTitle(text, options = {}) {
    const title = new GUI.TextBlock()
    title.text = text
    title.color = options.color || UITheme.colors.textPrimary
    title.fontSize = options.fontSize || UITheme.sizes.titleLarge
    title.fontFamily = UITheme.fonts.title
    title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    title.height = options.height || '80px'
    
    if (options.shadowColor) {
      title.shadowColor = options.shadowColor
      title.shadowBlur = options.shadowBlur || 10
    }
    
    return title
  }

  /**
   * 创建副标题文本
   */
  createSubtitle(text, options = {}) {
    const subtitle = new GUI.TextBlock()
    subtitle.text = text
    subtitle.color = options.color || UITheme.colors.textSecondary
    subtitle.fontSize = options.fontSize || UITheme.sizes.textMedium
    subtitle.fontFamily = UITheme.fonts.body
    subtitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    subtitle.height = options.height || '30px'
    
    return subtitle
  }

  /**
   * 创建滑块
   */
  createSlider(options = {}) {
    const slider = new GUI.Slider()
    slider.minimum = options.min ?? 0
    slider.maximum = options.max ?? 1
    slider.value = options.value ?? 0.5
    slider.width = options.width || '200px'
    slider.height = options.height || '20px'
    slider.color = UITheme.colors.accent
    slider.background = UITheme.colors.bgLight
    slider.thumbColor = UITheme.colors.textPrimary
    slider.borderColor = UITheme.colors.border
    slider.isThumbCircle = true
    
    return slider
  }

  /**
   * 创建面板容器
   */
  createPanel(options = {}) {
    const panel = new GUI.Rectangle()
    panel.width = options.width || '400px'
    panel.height = options.height || '500px'
    panel.background = options.background || UITheme.colors.bgDark
    panel.cornerRadius = UITheme.sizes.borderRadius
    panel.thickness = options.thickness ?? 1
    panel.color = UITheme.colors.border
    
    return panel
  }

  /**
   * 创建垂直堆栈面板
   */
  createStackPanel(options = {}) {
    const stack = new GUI.StackPanel()
    stack.isVertical = options.vertical ?? true
    stack.spacing = options.spacing ?? UITheme.sizes.buttonSpacing
    
    if (options.width) stack.width = options.width
    if (options.height) stack.height = options.height
    
    return stack
  }

  /**
   * 销毁
   */
  dispose() {
    this.pages.forEach(page => page.dispose())
    this.pages.clear()
    
    if (this.advancedTexture) {
      this.advancedTexture.dispose()
    }
  }
}

export const uiManager = new UIManager()
export default uiManager
