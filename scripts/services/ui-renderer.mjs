import { RendererCode } from "../utils/app-codes.mjs";
import { assert, ensureObject, safeGet } from "../utils/flow-common.mjs";

/**
 * @typedef {object} UIRenderSnapshot
 * @property {boolean} mounted
 * @property {string|null} currentPageId
 * @property {number} renderedComponentCount
 */

/**
 * UIRenderer: DOM renderer for rectangle/title/button components.
 */
export class UIRenderer {
  /**
   * @param {object} [options]
   * @param {HTMLElement} [options.rootElement]
   * @param {(actionId:string, payload?:any)=>void} [options.actionDispatcher]
   */
  constructor(options = {}) {
    this.rootElement = options.rootElement || null;
    this.actionDispatcher = options.actionDispatcher || null;

    this.currentPageId = null;
    this.renderedComponentCount = 0;
  }

  /**
   * Mount renderer root element.
   *
   * @param {HTMLElement} rootElement
   */
  mount(rootElement) {
    this.#assertDomAvailable();

    assert(rootElement && typeof rootElement.appendChild === "function", RendererCode.ROOT_NOT_MOUNTED, "rootElement is required", {
      rootElement
    });

    this.rootElement = rootElement;
  }

  /**
   * Set action dispatcher.
   *
   * @param {(actionId:string, payload?:any)=>void} actionDispatcher
   */
  setActionDispatcher(actionDispatcher) {
    assert(typeof actionDispatcher === "function", RendererCode.ACTION_DISPATCHER_MISSING, "actionDispatcher must be a function", {
      actionDispatcherType: typeof actionDispatcher
    });

    this.actionDispatcher = actionDispatcher;
  }

  /**
   * Render scene snapshot.
   *
   * @param {import('./scene-service.mjs').SceneRenderSnapshot} sceneSnapshot
   */
  renderScene(sceneSnapshot) {
    this.#assertDomAvailable();
    this.#assertMounted();

    const snapshot = ensureObject(sceneSnapshot, "sceneSnapshot");
    const scene = ensureObject(safeGet(snapshot, "scene", null), "sceneSnapshot.scene");

    const page = ensureObject(safeGet(scene, "page", null), "scene.page");
    const layers = safeGet(scene, "layers", []);
    const components = safeGet(scene, "components", []);
    const themeTokens = ensureObject(safeGet(snapshot, "themeTokens", {}), "sceneSnapshot.themeTokens");

    assert(Array.isArray(layers), RendererCode.INVALID_SCENE, "scene.layers must be an array");
    assert(Array.isArray(components), RendererCode.INVALID_SCENE, "scene.components must be an array");

    this.clear();

    const layerMap = new Map();
    const sortedLayers = [...layers].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    for (const layerConfig of sortedLayers) {
      const layer = ensureObject(layerConfig, "layer");
      const layerId = safeGet(layer, "id", null);
      assert(typeof layerId === "string", RendererCode.LAYER_NOT_FOUND, "layer.id is required", {
        layer
      });

      const layerElement = document.createElement("div");
      layerElement.dataset.layerId = layerId;
      layerElement.style.position = "absolute";
      layerElement.style.inset = "0";
      layerElement.style.zIndex = String(safeGet(layer, "depth", 0));
      layerElement.style.pointerEvents = "none";

      this.rootElement.appendChild(layerElement);
      layerMap.set(layerId, layerElement);
    }

    for (const componentConfig of components) {
      const component = ensureObject(componentConfig, "component");
      const layerId = safeGet(component, "layer", null);

      assert(typeof layerId === "string" && layerMap.has(layerId), RendererCode.LAYER_NOT_FOUND, "component layer not found", {
        componentId: component.id,
        layerId
      });

      const componentElement = this.renderComponent(component, themeTokens);
      const targetLayerElement = layerMap.get(layerId);
      targetLayerElement.appendChild(componentElement);
      this.renderedComponentCount += 1;
    }

    this.currentPageId = safeGet(page, "id", null);
  }

  /**
   * Render a single component.
   *
   * @param {Record<string, any>} component
   * @param {Record<string, any>} themeTokens
   * @returns {HTMLElement}
   */
  renderComponent(component, themeTokens) {
    const type = safeGet(component, "type", null);

    if (type === "rectangle") {
      return this.renderRectangle(component, themeTokens);
    }

    if (type === "title") {
      return this.renderTitle(component, themeTokens);
    }

    if (type === "button") {
      return this.renderButton(component, themeTokens);
    }

    assert(false, RendererCode.UNSUPPORTED_COMPONENT_TYPE, "unsupported component type", {
      type,
      componentId: safeGet(component, "id", null)
    });
  }

