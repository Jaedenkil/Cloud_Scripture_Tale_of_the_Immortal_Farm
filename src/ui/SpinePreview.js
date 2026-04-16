/**
 * Spine 2D 骨骼预览器
 * 使用独立 HTML Canvas + spine-canvas 运行时渲染骨骼动画
 * 通过 CSS 绝对定位覆盖在 Babylon.js GUI 预览区域上方
 */

import {
  AssetManager,
  SkeletonRenderer,
  CanvasTexture
} from '@esotericsoftware/spine-canvas'
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  AnimationState,
  AnimationStateData,
  Skeleton,
  TextureAtlas,
  Physics
} from '@esotericsoftware/spine-core'

export class SpinePreview {
  /**
   * @param {HTMLCanvasElement} mainCanvas - 主游戏 canvas（用于定位参考）
   * @param {number} width - 预览区域宽度
   * @param {number} height - 预览区域高度
   */
  constructor(mainCanvas, width = 256, height = 256) {
    this.mainCanvas = mainCanvas
    this.width = width
    this.height = height

    this.canvas = null
    this.ctx = null
    this.renderer = null
    this.assetManager = null

    this.skeleton = null
    this.animationState = null
    this.skeletonData = null

    this._visible = false
    this._animFrameId = null
    this._lastTime = 0
    this._guiControl = null
    this._advancedTexture = null
    this._positionInterval = null

    this._debugBones = true

    this._init()
  }

