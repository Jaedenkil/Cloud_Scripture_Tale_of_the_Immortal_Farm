/**
 * 游戏内 HUD
 * 显示玩家状态、快捷栏等
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../../core/GameState.js'
import { UITheme } from '../UIManager.js'

export default class GameHUD {
  constructor() {
    this.container = null
    this.advancedTexture = null
    this.uiManager = null
    this.isVisible = false
  }

  /**
   * 初始化
   */
  init(advancedTexture, uiManager) {
    this.advancedTexture = advancedTexture
    this.uiManager = uiManager
    
    this.createUI()
    this.setupKeyboardControls()
  }

  /**
   * 创建 UI
   */
  createUI() {
    // 主容器（不阻挡鼠标）
    this.container = new GUI.Rectangle('hudContainer')
    this.container.width = '100%'
    this.container.height = '100%'
    this.container.thickness = 0
    this.container.background = 'transparent'
    this.container.isVisible = false
    this.container.isPointerBlocker = false
    this.advancedTexture.addControl(this.container)

    // 左上角：玩家信息
    this.createPlayerInfo()
    
    // 右上角：小地图占位
    this.createMiniMapPlaceholder()
    
    // 底部：快捷栏
    this.createHotbar()
    
    // 左下角：提示信息
    this.createHintArea()
  }

  /**
   * 创建玩家信息面板
   */
  createPlayerInfo() {
    const infoPanel = new GUI.Rectangle('playerInfo')
    infoPanel.width = '200px'
    infoPanel.height = '100px'
    infoPanel.background = 'rgba(0, 0, 0, 0.5)'
    infoPanel.cornerRadius = 4
    infoPanel.thickness = 0
    infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    infoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    infoPanel.left = '20px'
    infoPanel.top = '50px' // 给标题栏留空间
    this.container.addControl(infoPanel)

    const infoStack = new GUI.StackPanel()
    infoStack.isVertical = true
    infoStack.spacing = 5
    infoStack.paddingTop = '10px'
    infoStack.paddingLeft = '10px'
    infoPanel.addControl(infoStack)

    // 玩家名称
    const nameText = new GUI.TextBlock('playerName')
    nameText.text = gameState.data.player.name
    nameText.color = UITheme.colors.textPrimary
    nameText.fontSize = 16
    nameText.height = '25px'
    nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    infoStack.addControl(nameText)

    // 境界
    const cultivationText = new GUI.TextBlock('cultivation')
    cultivationText.text = gameState.data.player.cultivation
    cultivationText.color = UITheme.colors.accent
    cultivationText.fontSize = 14
    cultivationText.height = '20px'
    cultivationText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    infoStack.addControl(cultivationText)

    // 灵力条
    const spiritBar = this.createProgressBar('spirit', 
      gameState.data.player.spirit / gameState.data.player.maxSpirit,
      UITheme.colors.primaryLight
    )
    infoStack.addControl(spiritBar)
  }

  /**
   * 创建进度条
   */
  createProgressBar(name, value, color) {
    const container = new GUI.Rectangle(`${name}BarContainer`)
    container.width = '180px'
    container.height = '15px'
    container.background = 'rgba(0, 0, 0, 0.3)'
    container.cornerRadius = 2
    container.thickness = 0
    
    const fill = new GUI.Rectangle(`${name}BarFill`)
    fill.width = `${value * 100}%`
    fill.height = '100%'
    fill.background = color
    fill.cornerRadius = 2
    fill.thickness = 0
    fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    container.addControl(fill)
    
    return container
  }

  /**
   * 创建小地图占位
   */
  createMiniMapPlaceholder() {
    const miniMap = new GUI.Rectangle('miniMap')
    miniMap.width = '150px'
    miniMap.height = '150px'
    miniMap.background = 'rgba(0, 0, 0, 0.5)'
    miniMap.cornerRadius = 4
    miniMap.thickness = 1
    miniMap.color = UITheme.colors.border
    miniMap.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    miniMap.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    miniMap.left = '-20px'
    miniMap.top = '50px'
    this.container.addControl(miniMap)

    const mapText = new GUI.TextBlock()
    mapText.text = '小地图'
    mapText.color = UITheme.colors.textMuted
    mapText.fontSize = 14
    miniMap.addControl(mapText)
  }

  /**
   * 创建快捷栏
   */
  createHotbar() {
    const hotbar = new GUI.StackPanel('hotbar')
    hotbar.isVertical = false
    hotbar.spacing = 4
    hotbar.height = '60px'
    hotbar.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    hotbar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    hotbar.top = '-20px'
    this.container.addControl(hotbar)

    // 创建 9 个快捷槽
    for (let i = 0; i < 9; i++) {
      const slot = new GUI.Rectangle(`slot${i}`)
      slot.width = '50px'
      slot.height = '50px'
      slot.background = 'rgba(0, 0, 0, 0.6)'
      slot.cornerRadius = 4
      slot.thickness = i === 0 ? 2 : 1
      slot.color = i === 0 ? UITheme.colors.accent : UITheme.colors.border
      hotbar.addControl(slot)

      // 槽位数字
      const numText = new GUI.TextBlock()
      numText.text = (i + 1).toString()
      numText.color = UITheme.colors.textMuted
      numText.fontSize = 10
      numText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
      numText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
      numText.paddingRight = '4px'
      numText.paddingTop = '2px'
      slot.addControl(numText)
    }
  }

  /**
   * 创建提示区域
   */
  createHintArea() {
    const hintText = new GUI.TextBlock('hintText')
    hintText.text = '按 ESC 暂停游戏'
    hintText.color = UITheme.colors.textMuted
    hintText.fontSize = 12
    hintText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    hintText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
    hintText.left = '20px'
    hintText.top = '-20px'
    this.container.addControl(hintText)
  }

  /**
   * 设置键盘控制
   */
  setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      if (!this.isVisible) return
      
      // ESC 暂停
      if (e.key === 'Escape') {
        gameState.setState(GameStates.PAUSED)
      }
    })
  }

  /**
   * 显示
   */
  show() {
    if (this.container) {
      this.container.isVisible = true
      this.isVisible = true
    }
  }

  /**
   * 隐藏
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
