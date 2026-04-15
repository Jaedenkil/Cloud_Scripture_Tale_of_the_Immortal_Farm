/**
 * UI 配置解析器
 * 职责：
 * 1. 完整的参数解析（变量、嵌套引用、表达式）
 * 2. 配置结构验证
 * 3. 统一的样式应用
 * 4. 友好的错误报告
 */

import * as GUI from '@babylonjs/gui'

// 支持的组件类型
const VALID_COMPONENT_TYPES = [
  'rectangle', 'panel', 'stack', 'title', 'subtitle', 'text', 'dynamicText',
  'button', 'slider', 'toggle', 'selector', 'spacer', 'section',
  'settingGroup', 'progressBar', 'slotGrid', 'canvas'
]

// 样式属性映射表（YAML配置 -> Babylon.js GUI属性）
const STYLE_PROPERTY_MAP = {
  // 尺寸
  width: 'width',
  height: 'height',
  minWidth: 'minWidth',
  minHeight: 'minHeight',
  maxWidth: 'maxWidth',
  maxHeight: 'maxHeight',
  
  // 颜色
  background: 'background',
  color: 'color',
  borderColor: 'color', // Rectangle的边框色
  shadowColor: 'shadowColor',
  
  // 边框
  thickness: 'thickness',
  cornerRadius: 'cornerRadius',
  
  // 文本
  fontSize: 'fontSize',
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  textAlign: 'textHorizontalAlignment',
  letterSpacing: 'letterSpacing',
  
  // 间距
  paddingTop: 'paddingTop',
  paddingBottom: 'paddingBottom',
  paddingLeft: 'paddingLeft',
  paddingRight: 'paddingRight',
  
  // 视觉效果
  shadowBlur: 'shadowBlur',
  shadowOffsetX: 'shadowOffsetX',
  shadowOffsetY: 'shadowOffsetY',
  alpha: 'alpha'
}

// 全局组件默认值（最低优先级）
const GLOBAL_DEFAULTS = {
  button: {
    width: '67px',
    height: '16px',
    fontSize: 5,
    cornerRadius: 1,
    thickness: 0
  },
  text: {
    fontSize: 5,
    height: '8px'
  },
  title: {
    fontSize: 9,
    fontWeight: 'bold',
    height: '12px'
  },
  subtitle: {
    fontSize: 6,
    height: '8px'
  },
  panel: {
    cornerRadius: 3,
    thickness: 1
  },
  rectangle: {
    thickness: 0
  }
}

export class UIConfigParser {
  constructor(configLoader) {
    this.configLoader = configLoader
    this.debugMode = false
    this.errors = []
  }

  /**
   * 启用调试模式
   */
  enableDebug(enabled = true) {
    this.debugMode = enabled
  }

  /**
   * 记录调试信息
   */
  debug(message, ...args) {
    if (this.debugMode) {
      console.log(`[UIConfigParser] ${message}`, ...args)
    }
  }

  /**
   * 验证页面配置
   * @returns {object} { valid: boolean, errors: string[] }
   */
  validatePageConfig(config, filename = 'config') {
    this.errors = []
    const path = filename

    // 验证必需的顶层字段
    if (!config.page) {
      this.addError(path, 'page', '缺少必需的 page 配置')
    } else {
      if (!config.page.id) {
        this.addError(path, 'page.id', '缺少必需的页面ID')
      }
      if (!config.page.type) {
        this.addError(path, 'page.type', '缺少必需的页面类型')
      } else if (!['fullscreen', 'overlay', 'popup', 'hud'].includes(config.page.type)) {
        this.addError(path, 'page.type', `无效的页面类型: ${config.page.type}，必须是 fullscreen/overlay/popup/hud 之一`)
      }
    }

    // 验证组件
    if (!config.components || !Array.isArray(config.components)) {
      this.addError(path, 'components', '缺少 components 数组或格式错误')
    } else {
      this.validateComponents(config.components, `${path}.components`)
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors
    }
  }

