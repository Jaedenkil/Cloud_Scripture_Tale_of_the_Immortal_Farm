/**
 * 配置驱动的页面渲染器
 * 根据 YAML 配置生成 Babylon.js GUI 组件
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../core/GameState.js'
import { configLoader } from '../core/ConfigLoader.js'
import UIConfigParser from './UIConfigParser.js'

export class ConfigurablePage {
  constructor(config, parser = null) {
    this.rawConfig = config
    this.parser = parser || new UIConfigParser(configLoader)
    
    // 解析配置（包含验证）
    this.config = this.parser.parsePageConfig(config)
    this.pageId = this.config.page?.id || 'unknown'
    
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
    const containerConfig = this.config.container
    
    // 创建主容器（配置已被解析）
    this.container = new GUI.Rectangle(`${this.pageId}Container`)
    this.container.width = containerConfig.width
    this.container.height = containerConfig.height
    this.container.background = containerConfig.background
    this.container.thickness = 0
    this.container.isVisible = false
    this.advancedTexture.addControl(this.container)

    // 渲染组件（使用解析后的配置）
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

    // 应用可见性（如果配置中指定）
    if (component && config.visible !== undefined) {
      component.isVisible = config.visible
    }

    // 注册可见性绑定（用于动态显示/隐藏）
    if (component && config.binding && type !== 'dynamicText' && type !== 'progressBar') {
      this.dynamicBindings.push({
        control: component,
        binding: config.binding,
        type: 'visibility'
      })
    }

    // 应用布局（配置已解析，直接应用）
    if (config.layout) {
      this.parser.applyLayoutToControl(component, config.layout)
    }

    if (component && parent) {
      parent.addControl(component)

      // 某些 Babylon GUI 容器会在 addControl 时重新测量子控件。
      // 布局在挂载后再次应用，避免 top/left 等偏移被首次布局覆盖。
      if (config.layout) {
        this.parser.applyLayoutToControl(component, config.layout)
      }
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
   * 应用样式配置（统一使用 parser）
   * @deprecated 使用 parser.applyStylesToControl 替代
   */
  applyStyle(control, style) {
    if (!control || !style) return
    this.parser.applyStylesToControl(control, style)
  }

  // ========== 组件创建方法 ==========

  createRectangle(config) {
    const rect = new GUI.Rectangle(config.id)
    // 使用已解析的样式（包含默认值）
    const style = config.style || {}
    rect.width = style.width || config.width || '100%'
    rect.height = style.height || config.height || '100%'
    rect.thickness = style.thickness !== undefined ? style.thickness : 0
    
    // 应用完整样式
    this.parser.applyStylesToControl(rect, style)
    return rect
  }

  createPanel(config) {
    const panel = new GUI.Rectangle(config.id)
    const style = config.style || {}
    
    panel.width = style.width || config.width || '400px'
    panel.height = style.height || config.height || 'auto'
    
    // 应用完整样式（已包含默认值）
    this.parser.applyStylesToControl(panel, style)
    return panel
  }

  createStack(config) {
    const stack = new GUI.StackPanel(config.id)
    const layout = config.layout || {}
    
    stack.isVertical = layout.isVertical !== false
    if (layout.spacing !== undefined) stack.spacing = layout.spacing
    
    // 应用样式
    if (config.style) {
      this.parser.applyStylesToControl(stack, config.style)
    }
    return stack
  }

  createTitle(config) {
    const text = new GUI.TextBlock(config.id)
    const style = config.style || {}
    
    text.text = config.text || ''
    text.isHitTestVisible = false
    
    // 应用完整样式（已包含默认值和变量解析）
    this.parser.applyStylesToControl(text, style)
    
    return text
  }

  createSubtitle(config) {
    const text = new GUI.TextBlock(config.id)
    const style = config.style || {}
    
    text.text = config.text || ''
    text.isHitTestVisible = false
    
    // 应用完整样式
    this.parser.applyStylesToControl(text, style)
    return text
  }

  createText(config) {
    const text = new GUI.TextBlock(config.id)
    const style = config.style || {}
    
    text.text = config.text || ''
    text.isHitTestVisible = false
    
    // 应用完整样式
    this.parser.applyStylesToControl(text, style)
    
    // 未指定宽高时自动适配内容尺寸
    if (!style.width && !style.height) {
      text.resizeToFit = true
    }
    
    return text
  }

  createDynamicText(config) {
    const text = new GUI.TextBlock(config.id)
    const style = config.style || {}
    
    text.text = config.template?.replace('{value}', '--') || '--'
    text.isHitTestVisible = false
    
    // 应用完整样式
    this.parser.applyStylesToControl(text, style)
    
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
    const style = config.style || {}
    
    const btn = GUI.Button.CreateSimpleButton(config.id, config.text || '')
    
    // 应用完整样式（已包含默认值）
    this.parser.applyStylesToControl(btn, style)
    
    // 文字样式
    const textBlock = btn.textBlock
    if (textBlock) {
      if (style.fontSize) {
        textBlock.fontSize = style.fontSize
      }
      if (style.color) {
        textBlock.color = style.color
      }
    }

    // 悬停效果（简化实现）
    const normalBg = btn.background
    btn.onPointerEnterObservable.add(() => {
      btn.alpha = 0.8
    })
    btn.onPointerOutObservable.add(() => {
      btn.alpha = 1.0
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
    container.height = '19px'
    container.width = '100%'
    
    // 标签
    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '53px'
      label.fontSize = 8
      label.color = this.parser.parseValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    // 滑块
    const slider = new GUI.Slider(config.id)
    slider.minimum = config.min || 0
    slider.maximum = config.max || 100
    slider.value = config.default || 50
    slider.height = '9px'
    slider.width = '107px'
    slider.color = this.parser.parseValue('$primary')
    slider.background = 'rgba(50, 80, 115, 0.5)'
    slider.thumbColor = this.parser.parseValue('$primaryLight')
    slider.borderColor = this.parser.parseValue('$border')
    slider.isThumbCircle = true
    container.addControl(slider)

    // 值显示
    const valueText = new GUI.TextBlock(config.id + '_value')
    valueText.text = String(Math.round(slider.value))
    valueText.width = '27px'
    valueText.fontSize = 8
    valueText.color = this.parser.parseValue('$textPrimary')
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
    container.height = '19px'
    container.width = '100%'

    // 标签
    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '107px'
      label.fontSize = 8
      label.color = this.parser.parseValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    // 开关
    const checkbox = new GUI.Checkbox(config.id)
    checkbox.width = '11px'
    checkbox.height = '11px'
    checkbox.isChecked = config.default || false
    checkbox.color = this.parser.parseValue('$primary')
    checkbox.background = 'rgba(50, 80, 115, 0.5)'
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
    container.height = '19px'
    container.width = '100%'

    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.width = '53px'
      label.fontSize = 8
      label.color = this.parser.parseValue('$textSecondary')
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)
    }

    let currentValue = config.default
    const buttons = []

    for (const option of (config.options || [])) {
      const btn = GUI.Button.CreateSimpleButton(config.id + '_' + option.value, option.text)
      btn.width = '45px'
      btn.height = '15px'
      btn.fontSize = 7
      btn.cornerRadius = 3
      btn.thickness = 2
      
      const isSelected = option.value === currentValue
      btn.background = isSelected ? this.parser.parseValue('$primary') : 'rgba(50, 80, 115, 0.4)'
      btn.color = this.parser.parseValue('$textPrimary')
      btn.paddingLeft = '4px'
      btn.paddingRight = '4px'
      
      btn.onPointerClickObservable.add(() => {
        currentValue = option.value
        buttons.forEach(b => {
          b.background = 'rgba(50, 80, 115, 0.4)'
          b.thickness = 2
        })
        btn.background = this.parser.parseValue('$primary')
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
    spacer.height = config.height || '7px'
    spacer.thickness = 0
    spacer.background = 'transparent'
    return spacer
  }

  createSection(config) {
    const container = new GUI.StackPanel(config.id)
    container.isVertical = true
    container.width = '100%'
    container.spacing = 3

    if (config.label) {
      const label = new GUI.TextBlock(config.id + '_label')
      label.text = config.label
      label.height = '13px'
      label.fontSize = 8
      label.color = this.parser.parseValue('$primary')
      label.fontWeight = 'bold'
      label.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
      container.addControl(label)

      // 分节线
      const divider = new GUI.Rectangle(config.id + '_divider')
      divider.width = '100%'
      divider.height = '1px'
      divider.background = this.parser.parseValue('$divider')
      divider.thickness = 0
      container.addControl(divider)
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
    container.background = this.parser.parseValue(config.style?.backgroundColor || 'rgba(0,0,0,0.3)')
    container.cornerRadius = config.style?.cornerRadius || 4
    container.thickness = 0

    const fill = new GUI.Rectangle(config.id + '_fill')
    fill.width = '50%'  // 默认 50%
    fill.height = '100%'
    fill.background = this.parser.parseValue(config.style?.fillColor || '$primary')
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
    const slotSize = config.slotSize || 17
    const spacing = config.spacing || 1

    for (let i = 0; i < cols; i++) {
      const slot = new GUI.Rectangle(`${config.id}_slot_${i}`)
      slot.width = `${slotSize}px`
      slot.height = `${slotSize}px`
      slot.background = this.parser.parseValue(config.style?.slotBackground || 'rgba(40, 50, 70, 0.6)')
      slot.thickness = 1
      slot.color = this.parser.parseValue(config.style?.slotBorder || '$primary')
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

    // 添加占位文字（可被外部替换）
    const text = new GUI.TextBlock(config.id + '_placeholder')
    text.text = config.renderer || '渲染区域'
    text.color = this.parser.parseValue('$textMuted')
    text.fontSize = 4
    placeholder.addControl(text)

    // 存储配置供外部读取
    placeholder._canvasConfig = config

    return placeholder
  }

  /**
   * 替换 canvas 占位符内容为自定义 GUI 控件
   * @param {string} canvasId - canvas 组件 ID
   * @param {GUI.Control} control - 替换进去的 GUI 控件
   */
  replaceCanvasContent(canvasId, control) {
    const container = this.components.get(canvasId)
    if (!container) return
    // 移除占位文字
    const placeholderText = container.getChildByName(canvasId + '_placeholder')
    if (placeholderText) container.removeControl(placeholderText)
    container.background = 'transparent'
    container.addControl(control)
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
        const targetState = GameStates[actionConfig.state || actionConfig.target]
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
          this.customHandlers[actionConfig.handler]({ ...actionConfig.params, ...params })
        }
        break

      case 'toggleTooltip':
        const tooltip = this.components.get(actionConfig.targetId)
        if (tooltip) {
          const willShow = !tooltip.isVisible
          tooltip.isVisible = willShow
          if (willShow) {
            // 延迟注册点击外部关闭，避免当前点击立即触发
            setTimeout(() => {
              const dismissHandler = () => {
                tooltip.isVisible = false
                this.advancedTexture.onPointerDownObservable.removeCallback(dismissHandler)
              }
              this.advancedTexture.onPointerDownObservable.add(dismissHandler)
            }, 0)
          }
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
      
      if (binding.type === 'visibility') {
        // 可见性绑定：真值显示，假值隐藏
        binding.control.isVisible = !!value
      } else if (binding.type === 'progressBar') {
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
