/**
 * 主菜单页面
 * 视觉论：空灵、古意、静谧的修仙氛围
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../../core/GameState.js'
import { UITheme } from '../UIManager.js'

export default class MainMenuPage {
  constructor() {
    this.container = null
    this.advancedTexture = null
    this.uiManager = null
    this.isVisible = false
  }

  /**
   * 初始化页面
   */
  init(advancedTexture, uiManager) {
    this.advancedTexture = advancedTexture
    this.uiManager = uiManager
    
    this.createUI()
  }

  /**
   * 创建 UI
   */
  createUI() {
    // 主容器（全屏）
    this.container = new GUI.Rectangle('mainMenuContainer')
    this.container.width = '100%'
    this.container.height = '100%'
    this.container.background = 'transparent'
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 背景渐变层
    const bgOverlay = new GUI.Rectangle('bgOverlay')
    bgOverlay.width = '100%'
    bgOverlay.height = '100%'
    bgOverlay.background = 'linear-gradient(180deg, rgba(15,25,40,0.7) 0%, rgba(20,30,50,0.9) 100%)'
    bgOverlay.thickness = 0
    this.container.addControl(bgOverlay)

    // 内容区域
    const contentStack = new GUI.StackPanel('contentStack')
    contentStack.isVertical = true
    contentStack.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    contentStack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    this.container.addControl(contentStack)

    // 游戏标题
    const title = this.uiManager.createTitle('云笈仙田录', {
      fontSize: 56,
      color: UITheme.colors.textPrimary,
      shadowColor: UITheme.colors.accent,
      shadowBlur: 20,
      height: '100px'
    })
    contentStack.addControl(title)

    // 副标题
    const subtitle = this.uiManager.createSubtitle('Cloud Scripture: Tale of the Immortal Farm', {
      color: UITheme.colors.textSecondary,
      fontSize: 16,
      height: '40px'
    })
    contentStack.addControl(subtitle)

    // 间隔
    const spacer = new GUI.Rectangle()
    spacer.width = '1px'
    spacer.height = '60px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    contentStack.addControl(spacer)

    // 按钮容器
    const buttonStack = new GUI.StackPanel('buttonStack')
    buttonStack.isVertical = true
    buttonStack.spacing = 16
    contentStack.addControl(buttonStack)

    // 开始游戏按钮
    const startBtn = this.uiManager.createButton('开始游戏', { name: 'startBtn' })
    startBtn.onPointerClickObservable.add(() => {
      console.log('[MainMenu] 开始游戏')
      gameState.setState(GameStates.PLAYING)
    })
    buttonStack.addControl(startBtn)

    // 继续游戏按钮
    const continueBtn = this.uiManager.createButton('继续游戏', { 
      name: 'continueBtn',
      background: UITheme.colors.bgLight
    })
    continueBtn.onPointerClickObservable.add(() => {
      console.log('[MainMenu] 继续游戏')
      // TODO: 加载存档
      gameState.setState(GameStates.PLAYING)
    })
    buttonStack.addControl(continueBtn)

    // 设置按钮
    const settingsBtn = this.uiManager.createButton('设置', { name: 'settingsBtn' })
    settingsBtn.onPointerClickObservable.add(() => {
      console.log('[MainMenu] 打开设置')
      gameState.setState(GameStates.SETTINGS)
    })
    buttonStack.addControl(settingsBtn)

    // 开发工具按钮（仅开发模式显示）
    const devBtn = this.uiManager.createButton('开发工具', { 
      name: 'devBtn',
      background: 'rgba(100, 60, 60, 0.5)'
    })
    devBtn.onPointerClickObservable.add(() => {
      console.log('[MainMenu] 打开开发工具')
      gameState.setState(GameStates.DEV_TOOLS)
    })
    buttonStack.addControl(devBtn)

    // 退出游戏按钮
    const exitBtn = this.uiManager.createButton('退出游戏', { 
      name: 'exitBtn',
      color: UITheme.colors.danger
    })
    exitBtn.onPointerClickObservable.add(() => {
      console.log('[MainMenu] 退出游戏')
      if (window.electronAPI) {
        window.electronAPI.close()
      }
    })
    buttonStack.addControl(exitBtn)

    // 底部版本信息
    const versionText = new GUI.TextBlock('version')
    versionText.text = 'v0.1.0 - 早期开发版'
    versionText.color = UITheme.colors.textMuted
    versionText.fontSize = 12
    versionText.fontFamily = UITheme.fonts.body
    versionText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    versionText.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    versionText.paddingRight = '20px'
    versionText.paddingBottom = '20px'
    this.container.addControl(versionText)
  }

  /**
   * 显示页面
   */
  show() {
    if (this.container) {
      this.container.isVisible = true
      this.isVisible = true
    }
  }

  /**
   * 隐藏页面
   */
  hide() {
    if (this.container) {
      this.container.isVisible = false
      this.isVisible = false
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.container) {
      this.container.dispose()
      this.container = null
    }
  }
}
