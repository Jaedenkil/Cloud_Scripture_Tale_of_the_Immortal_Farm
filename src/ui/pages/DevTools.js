/**
 * 开发工具页面
 * 提供调试、性能监控、场景编辑等功能
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../../core/GameState.js'
import { UITheme } from '../UIManager.js'

export default class DevToolsPage {
  constructor() {
    this.container = null
    this.advancedTexture = null
    this.uiManager = null
    this.isVisible = false
    this.fpsText = null
    this.scene = null
  }

  /**
   * 初始化页面
   */
  init(advancedTexture, uiManager) {
    this.advancedTexture = advancedTexture
    this.uiManager = uiManager
    this.scene = uiManager.scene
    
    this.createUI()
  }

  /**
   * 创建 UI
   */
  createUI() {
    // 主容器
    this.container = new GUI.Rectangle('devToolsContainer')
    this.container.width = '100%'
    this.container.height = '100%'
    this.container.background = UITheme.colors.bgDark
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 左侧工具面板
    const leftPanel = this.uiManager.createPanel({
      width: '300px',
      height: '100%',
      background: UITheme.colors.bgMedium
    })
    leftPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    leftPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP
    this.container.addControl(leftPanel)

    // 工具栏内容
    const toolStack = new GUI.StackPanel('toolStack')
    toolStack.isVertical = true
    toolStack.spacing = 10
    toolStack.paddingTop = '20px'
    toolStack.paddingLeft = '10px'
    toolStack.paddingRight = '10px'
    leftPanel.addControl(toolStack)

    // 标题
    const title = this.uiManager.createTitle('开发工具', {
      fontSize: 24,
      height: '40px'
    })
    toolStack.addControl(title)

    // 分隔线
    const divider = new GUI.Rectangle()
    divider.width = '100%'
    divider.height = '1px'
    divider.background = UITheme.colors.border
    divider.thickness = 0
    toolStack.addControl(divider)

    // 性能信息区域
    this.createSectionTitle(toolStack, '性能')
    
    // FPS 显示
    this.fpsText = new GUI.TextBlock('fpsText')
    this.fpsText.text = 'FPS: --'
    this.fpsText.color = UITheme.colors.success
    this.fpsText.fontSize = UITheme.sizes.textMedium
    this.fpsText.fontFamily = UITheme.fonts.mono
    this.fpsText.height = '25px'
    this.fpsText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    toolStack.addControl(this.fpsText)

    // 内存信息
    this.memoryText = new GUI.TextBlock('memoryText')
    this.memoryText.text = 'Memory: --'
    this.memoryText.color = UITheme.colors.textSecondary
    this.memoryText.fontSize = UITheme.sizes.textSmall
    this.memoryText.fontFamily = UITheme.fonts.mono
    this.memoryText.height = '20px'
    this.memoryText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    toolStack.addControl(this.memoryText)

    // 场景工具区域
    this.createSectionTitle(toolStack, '场景')

    // 线框模式按钮
    const wireframeBtn = this.uiManager.createButton('线框模式', {
      width: '100%',
      height: '35px',
      fontSize: 14
    })
    wireframeBtn.onPointerClickObservable.add(() => {
      if (this.scene) {
        this.scene.forceWireframe = !this.scene.forceWireframe
        console.log('[DevTools] 线框模式:', this.scene.forceWireframe)
      }
    })
    toolStack.addControl(wireframeBtn)

    // 显示边界框按钮
    const boundingBtn = this.uiManager.createButton('显示边界框', {
      width: '100%',
      height: '35px',
      fontSize: 14
    })
    boundingBtn.onPointerClickObservable.add(() => {
      if (this.scene) {
        this.scene.forceShowBoundingBoxes = !this.scene.forceShowBoundingBoxes
        console.log('[DevTools] 边界框:', this.scene.forceShowBoundingBoxes)
      }
    })
    toolStack.addControl(boundingBtn)

    // 游戏状态区域
    this.createSectionTitle(toolStack, '状态')

    // 状态显示
    this.stateText = new GUI.TextBlock('stateText')
    this.stateText.text = '当前状态: ' + gameState.getState()
    this.stateText.color = UITheme.colors.textSecondary
    this.stateText.fontSize = UITheme.sizes.textSmall
    this.stateText.fontFamily = UITheme.fonts.mono
    this.stateText.height = '20px'
    this.stateText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    toolStack.addControl(this.stateText)

    // 快捷操作区域
    this.createSectionTitle(toolStack, '快捷操作')

    // 重载场景按钮
    const reloadBtn = this.uiManager.createButton('重载场景', {
      width: '100%',
      height: '35px',
      fontSize: 14
    })
    reloadBtn.onPointerClickObservable.add(() => {
      console.log('[DevTools] 重载场景')
      location.reload()
    })
    toolStack.addControl(reloadBtn)

    // 清除存档按钮
    const clearSaveBtn = this.uiManager.createButton('清除存档', {
      width: '100%',
      height: '35px',
      fontSize: 14,
      color: UITheme.colors.danger
    })
    clearSaveBtn.onPointerClickObservable.add(() => {
      console.log('[DevTools] 清除存档')
      localStorage.clear()
    })
    toolStack.addControl(clearSaveBtn)

    // 间隔
    const spacer = new GUI.Rectangle()
    spacer.width = '1px'
    spacer.height = '40px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    toolStack.addControl(spacer)

    // 返回按钮
    const backBtn = this.uiManager.createButton('返回主菜单', {
      width: '100%',
      height: '40px'
    })
    backBtn.onPointerClickObservable.add(() => {
      gameState.setState(GameStates.MAIN_MENU)
    })
    toolStack.addControl(backBtn)

    // 右侧预览区域提示
    const previewHint = new GUI.TextBlock('previewHint')
    previewHint.text = '预览区域\n(场景在此显示)'
    previewHint.color = UITheme.colors.textMuted
    previewHint.fontSize = 18
    previewHint.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    previewHint.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    previewHint.left = '150px'
    this.container.addControl(previewHint)
  }

  /**
   * 创建分区标题
   */
  createSectionTitle(parent, text) {
    const sectionTitle = new GUI.TextBlock()
    sectionTitle.text = `— ${text} —`
    sectionTitle.color = UITheme.colors.accent
    sectionTitle.fontSize = UITheme.sizes.textSmall
    sectionTitle.fontFamily = UITheme.fonts.body
    sectionTitle.height = '30px'
    sectionTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    parent.addControl(sectionTitle)
  }

  /**
   * 更新性能信息
   */
  updatePerformance() {
    if (!this.isVisible || !this.scene) return

    // FPS
    const fps = this.scene.getEngine().getFps().toFixed(0)
    if (this.fpsText) {
      this.fpsText.text = `FPS: ${fps}`
      this.fpsText.color = fps > 50 ? UITheme.colors.success : 
                          fps > 30 ? UITheme.colors.warning : UITheme.colors.danger
    }

    // 内存（如果可用）
    if (performance.memory && this.memoryText) {
      const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
      const total = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)
      this.memoryText.text = `Memory: ${used}MB / ${total}MB`
    }

    // 状态
    if (this.stateText) {
      this.stateText.text = '当前状态: ' + gameState.getState()
    }
  }

  /**
   * 显示页面
   */
  show() {
    if (this.container) {
      this.container.isVisible = true
      this.isVisible = true
      
      // 启动性能更新
      this.perfInterval = setInterval(() => this.updatePerformance(), 500)
    }
  }

  /**
   * 隐藏页面
   */
  hide() {
    if (this.container) {
      this.container.isVisible = false
      this.isVisible = false
      
      // 停止性能更新
      if (this.perfInterval) {
        clearInterval(this.perfInterval)
        this.perfInterval = null
      }
    }
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.perfInterval) {
      clearInterval(this.perfInterval)
    }
    if (this.container) {
      this.container.dispose()
      this.container = null
    }
  }
}
