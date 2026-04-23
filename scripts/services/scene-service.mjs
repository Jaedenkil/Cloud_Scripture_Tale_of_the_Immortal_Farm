import { safeReadYamlFile } from "../utils/read-yaml.mjs";
import { SceneCode } from "../utils/app-codes.mjs";
import { CommonError, assert, ensureObject, safeGet } from "../utils/flow-common.mjs";

/**
 * @typedef {object} SceneServiceSnapshot
 * @property {boolean} loaded
 * @property {string|null} themePath
 * @property {number} cacheSize
 * @property {string[]} cachedPageIds
 */

/**
 * @typedef {object} SceneRenderSnapshot
 * @property {string} nodeId
 * @property {string} pageId
 * @property {string} resolvedPageId
 * @property {string} scenePath
 * @property {Record<string, any>} scene
 * @property {Record<string, any>} themeTokens
 * @property {number} loadedAtMs
 */

/**
 * SceneService: load and validate scene yaml from node/page lookups.
 */
export class SceneService {
  /**
   * @param {object} options
   * @param {import('./registry-service.mjs').RegistryService} options.registryService
   * @param {import('./flow-service.mjs').FlowService} options.flowService
   * @param {string} [options.themePath]
   */
  constructor(options = {}) {
    this.registryService = options.registryService || null;
    this.flowService = options.flowService || null;
    this.themePath = options.themePath || null;

    this.themeTokens = {};
    this.sceneCache = new Map();
    this.loaded = false;
  }

  /**
   * Load theme from yaml file path.
   *
   * @param {string} [themePath=this.themePath]
   * @returns {Promise<{themePath:string, tokenCount:number}>}
   */
  async loadTheme(themePath = this.themePath) {
    assert(typeof themePath === "string" && themePath.trim() !== "", SceneCode.THEME_NOT_LOADED, "themePath is required", {
      themePath
    });

    const readResult = await safeReadYamlFile(themePath, { expectedType: "object" });
    if (!readResult.ok) {
      throw new CommonError(readResult.code, readResult.message, {
        ...readResult.details,
        themePath
      });
    }

    const root = ensureObject(readResult.data, "theme root");
    const tokens = ensureObject(safeGet(root, "tokens", root), "theme tokens");

    this.themePath = readResult.filePath;
    this.themeTokens = tokens;
    this.loaded = true;

    return {
      themePath: this.themePath,
      tokenCount: Object.keys(this.themeTokens).length
    };
  }

  /**
   * Load scene by page id or alias.
   *
   * @param {string} pageIdOrAlias
   * @returns {Promise<SceneRenderSnapshot>}
   */
  async loadSceneByPageId(pageIdOrAlias) {
    this.#assertReady();

    const resolvedPageId = this.registryService.resolvePageId(pageIdOrAlias);

    if (this.sceneCache.has(resolvedPageId)) {
      return this.sceneCache.get(resolvedPageId);
    }

    const page = this.registryService.getPage(resolvedPageId);
    const scenePath = this.registryService.getScenePathByPageId(resolvedPageId);

    const readResult = await safeReadYamlFile(scenePath, { expectedType: "object" });
    if (!readResult.ok) {
      throw new CommonError(readResult.code, readResult.message, {
        ...readResult.details,
        scenePath,
        resolvedPageId
      });
    }

    const scene = ensureObject(readResult.data, "scene root");
    this.validateScene(scene, {
      scenePath,
      resolvedPageId
    });

    const snapshot = {
      nodeId: "",
      pageId: page.id,
      resolvedPageId,
      scenePath,
      scene,
      themeTokens: { ...this.themeTokens },
      loadedAtMs: Date.now()
    };

    this.sceneCache.set(resolvedPageId, snapshot);
    return snapshot;
  }

  /**
   * Load scene by node id.
   *
   * @param {string} nodeId
   * @returns {Promise<SceneRenderSnapshot>}
   */
  async loadSceneByNodeId(nodeId) {
    this.#assertReady();

    assert(this.flowService.hasNode(nodeId), SceneCode.NODE_NOT_FOUND, "flow node not found", {
      nodeId
    });

    const node = this.flowService.getNode(nodeId);
    const pageId = safeGet(node, "pageId", null);

    assert(typeof pageId === "string" && pageId.trim() !== "", SceneCode.PAGE_NOT_FOUND, "node.pageId is required", {
      nodeId
    });

    const sceneSnapshot = await this.loadSceneByPageId(pageId);

    return {
      ...sceneSnapshot,
      nodeId
    };
  }

  /**
   * Validate minimal scene structure for renderer.
   *
   * @param {any} scene
   * @param {object} [context]
   */
  validateScene(scene, context = {}) {
    const root = ensureObject(scene, "scene root");

    const page = ensureObject(safeGet(root, "page", null), "scene.page");
    assert(typeof safeGet(page, "id", null) === "string", SceneCode.INVALID_SCENE, "scene.page.id is required", {
      ...context
    });

    const layers = safeGet(root, "layers", []);
    const components = safeGet(root, "components", []);

    assert(Array.isArray(layers), SceneCode.INVALID_SCENE, "scene.layers must be an array", {
      ...context
    });

    assert(Array.isArray(components), SceneCode.INVALID_COMPONENTS, "scene.components must be an array", {
      ...context
    });
  }

  /**
   * Get cached scene by page id or alias.
   *
   * @param {string} pageIdOrAlias
   * @returns {SceneRenderSnapshot|null}
   */
  getCachedScene(pageIdOrAlias) {
    this.#assertReady();

    const resolvedPageId = this.registryService.resolvePageId(pageIdOrAlias);
    return this.sceneCache.get(resolvedPageId) || null;
  }

  /**
   * Clear all cached scenes.
   */
  clearCache() {
    this.sceneCache.clear();
  }

  /**
   * Return service snapshot.
   *
   * @returns {SceneServiceSnapshot}
   */
  getSnapshot() {
    return {
      loaded: this.loaded,
      themePath: this.themePath,
      cacheSize: this.sceneCache.size,
      cachedPageIds: [...this.sceneCache.keys()]
    };
  }

  #assertReady() {
    assert(this.registryService, SceneCode.NOT_LOADED, "registryService is required");
    assert(this.flowService, SceneCode.NOT_LOADED, "flowService is required");
    assert(this.loaded, SceneCode.THEME_NOT_LOADED, "SceneService theme is not loaded");
  }
}
