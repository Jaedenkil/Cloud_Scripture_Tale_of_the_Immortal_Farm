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

const SETTINGS_EFFECT_META = Object.freeze({
  instant: Object.freeze({ label: "即时生效", color: "#3fbf7f" }),
  confirm: Object.freeze({ label: "需确认", color: "#e3a33a" }),
  restart: Object.freeze({ label: "需重启", color: "#4b8dff" })
});

const SETTINGS_CONTROL_TYPES = new Set(["toggle", "slider", "dropdown", "stepper", "keybind"]);

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
    this.componentStateByKey = new Map();
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

    if (type === "settingsPanel") {
      return this.renderSettingsPanel(component, themeTokens, pageId);
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
    this.componentStateByKey.clear();
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

  renderSettingsPanel(component, themeTokens, pageId = this.currentPageId) {
    const host = document.createElement("div");
    this.#applyBaseStyle(host, component, themeTokens);
    host.style.pointerEvents = "auto";
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    host.style.background = this.#resolveThemeToken(themeTokens, "colors.panelBgSecondary", "#243034");
    host.style.color = this.#resolveThemeToken(themeTokens, "colors.textPrimary", "#f3efe4");
    host.style.boxSizing = "border-box";
    host.style.overflow = "hidden";

    const panelState = this.#getOrCreateSettingsPanelState(component, pageId);
    const render = () => {
      this.#renderSettingsPanelContent({
        host,
        component,
        themeTokens,
        panelState,
        pageId,
        rerender: render
      });
    };

    render();
    return host;
  }

  #getOrCreateSettingsPanelState(component, pageId) {
    const componentId = typeof component?.id === "string" ? component.id : "settings-panel";
    const key = `${pageId || "unknown-page"}::${componentId}`;
    if (this.componentStateByKey.has(key)) {
      return this.componentStateByKey.get(key);
    }

    const categories = Array.isArray(component?.categories) ? component.categories : [];
    const state = {
      key,
      activeCategoryId: typeof categories?.[0]?.id === "string" ? categories[0].id : null,
      searchText: "",
      values: {},
      savedValues: {},
      defaults: {},
      bindingMetaByKey: new Map(),
      dirtyBindingKeys: new Set(),
      categoryScrollTopById: {},
      captureBindingKey: null,
      captureListener: null,
      modal: null,
      toast: null,
      toastTimerId: null
    };

    for (const category of categories) {
      const categoryId = typeof category?.id === "string" ? category.id : "";
      const items = Array.isArray(category?.items) ? category.items : [];
      for (const item of items) {
        const bindingKey = typeof item?.binding === "string" ? item.binding.trim() : "";
        if (!bindingKey) {
          continue;
        }

        const defaultValue = this.#normalizeSettingValue(item, item.defaultValue);
        state.values[bindingKey] = defaultValue;
        state.savedValues[bindingKey] = defaultValue;
        state.defaults[bindingKey] = defaultValue;
        state.bindingMetaByKey.set(bindingKey, {
          categoryId,
          item
        });
      }
    }

    this.componentStateByKey.set(key, state);
    return state;
  }

  #renderSettingsPanelContent({ host, component, themeTokens, panelState, pageId, rerender }) {
    const previousActiveCategoryId = panelState.activeCategoryId;
    this.#captureSettingsScrollBeforeRerender(host, panelState, previousActiveCategoryId);

    const categories = Array.isArray(component?.categories) ? component.categories : [];
    const activeCategory = categories.find((item) => item.id === panelState.activeCategoryId) || categories[0] || null;
    const activeCategoryId = activeCategory?.id || null;
    if (activeCategoryId && panelState.activeCategoryId !== activeCategoryId) {
      panelState.activeCategoryId = activeCategoryId;
    }

    host.replaceChildren();

    const topBar = document.createElement("div");
    topBar.style.display = "flex";
    topBar.style.alignItems = "center";
    topBar.style.justifyContent = "space-between";
    topBar.style.gap = "12px";
    topBar.style.padding = "14px 18px";
    topBar.style.borderBottom = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    topBar.style.background = this.#resolveThemeToken(themeTokens, "colors.panelBgMain", "#1a2125");

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = String(component?.title || "设置");
    title.style.fontSize = "28px";
    title.style.fontWeight = "700";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.textContent = String(component?.subtitle || "仅前端预览：不应用真实系统设置");
    subtitle.style.fontSize = "12px";
    subtitle.style.marginTop = "4px";
    subtitle.style.opacity = "0.8";
    titleWrap.appendChild(subtitle);
    topBar.appendChild(titleWrap);

    const dirtyIndicator = document.createElement("div");
    const hasDirty = panelState.dirtyBindingKeys.size > 0;
    dirtyIndicator.textContent = hasDirty ? `未保存变更 ${panelState.dirtyBindingKeys.size}` : "已同步";
    dirtyIndicator.style.fontSize = "12px";
    dirtyIndicator.style.padding = "6px 10px";
    dirtyIndicator.style.border = `1px solid ${hasDirty ? "#e3a33a" : "#3fbf7f"}`;
    dirtyIndicator.style.color = hasDirty ? "#ffd190" : "#9be5ba";
    topBar.appendChild(dirtyIndicator);

    host.appendChild(topBar);

    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flex = "1";
    body.style.minHeight = "0";
    host.appendChild(body);

    const nav = document.createElement("aside");
    nav.style.width = "240px";
    nav.style.display = "flex";
    nav.style.flexDirection = "column";
    nav.style.gap = "8px";
    nav.style.padding = "12px";
    nav.style.borderRight = `1px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    nav.style.background = "rgba(0,0,0,0.15)";
    body.appendChild(nav);

    for (const category of categories) {
      const categoryButton = document.createElement("button");
      const isActive = category?.id === panelState.activeCategoryId;
      categoryButton.type = "button";
      categoryButton.textContent = String(category?.label || category?.id || "未命名分类");
      categoryButton.style.height = "38px";
      categoryButton.style.borderRadius = "0";
      categoryButton.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
      categoryButton.style.background = isActive
        ? this.#resolveThemeToken(themeTokens, "colors.btnPrimaryBg", "#e5c271")
        : this.#resolveThemeToken(themeTokens, "colors.btnSecondaryBg", "#2c363a");
      categoryButton.style.color = isActive
        ? this.#resolveThemeToken(themeTokens, "colors.btnPrimaryText", "#1a2125")
        : this.#resolveThemeToken(themeTokens, "colors.btnSecondaryText", "#f3efe4");
      categoryButton.style.cursor = "pointer";
      categoryButton.style.textAlign = "left";
      categoryButton.style.padding = "0 10px";
      categoryButton.style.fontSize = "14px";
      categoryButton.dataset.categoryId = String(category?.id || "");
      categoryButton.addEventListener("click", () => {
        panelState.activeCategoryId = category?.id || null;
        panelState.searchText = "";
        rerender();
      });
      nav.appendChild(categoryButton);
    }

    const content = document.createElement("section");
    content.style.flex = "1";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.minHeight = "0";
    content.style.padding = "12px 14px";
    body.appendChild(content);

    const toolbar = document.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.alignItems = "center";
    toolbar.style.justifyContent = "space-between";
    toolbar.style.gap = "10px";
    toolbar.style.paddingBottom = "10px";

    const categoryTitle = document.createElement("div");
    categoryTitle.textContent = String(activeCategory?.label || "设置项");
    categoryTitle.style.fontSize = "20px";
    categoryTitle.style.fontWeight = "700";
    toolbar.appendChild(categoryTitle);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "搜索设置项";
    searchInput.value = panelState.searchText;
    searchInput.style.width = "220px";
    searchInput.style.height = "30px";
    searchInput.style.border = `1px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    searchInput.style.background = "rgba(0,0,0,0.2)";
    searchInput.style.color = this.#resolveThemeToken(themeTokens, "colors.textPrimary", "#f3efe4");
    searchInput.style.outline = "none";
    searchInput.style.padding = "0 8px";
    searchInput.addEventListener("input", (event) => {
      panelState.searchText = String(event.target?.value || "");
      rerender();
    });
    toolbar.appendChild(searchInput);
    content.appendChild(toolbar);

    const list = document.createElement("div");
    list.style.flex = "1";
    list.style.overflowY = "auto";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    list.style.paddingRight = "4px";
    content.appendChild(list);

    const targetScrollTop = activeCategoryId
      ? Number(panelState.categoryScrollTopById[activeCategoryId] || 0)
      : 0;

    if (activeCategoryId) {
      list.addEventListener("scroll", () => {
        panelState.categoryScrollTopById[activeCategoryId] = list.scrollTop;
      });
    }

    const rawItems = Array.isArray(activeCategory?.items) ? activeCategory.items : [];
    const keyword = panelState.searchText.trim().toLowerCase();
    const items = keyword
      ? rawItems.filter((item) => {
        const label = String(item?.label || "").toLowerCase();
        const description = String(item?.description || "").toLowerCase();
        return label.includes(keyword) || description.includes(keyword);
      })
      : rawItems;

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = keyword ? "未找到匹配项" : "当前分类暂无可展示设置项";
      empty.style.opacity = "0.8";
      empty.style.padding = "10px";
      list.appendChild(empty);
    }

    for (const item of items) {
      const bindingKey = typeof item?.binding === "string" ? item.binding.trim() : "";
      const row = document.createElement("div");
      row.style.border = `1px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
      row.style.padding = "10px";
      row.style.background = "rgba(0,0,0,0.15)";
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.gap = "8px";

      const titleLine = document.createElement("div");
      titleLine.style.display = "flex";
      titleLine.style.alignItems = "center";
      titleLine.style.justifyContent = "space-between";
      titleLine.style.gap = "10px";

      const rowTitle = document.createElement("div");
      rowTitle.textContent = String(item?.label || bindingKey || "未命名选项");
      rowTitle.style.fontSize = "15px";
      rowTitle.style.fontWeight = "700";
      titleLine.appendChild(rowTitle);

      const badgeWrap = document.createElement("div");
      badgeWrap.style.display = "flex";
      badgeWrap.style.alignItems = "center";
      badgeWrap.style.gap = "6px";

      const effectMeta = SETTINGS_EFFECT_META[item?.effect] || SETTINGS_EFFECT_META.instant;
      const effectBadge = document.createElement("span");
      effectBadge.textContent = effectMeta.label;
      effectBadge.style.fontSize = "11px";
      effectBadge.style.padding = "2px 6px";
      effectBadge.style.border = `1px solid ${effectMeta.color}`;
      effectBadge.style.color = effectMeta.color;
      badgeWrap.appendChild(effectBadge);

      if (bindingKey && panelState.dirtyBindingKeys.has(bindingKey)) {
        const dirtyBadge = document.createElement("span");
        dirtyBadge.textContent = "已修改";
        dirtyBadge.style.fontSize = "11px";
        dirtyBadge.style.padding = "2px 6px";
        dirtyBadge.style.border = "1px solid #e3a33a";
        dirtyBadge.style.color = "#ffd190";
        badgeWrap.appendChild(dirtyBadge);
      }

      titleLine.appendChild(badgeWrap);
      row.appendChild(titleLine);

      const description = document.createElement("div");
      description.textContent = String(item?.description || "");
      description.style.fontSize = "12px";
      description.style.opacity = "0.82";
      row.appendChild(description);

      row.appendChild(this.#renderSettingsControl({
        item,
        bindingKey,
        panelState,
        themeTokens,
        rerender
      }));

      list.appendChild(row);
    }

    this.#restoreSettingsListScrollAfterRender(list, targetScrollTop);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.alignItems = "center";
    footer.style.justifyContent = "space-between";
    footer.style.gap = "10px";
    footer.style.padding = "12px 14px";
    footer.style.borderTop = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    footer.style.background = this.#resolveThemeToken(themeTokens, "colors.panelBgMain", "#1a2125");

    const leftActions = document.createElement("div");
    leftActions.style.display = "flex";
    leftActions.style.gap = "8px";
    footer.appendChild(leftActions);

    leftActions.appendChild(this.#createFooterButton({
      text: "恢复本页默认",
      themeTokens,
      kind: "secondary",
      onClick: () => {
        if (!activeCategoryId) {
          return;
        }

        for (const [bindingKey, meta] of panelState.bindingMetaByKey.entries()) {
          if (meta.categoryId !== activeCategoryId) {
            continue;
          }

          panelState.values[bindingKey] = panelState.defaults[bindingKey];
        }

        this.#recomputeSettingsDirty(panelState);
        this.#openSettingsToast(panelState, "当前分类已恢复默认（仅UI）", rerender);
        rerender();
      }
    }));

    leftActions.appendChild(this.#createFooterButton({
      text: "恢复全部默认",
      themeTokens,
      kind: "secondary",
      onClick: () => {
        panelState.modal = {
          kind: "reset-all"
        };
        rerender();
      }
    }));

    const rightActions = document.createElement("div");
    rightActions.style.display = "flex";
    rightActions.style.gap = "8px";
    footer.appendChild(rightActions);

    rightActions.appendChild(this.#createFooterButton({
      text: "应用",
      themeTokens,
      kind: "primary",
      onClick: () => {
        panelState.savedValues = { ...panelState.values };
        this.#recomputeSettingsDirty(panelState);
        this.#openSettingsToast(panelState, "设置已应用（仅UI预览）", rerender);
        rerender();
      }
    }));

    rightActions.appendChild(this.#createFooterButton({
      text: "返回",
      themeTokens,
      kind: "secondary",
      onClick: () => {
        if (panelState.dirtyBindingKeys.size > 0) {
          panelState.modal = {
            kind: "leave-with-unsaved"
          };
          rerender();
          return;
        }

        this.#dispatchAction(component?.backActionId || "back", {
          source: "settingsPanel",
          pageId
        });
      }
    }));

    host.appendChild(footer);

    if (panelState.toast) {
      const toast = document.createElement("div");
      toast.textContent = panelState.toast.message;
      toast.style.position = "absolute";
      toast.style.right = "16px";
      toast.style.top = "16px";
      toast.style.padding = "8px 12px";
      toast.style.border = "1px solid #3fbf7f";
      toast.style.background = "rgba(20, 48, 34, 0.96)";
      toast.style.color = "#b8f6cc";
      toast.style.pointerEvents = "none";
      host.appendChild(toast);
    }

    if (panelState.modal) {
      host.appendChild(this.#renderSettingsModal({
        panelState,
        component,
        pageId,
        rerender
      }));
    }
  }

  #renderSettingsControl({ item, bindingKey, panelState, themeTokens, rerender }) {
    const controlType = SETTINGS_CONTROL_TYPES.has(item?.control)
      ? item.control
      : "toggle";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";

    const currentValue = bindingKey ? panelState.values[bindingKey] : null;

    if (controlType === "toggle") {
      const toggleButton = document.createElement("button");
      const enabled = Boolean(currentValue);
      toggleButton.type = "button";
      toggleButton.textContent = enabled ? "开启" : "关闭";
      toggleButton.setAttribute("aria-pressed", enabled ? "true" : "false");
      toggleButton.style.height = "32px";
      toggleButton.style.minWidth = "88px";
      toggleButton.style.borderRadius = "0";
      toggleButton.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
      toggleButton.style.background = enabled
        ? this.#resolveThemeToken(themeTokens, "colors.btnPrimaryBg", "#e5c271")
        : this.#resolveThemeToken(themeTokens, "colors.btnSecondaryBg", "#2c363a");
      toggleButton.style.color = enabled
        ? this.#resolveThemeToken(themeTokens, "colors.btnPrimaryText", "#1a2125")
        : this.#resolveThemeToken(themeTokens, "colors.btnSecondaryText", "#f3efe4");
      toggleButton.style.cursor = "pointer";
      toggleButton.addEventListener("click", () => {
        panelState.values[bindingKey] = !enabled;
        this.#recomputeSettingsDirty(panelState);
        rerender();
      });
      wrap.appendChild(toggleButton);
      return wrap;
    }

    if (controlType === "slider") {
      const min = Number.isFinite(item?.min) ? item.min : 0;
      const max = Number.isFinite(item?.max) ? item.max : 100;
      const step = Number.isFinite(item?.step) ? item.step : 1;

      const range = document.createElement("input");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(this.#normalizeSettingValue(item, currentValue));
      range.style.width = "260px";

      const valueLabel = document.createElement("span");
      valueLabel.style.minWidth = "70px";
      valueLabel.style.textAlign = "right";

      const formatValue = (value) => `${value}${item?.unit || ""}`;
      const syncSliderDraft = (nextRawValue) => {
        panelState.values[bindingKey] = this.#normalizeSettingValue(item, Number(nextRawValue ?? min));
        this.#recomputeSettingsDirty(panelState);
        valueLabel.textContent = formatValue(panelState.values[bindingKey]);
      };

      range.addEventListener("input", (event) => {
        // 拖动过程只更新草稿值与当前行显示，避免重渲染导致滑块节点重建、拖动捕获丢失。
        syncSliderDraft(event.target?.value);
      });

      range.addEventListener("change", (event) => {
        // 松手/确认后再统一重渲染，刷新全局“未保存变更”与行级状态。
        syncSliderDraft(event.target?.value);
        rerender();
      });

      wrap.appendChild(range);

      valueLabel.textContent = formatValue(panelState.values[bindingKey]);
      wrap.appendChild(valueLabel);
      return wrap;
    }

    if (controlType === "dropdown") {
      const select = document.createElement("select");
      select.style.height = "32px";
      select.style.minWidth = "220px";
      select.style.borderRadius = "0";
      select.style.border = `1px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
      select.style.background = "rgba(0,0,0,0.22)";
      select.style.color = this.#resolveThemeToken(themeTokens, "colors.textPrimary", "#f3efe4");

      const options = Array.isArray(item?.options) ? item.options : [];
      for (const option of options) {
        const optionEl = document.createElement("option");
        optionEl.value = String(option?.value ?? "");
        optionEl.textContent = String(option?.label ?? option?.value ?? "");
        optionEl.selected = String(panelState.values[bindingKey]) === optionEl.value;
        select.appendChild(optionEl);
      }

      select.addEventListener("change", (event) => {
        panelState.values[bindingKey] = this.#normalizeSettingValue(item, event.target?.value);
        this.#recomputeSettingsDirty(panelState);
        rerender();
      });

      wrap.appendChild(select);
      return wrap;
    }

    if (controlType === "stepper") {
      const min = Number.isFinite(item?.min) ? item.min : 0;
      const max = Number.isFinite(item?.max) ? item.max : 10;
      const step = Number.isFinite(item?.step) ? item.step : 1;
      const value = Number(this.#normalizeSettingValue(item, currentValue));

      const createStepButton = (label, nextValue) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.style.width = "32px";
        button.style.height = "32px";
        button.style.borderRadius = "0";
        button.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
        button.style.background = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryBg", "#2c363a");
        button.style.color = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryText", "#f3efe4");
        button.style.cursor = "pointer";
        button.addEventListener("click", () => {
          panelState.values[bindingKey] = this.#normalizeSettingValue(item, nextValue());
          this.#recomputeSettingsDirty(panelState);
          rerender();
        });
        return button;
      };

      wrap.appendChild(createStepButton("-", () => Math.max(min, value - step)));

      const valueLabel = document.createElement("span");
      valueLabel.textContent = String(value);
      valueLabel.style.display = "inline-flex";
      valueLabel.style.alignItems = "center";
      valueLabel.style.justifyContent = "center";
      valueLabel.style.minWidth = "52px";
      valueLabel.style.height = "32px";
      valueLabel.style.border = `1px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
      wrap.appendChild(valueLabel);

      wrap.appendChild(createStepButton("+", () => Math.min(max, value + step)));
      return wrap;
    }

    const keybindButton = document.createElement("button");
    keybindButton.type = "button";
    keybindButton.style.height = "32px";
    keybindButton.style.minWidth = "220px";
    keybindButton.style.borderRadius = "0";
    keybindButton.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;
    keybindButton.style.background = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryBg", "#2c363a");
    keybindButton.style.color = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryText", "#f3efe4");
    keybindButton.style.cursor = "pointer";
    const isCapturing = panelState.captureBindingKey === bindingKey;
    keybindButton.textContent = isCapturing
      ? "按任意键..."
      : String(panelState.values[bindingKey] || "未绑定");

    keybindButton.addEventListener("click", () => {
      panelState.captureBindingKey = bindingKey;
      if (typeof panelState.captureListener === "function") {
        panelState.captureListener();
      }

      const keyListener = (event) => {
        event.preventDefault();
        const keyName = String(event.key || "").toUpperCase();
        if (keyName) {
          panelState.values[bindingKey] = this.#normalizeSettingValue(item, keyName);
          this.#recomputeSettingsDirty(panelState);
          this.#openSettingsToast(panelState, `已绑定按键：${keyName}（仅UI）`, rerender);
        }

        panelState.captureBindingKey = null;
        globalThis.removeEventListener("keydown", keyListener, true);
        panelState.captureListener = null;
        rerender();
      };

      panelState.captureListener = () => {
        globalThis.removeEventListener("keydown", keyListener, true);
        panelState.captureListener = null;
      };

      globalThis.addEventListener("keydown", keyListener, true);
      rerender();
    });

    wrap.appendChild(keybindButton);
    return wrap;
  }

  #renderSettingsModal({ panelState, component, pageId, rerender }) {
    const mask = document.createElement("div");
    mask.style.position = "absolute";
    mask.style.inset = "0";
    mask.style.background = "rgba(0,0,0,0.62)";
    mask.style.display = "flex";
    mask.style.alignItems = "center";
    mask.style.justifyContent = "center";

    const dialog = document.createElement("div");
    dialog.style.width = "460px";
    dialog.style.border = "2px solid #b99a6c";
    dialog.style.background = "#1f2a2f";
    dialog.style.padding = "14px";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    dialog.style.gap = "12px";
    mask.appendChild(dialog);

    const modalKind = panelState.modal?.kind || "";
    const title = document.createElement("div");
    title.style.fontSize = "18px";
    title.style.fontWeight = "700";
    dialog.appendChild(title);

    const message = document.createElement("div");
    message.style.fontSize = "13px";
    message.style.opacity = "0.9";
    dialog.appendChild(message);

    const actionBar = document.createElement("div");
    actionBar.style.display = "flex";
    actionBar.style.justifyContent = "flex-end";
    actionBar.style.gap = "8px";
    dialog.appendChild(actionBar);

    const closeModal = () => {
      panelState.modal = null;
      rerender();
    };

    if (modalKind === "reset-all") {
      title.textContent = "恢复全部默认";
      message.textContent = "该操作将把全部分类恢复为默认值（仅影响当前设置页草稿）。";

      actionBar.appendChild(this.#createDialogButton("取消", "secondary", () => closeModal()));
      actionBar.appendChild(this.#createDialogButton("确认恢复", "danger", () => {
        for (const bindingKey of panelState.bindingMetaByKey.keys()) {
          panelState.values[bindingKey] = panelState.defaults[bindingKey];
        }

        this.#recomputeSettingsDirty(panelState);
        closeModal();
        this.#openSettingsToast(panelState, "全部设置已恢复默认（仅UI）", rerender);
      }));

      return mask;
    }

    title.textContent = "存在未保存变更";
    message.textContent = "是否先保存再返回？你也可以直接放弃本次草稿改动。";

    actionBar.appendChild(this.#createDialogButton("取消", "secondary", () => closeModal()));
    actionBar.appendChild(this.#createDialogButton("放弃并返回", "danger", () => {
      panelState.values = { ...panelState.savedValues };
      this.#recomputeSettingsDirty(panelState);
      closeModal();
      this.#dispatchAction(component?.backActionId || "back", {
        source: "settingsPanel",
        pageId,
        mode: "discard"
      });
    }));
    actionBar.appendChild(this.#createDialogButton("保存并返回", "primary", () => {
      panelState.savedValues = { ...panelState.values };
      this.#recomputeSettingsDirty(panelState);
      closeModal();
      this.#dispatchAction(component?.backActionId || "back", {
        source: "settingsPanel",
        pageId,
        mode: "save"
      });
    }));

    return mask;
  }

  #createFooterButton({ text, themeTokens, kind, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.height = "34px";
    button.style.minWidth = "124px";
    button.style.padding = "0 10px";
    button.style.borderRadius = "0";
    button.style.cursor = "pointer";
    button.style.border = `2px solid ${this.#resolveThemeToken(themeTokens, "colors.panelBorder", "#b99a6c")}`;

    if (kind === "primary") {
      button.style.background = this.#resolveThemeToken(themeTokens, "colors.btnPrimaryBg", "#e5c271");
      button.style.color = this.#resolveThemeToken(themeTokens, "colors.btnPrimaryText", "#1a2125");
    } else {
      button.style.background = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryBg", "#2c363a");
      button.style.color = this.#resolveThemeToken(themeTokens, "colors.btnSecondaryText", "#f3efe4");
    }

    button.addEventListener("click", onClick);
    return button;
  }

  #createDialogButton(text, kind, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.height = "32px";
    button.style.minWidth = "96px";
    button.style.borderRadius = "0";
    button.style.border = "1px solid #b99a6c";
    button.style.cursor = "pointer";

    if (kind === "danger") {
      button.style.background = "#8b2a2a";
      button.style.color = "#fff2f2";
    } else if (kind === "primary") {
      button.style.background = "#e5c271";
      button.style.color = "#1a2125";
    } else {
      button.style.background = "#2c363a";
      button.style.color = "#f3efe4";
    }

    button.addEventListener("click", onClick);
    return button;
  }

  #resolveThemeToken(themeTokens, tokenPath, fallbackValue) {
    const value = safeGet(themeTokens, tokenPath, fallbackValue);
    return value == null ? fallbackValue : value;
  }

  #dispatchAction(actionId, payload) {
    if (typeof this.actionDispatcher !== "function") {
      return;
    }

    if (typeof actionId !== "string" || actionId.trim() === "") {
      return;
    }

    this.actionDispatcher(actionId, {
      actionId,
      timestamp: Date.now(),
      ...payload
    });
  }

  #normalizeSettingValue(item, rawValue) {
    const controlType = SETTINGS_CONTROL_TYPES.has(item?.control)
      ? item.control
      : "toggle";

    if (controlType === "toggle") {
      return Boolean(rawValue);
    }

    if (controlType === "slider" || controlType === "stepper") {
      const min = Number.isFinite(item?.min) ? item.min : 0;
      const max = Number.isFinite(item?.max) ? item.max : 100;
      const step = Number.isFinite(item?.step) && item.step > 0 ? item.step : 1;
      const numberValue = Number.isFinite(Number(rawValue)) ? Number(rawValue) : min;
      const clamped = Math.max(min, Math.min(max, numberValue));
      const snapped = Math.round((clamped - min) / step) * step + min;
      return Number(snapped.toFixed(6));
    }

    if (controlType === "dropdown") {
      const options = Array.isArray(item?.options) ? item.options : [];
      const normalized = String(rawValue ?? "");
      if (options.some((option) => String(option?.value ?? "") === normalized)) {
        return normalized;
      }

      if (options.length > 0) {
        return String(options[0]?.value ?? "");
      }

      return normalized;
    }

    if (controlType === "keybind") {
      return this.#normalizeKeybindValue(rawValue);
    }

    return String(rawValue ?? "");
  }

  #normalizeKeybindValue(rawValue) {
    const keyValue = String(rawValue ?? "").trim();
    if (keyValue === "") {
      return "";
    }

    const normalizedUpper = keyValue.toUpperCase();
    const aliasMap = {
      ESCAPE: "ESC",
      ARROWUP: "↑",
      ARROWDOWN: "↓",
      ARROWLEFT: "←",
      ARROWRIGHT: "→",
      " ": "SPACE",
      SPACEBAR: "SPACE"
    };

    return aliasMap[normalizedUpper] || normalizedUpper;
  }

  #recomputeSettingsDirty(panelState) {
    const nextDirtySet = new Set();

    for (const bindingKey of panelState.bindingMetaByKey.keys()) {
      if (panelState.values[bindingKey] !== panelState.savedValues[bindingKey]) {
        nextDirtySet.add(bindingKey);
      }
    }

    panelState.dirtyBindingKeys = nextDirtySet;
  }

  #openSettingsToast(panelState, message, rerender) {
    panelState.toast = {
      message: String(message || "操作完成")
    };

    if (panelState.toastTimerId) {
      clearTimeout(panelState.toastTimerId);
      panelState.toastTimerId = null;
    }

    panelState.toastTimerId = setTimeout(() => {
      panelState.toast = null;
      panelState.toastTimerId = null;
      rerender();
    }, 1800);
  }

  #captureSettingsScrollBeforeRerender(host, panelState, activeCategoryId) {
    if (typeof activeCategoryId !== "string" || activeCategoryId.trim() === "") {
      return;
    }

    const existingList = this.#findSettingsScrollList(host);
    if (!existingList) {
      return;
    }

    panelState.categoryScrollTopById[activeCategoryId] = existingList.scrollTop;
  }

  #findSettingsScrollList(host) {
    const candidates = host.querySelectorAll("div");
    for (const element of candidates) {
      if (element?.style?.overflowY === "auto") {
        return element;
      }
    }

    return null;
  }

  #restoreSettingsListScrollAfterRender(list, scrollTopValue) {
    const target = Number(scrollTopValue || 0);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }

    const applyScroll = () => {
      list.scrollTop = target;
    };

    applyScroll();

    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => {
        applyScroll();
      });
      return;
    }

    setTimeout(() => {
      applyScroll();
    }, 0);
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
