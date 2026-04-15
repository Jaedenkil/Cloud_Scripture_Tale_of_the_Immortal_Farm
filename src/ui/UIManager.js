/**
 * UI 管理器
 * 使用 Babylon.js GUI 管理所有游戏界面
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../core/GameState.js'
import { ConfigurablePage } from './ConfigurablePage.js'
import { configLoader } from '../core/ConfigLoader.js'

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
    this.advancedTexture.idealWidth = 640
    this.advancedTexture.idealHeight = 360
    
    // 监听状态变化
    gameState.on('stateChange', ({ to }) => this.onStateChange(to))
    
    console.log('[UIManager] 初始化完成')
  }

  /**
   * 状态变化处理
   */
  onStateChange(newState) {
    if (this.currentPage) {
      this.hidePage(this.currentPage)
    }
    this.showPage(newState)
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
   * 从 YAML 配置加载所有 UI 页面
   */
  async loadFromConfig() {
    try {
      const { index, pages } = await configLoader.init()

      for (const { pageId, config, state } of pages) {
        const pageName = GameStates[state]
        if (pageName !== undefined) {
          const page = new ConfigurablePage(config)
          this.registerPage(pageName, page)
          if (state === 'SETTINGS') {
            this.registerSettingsHandlers(page)
          }
        }
      }

      // 设置初始状态，触发首个页面显示
      const initialState = GameStates[index.initialState]
      if (initialState !== undefined) {
        gameState.setState(initialState)
      }

      return true
    } catch (error) {
      console.error('[UIManager] 配置加载失败:', error)
      return false
    }
  }

  /**
   * 注册设置页面的标签切换逻辑
   */
  registerSettingsHandlers(page) {
    const theme = configLoader.getTheme()
    const colors = theme?.colors || {}

    const switchTab = (activeContentId) => {
      const tabMap = [
        { contentId: 'audioContent', tabId: 'tabAudio' },
        { contentId: 'graphicsContent', tabId: 'tabGraphics' },
        { contentId: 'languageContent', tabId: 'tabLanguage' }
      ]
      for (const { contentId, tabId } of tabMap) {
        const content = page.components.get(contentId)
        const tab = page.components.get(tabId)
        const isActive = contentId === activeContentId
        if (content) content.isVisible = isActive
        if (tab) {
          tab.background = isActive ? (colors.primary || '#4A9BE8') : 'rgba(50, 80, 115, 0.35)'
          tab.color = isActive ? (colors.primaryLight || '#6BB3F0') : (colors.border || 'rgba(74, 155, 232, 0.4)')
          if (tab.textBlock) {
            tab.textBlock.color = isActive ? (colors.textPrimary || '#FFFFFF') : (colors.textSecondary || '#B0D4F1')
          }
        }
      }
    }

    // 页面初始化后延迟执行，确保组件已创建
    setTimeout(() => switchTab('audioContent'), 0)

    page.registerHandler('switchToAudio', () => switchTab('audioContent'))
    page.registerHandler('switchToGraphics', () => switchTab('graphicsContent'))
    page.registerHandler('switchToLanguage', () => switchTab('languageContent'))
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
