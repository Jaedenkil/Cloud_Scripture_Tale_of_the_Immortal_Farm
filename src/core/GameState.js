/**
 * 游戏状态管理
 * 管理游戏的全局状态和状态转换
 */

export const GameStates = {
  LOADING: 'loading',
  MAIN_MENU: 'mainMenu',
  SETTINGS: 'settings',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DEV_TOOLS: 'devTools'
}

class GameState {
  constructor() {
    this.currentState = GameStates.LOADING
    this.previousState = null
    this.listeners = new Map()
    
    // 游戏数据
    this.data = {
      player: {
        name: '无名修士',
        level: 1,
        cultivation: '练气期',
        spirit: 100,
        maxSpirit: 100
      },
      settings: {
        masterVolume: 0.8,
        musicVolume: 0.6,
        sfxVolume: 0.8,
        quality: 'high', // low, medium, high
        fullscreen: false,
        language: 'zh-CN'
      },
      world: {
        seed: null,
        time: 0,
        weather: 'clear'
      }
    }
  }

  /**
   * 切换游戏状态
   */
  setState(newState) {
    if (this.currentState === newState) return
    
    this.previousState = this.currentState
    this.currentState = newState
    
    console.log(`[GameState] ${this.previousState} → ${newState}`)
    this.emit('stateChange', { from: this.previousState, to: newState })
  }

  /**
   * 返回上一个状态
   */
  goBack() {
    if (this.previousState) {
      this.setState(this.previousState)
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.currentState
  }

  /**
   * 检查是否处于某个状态
   */
  is(state) {
    return this.currentState === state
  }

  /**
   * 更新设置
   */
  updateSettings(key, value) {
    if (key in this.data.settings) {
      this.data.settings[key] = value
      this.emit('settingsChange', { key, value })
      this.saveSettings()
    }
  }

  /**
   * 保存设置到本地存储
   */
  saveSettings() {
    if (window.electronAPI) {
      window.electronAPI.saveGame({ settings: this.data.settings })
    } else {
      localStorage.setItem('gameSettings', JSON.stringify(this.data.settings))
    }
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.loadGame()
        if (data?.settings) {
          this.data.settings = { ...this.data.settings, ...data.settings }
        }
      } else {
        const saved = localStorage.getItem('gameSettings')
        if (saved) {
          this.data.settings = { ...this.data.settings, ...JSON.parse(saved) }
        }
      }
    } catch (e) {
      console.warn('[GameState] 加载设置失败:', e)
    }
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data))
    }
  }
}

// 单例导出
export const gameState = new GameState()
export default gameState
