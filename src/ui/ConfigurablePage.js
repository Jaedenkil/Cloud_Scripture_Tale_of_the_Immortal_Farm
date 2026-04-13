/**
 * 配置驱动的页面渲染器
 * 根据 YAML 配置生成 Babylon.js GUI 组件
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../core/GameState.js'
import { configLoader } from '../core/ConfigLoader.js'

export class ConfigurablePage {
  constructor(config) {
    this.config = config
    this.pageId = config.page?.id || 'unknown'
    this.container = null
    this.advancedTexture = null
    this.uiManager = null
    this.isVisible = false
    this.components = new Map()  // 存储所有组件引用
    this.dynamicBindings = []    // 动态绑定列表
    this.customHandlers = {}     // 自定义事件处理器
  }

  /**
   * 注册自定义事件处理器
   */
  registerHandler(name, handler) {
    this.customHandlers[name] = handler
  }

  /**
   * 初始化页面
   */
  init(advancedTexture, uiManager) {
    this.advancedTexture = advancedTexture
    this.uiManager = uiManager
    
    this.createUI()
    console.log(`[ConfigurablePage] 页面初始化完成: ${this.pageId}`)
  }

  /**
   * 根据配置创建 UI
   */
  createUI() {
    const containerConfig = this.config.container || {}
    
    // 创建主容器
    this.container = new GUI.Rectangle(`${this.pageId}Container`)
    this.container.width = containerConfig.width || '100%'
    this.container.height = containerConfig.height || '100%'
    this.container.background = this.resolveValue(containerConfig.background) || 'transparent'
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 渲染组件
    const components = this.config.components || []
    for (const componentConfig of components) {
      const component = this.createComponent(componentConfig, this.container)
      if (component) {
        this.components.set(componentConfig.id, component)
      }
    }

    // 设置键盘绑定
    this.setupKeybindings()
  }

  /**
   * 创建单个组件
   */
  createComponent(config, parent) {
    const type = config.type
    let component = null

    switch (type) {
      case 'rectangle':
        component = this.createRectangle(config)
        break
      case 'panel':
        component = this.createPanel(config)
        break
      case 'stack':
        component = this.createStack(config)
        break
      case 'title':
        component = this.createTitle(config)
        break
      case 'subtitle':
        component = this.createSubtitle(config)
        break
      case 'text':
        component = this.createText(config)
        break
      case 'dynamicText':
        component = this.createDynamicText(config)
        break
      case 'button':
        component = this.createButton(config)
        break
      case 'slider':
        component = this.createSlider(config)
        break
      case 'toggle':
        component = this.createToggle(config)
        break
      case 'selector':
        component = this.createSelector(config)
        break
      case 'spacer':
        component = this.createSpacer(config)
        break
      case 'section':
        component = this.createSection(config)
        break
      case 'settingGroup':
        component = this.createSettingGroup(config)
        break
      case 'progressBar':
        component = this.createProgressBar(config)
        break
      case 'slotGrid':
        component = this.createSlotGrid(config)
        break
      case 'canvas':
        component = this.createCanvasPlaceholder(config)
        break
      default:
        console.warn(`[ConfigurablePage] 未知组件类型: ${type}`)
        return null
    }

    if (component && parent) {
      parent.addControl(component)
    }

    // 应用布局
    if (config.layout) {
      this.applyLayout(component, config.layout)
    }

    // 递归创建子组件
    if (config.children) {
      for (const childConfig of config.children) {
        const child = this.createComponent(childConfig, component)
        if (child) {
          this.components.set(childConfig.id, child)
        }
      }
    }

    return component
  }

  /**
   * 解析值（处理变量引用）
   */
  resolveValue(value) {
    if (!value) return value
    if (typeof value !== 'string') return value
    
    if (value.startsWith('$')) {
      const varName = value.slice(1)
      return configLoader.getColor(varName) || 
             configLoader.getFont(varName) || 
             configLoader.getSize(varName) || 
             value
    }
    return value
  }

  /**
   * 应用布局配置
   */
  applyLayout(control, layout) {
    if (!control || !layout) return

    // 对齐方式
    if (layout.horizontalAlignment) {
      const alignMap = {
        'left': GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
        'center': GUI.Control.HORIZONTAL_ALIGNMENT_CENTER,
        'right': GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
      }
      control.horizontalAlignment = alignMap[layout.horizontalAlignment] || GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    }

    if (layout.verticalAlignment) {
      const alignMap = {
        'top': GUI.Control.VERTICAL_ALIGNMENT_TOP,
        'center': GUI.Control.VERTICAL_ALIGNMENT_CENTER,
        'bottom': GUI.Control.VERTICAL_ALIGNMENT_BOTTOM
      }
      control.verticalAlignment = alignMap[layout.verticalAlignment] || GUI.Control.VERTICAL_ALIGNMENT_CENTER
    }

    // 位置
    if (layout.left) control.left = layout.left
    if (layout.right) control.left = `-${layout.right}`  // 右侧偏移转为负左偏移
    if (layout.top) control.top = layout.top
    if (layout.bottom) control.top = `-${layout.bottom}`

    // 堆栈布局
    if (layout.isVertical !== undefined && control.isVertical !== undefined) {
      control.isVertical = layout.isVertical
    }
    if (layout.spacing !== undefined && control.spacing !== undefined) {
      control.spacing = layout.spacing
    }

    // 内边距
    if (layout.paddingLeft) control.paddingLeft = layout.paddingLeft
    if (layout.paddingRight) control.paddingRight = layout.paddingRight
    if (layout.paddingTop) control.paddingTop = layout.paddingTop
    if (layout.paddingBottom) control.paddingBottom = layout.paddingBottom
  }

  /**
   * 应用样式配置
   */
  applyStyle(control, style) {
    if (!control || !style) return

    // 背景和颜色
    if (style.background) control.background = this.resolveValue(style.background)
    if (style.color) control.color = this.resolveValue(style.color)
    
    // 边框
    if (style.thickness !== undefined) control.thickness = style.thickness
    if (style.borderColor) control.color = this.resolveValue(style.borderColor)
    if (style.cornerRadius !== undefined) control.cornerRadius = style.cornerRadius

    // 字体
    if (style.fontSize) control.fontSize = style.fontSize
    if (style.fontFamily) control.fontFamily = this.resolveValue(style.fontFamily)
    if (style.fontWeight === 'bold') control.fontWeight = 'bold'

    // 阴影
    if (style.shadowColor) control.shadowColor = this.resolveValue(style.shadowColor)
    if (style.shadowBlur) control.shadowBlur = style.shadowBlur

    // 尺寸
    if (style.width) control.width = style.width
    if (style.height) control.height = style.height

    // 内边距
    if (style.paddingLeft) control.paddingLeft = style.paddingLeft
    if (style.paddingRight) control.paddingRight = style.paddingRight
    if (style.paddingTop) control.paddingTop = style.paddingTop
    if (style.paddingBottom) control.paddingBottom = style.paddingBottom
  }

  // ========== 组件创建方法 ==========

  createRectangle(config) {
    const rect = new GUI.Rectangle(config.id)
    rect.width = config.width || '100%'
    rect.height = config.height || '100%'
    rect.thickness = 0
    this.applyStyle(rect, config.style)
    return rect
  }

  createPanel(config) {
    const panel = new GUI.Rectangle(config.id)
    panel.width = config.width || '400px'
    panel.height = config.height || 'auto'
    
    // 应用默认面板样式
    const defaults = configLoader.getComponentDefaults('panel')
    panel.background = this.resolveValue(config.style?.background || defaults.background || 'rgba(20, 30, 45, 0.9)')
    panel.cornerRadius = config.style?.cornerRadius || defaults.cornerRadius || 12
    panel.thickness = config.style?.borderWidth || defaults.borderWidth || 1
    panel.color = this.resolveValue(config.style?.borderColor || defaults.borderColor || 'rgba(212, 175, 55, 0.3)')
    
    this.applyStyle(panel, config.style)
    return panel
  }

  createStack(config) {
    const stack = new GUI.StackPanel(config.id)
    stack.isVertical = config.layout?.isVertical !== false
    if (config.layout?.spacing) stack.spacing = config.layout.spacing
    return stack
  }

  createTitle(config) {
    const defaults = configLoader.getComponentDefaults('title')
    const text = new GUI.TextBlock(config.id)
    text.text = config.text || ''
    text.fontSize = config.style?.fontSize || 36
    text.color = this.resolveValue(config.style?.color || defaults.color || '#e8e4d9')
    text.fontFamily = this.resolveValue(config.style?.fontFamily || defaults.fontFamily || 'SimSun')
    
    if (config.style?.shadowColor || defaults.shadowColor) {
      text.shadowColor = this.resolveValue(config.style?.shadowColor || defaults.shadowColor)
      text.shadowBlur = config.style?.shadowBlur || defaults.shadowBlur || 15
    }
    
    if (config.style?.height) text.height = config.style.height
    
    return text
  }

  createSubtitle(config) {
    const text = new GUI.TextBlock(config.id)
    text.text = config.text || ''
    text.fontSize = config.style?.fontSize || 16
    text.color = this.resolveValue(config.style?.color || '#a8a498')
    text.fontFamily = this.resolveValue(config.style?.fontFamily || 'Microsoft YaHei')
    if (config.style?.height) text.height = config.style.height
    return text
  }

  createText(config) {
    const text = new GUI.TextBlock(config.id)
    text.text = config.text || ''
    this.applyStyle(text, config.style)
    
    // 默认样式
    if (!config.style?.fontSize) text.fontSize = 14
    if (!config.style?.color) text.color = this.resolveValue('$textSecondary')
    
    return text
  }

  createDynamicText(config) {
    const text = new GUI.TextBlock(config.id)
    text.text = config.template?.replace('{value}', '--') || '--'
    this.applyStyle(text, config.style)
    
    // 注册动态绑定
    if (config.binding) {
      this.dynamicBindings.push({
        control: text,
        binding: config.binding,
        template: config.template || '{value}'
      })
    }
    
    return text
  }

  createButton(config) {
    const defaults = configLoader.getComponentDefaults('button')
    
    const btn = GUI.Button.CreateSimpleButton(config.id, config.text || '')
    btn.width = config.style?.width || defaults.width || '280px'
    btn.height = config.style?.height || defaults.height || '52px'
    btn.background = this.resolveValue(config.style?.background || defaults.background || '#1a3a4a')
    btn.color = this.resolveValue(config.style?.color || defaults.color || '#e8e4d9')
    btn.cornerRadius = config.style?.cornerRadius || defaults.cornerRadius || 6
    btn.thickness = defaults.borderWidth || 1
    
    // 文字样式
    const textBlock = btn.textBlock
    if (textBlock) {
      textBlock.fontSize = config.style?.fontSize || defaults.fontSize || 18
      textBlock.fontFamily = this.resolveValue('$body')
    }

    // 悬停效果
    const hoverBg = this.resolveValue(defaults.hoverBackground || 'rgba(30, 60, 80, 0.9)')
    const normalBg = btn.background
    
    btn.onPointerEnterObservable.add(() => {
      btn.background = hoverBg
    })
    btn.onPointerOutObservable.add(() => {
      btn.background = normalBg
    })

    // 绑定动作
    if (config.action) {
      btn.onPointerClickObservable.add(() => {
        this.executeAction(config.action)
      })
    }

    return btn
  }

  createSlider(config) {
    const container = new GUI.StackPanel(config.id + '_container')
    container.isVertical = false
    container.height = '40px'
    container.width = '100%'
    
    // 标签
    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '80px'
      label.fontSize = 14
      label.color = this.resolveValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    // 滑块
    const slider = new GUI.Slider(config.id)
    slider.minimum = config.min || 0
    slider.maximum = config.max || 100
    slider.value = config.default || 50
    slider.height = '20px'
    slider.width = '160px'
    slider.color = this.resolveValue('$accent')
    slider.background = 'rgba(0, 0, 0, 0.3)'
    slider.thumbColor = this.resolveValue('$accent')
    container.addControl(slider)

    // 值显示
    const valueText = new GUI.TextBlock(config.id + '_value')
    valueText.text = String(Math.round(slider.value))
    valueText.width = '50px'
    valueText.fontSize = 14
    valueText.color = this.resolveValue('$textSecondary')
    container.addControl(valueText)

    slider.onValueChangedObservable.add((value) => {
      valueText.text = String(Math.round(value))
      if (config.setting) {
        gameState.setSetting(config.setting, value)
      }
    })

    return container
  }

  createToggle(config) {
    const container = new GUI.StackPanel(config.id + '_container')
    container.isVertical = false
    container.height = '40px'
    container.width = '100%'

    // 标签
    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '200px'
      label.fontSize = 14
      label.color = this.resolveValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    // 开关
    const checkbox = new GUI.Checkbox(config.id)
    checkbox.width = '24px'
    checkbox.height = '24px'
    checkbox.isChecked = config.default || false
    checkbox.color = this.resolveValue('$accent')
    checkbox.background = 'rgba(50, 50, 50, 0.6)'
    container.addControl(checkbox)

    checkbox.onIsCheckedChangedObservable.add((value) => {
      if (config.setting) {
        gameState.setSetting(config.setting, value)
      }
      if (config.action) {
        this.executeAction(config.action, { value })
      }
    })

    return container
  }

  createSelector(config) {
    // 简化实现 - 使用按钮组
    const container = new GUI.StackPanel(config.id + '_container')
    container.isVertical = false
    container.height = '40px'
    container.width = '100%'

    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '80px'
      label.fontSize = 14
      label.color = this.resolveValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    let currentValue = config.default
    const buttons = []

    for (const option of (config.options || [])) {
      const btn = GUI.Button.CreateSimpleButton(config.id + '_' + option.value, option.text)
      btn.width = '60px'
      btn.height = '30px'
      btn.fontSize = 12
      btn.cornerRadius = 4
      btn.thickness = 1
      
      const isSelected = option.value === currentValue
      btn.background = isSelected ? this.resolveValue('$primary') : 'rgba(50, 50, 50, 0.6)'
      btn.color = this.resolveValue('$textPrimary')
      
      btn.onPointerClickObservable.add(() => {
        currentValue = option.value
        buttons.forEach(b => b.background = 'rgba(50, 50, 50, 0.6)')
        btn.background = this.resolveValue('$primary')
        if (config.setting) {
          gameState.setSetting(config.setting, option.value)
        }
      })
      
      buttons.push(btn)
      container.addControl(btn)
    }

    return container
  }

  createSpacer(config) {
    const spacer = new GUI.Rectangle(config.id)
    spacer.width = config.width || '1px'
    spacer.height = config.height || '20px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    return spacer
  }

  createSection(config) {
    const container = new GUI.StackPanel(config.id)
    container.isVertical = true
    container.width = '100%'

    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.height = '30px'
      label.fontSize = 14
      label.color = this.resolveValue('$accent')
      label.fontWeight = 'bold'
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    return container
  }

  createSettingGroup(config) {
    return this.createSection(config)
  }

  createProgressBar(config) {
    const container = new GUI.Rectangle(config.id)
    container.width = config.style?.width || '100%'
    container.height = config.style?.height || '8px'
    container.background = this.resolveValue(config.style?.backgroundColor || 'rgba(0,0,0,0.3)')
    container.cornerRadius = config.style?.cornerRadius || 4
    container.thickness = 0

    const fill = new GUI.Rectangle(config.id + '_fill')
    fill.width = '50%'  // 默认 50%
    fill.height = '100%'
    fill.background = this.resolveValue(config.style?.fillColor || '$primary')
    fill.cornerRadius = config.style?.cornerRadius || 4
    fill.thickness = 0
    fill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    container.addControl(fill)

    // 绑定动态值
    if (config.binding) {
      this.dynamicBindings.push({
        control: fill,
        binding: config.binding,
        maxBinding: config.max,
        type: 'progressBar'
      })
    }

    return container
  }

  createSlotGrid(config) {
    const container = new GUI.StackPanel(config.id)
    container.isVertical = false
    
    const cols = config.columns || 9
    const slotSize = config.slotSize || 52
    const spacing = config.spacing || 4

    for (let i = 0; i < cols; i++) {
      const slot = new GUI.Rectangle(`${config.id}_slot_${i}`)
      slot.width = `${slotSize}px`
      slot.height = `${slotSize}px`
      slot.background = this.resolveValue(config.style?.slotBackground || 'rgba(40, 50, 70, 0.6)')
      slot.thickness = 1
      slot.color = this.resolveValue(config.style?.slotBorder || '$primary')
      slot.cornerRadius = 4
      
      if (i < cols - 1) {
        slot.paddingRight = `${spacing}px`
      }
      
      container.addControl(slot)
    }

    return container
  }

  createCanvasPlaceholder(config) {
    // Canvas 组件占位符 - 用于小地图等需要自定义渲染的区域
    const placeholder = new GUI.Rectangle(config.id)
    placeholder.width = config.width || '100%'
    placeholder.height = config.height || '100%'
    placeholder.background = 'rgba(30, 40, 60, 0.5)'
    placeholder.thickness = 0
    placeholder.cornerRadius = 4

    // 添加占位文字
    const text = new GUI.TextBlock(config.id + '_placeholder')
    text.text = config.renderer || '渲染区域'
    text.color = this.resolveValue('$textMuted')
    text.fontSize = 12
    placeholder.addControl(text)

    return placeholder
  }

  // ========== 动作执行 ==========

  executeAction(actionName, params = {}) {
    const actions = this.config.actions || {}
    const actionConfig = actions[actionName]

    if (!actionConfig) {
      console.warn(`[ConfigurablePage] 未定义的动作: ${actionName}`)
      return
    }

    console.log(`[ConfigurablePage] 执行动作: ${actionName}`, actionConfig)

    switch (actionConfig.type) {
      case 'setState':
        const targetState = GameStates[actionConfig.target]
        if (targetState !== undefined) {
          gameState.setState(targetState)
        }
        break

      case 'goBack':
        gameState.goBack()
        break

      case 'saveSettings':
        gameState.saveSettings()
        break

      case 'electronAPI':
        if (window.electronAPI && window.electronAPI[actionConfig.method]) {
          window.electronAPI[actionConfig.method]()
        }
        break

      case 'custom':
        if (this.customHandlers[actionConfig.handler]) {
          this.customHandlers[actionConfig.handler](params)
        }
        break

      default:
        console.warn(`[ConfigurablePage] 未知动作类型: ${actionConfig.type}`)
    }
  }

  // ========== 键盘绑定 ==========

  setupKeybindings() {
    const keybindings = this.config.keybindings
    if (!keybindings) return

    this._keyHandler = (e) => {
      if (!this.isVisible) return

      const binding = keybindings[e.key] || keybindings[e.code]
      if (binding) {
        e.preventDefault()
        this.executeAction(binding.action, binding.param ? { [binding.param]: e.key } : {})
      }
    }

    window.addEventListener('keydown', this._keyHandler)
  }

  // ========== 生命周期方法 ==========

  show() {
    if (this.container) {
      this.container.isVisible = true
      this.isVisible = true
    }
  }

  hide() {
    if (this.container) {
      this.container.isVisible = false
      this.isVisible = false
    }
  }

  /**
   * 更新动态绑定
   */
  update(data) {
    for (const binding of this.dynamicBindings) {
      const value = this.getBindingValue(data, binding.binding)
      
      if (binding.type === 'progressBar') {
        const max = this.getBindingValue(data, binding.maxBinding) || 100
        binding.control.width = `${(value / max) * 100}%`
      } else if (binding.template) {
        binding.control.text = binding.template.replace('{value}', value ?? '--')
      }
    }
  }

  getBindingValue(data, path) {
    if (!data || !path) return undefined
    const keys = path.split('.')
    let current = data
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return undefined
      }
    }
    return current
  }

  dispose() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler)
    }
    if (this.container) {
      this.container.dispose()
      this.container = null
    }
    this.components.clear()
    this.dynamicBindings = []
  }
}

export default ConfigurablePage
