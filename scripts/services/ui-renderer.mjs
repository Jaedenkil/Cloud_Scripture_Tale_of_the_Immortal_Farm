import { RendererCode } from "../utils/app-codes.mjs";
import { assert, ensureObject, safeGet } from "../utils/flow-common.mjs";

const DOMAIN_ORDER = Object.freeze(["world", "hud", "panel", "system"]);
const DOMAIN_BASE_DEPTH = Object.freeze({
  world: 0,
  hud: 1000,
  panel: 2000,
  system: 3000
});

const LAYER_CAPTURE_INPUT_POLICIES = new Set(["capture", "block"]);

/**
 * @typedef {object} UIRenderSnapshot
 * @property {boolean} mounted
 * @property {string|null} currentPageId
 * @property {number} renderedComponentCount
 * @property {boolean} inputBlocked
 * @property {Record<string, string|null>} activePageByDomain
 * @property {string[]} overlayPageIds
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
    this.inputBlocked = false;

    this.domainRootMap = new Map();
    this.domainDefaultPointerEvents = new Map();
    this.activeSceneByDomain = new Map();
    this.overlaySceneByPageId = new Map();
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
    this.#ensureDomainRoots();
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
    const sceneDomain = safeGet(page, "domain", null);

    assert(typeof sceneDomain === "string" && DOMAIN_ORDER.includes(sceneDomain), RendererCode.INVALID_SCENE, "scene.page.domain is invalid", {
      sceneDomain,
      pageId: safeGet(page, "id", null)
    });

    this.activeSceneByDomain.set(sceneDomain, snapshot);
    this.currentPageId = safeGet(page, "id", null);
    this.#renderAllScenes();
  }

  /**
   * Show an overlay/popup scene without clearing base domain scenes.
   *
   * @param {import('./scene-service.mjs').SceneRenderSnapshot} sceneSnapshot
   */
  showOverlay(sceneSnapshot) {
    this.#assertDomAvailable();
    this.#assertMounted();

    const snapshot = ensureObject(sceneSnapshot, "sceneSnapshot");
    const scene = ensureObject(safeGet(snapshot, "scene", null), "sceneSnapshot.scene");
    const page = ensureObject(safeGet(scene, "page", null), "scene.page");
    const pageId = safeGet(page, "id", null);

    assert(typeof pageId === "string" && pageId.trim() !== "", RendererCode.INVALID_SCENE, "overlay scene page.id is required");

    this.overlaySceneByPageId.set(pageId, snapshot);
    this.#renderAllScenes();
  }

  /**
   * Hide one overlay scene by page id.
   *
   * @param {string} pageId
   * @returns {boolean}
   */
  hideOverlay(pageId) {
    assert(typeof pageId === "string" && pageId.trim() !== "", RendererCode.INVALID_SCENE, "overlay pageId is required", {
      pageId
    });

    const removed = this.overlaySceneByPageId.delete(pageId);
    if (removed) {
      this.#renderAllScenes();
    }

    return removed;
  }

  /**
   * Remove active scene from a domain.
   *
   * @param {string} domain
   * @returns {boolean}
   */
  removeDomainScene(domain) {
    assert(typeof domain === "string" && DOMAIN_ORDER.includes(domain), RendererCode.INVALID_SCENE, "invalid domain", {
      domain
    });

    const removed = this.activeSceneByDomain.delete(domain);
    if (removed) {
      this.#renderAllScenes();
    }

    return removed;
  }

  /**
   * Enable or disable input for world/hud/panel domains.
   *
   * @param {boolean} enabled
   */
  setInputBlocker(enabled) {
    this.inputBlocked = Boolean(enabled);
    this.#applyDomainInputState();
  }

  /**
   * Hit-test domain priority from highest to lowest.
   *
   * @returns {string[]}
   */
  hitTestWithPriority() {
    return ["system", "panel", "hud", "world"];
  }

  /**
   * Return active page id for each domain.
   *
   * @returns {Record<string, string|null>}
   */
  getActivePageByDomain() {
    const result = {
      world: null,
      hud: null,
      panel: null,
      system: null
    };

    for (const domain of DOMAIN_ORDER) {
      const snapshot = this.activeSceneByDomain.get(domain);
      if (snapshot) {
        result[domain] = safeGet(snapshot, "pageId", null);
      }
    }

    return result;
  }

  #renderAllScenes() {
    this.#ensureDomainRoots();

    this.renderedComponentCount = 0;

    for (const domain of DOMAIN_ORDER) {
      const domainRoot = this.domainRootMap.get(domain);
      if (domainRoot) {
        domainRoot.replaceChildren();
        domainRoot.style.pointerEvents = "none";
        this.domainDefaultPointerEvents.set(domain, "none");
      }
    }

    for (const domain of DOMAIN_ORDER) {
      const sceneSnapshot = this.activeSceneByDomain.get(domain);
      if (sceneSnapshot) {
        this.#renderSnapshotIntoDomain(sceneSnapshot, domain);
      }
    }

    const overlays = [...this.overlaySceneByPageId.values()].sort((left, right) => {
      const leftDomain = safeGet(left, "scene.page.domain", "system");
      const rightDomain = safeGet(right, "scene.page.domain", "system");
      const leftDepth = DOMAIN_BASE_DEPTH[leftDomain] ?? DOMAIN_BASE_DEPTH.system;
      const rightDepth = DOMAIN_BASE_DEPTH[rightDomain] ?? DOMAIN_BASE_DEPTH.system;
      return leftDepth - rightDepth;
    });

    for (const overlaySnapshot of overlays) {
      const overlayDomain = safeGet(overlaySnapshot, "scene.page.domain", "system");
      this.#renderSnapshotIntoDomain(overlaySnapshot, overlayDomain);
    }

    this.#applyDomainInputState();
  }

  #renderSnapshotIntoDomain(sceneSnapshot, domain) {
    const snapshot = ensureObject(sceneSnapshot, "sceneSnapshot");
    const scene = ensureObject(safeGet(snapshot, "scene", null), "sceneSnapshot.scene");

    const layers = safeGet(scene, "layers", []);
    const components = safeGet(scene, "components", []);
    const themeTokens = ensureObject(safeGet(snapshot, "themeTokens", {}), "sceneSnapshot.themeTokens");
    const pageId = safeGet(snapshot, "pageId", null);

    assert(Array.isArray(layers), RendererCode.INVALID_SCENE, "scene.layers must be an array");
    assert(Array.isArray(components), RendererCode.INVALID_SCENE, "scene.components must be an array");

    const domainRoot = this.domainRootMap.get(domain);
    assert(domainRoot, RendererCode.ROOT_NOT_MOUNTED, "domain root not mounted", { domain });
    domainRoot.style.pointerEvents = "auto";
    this.domainDefaultPointerEvents.set(domain, "auto");

    const layerMap = new Map();
    const sortedLayers = [...layers].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    for (const layerConfig of sortedLayers) {
      const layer = ensureObject(layerConfig, "layer");
      const layerId = safeGet(layer, "id", null);
      assert(typeof layerId === "string", RendererCode.LAYER_NOT_FOUND, "layer.id is required", {
        layer
      });

      const inputPolicy = safeGet(layer, "inputPolicy", "passthrough");

      const layerElement = document.createElement("div");
      layerElement.dataset.layerId = layerId;
      layerElement.style.position = "absolute";
      layerElement.style.inset = "0";
      layerElement.style.zIndex = String(safeGet(layer, "depth", 0));
      layerElement.style.pointerEvents = this.#resolveLayerPointerEvents(inputPolicy);

      domainRoot.appendChild(layerElement);
      layerMap.set(layerId, layerElement);
    }

    for (const componentConfig of components) {
      const component = ensureObject(componentConfig, "component");
      const layerId = safeGet(component, "layer", null);

      assert(typeof layerId === "string" && layerMap.has(layerId), RendererCode.LAYER_NOT_FOUND, "component layer not found", {
        componentId: component.id,
        layerId
      });

      const componentElement = this.renderComponent(component, themeTokens, pageId);
      const targetLayerElement = layerMap.get(layerId);
      targetLayerElement.appendChild(componentElement);
      this.renderedComponentCount += 1;
    }
  }

  /**
   * Render a single component.
   *
   * @param {Record<string, any>} component
   * @param {Record<string, any>} themeTokens
   * @param {string|null} pageId
   * @returns {HTMLElement}
   */
  renderComponent(component, themeTokens, pageId = this.currentPageId) {
    const type = safeGet(component, "type", null);

    if (type === "rectangle") {
      return this.renderRectangle(component, themeTokens);
    }

    if (type === "title") {
      return this.renderTitle(component, themeTokens);
    }

    if (type === "button") {
      return this.renderButton(component, themeTokens, pageId);
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
   * @param {string|null} pageId
   * @returns {HTMLElement}
   */
  renderButton(component, themeTokens, pageId = this.currentPageId) {
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
        pageId,
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

    this.activeSceneByDomain.clear();
    this.overlaySceneByPageId.clear();
    this.#renderAllScenes();

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
      renderedComponentCount: this.renderedComponentCount,
      inputBlocked: this.inputBlocked,
      activePageByDomain: this.getActivePageByDomain(),
      overlayPageIds: [...this.overlaySceneByPageId.keys()]
    };
  }

  #assertMounted() {
    assert(this.rootElement, RendererCode.ROOT_NOT_MOUNTED, "UIRenderer root is not mounted");
  }

  #assertDomAvailable() {
    assert(typeof document !== "undefined", RendererCode.DOM_UNAVAILABLE, "document is unavailable in current runtime");
  }

  #ensureDomainRoots() {
    this.#assertMounted();

    if (this.domainRootMap.size === DOMAIN_ORDER.length) {
      return;
    }

    this.domainRootMap.clear();
    this.rootElement.replaceChildren();

    for (const domain of DOMAIN_ORDER) {
      const domainRoot = document.createElement("div");
      domainRoot.dataset.domainId = domain;
      domainRoot.style.position = "absolute";
      domainRoot.style.inset = "0";
      domainRoot.style.zIndex = String(DOMAIN_BASE_DEPTH[domain]);
      domainRoot.style.pointerEvents = "none";

      this.rootElement.appendChild(domainRoot);
      this.domainRootMap.set(domain, domainRoot);
      this.domainDefaultPointerEvents.set(domain, "none");
    }
  }

  #applyDomainInputState() {
    if (this.domainRootMap.size === 0) {
      return;
    }

    for (const domain of DOMAIN_ORDER) {
      const domainRoot = this.domainRootMap.get(domain);
      if (!domainRoot) {
        continue;
      }

      if (!this.inputBlocked) {
        domainRoot.style.pointerEvents = this.domainDefaultPointerEvents.get(domain) || "none";
        continue;
      }

      if (domain === "system") {
        domainRoot.style.pointerEvents = "auto";
      } else {
        domainRoot.style.pointerEvents = "none";
      }
    }
  }

  #resolveLayerPointerEvents(inputPolicy) {
    const normalizedPolicy = typeof inputPolicy === "string"
      ? inputPolicy
      : "passthrough";

    return LAYER_CAPTURE_INPUT_POLICIES.has(normalizedPolicy)
      ? "auto"
      : "none";
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
      position: "position",
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
