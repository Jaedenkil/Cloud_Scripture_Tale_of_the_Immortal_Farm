/**
 * 设置页面
 * 音量、画质、全屏等设置
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../../core/GameState.js'
import { UITheme } from '../UIManager.js'

export default class SettingsPage {
  constructor() {
    this.container = null
    this.advancedTexture = null
    this.uiManager = null
    this.isVisible = false
    this.sliders = {}
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
    // 主容器
    this.container = new GUI.Rectangle('settingsContainer')
    this.container.width = '100%'
    this.container.height = '100%'
    this.container.background = UITheme.colors.bgDark
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 设置面板
    const panel = this.uiManager.createPanel({
      width: '500px',
      height: '600px'
    })
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
    this.container.addControl(panel)

    // 内容堆栈
    const contentStack = new GUI.StackPanel('settingsContent')
    contentStack.isVertical = true
    contentStack.spacing = 20
    contentStack.paddingTop = '30px'
    panel.addControl(contentStack)

    // 标题
    const title = this.uiManager.createTitle('设置', {
      fontSize: 36,
      height: '60px'
    })
    contentStack.addControl(title)

    // 音频设置区域
    this.createSectionTitle(contentStack, '音频')
    this.createSliderRow(contentStack, '主音量', 'masterVolume', gameState.data.settings.masterVolume)
    this.createSliderRow(contentStack, '音乐', 'musicVolume', gameState.data.settings.musicVolume)
    this.createSliderRow(contentStack, '音效', 'sfxVolume', gameState.data.settings.sfxVolume)

    // 画面设置区域
    this.createSectionTitle(contentStack, '画面')
    this.createQualitySelector(contentStack)
    this.createToggleRow(contentStack, '全屏模式', 'fullscreen', gameState.data.settings.fullscreen)

    // 间隔
    const spacer = new GUI.Rectangle()
    spacer.width = '1px'
    spacer.height = '30px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    contentStack.addControl(spacer)

    // 按钮区域
    const buttonStack = new GUI.StackPanel()
    buttonStack.isVertical = false
    buttonStack.spacing = 20
    buttonStack.height = '60px'
    contentStack.addControl(buttonStack)

    // 应用按钮
    const applyBtn = this.uiManager.createButton('应用', {
      width: '120px',
      background: UITheme.colors.accent
    })
    applyBtn.onPointerClickObservable.add(() => {
      this.applySettings()
    })
    buttonStack.addControl(applyBtn)

    // 返回按钮
    const backBtn = this.uiManager.createButton('返回', {
      width: '120px'
    })
    backBtn.onPointerClickObservable.add(() => {
      gameState.goBack()
    })
    buttonStack.addControl(backBtn)
  }

  /**
   * 创建分区标题
   */
  createSectionTitle(parent, text) {
    const titleContainer = new GUI.Rectangle()
    titleContainer.height = '35px'
    titleContainer.width = '90%'
    titleContainer.thickness = 0
    titleContainer.background = 'transparent'
    parent.addControl(titleContainer)

    const sectionTitle = new GUI.TextBlock()
    sectionTitle.text = text
    sectionTitle.color = UITheme.colors.accent
    sectionTitle.fontSize = UITheme.sizes.textLarge
    sectionTitle.fontFamily = UITheme.fonts.body
    sectionTitle.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    sectionTitle.paddingLeft = '20px'
    titleContainer.addControl(sectionTitle)

    // 分隔线
    const line = new GUI.Rectangle()
    line.width = '90%'
    line.height = '1px'
    line.background = UITheme.colors.border
    line.thickness = 0
    parent.addControl(line)
  }

  /**
   * 创建滑块行
   */
  createSliderRow(parent, label, key, initialValue) {
    const row = new GUI.StackPanel()
    row.isVertical = false
    row.height = '40px'
    row.width = '90%'
    parent.addControl(row)

    // 标签
    const labelText = new GUI.TextBlock()
    labelText.text = label
    labelText.color = UITheme.colors.textPrimary
    labelText.fontSize = UITheme.sizes.textMedium
    labelText.fontFamily = UITheme.fonts.body
    labelText.width = '100px'
    labelText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    row.addControl(labelText)

    // 滑块
    const slider = this.uiManager.createSlider({
      value: initialValue,
      width: '200px'
    })
    this.sliders[key] = slider
    slider.onValueChangedObservable.add((value) => {
      valueText.text = Math.round(value * 100) + '%'
    })
    row.addControl(slider)

    // 数值显示
    const valueText = new GUI.TextBlock()
    valueText.text = Math.round(initialValue * 100) + '%'
    valueText.color = UITheme.colors.textSecondary
    valueText.fontSize = UITheme.sizes.textSmall
    valueText.width = '60px'
    valueText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
    row.addControl(valueText)
  }

  /**
   * 创建画质选择器
   */
  createQualitySelector(parent) {
    const row = new GUI.StackPanel()
    row.isVertical = false
    row.height = '40px'
    row.width = '90%'
    parent.addControl(row)

    // 标签
    const labelText = new GUI.TextBlock()
    labelText.text = '画质'
    labelText.color = UITheme.colors.textPrimary
    labelText.fontSize = UITheme.sizes.textMedium
    labelText.fontFamily = UITheme.fonts.body
    labelText.width = '100px'
    labelText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    row.addControl(labelText)

    // 选项按钮
    const options = ['低', '中', '高']
    const values = ['low', 'medium', 'high']
    
    options.forEach((opt, i) => {
      const btn = GUI.Button.CreateSimpleButton(`quality_${values[i]}`, opt)
      btn.width = '60px'
      btn.height = '30px'
      btn.color = UITheme.colors.textPrimary
      btn.background = gameState.data.settings.quality === values[i] 
        ? UITheme.colors.accent 
        : UITheme.colors.bgLight
      btn.fontSize = UITheme.sizes.textSmall
      btn.cornerRadius = 4
      btn.thickness = 0
      
      btn.onPointerClickObservable.add(() => {
        // 更新所有按钮状态
        options.forEach((_, j) => {
          const targetBtn = row.children[j + 1] // 跳过标签
          if (targetBtn) {
            targetBtn.background = j === i ? UITheme.colors.accent : UITheme.colors.bgLight
          }
        })
        gameState.data.settings.quality = values[i]
      })
      
      row.addControl(btn)
    })
  }

  /**
   * 创建开关行
   */
  createToggleRow(parent, label, key, initialValue) {
    const row = new GUI.StackPanel()
    row.isVertical = false
    row.height = '40px'
    row.width = '90%'
    parent.addControl(row)

    // 标签
    const labelText = new GUI.TextBlock()
    labelText.text = label
    labelText.color = UITheme.colors.textPrimary
    labelText.fontSize = UITheme.sizes.textMedium
    labelText.fontFamily = UITheme.fonts.body
    labelText.width = '200px'
    labelText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    row.addControl(labelText)

    // 开关按钮
    const toggleBtn = GUI.Button.CreateSimpleButton(`toggle_${key}`, initialValue ? '开' : '关')
    toggleBtn.width = '60px'
    toggleBtn.height = '30px'
    toggleBtn.color = UITheme.colors.textPrimary
    toggleBtn.background = initialValue ? UITheme.colors.success : UITheme.colors.bgLight
    toggleBtn.fontSize = UITheme.sizes.textSmall
    toggleBtn.cornerRadius = 4
    toggleBtn.thickness = 0
    
    toggleBtn.onPointerClickObservable.add(() => {
      const newValue = !gameState.data.settings[key]
      gameState.data.settings[key] = newValue
      toggleBtn.textBlock.text = newValue ? '开' : '关'
      toggleBtn.background = newValue ? UITheme.colors.success : UITheme.colors.bgLight
    })
    
    row.addControl(toggleBtn)
  }

  /**
   * 应用设置
   */
  applySettings() {
    // 更新滑块值到设置
    Object.keys(this.sliders).forEach(key => {
      gameState.updateSettings(key, this.sliders[key].value)
    })
    
    console.log('[Settings] 设置已应用', gameState.data.settings)
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
