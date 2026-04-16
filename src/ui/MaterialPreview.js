/**
 * 材质 3D 预览器
 * 使用独立的 HTML Canvas + Babylon.js Engine 渲染可旋转的 3D 方块/球体
 * 通过 CSS 绝对定位覆盖在 GUI 预览区域上方
 */

import * as BABYLON from '@babylonjs/core'

export class MaterialPreview {
  /**
   * @param {BABYLON.Scene} mainScene - 主场景（用于获取 engine 参考）
   * @param {number} resolution - canvas 分辨率
   */
  constructor(mainScene, resolution = 256) {
    this.mainScene = mainScene
    this.resolution = resolution

    this.canvas = null
    this.engine = null
    this.scene = null
    this.camera = null
    this.mesh = null
    this.material = null
    this._currentShape = 'sphere'
    this._visible = false

    this._init()
  }

  _init() {
    // 创建独立 canvas 元素
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.resolution
    this.canvas.height = this.resolution
    this.canvas.style.cssText = `
      position: absolute;
      pointer-events: auto;
      z-index: 10;
      display: none;
      border-radius: 4px;
    `
    this.canvas.id = 'materialPreviewCanvas'
    document.body.appendChild(this.canvas)

    // 独立引擎
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      alpha: true
    })

    // 预览场景
    this.scene = new BABYLON.Scene(this.engine)
    this.scene.clearColor = new BABYLON.Color4(0.06, 0.1, 0.18, 1.0)

    // ArcRotateCamera — 鼠标可旋转
    this.camera = new BABYLON.ArcRotateCamera(
      'previewCam',
      -Math.PI / 4,
      Math.PI / 3,
      3.0,
      BABYLON.Vector3.Zero(),
      this.scene
    )
    this.camera.attachControl(this.canvas, true)
    this.camera.wheelPrecision = 80
    this.camera.lowerRadiusLimit = 1.5
    this.camera.upperRadiusLimit = 6
    this.camera.minZ = 0.1

    // 光照
    const hemi = new BABYLON.HemisphericLight('previewHemi', new BABYLON.Vector3(0, 1, 0), this.scene)
    hemi.intensity = 0.7
    hemi.groundColor = new BABYLON.Color3(0.15, 0.15, 0.25)

    const dir = new BABYLON.DirectionalLight('previewDir', new BABYLON.Vector3(-1, -1.5, 1), this.scene)
    dir.intensity = 0.5

    // 默认材质
    this.material = new BABYLON.StandardMaterial('previewMat', this.scene)
    this.material.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15)

    // 默认网格
    this._createMesh('sphere')

    // 渲染循环
    this.engine.runRenderLoop(() => {
      if (this._visible) {
        this.scene.render()
      }
    })

    // 响应主窗口 resize
    window.addEventListener('resize', () => {
      this.engine.resize()
      this._updatePosition()
    })
  }

  _createMesh(shape) {
    if (this.mesh) {
      this.mesh.dispose()
    }

    switch (shape) {
      case 'cube':
        this.mesh = BABYLON.MeshBuilder.CreateBox('previewMesh', { size: 1.4 }, this.scene)
        break
      case 'plane':
        this.mesh = BABYLON.MeshBuilder.CreatePlane('previewMesh', { size: 1.8 }, this.scene)
        break
      case 'sphere':
      default:
        this.mesh = BABYLON.MeshBuilder.CreateSphere('previewMesh', { diameter: 1.6, segments: 24 }, this.scene)
        break
    }

    this.mesh.material = this.material
    this._currentShape = shape
  }

  /**
   * 将预览 canvas 定位到指定的 GUI 占位符控件上方
   * @param {GUI.Control} guiControl - GUI 中的占位符控件
   * @param {GUI.AdvancedDynamicTexture} advancedTexture - 全屏 GUI 纹理
   */
  attachToGUIControl(guiControl, advancedTexture) {
    this._guiControl = guiControl
    this._advancedTexture = advancedTexture
    this._updatePosition()

    // 定期更新位置（应对窗口/布局变化）
    this._positionInterval = setInterval(() => {
      if (this._visible) this._updatePosition()
    }, 500)
  }

  _updatePosition() {
    if (!this._guiControl || !this._advancedTexture || !this.canvas) return

    const mainCanvas = this.mainScene.getEngine().getRenderingCanvas()
    if (!mainCanvas) return

    // 获取 GUI 控件在屏幕上的像素坐标
    // AdvancedDynamicTexture idealWidth/Height → 实际屏幕坐标的缩放
    const idealW = this._advancedTexture.idealWidth || mainCanvas.clientWidth
    const idealH = this._advancedTexture.idealHeight || mainCanvas.clientHeight
    const scaleX = mainCanvas.clientWidth / idealW
    const scaleY = mainCanvas.clientHeight / idealH

    // 获取控件中心在 ideal 坐标系中的位置
    const ctrl = this._guiControl
    const centerX = ctrl.centerX
    const centerY = ctrl.centerY

    // 控件尺寸（像素值）
    const ctrlW = ctrl.widthInPixels * scaleX
    const ctrlH = ctrl.heightInPixels * scaleY

    // 屏幕坐标
    const screenX = centerX * scaleX - ctrlW / 2
    const screenY = centerY * scaleY - ctrlH / 2

    // 获取主 canvas 在页面中的偏移
    const rect = mainCanvas.getBoundingClientRect()

    this.canvas.style.left = (rect.left + screenX) + 'px'
    this.canvas.style.top = (rect.top + screenY) + 'px'
    this.canvas.style.width = ctrlW + 'px'
    this.canvas.style.height = ctrlH + 'px'
  }

  show() {
    this._visible = true
    if (this.canvas) {
      this.canvas.style.display = 'block'
      this._updatePosition()
      this.engine.resize()
    }
  }

  hide() {
    this._visible = false
    if (this.canvas) {
      this.canvas.style.display = 'none'
    }
  }

  setDiffuseTexture(texturePath) {
    if (this.material.diffuseTexture) {
      this.material.diffuseTexture.dispose()
    }
    if (texturePath) {
      const tex = new BABYLON.Texture('/' + texturePath, this.scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE)
      this.material.diffuseTexture = tex
    } else {
      this.material.diffuseTexture = null
    }
  }

  setNormalTexture(texturePath) {
    if (this.material.bumpTexture) {
      this.material.bumpTexture.dispose()
    }
    if (texturePath) {
      const tex = new BABYLON.Texture('/' + texturePath, this.scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE)
      this.material.bumpTexture = tex
    } else {
      this.material.bumpTexture = null
    }
  }

  setEmissiveTexture(texturePath) {
    if (this.material.emissiveTexture) {
      this.material.emissiveTexture.dispose()
    }
    if (texturePath) {
      const tex = new BABYLON.Texture('/' + texturePath, this.scene, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE)
      this.material.emissiveTexture = tex
    } else {
      this.material.emissiveTexture = null
    }
  }

  setAlpha(alpha) {
    this.material.alpha = alpha
    if (alpha < 1.0) {
      this.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND
    } else {
      this.material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE
    }
  }

  setShape(shape) {
    if (shape === this._currentShape) return
    this._createMesh(shape)
  }

  /**
   * 根据材质数据设置完整材质
   * @param {object} matData - { diffuse, normal, emissive, alpha }
   * @param {object} resourceMap - 资源 ID → 文件路径映射
   */
  applyMaterial(matData, resourceMap) {
    const resolvePath = (resId) => {
      if (!resId || resId === '(无)') return null
      return resourceMap[resId] || null
    }

    this.setDiffuseTexture(resolvePath(matData.diffuse))
    this.setNormalTexture(resolvePath(matData.normal))
    this.setEmissiveTexture(resolvePath(matData.emissive))
    this.setAlpha(matData.alpha !== undefined ? matData.alpha : 1.0)

    // 重置相机角度
    if (this.camera) {
      this.camera.alpha = -Math.PI / 4
      this.camera.beta = Math.PI / 3
      this.camera.radius = 3.0
    }

    this.show()
  }

  dispose() {
    if (this._positionInterval) clearInterval(this._positionInterval)
    if (this.engine) this.engine.dispose()
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
  }
}