  /**
   * 验证组件配置
   */
  validateComponents(components, pathPrefix) {
    const idSet = new Set()

    components.forEach((component, index) => {
      const componentPath = `${pathPrefix}[${index}]`

      // 验证必需字段
      if (!component.id) {
        this.addError(componentPath, 'id', '组件缺少必需的 id 字段')
      } else {
        // 检查ID唯一性
        if (idSet.has(component.id)) {
          this.addError(componentPath, 'id', `重复的组件ID: ${component.id}`)
        }
        idSet.add(component.id)

        // 验证ID格式
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(component.id)) {
          this.addError(componentPath, 'id', `无效的ID格式: ${component.id}，必须以字母或下划线开头`)
        }
      }

      if (!component.type) {
        this.addError(componentPath, 'type', '组件缺少必需的 type 字段')
      } else if (!VALID_COMPONENT_TYPES.includes(component.type)) {
        this.addError(componentPath, 'type', `未知的组件类型: ${component.type}`)
      }

      // 递归验证子组件
      if (component.children && Array.isArray(component.children)) {
        this.validateComponents(component.children, `${componentPath}.children`)
      }
    })
  }

  /**
   * 添加错误记录
   */
  addError(path, field, message) {
    this.errors.push({
      path: `${path}.${field}`,
      message
    })
  }

  /**
   * 格式化错误报告
   */
  formatErrors() {
    if (this.errors.length === 0) return ''

    let report = '\n配置验证失败:\n'
    this.errors.forEach(error => {
      report += `  ✗ ${error.path}\n`
      report += `    ${error.message}\n`
    })
    return report
  }

  /**
   * 增强的变量解析
   * 支持：
   * - 简单变量: $primary
   * - 嵌套路径: $colors.primary
   * - 表达式: ${$buttonWidth * 0.8} (未来扩展)
   */
  parseValue(value, context = null) {
    if (value === null || value === undefined) return value
    if (typeof value !== 'string') return value

    // 简单变量引用 $varName
    if (value.startsWith('$') && !value.includes('{')) {
      const varPath = value.slice(1)
      return this.resolveVariable(varPath, context)
    }

    // 表达式 ${...} (预留接口，暂不实现)
    if (value.includes('${')) {
      this.debug('表达式解析暂未实现:', value)
      return value
    }

    return value
  }

  /**
   * 解析变量引用
   */
  resolveVariable(varPath, context = null) {
    const theme = this.configLoader.getTheme()
    if (!theme) {
      this.debug('主题未加载，无法解析变量:', varPath)
      return `$${varPath}`
    }

    // 尝试从主题的各个部分查找
    const sections = ['colors', 'fonts', 'sizes', 'animations']
    
    // 如果路径包含点号，按路径查找
    if (varPath.includes('.')) {
      const value = this.getNestedValue(theme, varPath)
      if (value !== undefined) return value
    }

    // 简单变量名，在各个section中查找
    for (const section of sections) {
      if (theme[section] && theme[section][varPath] !== undefined) {
        return theme[section][varPath]
      }
    }

    this.debug('未找到变量:', varPath)
    return `$${varPath}` // 返回原值
  }

  /**
   * 获取嵌套对象的值
   */
  getNestedValue(obj, path) {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return undefined
      }
    }

    return current
  }

  /**
   * 解析样式配置对象
   * 将YAML中的样式配置转换为解析后的对象
   */
  parseStyleConfig(styleConfig) {
    if (!styleConfig || typeof styleConfig !== 'object') {
      return {}
    }

    const parsed = {}
    for (const [key, value] of Object.entries(styleConfig)) {
      parsed[key] = this.parseValue(value)
    }

    return parsed
  }

  /**
   * 获取组件的完整样式（合并默认值）
   * 优先级: 实例配置 > 主题组件默认值 > 全局默认值
   */
  getComponentStyle(componentType, instanceStyle = {}) {
    // 1. 全局默认值
    const globalDefaults = GLOBAL_DEFAULTS[componentType] || {}
    
    // 2. 主题组件默认值
    const themeDefaults = this.configLoader.getComponentDefaults(componentType) || {}
    
    // 3. 实例样式
    const parsedInstanceStyle = this.parseStyleConfig(instanceStyle)

    // 合并（后者覆盖前者）
    return {
      ...globalDefaults,
      ...themeDefaults,
      ...parsedInstanceStyle
    }
  }

  /**
   * 应用样式到GUI控件
   */
  applyStylesToControl(control, styles) {
    if (!control || !styles) return

    for (const [styleKey, value] of Object.entries(styles)) {
      const guiProperty = STYLE_PROPERTY_MAP[styleKey]
      
      if (!guiProperty) {
        this.debug(`未映射的样式属性: ${styleKey}`)
        continue
      }

      try {
        // 特殊处理：textAlign 需要转换为枚举
        if (styleKey === 'textAlign') {
          const alignMap = {
            'left': GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
            'center': GUI.Control.HORIZONTAL_ALIGNMENT_CENTER,
            'right': GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
          }
          control[guiProperty] = alignMap[value] || GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
        } else {
          control[guiProperty] = value
        }
      } catch (error) {
        this.debug(`应用样式失败 ${styleKey}:`, error.message)
      }
    }
  }

  /**
   * 解析布局配置
   */
  parseLayoutConfig(layoutConfig) {
    if (!layoutConfig || typeof layoutConfig !== 'object') {
      return {}
    }

    const parsed = {}
    for (const [key, value] of Object.entries(layoutConfig)) {
      const parsedValue = typeof value === 'string' ? this.parseValue(value) : value
      parsed[key] = this.normalizeLayoutValue(key, parsedValue)
    }

    return parsed
  }

  /**
   * 规范化布局值
   * 偏移/尺寸数值统一转为 Babylon GUI 可识别的 px 字符串
   */
  normalizeLayoutValue(key, value) {
    if (value === null || value === undefined) return value

    const pixelKeys = new Set(['left', 'top', 'right', 'bottom', 'width', 'height'])
    if (pixelKeys.has(key) && typeof value === 'number') {
      return `${value}px`
    }

    return value
  }

  /**
   * 应用布局到GUI控件
   */
  applyLayoutToControl(control, layout) {
    if (!control || !layout) return

    // 对齐方式
    if (layout.horizontalAlignment) {
      const alignMap = {
        'left': GUI.Control.HORIZONTAL_ALIGNMENT_LEFT,
        'center': GUI.Control.HORIZONTAL_ALIGNMENT_CENTER,
        'right': GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT,
        'stretch': GUI.Control.HORIZONTAL_ALIGNMENT_LEFT // stretch暂用left
      }
      control.horizontalAlignment = alignMap[layout.horizontalAlignment] || GUI.Control.HORIZONTAL_ALIGNMENT_CENTER
    }

    if (layout.verticalAlignment) {
      const alignMap = {
        'top': GUI.Control.VERTICAL_ALIGNMENT_TOP,
        'center': GUI.Control.VERTICAL_ALIGNMENT_CENTER,
        'bottom': GUI.Control.VERTICAL_ALIGNMENT_BOTTOM,
        'stretch': GUI.Control.VERTICAL_ALIGNMENT_TOP // stretch暂用top
      }
      control.verticalAlignment = alignMap[layout.verticalAlignment] || GUI.Control.VERTICAL_ALIGNMENT_CENTER
    }

    // 位置偏移
    if (layout.left !== undefined) control.left = this.normalizeLayoutValue('left', layout.left)
    if (layout.top !== undefined) control.top = this.normalizeLayoutValue('top', layout.top)
    if (layout.right !== undefined) {
      const right = this.normalizeLayoutValue('right', layout.right)
      control.left = typeof right === 'string' ? `-${right}` : -right
    }
    if (layout.bottom !== undefined) {
      const bottom = this.normalizeLayoutValue('bottom', layout.bottom)
      control.top = typeof bottom === 'string' ? `-${bottom}` : -bottom
    }

    // StackPanel 特有属性
    if (control instanceof GUI.StackPanel) {
      if (layout.isVertical !== undefined) control.isVertical = layout.isVertical
      if (layout.spacing !== undefined) control.spacing = layout.spacing
    }
  }

  /**
   * 解析完整的组件配置
   * 返回包含所有解析后属性的配置对象
   */
  parseComponentConfig(config) {
    const parsed = {
      id: config.id,
      type: config.type,
      text: config.text,
      label: config.label,
      action: config.action,
      binding: config.binding,
      
      // 顶层尺寸（rectangle/panel/spacer 等直接读取）
      width: config.width,
      height: config.height,
      
      // 可见性
      visible: config.visible,
      
      // 解析样式（已合并默认值）
      style: this.getComponentStyle(config.type, config.style),
      
      // 解析布局
      layout: this.parseLayoutConfig(config.layout),
      
      // 组件特定配置
      min: config.min,
      max: config.max,
      default: config.default,
      options: config.options,
      setting: config.setting,
      template: config.template,
      
      // slotGrid / canvas 专用
      columns: config.columns,
      rows: config.rows,
      slotSize: config.slotSize,
      spacing: config.spacing,
      renderer: config.renderer,
      
      // 子组件
      children: config.children
    }

    return parsed
  }

  /**
   * 批量解析组件树
   */
  parseComponentTree(components) {
    if (!Array.isArray(components)) return []

    return components.map(component => {
      const parsed = this.parseComponentConfig(component)
      
      // 递归解析子组件
      if (component.children) {
        parsed.children = this.parseComponentTree(component.children)
      }
      
      return parsed
    })
  }

  /**
   * 解析完整页面配置
   */
  parsePageConfig(config, filename = 'config') {
    // 验证配置
    const validation = this.validatePageConfig(config, filename)
    if (!validation.valid) {
      console.error('[UIConfigParser]', this.formatErrors())
      throw new Error(`配置验证失败: ${filename}`)
    }

    // 解析页面配置
    const parsed = {
      page: config.page,
      container: {
        width: this.parseValue(config.container?.width) || '100%',
        height: this.parseValue(config.container?.height) || '100%',
        background: this.parseValue(config.container?.background) || 'transparent'
      },
      components: this.parseComponentTree(config.components),
      actions: config.actions || {},
      keybindings: config.keybindings || {}
    }

    this.debug('页面配置解析完成:', parsed.page.id)
    return parsed
  }
}

export default UIConfigParser
