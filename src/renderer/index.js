import * as BABYLON from '@babylonjs/core'
import { uiManager } from '../ui/UIManager.js'
import { gameState, GameStates } from '../core/GameState.js'

/**
 * 云笈仙田录 - 主游戏类
 * 集成 Babylon.js 渲染与配置驱动的 UI 系统
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('render-canvas')
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    })

    this.scene = this.createBaseScene()
    this.gameWorldLoaded = false  // 游戏世界是否已加载

    // 异步初始化 UI 系统
    this.initUI()

    // 游戏循环
    this.engine.runRenderLoop(() => {
      this.scene.render()
    })

    // 响应窗口大小变化
    window.addEventListener('resize', () => {
      this.engine.resize()
    })

    // 监听键盘事件
    this.setupKeyboardControls()
  }

  /**
   * 初始化 UI 系统（配置驱动）
   */
  async initUI () {
    // 初始化 UI 管理器
    uiManager.init(this.scene)

    // 从配置文件加载 UI 页面
    const success = await uiManager.loadFromConfig()
    
    if (success) {
      console.log('🎮 UI 配置加载成功')
    } else {
      console.error('❌ UI 配置加载失败，请检查 configs/ui/ 目录')
    }

    // 监听状态变化，切换 UI 页面
    gameState.on('stateChange', ({ from, to }) => {
      console.log(`🎮 状态切换: ${from} -> ${to}`)
      uiManager.showPage(to)

      // 根据状态控制 3D 场景可见性
      this.updateSceneVisibility(to)
    })
  }

  /**
   * 根据游戏状态更新 3D 场景可见性
   */
  updateSceneVisibility (state) {
    const showScene = state === GameStates.PLAYING || 
                      state === GameStates.PAUSED || 
                      state === GameStates.DEV_TOOLS

    // 如果进入游戏状态且世界未加载，则加载游戏世界
    if (showScene && !this.gameWorldLoaded) {
      console.log('🌍 开始加载游戏世界...')
      this.loadGameWorld()
      this.gameWorldLoaded = true
    }

    // 设置场景中所有网格的可见性
    this.scene.meshes.forEach(mesh => {
      mesh.isVisible = showScene
    })
  }

  /**
   * 设置键盘快捷键
   */
  setupKeyboardControls () {
    window.addEventListener('keydown', (e) => {
      const currentState = gameState.getState()

      switch (e.key) {
        case 'F12':
          // F12 切换开发者工具
          if (currentState === GameStates.DEV_TOOLS) {
            gameState.setState(GameStates.PLAYING)
          } else if (currentState === GameStates.PLAYING) {
            gameState.setState(GameStates.DEV_TOOLS)
          }
          break

        case 'F11':
          // F11 切换全屏
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
          break
      }
    })
  }

  /**
   * 创建基础场景（不包含游戏世界内容）
   */
  createBaseScene () {
    const scene = new BABYLON.Scene(this.engine)

    // 设置天空色（主菜单时使用深色，后续可改为渐变）
    scene.clearColor = new BABYLON.Color4(0.05, 0.1, 0.15, 1.0)

    // 创建相机
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,  // alpha - 水平旋转
      Math.PI / 3,   // beta - 垂直角度
      15,            // radius - 距离目标点的距离
      new BABYLON.Vector3(0, 2, 0),  // target - 目标点
      scene
    )
    camera.attachControl(this.canvas, true)
    camera.wheelPrecision = 50  // 滚轮缩放灵敏度
    camera.minZ = 0.1

    // 创建光源
    const light = new BABYLON.HemisphericLight(
      'hemisphericLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    )
    light.intensity = 0.8
    light.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3)

    // 添加方向光（模拟太阳）
    const sunLight = new BABYLON.DirectionalLight(
      'sunLight',
      new BABYLON.Vector3(-1, -2, -1),
      scene
    )
    sunLight.intensity = 0.6

    return scene
  }

  /**
   * 加载游戏世界内容（仅在开始游戏时调用）
   */
  loadGameWorld () {
    // 切换天空色为游戏场景色（仙气蓝紫色调）
    this.scene.clearColor = new BABYLON.Color4(0.4, 0.6, 0.9, 1.0)

    // 创建地面（草地）
    const ground = this.createVoxelBlock(this.scene, 'ground', 10, 0.5, 10, new BABYLON.Color3(0.3, 0.6, 0.2))
    ground.position.y = -0.25

    // 创建一些体素方块（测试用）
    const dirtBlock = this.createVoxelBlock(this.scene, 'dirt', 1, 1, 1, new BABYLON.Color3(0.5, 0.35, 0.2))
    dirtBlock.position.set(-2, 0.5, 0)

    const stoneBlock = this.createVoxelBlock(this.scene, 'stone', 1, 1, 1, new BABYLON.Color3(0.5, 0.5, 0.5))
    stoneBlock.position.set(0, 0.5, 0)

    const woodBlock = this.createVoxelBlock(this.scene, 'wood', 1, 1, 1, new BABYLON.Color3(0.6, 0.4, 0.2))
    woodBlock.position.set(2, 0.5, 0)

    // 创建一棵简单的树
    this.createTree(this.scene, new BABYLON.Vector3(0, 0, -3))

    // 创建一个简单的房子轮廓
    this.createHouse(this.scene, new BABYLON.Vector3(4, 0, 3))

    console.log('✅ 游戏世界加载完成')
  }

  /**
   * 创建体素方块
   */
  createVoxelBlock (scene, name, width, height, depth, color) {
    const box = BABYLON.MeshBuilder.CreateBox(name, {
      width,
      height,
      depth
    }, scene)

    const material = new BABYLON.StandardMaterial(`${name}Mat`, scene)
    material.diffuseColor = color
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1)
    box.material = material

    return box
  }

  /**
   * 创建一棵简单的树（体素风格）
   */
  createTree (scene, position) {
    // 树干
    const trunk = this.createVoxelBlock(scene, 'trunk', 0.5, 2, 0.5, new BABYLON.Color3(0.4, 0.25, 0.1))
    trunk.position = position.add(new BABYLON.Vector3(0, 1, 0))

    // 树叶（多层）
    const leafColor = new BABYLON.Color3(0.2, 0.5, 0.15)

    const leaves1 = this.createVoxelBlock(scene, 'leaves1', 2, 1, 2, leafColor)
    leaves1.position = position.add(new BABYLON.Vector3(0, 2.5, 0))

    const leaves2 = this.createVoxelBlock(scene, 'leaves2', 1.5, 1, 1.5, leafColor)
    leaves2.position = position.add(new BABYLON.Vector3(0, 3.5, 0))

    const leaves3 = this.createVoxelBlock(scene, 'leaves3', 1, 0.5, 1, leafColor)
    leaves3.position = position.add(new BABYLON.Vector3(0, 4.25, 0))
  }

  /**
   * 创建一个简单的房子（体素风格）
   */
  createHouse (scene, position) {
    const wallColor = new BABYLON.Color3(0.8, 0.75, 0.6)
    const roofColor = new BABYLON.Color3(0.6, 0.3, 0.2)

    // 房屋主体
    const walls = this.createVoxelBlock(scene, 'houseWalls', 3, 2, 3, wallColor)
    walls.position = position.add(new BABYLON.Vector3(0, 1, 0))

    // 屋顶（简化为一个扁平方块）
    const roof = this.createVoxelBlock(scene, 'houseRoof', 3.5, 0.5, 3.5, roofColor)
    roof.position = position.add(new BABYLON.Vector3(0, 2.25, 0))

    // 烟囱
    const chimney = this.createVoxelBlock(scene, 'chimney', 0.5, 1, 0.5, new BABYLON.Color3(0.4, 0.4, 0.4))
    chimney.position = position.add(new BABYLON.Vector3(1, 3, 1))
  }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 云笈仙田录 启动中...')
  new Game()
})
