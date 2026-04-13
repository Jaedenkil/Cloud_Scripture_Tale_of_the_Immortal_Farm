/**
 * 暂停菜单页面
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../../core/GameState.js'
import { UITheme } from '../UIManager.js'

export default class PauseMenuPage {
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
    // 主容器（半透明遮罩）
    this.container = new GUI.Rectangle('pauseContainer')
    this.container.width = '100%'
    this.container.height = '100%'
    this.container.background = 'rgba(0, 0, 0, 0.6)'
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 暂停面板
    const panel = this.uiManager.createPanel({
      width: '350px',
      height: '400px'
    })
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    this.container.addControl(panel)

    // 内容堆栈
    const contentStack = new GUI.StackPanel('pauseContent')
    contentStack.isVertical = true
    contentStack.spacing = 16
    contentStack.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    panel.addControl(contentStack)

    // 标题
    const title = this.uiManager.createTitle('游戏暂停', {
      fontSize: 32,
      height: '60px'
    })
    contentStack.addControl(title)

    // 间隔
    const spacer = new GUI.Rectangle()
    spacer.width = '1px'
    spacer.height = '20px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    contentStack.addControl(spacer)

    // 继续游戏按钮
    const resumeBtn = this.uiManager.createButton('继续游戏', { 
      name: 'resumeBtn',
      background: UITheme.colors.accent
    })
    resumeBtn.onPointerClickObservable.add(() => {
      console.log('[PauseMenu] 继续游戏')
      gameState.setState(GameStates.PLAYING)
    })
    contentStack.addControl(resumeBtn)

    // 设置按钮
    const settingsBtn = this.uiManager.createButton('设置', { name: 'settingsBtn' })
    settingsBtn.onPointerClickObservable.add(() => {
      console.log('[PauseMenu] 打开设置')
      gameState.setState(GameStates.SETTINGS)
    })
    contentStack.addControl(settingsBtn)

    // 存档按钮
    const saveBtn = this.uiManager.createButton('保存游戏', { name: 'saveBtn' })
    saveBtn.onPointerClickObservable.add(() => {
      console.log('[PauseMenu] 保存游戏')
      // TODO: 实现存档
    })
    contentStack.addControl(saveBtn)

    // 返回主菜单按钮
    const mainMenuBtn = this.uiManager.createButton('返回主菜单', { 
      name: 'mainMenuBtn',
      color: UITheme.colors.warning
    })
    mainMenuBtn.onPointerClickObservable.add(() => {
      console.log('[PauseMenu] 返回主菜单')
      gameState.setState(GameStates.MAIN_MENU)
    })
    contentStack.addControl(mainMenuBtn)
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
