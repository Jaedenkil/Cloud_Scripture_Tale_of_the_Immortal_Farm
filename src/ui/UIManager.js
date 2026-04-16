/**
 * UI 管理器
 * 使用 Babylon.js GUI 管理所有游戏界面
 */

import * as GUI from '@babylonjs/gui'
import { gameState, GameStates } from '../core/GameState.js'
import { ConfigurablePage } from './ConfigurablePage.js'
import { configLoader } from '../core/ConfigLoader.js'
import { MaterialPreview } from './MaterialPreview.js'

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
          if (state === 'EDITOR_RESOURCE') {
            this.registerResourceEditorHandlers(page)
          }
          if (state === 'EDITOR_MATERIAL') {
            this.registerMaterialEditorHandlers(page)
          }
          if (state === 'EDITOR_AUDIO') {
            this.registerAudioEditorHandlers(page)
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

  // ==========================================
  // 资源管理器
  // ==========================================
  registerResourceEditorHandlers(page) {
    const theme = configLoader.getTheme()
    const colors = theme?.colors || {}

    // 模拟资源数据
    const mockResources = [
      { id: 'tex_grass_top', name: '草地顶部', type: 'texture', tags: ['block', 'grass'] },
      { id: 'tex_stone_side', name: '石块侧面', type: 'texture', tags: ['block', 'stone'] },
      { id: 'tex_spiritual_ore', name: '灵石矿', type: 'texture', tags: ['block', 'ore', 'spiritual'] },
      { id: 'tex_water_flow', name: '流水纹理', type: 'texture', tags: ['water', 'animated'] },
      { id: 'sfx_step_stone', name: '踩石头音效', type: 'audio', tags: ['footstep', 'stone'] },
      { id: 'sfx_block_break', name: '方块破坏音效', type: 'audio', tags: ['block', 'break'] },
      { id: 'bgm_morning_field', name: '晨间田野', type: 'audio', tags: ['bgm', 'ambient'] },
      { id: 'mdl_tree_spiritual', name: '灵木模型', type: 'model', tags: ['tree', 'spiritual'] },
      { id: 'mdl_rock_common', name: '普通岩石', type: 'model', tags: ['rock', 'common'] },
      { id: 'tex_farmland_wet', name: '湿润农田', type: 'texture', tags: ['block', 'farm'] }
    ]

    let currentFilter = 'all'
    let selectedIndex = -1

    // 初始化编辑器数据
    if (!gameState.data.editor) gameState.data.editor = {}
    gameState.data.editor.resource = {
      count: String(mockResources.length),
      status: `共 ${mockResources.length} 个资源 | 筛选: 全部`,
      selectedId: '--',
      selectedType: '--',
      selectedTags: '--'
    }

    const catIds = ['catAll', 'catTexture', 'catAudio', 'catModel']
    const catFilters = ['all', 'texture', 'audio', 'model']
    const catLabels = ['全部', '贴图', '音频', '模型']

    const switchCategory = (filter) => {
      currentFilter = filter
      const filtered = filter === 'all' ? mockResources : mockResources.filter(r => r.type === filter)

      // 更新分类按钮高亮
      catIds.forEach((id, i) => {
        const btn = page.components.get(id)
        if (!btn) return
        const isActive = catFilters[i] === filter
        btn.background = isActive ? (colors.btnPrimary || '#4A9BE8') : 'rgba(50, 80, 115, 0.35)'
        if (btn.textBlock) {
          btn.textBlock.color = isActive ? '#FFFFFF' : (colors.textSecondary || '#B0D4F1')
        }
      })

      // 根据筛选结果显示/隐藏资源行
      const filteredIds = new Set(filtered.map(r => r.id))
      for (let i = 0; i < mockResources.length; i++) {
        const row = page.components.get(`res_row_${i + 1}`)
        if (row) {
          row.isVisible = filteredIds.has(mockResources[i].id)
        }
      }

      // 更新状态栏
      const filterLabel = catLabels[catFilters.indexOf(filter)] || '全部'
      gameState.data.editor.resource.count = String(filtered.length)
      gameState.data.editor.resource.status = `共 ${filtered.length} 个资源 | 筛选: ${filterLabel}`
      page.update(gameState.data)
    }

    const selectResource = (index) => {
      if (index < 0 || index >= mockResources.length) return
      const res = mockResources[index]
      selectedIndex = index

      // 高亮选中行
      for (let i = 0; i < 10; i++) {
        const row = page.components.get(`res_row_${i + 1}`)
        if (!row) continue
        const isSelected = i === index
        row.background = isSelected ? 'rgba(74, 155, 232, 0.15)' : 'rgba(50, 80, 115, 0.15)'
        row.thickness = isSelected ? 1 : 0
        if (isSelected) row.color = colors.primary || '#4A9BE8'
      }

      // 更新详情面板
      const detailPanel = page.components.get('detailPanel')
      if (detailPanel) detailPanel.isVisible = true

      gameState.data.editor.resource.selectedId = res.id
      gameState.data.editor.resource.selectedType = res.type
      gameState.data.editor.resource.selectedTags = res.tags.join(', ')
      gameState.data.editor.resource.status = `已选中: ${res.name} (${res.id})`
      page.update(gameState.data)
    }

    page.registerHandler('resourceFilterAll', () => switchCategory('all'))
    page.registerHandler('resourceFilterTexture', () => switchCategory('texture'))
    page.registerHandler('resourceFilterAudio', () => switchCategory('audio'))
    page.registerHandler('resourceFilterModel', () => switchCategory('model'))
    page.registerHandler('resourceSelect', (params) => selectResource(params.index))
    page.registerHandler('resourceImport', () => {
      gameState.data.editor.resource.status = '⚠ 导入功能需要 Electron 文件对话框（尚未实现）'
      page.update(gameState.data)
    })
    page.registerHandler('resourceDelete', () => {
      if (selectedIndex >= 0) {
        const res = mockResources[selectedIndex]
        gameState.data.editor.resource.status = `⚠ 删除 ${res.id} — 模拟操作，数据未实际删除`
        page.update(gameState.data)
      }
    })

    // 初始化绑定
    setTimeout(() => page.update(gameState.data), 0)
  }

  // ==========================================
  // 材质编辑器
  // ==========================================
  registerMaterialEditorHandlers(page) {
    const theme = configLoader.getTheme()
    const colors = theme?.colors || {}

    // 模拟材质数据
    const mockMaterials = [
      { id: 'mat_spiritual_stone', name: '灵石材质', diffuse: 'tex_spiritual_ore', normal: '(无)', emissive: 'tex_spiritual_ore_e', alpha: 1.0, blendMode: 'opaque' },
      { id: 'mat_grass', name: '草地材质', diffuse: 'tex_grass_top', normal: 'tex_grass_n', emissive: '(无)', alpha: 1.0, blendMode: 'opaque' },
      { id: 'mat_water', name: '流水材质', diffuse: 'tex_water_flow', normal: 'tex_water_n', emissive: '(无)', alpha: 0.8, blendMode: 'alphaBlend' },
      { id: 'mat_wood', name: '木板材质', diffuse: 'tex_wood_plank', normal: 'tex_wood_n', emissive: '(无)', alpha: 1.0, blendMode: 'opaque' },
      { id: 'mat_farmland', name: '灵田土壤', diffuse: 'tex_farmland_wet', normal: '(无)', emissive: '(无)', alpha: 1.0, blendMode: 'opaque' }
    ]

    // 资源 ID → 文件路径映射
    const resourceMap = {
      'tex_spiritual_ore': 'textures/tex_spiritual_ore.png',
      'tex_spiritual_ore_e': 'textures/tex_spiritual_ore_e.png',
      'tex_grass_top': 'textures/tex_grass_top.png',
      'tex_grass_n': 'textures/tex_grass_n.png',
      'tex_water_flow': 'textures/tex_water_flow.png',
      'tex_water_n': 'textures/tex_water_n.png',
      'tex_wood_plank': 'textures/tex_wood_plank.png',
      'tex_wood_n': 'textures/tex_wood_n.png',
      'tex_farmland_wet': 'textures/tex_farmland_wet.png'
    }

    let selectedIndex = -1
    let materialPreview = null

    if (!gameState.data.editor) gameState.data.editor = {}
    gameState.data.editor.material = {
      status: `共 ${mockMaterials.length} 个材质`,
      selectedId: '--',
      selectedName: '--',
      diffuse: '--',
      normal: '--',
      emissive: '--'
    }

    const matItemIds = ['mat_item_1', 'mat_item_2', 'mat_item_3', 'mat_item_4', 'mat_item_5']

    // 延迟初始化 3D 预览（等页面组件创建完成）
    setTimeout(() => {
      if (this.scene) {
        materialPreview = new MaterialPreview(this.scene, 256)
        const canvasCtrl = page.components.get('previewCanvas')
        if (canvasCtrl) {
          materialPreview.attachToGUIControl(canvasCtrl, this.advancedTexture)
        }
        console.log('[UIManager] 材质 3D 预览已初始化')
      }
    }, 100)

    // 页面显示/隐藏时控制预览可见性
    const origShow = page.show.bind(page)
    const origHide = page.hide.bind(page)
    page.show = () => {
      origShow()
      if (materialPreview && selectedIndex >= 0) materialPreview.show()
    }
    page.hide = () => {
      origHide()
      if (materialPreview) materialPreview.hide()
    }

    const selectMaterial = (index) => {
      if (index < 0 || index >= mockMaterials.length) return
      const mat = mockMaterials[index]
      selectedIndex = index

      // 高亮选中项
      matItemIds.forEach((id, i) => {
        const btn = page.components.get(id)
        if (!btn) return
        const isSelected = i === index
        btn.background = isSelected ? 'rgba(74, 155, 232, 0.2)' : 'rgba(50, 80, 115, 0.15)'
        btn.thickness = isSelected ? 1 : 0
        if (isSelected) btn.color = colors.primary || '#4A9BE8'
      })

      // 显示属性面板和预览面板，隐藏提示
      const propsPanel = page.components.get('propsPanel')
      const previewPanel = page.components.get('previewPanel')
      const hint = page.components.get('noSelectionHint')
      if (propsPanel) propsPanel.isVisible = true
      if (previewPanel) previewPanel.isVisible = true
      if (hint) hint.isVisible = false

      // 更新绑定数据
      gameState.data.editor.material.selectedId = mat.id
      gameState.data.editor.material.selectedName = mat.name
      gameState.data.editor.material.diffuse = mat.diffuse
      gameState.data.editor.material.normal = mat.normal
      gameState.data.editor.material.emissive = mat.emissive
      gameState.data.editor.material.status = `编辑中: ${mat.name} (${mat.id})`
      page.update(gameState.data)

      // 更新 3D 预览
      if (materialPreview) {
        materialPreview.applyMaterial(mat, resourceMap)
      }
    }

    page.registerHandler('materialSelect', (params) => selectMaterial(params.index))
    page.registerHandler('materialNew', () => {
      gameState.data.editor.material.status = '⚠ 新建材质 — 模拟操作'
      page.update(gameState.data)
    })
    page.registerHandler('materialPickTexture', (params) => {
      const channel = params.channel || 'diffuse'
      gameState.data.editor.material.status = `⚠ 选择${channel}贴图 — 需要资源选择器（尚未实现）`
      page.update(gameState.data)
    })
    page.registerHandler('materialDelete', () => {
      if (selectedIndex >= 0) {
        gameState.data.editor.material.status = `⚠ 删除 ${mockMaterials[selectedIndex].id} — 模拟操作`
        page.update(gameState.data)
      }
    })

    // 形状切换处理器（通过 selector 的 setting 变更触发）
    gameState.on('settingsChange', ({ key, value }) => {
      if (key === 'editor.material.previewShape' && materialPreview) {
        materialPreview.setShape(value)
      }
    })

    setTimeout(() => page.update(gameState.data), 0)
  }

  // ==========================================
  // 音效编辑器
  // ==========================================
  registerAudioEditorHandlers(page) {
    const theme = configLoader.getTheme()
    const colors = theme?.colors || {}

    // 模拟音效数据
    const mockSounds = [
      { id: 'sfx_block_break_stone', name: '踩石头音效', source: 'sfx_step_stone', trigger: 'event', volume: 80, spatialize: true, maxDistance: 16, pitchMin: -10, pitchMax: 10, duration: '0.3s' },
      { id: 'sfx_block_break', name: '方块破坏', source: 'sfx_block_break', trigger: 'event', volume: 90, spatialize: true, maxDistance: 24, pitchMin: -15, pitchMax: 15, duration: '0.5s' },
      { id: 'bgm_morning', name: '晨间田野BGM', source: 'bgm_morning_field', trigger: 'loop', volume: 60, spatialize: false, maxDistance: 64, pitchMin: 0, pitchMax: 0, duration: '3:24' },
      { id: 'amb_water_flow', name: '流水环境音', source: 'sfx_water_flow', trigger: 'ambient', volume: 50, spatialize: true, maxDistance: 12, pitchMin: -5, pitchMax: 5, duration: '2.1s' },
      { id: 'sfx_cultivation_up', name: '修炼突破', source: 'sfx_level_up', trigger: 'event', volume: 100, spatialize: false, maxDistance: 32, pitchMin: 0, pitchMax: 5, duration: '1.8s' },
      { id: 'amb_birds', name: '鸟鸣环境音', source: 'sfx_birds_chirp', trigger: 'ambient', volume: 40, spatialize: true, maxDistance: 20, pitchMin: -20, pitchMax: 20, duration: '4.2s' }
    ]

    let selectedIndex = -1

    if (!gameState.data.editor) gameState.data.editor = {}
    gameState.data.editor.audio = {
      status: `共 ${mockSounds.length} 个音效配置`,
      selectedId: '--',
      selectedName: '--',
      source: '--',
      duration: '--',
      playback: 0,
      playbackMax: 100
    }

    const sndItemIds = ['snd_item_1', 'snd_item_2', 'snd_item_3', 'snd_item_4', 'snd_item_5', 'snd_item_6']

    const selectSound = (index) => {
      if (index < 0 || index >= mockSounds.length) return
      const snd = mockSounds[index]
      selectedIndex = index

      // 高亮选中项
      sndItemIds.forEach((id, i) => {
        const btn = page.components.get(id)
        if (!btn) return
        const isSelected = i === index
        btn.background = isSelected ? 'rgba(74, 155, 232, 0.2)' : 'rgba(50, 80, 115, 0.15)'
        btn.thickness = isSelected ? 1 : 0
        if (isSelected) btn.color = colors.primary || '#4A9BE8'
      })

      // 显示面板，隐藏提示
      const propsPanel = page.components.get('propsPanel')
      const previewPanel = page.components.get('previewPanel')
      const hint = page.components.get('noSelectionHint')
      if (propsPanel) propsPanel.isVisible = true
      if (previewPanel) previewPanel.isVisible = true
      if (hint) hint.isVisible = false

      // 更新绑定数据
      gameState.data.editor.audio.selectedId = snd.id
      gameState.data.editor.audio.selectedName = snd.name
      gameState.data.editor.audio.source = snd.source
      gameState.data.editor.audio.duration = snd.duration
      gameState.data.editor.audio.status = `编辑中: ${snd.name} (${snd.id})`
      page.update(gameState.data)
    }

    page.registerHandler('audioSelect', (params) => selectSound(params.index))
    page.registerHandler('audioNew', () => {
      gameState.data.editor.audio.status = '⚠ 新建音效 — 模拟操作'
      page.update(gameState.data)
    })
    page.registerHandler('audioPickSource', () => {
      gameState.data.editor.audio.status = '⚠ 选择音频资源 — 需要资源选择器（尚未实现）'
      page.update(gameState.data)
    })

    let playbackTimer = null
    const stopPlayback = () => {
      if (playbackTimer) {
        clearInterval(playbackTimer)
        playbackTimer = null
      }
      gameState.data.editor.audio.playback = 0
      gameState.data.editor.audio.status = '⏹ 已停止播放'
      page.update(gameState.data)
    }

    page.registerHandler('audioPlay', () => {
      if (selectedIndex < 0) return
      // 停止之前的播放
      if (playbackTimer) clearInterval(playbackTimer)

      const snd = mockSounds[selectedIndex]
      gameState.data.editor.audio.playback = 0
      gameState.data.editor.audio.status = `▶ 正在播放: ${snd.name}`
      page.update(gameState.data)

      // 模拟播放进度（2秒完成）
      let progress = 0
      playbackTimer = setInterval(() => {
        progress += 5
        if (progress >= 100) {
          progress = 100
          clearInterval(playbackTimer)
          playbackTimer = null
          gameState.data.editor.audio.status = `✓ 播放完成: ${snd.name}`
        }
        gameState.data.editor.audio.playback = progress
        page.update(gameState.data)
      }, 100)
    })
    page.registerHandler('audioStop', () => stopPlayback())

    setTimeout(() => page.update(gameState.data), 0)
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