  _init() {
    // 创建独立 canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 10;
      display: none;
      border-radius: 4px;
    `
    this.canvas.id = 'spinePreviewCanvas'
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')
    this.renderer = new SkeletonRenderer(this.ctx)
    this.renderer.debugRendering = true

    this.assetManager = new AssetManager()

    window.addEventListener('resize', () => this._updatePosition())
  }

  /**
   * 加载 Spine 资产
   * @param {string} basePath - 资产基础路径（如 '/spine/'）
   * @param {string} skelFile - 骨骼 JSON 文件名
   * @param {string} atlasFile - 图集文件名
   */
  async load(basePath, skelFile, atlasFile) {
    return new Promise((resolve, reject) => {
      this.assetManager = new AssetManager(basePath)
      this.assetManager.loadTextureAtlas(atlasFile)
      this.assetManager.loadJson(skelFile)

      const checkLoaded = () => {
        if (this.assetManager.isLoadingComplete()) {
          if (this.assetManager.hasErrors()) {
            console.error('[SpinePreview] 资产加载错误:', this.assetManager.getErrors())
            reject(new Error('Spine 资产加载失败'))
            return
          }

          try {
            const atlas = this.assetManager.require(atlasFile)
            const atlasLoader = new AtlasAttachmentLoader(atlas)
            const skelJson = new SkeletonJson(atlasLoader)
            skelJson.scale = 0.5 // 缩放以适应预览区域

            const skelData = this.assetManager.require(skelFile)
            this.skeletonData = skelJson.readSkeletonData(skelData)

            this.skeleton = new Skeleton(this.skeletonData)
            this.skeleton.setToSetupPose()

            const stateData = new AnimationStateData(this.skeletonData)
            this.animationState = new AnimationState(stateData)

            // 默认播放第一个动画（如有）
            if (this.skeletonData.animations.length > 0) {
              this.animationState.setAnimation(0, this.skeletonData.animations[0].name, true)
            }

            // 将骨骼居中到 canvas
            this.skeleton.x = this.width / 2
            this.skeleton.y = this.height * 0.85

            console.log('[SpinePreview] 加载完成:', skelFile)
            resolve(this.skeletonData)
          } catch (e) {
            console.error('[SpinePreview] 初始化骨骼失败:', e)
            reject(e)
          }
        } else {
          requestAnimationFrame(checkLoaded)
        }
      }
      requestAnimationFrame(checkLoaded)
    })
  }

  /**
   * 获取骨骼数据中的动画列表
   * @returns {{ name: string, duration: number }[]}
   */
  getAnimations() {
    if (!this.skeletonData) return []
    return this.skeletonData.animations.map(a => ({
      name: a.name,
      duration: a.duration
    }))
  }

  /**
   * 获取骨骼数据中的骨骼列表
   * @returns {{ name: string, parentName: string|null }[]}
   */
  getBones() {
    if (!this.skeletonData) return []
    return this.skeletonData.bones.map(b => ({
      name: b.name,
      parentName: b.parent ? b.parent.name : null
    }))
  }

  /**
   * 获取皮肤列表
   * @returns {string[]}
   */
  getSkins() {
    if (!this.skeletonData) return []
    return this.skeletonData.skins.map(s => s.name)
  }

  /**
   * 播放指定动画
   * @param {string} animName
   * @param {boolean} loop
   */
  playAnimation(animName, loop = true) {
    if (!this.animationState) return
    try {
      this.animationState.setAnimation(0, animName, loop)
    } catch (e) {
      console.warn(`[SpinePreview] 动画 "${animName}" 不存在`)
    }
  }

  /**
   * 切换皮肤
   * @param {string} skinName
   */
  setSkin(skinName) {
    if (!this.skeleton || !this.skeletonData) return
    try {
      this.skeleton.setSkinByName(skinName)
      this.skeleton.setSlotsToSetupPose()
    } catch (e) {
      console.warn(`[SpinePreview] 皮肤 "${skinName}" 不存在`)
    }
  }

  /**
   * 切换骨骼调试显示
   * @param {boolean} show
   */
  setDebugBones(show) {
    this._debugBones = show
    this.renderer.debugRendering = show
  }

  /**
   * 将预览 canvas 定位到 GUI 占位符控件上方
   */
  attachToGUIControl(guiControl, advancedTexture) {
    this._guiControl = guiControl
    this._advancedTexture = advancedTexture
    this._updatePosition()

    this._positionInterval = setInterval(() => {
      if (this._visible) this._updatePosition()
    }, 500)
  }

  _updatePosition() {
    if (!this._guiControl || !this._advancedTexture || !this.canvas) return
    if (!this.mainCanvas) return

    const idealW = this._advancedTexture.idealWidth || this.mainCanvas.clientWidth
    const idealH = this._advancedTexture.idealHeight || this.mainCanvas.clientHeight
    const scaleX = this.mainCanvas.clientWidth / idealW
    const scaleY = this.mainCanvas.clientHeight / idealH

    const ctrl = this._guiControl
    const ctrlW = ctrl.widthInPixels * scaleX
    const ctrlH = ctrl.heightInPixels * scaleY
    const screenX = ctrl.centerX * scaleX - ctrlW / 2
    const screenY = ctrl.centerY * scaleY - ctrlH / 2

    const rect = this.mainCanvas.getBoundingClientRect()

    this.canvas.style.left = (rect.left + screenX) + 'px'
    this.canvas.style.top = (rect.top + screenY) + 'px'
    this.canvas.style.width = ctrlW + 'px'
    this.canvas.style.height = ctrlH + 'px'
  }

  _renderFrame(timestamp) {
    if (!this._visible) return

    const delta = (timestamp - this._lastTime) / 1000
    this._lastTime = timestamp

    if (this.skeleton && this.animationState) {
      this.animationState.update(delta)
      this.animationState.apply(this.skeleton)
      this.skeleton.update(delta)
      this.skeleton.updateWorldTransform(Physics.update)

      this.ctx.save()
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

      // 深色背景
      this.ctx.fillStyle = 'rgba(18, 32, 48, 1.0)'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      this.renderer.draw(this.skeleton)
      this.ctx.restore()
    }

    this._animFrameId = requestAnimationFrame((t) => this._renderFrame(t))
  }

  /**
   * 在没有 Spine 资产时绘制占位骨骼图
   * 用简单线段+圆点表示骨骼层级结构
   * @param {Array} bones - 骨骼数据 [{name, x, y, parentIndex}]
   */
  drawPlaceholderSkeleton(bones) {
    if (!this.ctx) return

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.fillStyle = 'rgba(18, 32, 48, 1.0)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    if (!bones || bones.length === 0) {
      this.ctx.fillStyle = '#6B8DAB'
      this.ctx.font = '12px sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.fillText('无 Spine 资产', this.canvas.width / 2, this.canvas.height / 2)
      this.ctx.fillText('请导入 .json + .atlas', this.canvas.width / 2, this.canvas.height / 2 + 18)
      return
    }

    // 画骨骼连线
    this.ctx.strokeStyle = 'rgba(74, 155, 232, 0.6)'
    this.ctx.lineWidth = 2
    for (const bone of bones) {
      if (bone.parentIndex >= 0) {
        const parent = bones[bone.parentIndex]
        this.ctx.beginPath()
        this.ctx.moveTo(parent.x, parent.y)
        this.ctx.lineTo(bone.x, bone.y)
        this.ctx.stroke()
      }
    }

    // 画关节点
    for (const bone of bones) {
      const isRoot = bone.parentIndex < 0
      this.ctx.beginPath()
      this.ctx.arc(bone.x, bone.y, isRoot ? 5 : 3, 0, Math.PI * 2)
      this.ctx.fillStyle = isRoot ? '#FFA502' : '#4A9BE8'
      this.ctx.fill()
      this.ctx.strokeStyle = '#FFFFFF'
      this.ctx.lineWidth = 1
      this.ctx.stroke()

      // 骨骼名称
      this.ctx.fillStyle = '#B0D4F1'
      this.ctx.font = '9px sans-serif'
      this.ctx.textAlign = 'left'
      this.ctx.fillText(bone.name, bone.x + 6, bone.y + 3)
    }
  }

  show() {
    this._visible = true
    if (this.canvas) {
      this.canvas.style.display = 'block'
      this._updatePosition()
      this._lastTime = performance.now()
      if (this.skeleton) {
        this._animFrameId = requestAnimationFrame((t) => this._renderFrame(t))
      }
    }
  }

  hide() {
    this._visible = false
    if (this.canvas) {
      this.canvas.style.display = 'none'
    }
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId)
      this._animFrameId = null
    }
  }

  dispose() {
    this.hide()
    if (this._positionInterval) {
      clearInterval(this._positionInterval)
      this._positionInterval = null
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    this.skeleton = null
    this.animationState = null
    this.skeletonData = null
  }
}
