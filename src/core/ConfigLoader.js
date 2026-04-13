/**
 * UI 配置加载器
 * 负责加载和解析 YAML 配置文件
 */

import yaml from 'js-yaml'

class ConfigLoader {
  constructor() {
    this.cache = new Map()
    this.theme = null
    this.basePath = '/configs/ui/'
  }

  /**
   * 初始化配置系统
   */
  async init() {
    console.log('[ConfigLoader] 初始化配置系统...')
    
    // 加载索引文件
    const indexConfig = await this.loadConfig('index.yaml')
    
    // 加载主题（先加载原始配置，再自解析变量）
    if (indexConfig.theme) {
      const rawTheme = await this.loadRawConfig(indexConfig.theme)
      // 用主题自身作为上下文解析变量
      this.theme = this.resolveVariables(rawTheme, rawTheme)
      console.log('[ConfigLoader] 主题加载完成:', this.theme.theme?.name)
    }

    // 预加载页面配置
    const preloadPromises = []
    for (const [pageId, pageInfo] of Object.entries(indexConfig.pages || {})) {
      if (pageInfo.preload) {
        preloadPromises.push(
          this.loadConfig(pageInfo.file).then(config => {
            console.log(`[ConfigLoader] 预加载页面: ${pageId}`)
            return { pageId, config, state: pageInfo.state }
          })
        )
      }
    }

    const preloadedPages = await Promise.all(preloadPromises)
    
    return {
      index: indexConfig,
      theme: this.theme,
      pages: preloadedPages
    }
  }

  /**
   * 加载原始配置文件（不解析变量）
   */
  async loadRawConfig(filename) {
    const url = this.basePath + filename
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const yamlText = await response.text()
      return yaml.load(yamlText)
    } catch (error) {
      console.error(`[ConfigLoader] 加载配置失败: ${filename}`, error)
      throw error
    }
  }

  /**
   * 加载单个配置文件
   */
  async loadConfig(filename) {
    // 检查缓存
    if (this.cache.has(filename)) {
      return this.cache.get(filename)
    }

    const url = this.basePath + filename
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const yamlText = await response.text()
      const config = yaml.load(yamlText)
      
      // 处理变量引用
      const resolvedConfig = this.resolveVariables(config)
      
      // 缓存配置
      this.cache.set(filename, resolvedConfig)
      
      return resolvedConfig
    } catch (error) {
      console.error(`[ConfigLoader] 加载配置失败: ${filename}`, error)
      throw error
    }
  }

  /**
   * 解析配置中的变量引用 ($variableName)
   */
  resolveVariables(obj, context = null) {
    if (!obj) return obj
    
    // 使用主题作为默认上下文
    const resolveContext = context || this.theme || {}
    
    if (typeof obj === 'string') {
      // 处理 $variable 引用
      if (obj.startsWith('$')) {
        const varName = obj.slice(1)
        return this.getNestedValue(resolveContext, varName) || obj
      }
      return obj
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveVariables(item, resolveContext))
    }
    
    if (typeof obj === 'object') {
      const resolved = {}
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveVariables(value, resolveContext)
      }
      return resolved
    }
    
    return obj
  }

  /**
   * 获取嵌套对象的值 (支持 a.b.c 路径)
   */
  getNestedValue(obj, path) {
    const keys = path.split('.')
    let current = obj
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        // 尝试在 colors、fonts、sizes 中查找
        for (const section of ['colors', 'fonts', 'sizes']) {
          if (obj[section] && key in obj[section]) {
            return obj[section][key]
          }
        }
        return undefined
      }
    }
    
    return current
  }

  /**
   * 获取主题配置
   */
  getTheme() {
    return this.theme
  }

  /**
   * 获取主题颜色
   */
  getColor(name) {
    return this.theme?.colors?.[name] || name
  }

  /**
   * 获取字体配置
   */
  getFont(name) {
    return this.theme?.fonts?.[name] || name
  }

  /**
   * 获取尺寸配置
   */
  getSize(name) {
    return this.theme?.sizes?.[name] || name
  }

  /**
   * 获取组件默认样式（已解析变量）
   */
  getComponentDefaults(componentType) {
    const defaults = this.theme?.components?.[componentType] || {}
    return this.resolveVariables(defaults)
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * 重新加载配置
   */
  async reload() {
    this.clearCache()
    return await this.init()
  }
}

// 导出单例
export const configLoader = new ConfigLoader()
export default configLoader