  /**
   * Render rectangle component.
   *
   * @param {Record<string, any>} component
   * @param {Record<string, any>} themeTokens
   * @returns {HTMLElement}
   */
  renderRectangle(component, themeTokens) {
    const element = document.createElement("div");
    this.#applyBaseStyle(element, component, themeTokens);
    element.style.pointerEvents = "none";
    return element;
  }

  /**
   * Render title component.
   *
   * @param {Record<string, any>} component
   * @param {Record<string, any>} themeTokens
   * @returns {HTMLElement}
   */
  renderTitle(component, themeTokens) {
    const element = document.createElement("div");
    element.textContent = String(safeGet(component, "text", ""));
    this.#applyBaseStyle(element, component, themeTokens);
    element.style.display = "flex";
    element.style.alignItems = this.#mapVerticalAlign(safeGet(component, "style.verticalAlign", null));
    element.style.justifyContent = this.#mapTextAlign(safeGet(component, "style.textAlign", null));
    element.style.pointerEvents = "none";
    return element;
  }

  /**
   * Render button component.
   *
   * @param {Record<string, any>} component
   * @param {Record<string, any>} themeTokens
   * @returns {HTMLElement}
   */
  renderButton(component, themeTokens) {
    const actionId = safeGet(component, "actionId", null);
    assert(typeof actionId === "string" && actionId.trim() !== "", RendererCode.INVALID_COMPONENT, "button.actionId is required", {
      componentId: component.id
    });

    assert(typeof this.actionDispatcher === "function", RendererCode.ACTION_DISPATCHER_MISSING, "actionDispatcher is required for button", {
      componentId: component.id,
      actionId
    });

    const element = document.createElement("button");
    element.textContent = String(safeGet(component, "text", ""));
    this.#applyBaseStyle(element, component, themeTokens);

    // Keep border buttons pixel-like by default.
    element.style.borderRadius = "0";
    element.style.borderWidth = element.style.borderWidth || "2px";
    element.style.borderStyle = element.style.borderStyle || "solid";
    element.style.pointerEvents = "auto";
    element.style.cursor = "pointer";

    element.addEventListener("click", () => {
      this.actionDispatcher(actionId, {
        actionId,
        componentId: safeGet(component, "id", null),
        pageId: this.currentPageId,
        timestamp: Date.now()
      });
    });

    return element;
  }

  /**
   * Clear rendered scene.
   */
  clear() {
    this.#assertMounted();

    while (this.rootElement.firstChild) {
      this.rootElement.removeChild(this.rootElement.firstChild);
    }

    this.currentPageId = null;
    this.renderedComponentCount = 0;
  }

  /**
   * Return renderer snapshot.
   *
   * @returns {UIRenderSnapshot}
   */
  getRenderSnapshot() {
    return {
      mounted: Boolean(this.rootElement),
      currentPageId: this.currentPageId,
      renderedComponentCount: this.renderedComponentCount
    };
  }

  #assertMounted() {
    assert(this.rootElement, RendererCode.ROOT_NOT_MOUNTED, "UIRenderer root is not mounted");
  }

  #assertDomAvailable() {
    assert(typeof document !== "undefined", RendererCode.DOM_UNAVAILABLE, "document is unavailable in current runtime");
  }

  #applyBaseStyle(element, component, themeTokens) {
    const style = ensureObject(safeGet(component, "style", {}), "component.style");

    element.style.position = "absolute";

    const applyToken = (value) => {
      if (typeof value === "string" && value.startsWith("$")) {
        const tokenName = value.slice(1);
        return safeGet(themeTokens, tokenName, value);
      }

      return value;
    };

    const styleMap = {
      width: "width",
      height: "height",
      background: "background",
      color: "color",
      borderColor: "borderColor",
      borderWidth: "borderWidth",
      left: "left",
      right: "right",
      top: "top",
      bottom: "bottom",
      marginTop: "marginTop",
      marginLeft: "marginLeft",
      marginRight: "marginRight",
      fontSize: "fontSize",
      textAlign: "textAlign",
      alignSelf: "alignSelf"
    };

    for (const [sourceKey, targetKey] of Object.entries(styleMap)) {
      const rawValue = style[sourceKey];
      if (rawValue == null) {
        continue;
      }

      const resolvedValue = applyToken(rawValue);
      element.style[targetKey] = typeof resolvedValue === "number" ? `${resolvedValue}px` : String(resolvedValue);
    }

    if (!style.width) {
      element.style.width = element.style.width || "auto";
    }

    if (!style.height) {
      element.style.height = element.style.height || "auto";
    }
  }

  #mapTextAlign(textAlign) {
    if (textAlign === "right") {
      return "flex-end";
    }

    if (textAlign === "center") {
      return "center";
    }

    return "flex-start";
  }

  #mapVerticalAlign(verticalAlign) {
    if (verticalAlign === "bottom") {
      return "flex-end";
    }

    if (verticalAlign === "center") {
      return "center";
    }

    return "flex-start";
  }
}
