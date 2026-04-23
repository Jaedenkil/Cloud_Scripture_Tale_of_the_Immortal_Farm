import { safeReadYamlFile } from "../utils/read-yaml.mjs";
import {
  CommonError,
  assert,
  createMapById,
  ensureObject,
  normalizePageId,
  resolveAlias,
  safeGet
} from "../utils/flow-common.mjs";
import { RegistryCode } from "../utils/app-codes.mjs";

/**
 * @typedef {object} RegistryServiceSnapshot
 * @property {boolean} loaded
 * @property {string|null} sourcePath
 * @property {number} pageCount
 * @property {number} aliasCount
 * @property {string[]} pageIds
 * @property {Record<string, string>} aliases
 * @property {Record<string, any>} defaults
 */

/**
 * RegistryService: manage ui-registry loading and page/alias resolution.
 */
export class RegistryService {
  /**
   * @param {object} [options]
   * @param {string} [options.registryPath]
   */
  constructor(options = {}) {
    this.registryPath = options.registryPath || null;
    this.loaded = false;
    this.sourcePath = null;
    this.rawRegistry = null;
    this.pageMap = new Map();
    this.aliasMap = new Map();
    this.defaults = {};
  }

  /**
   * Load registry from yaml file path.
   *
   * @param {string} [registryPath=this.registryPath]
   * @returns {Promise<RegistryServiceSnapshot>}
   */
  async loadRegistry(registryPath = this.registryPath) {
    assert(typeof registryPath === "string" && registryPath.trim() !== "", RegistryCode.INVALID_ROOT, "registryPath is required", {
      registryPath
    });

    const readResult = await safeReadYamlFile(registryPath, { expectedType: "object" });
    if (!readResult.ok) {
      throw new CommonError(readResult.code, readResult.message, {
        ...readResult.details,
        registryPath
      });
    }

    this.sourcePath = readResult.filePath;
    return this.loadFromData(readResult.data, readResult.filePath);
  }

  /**
   * Load registry from object data.
   *
   * @param {any} registryData
   * @param {string} [sourcePath="memory"]
   * @returns {RegistryServiceSnapshot}
   */
  loadFromData(registryData, sourcePath = "memory") {
    const root = ensureObject(registryData, "registry root");

    const pages = safeGet(root, "pages", []);
    assert(Array.isArray(pages), RegistryCode.INVALID_PAGES, "registry.pages must be an array", {
      actualType: typeof pages
    });

    const pageMap = createMapById(pages, {
      name: "registry.pages",
      idField: "id",
      normalizeId: normalizePageId
    });

    const aliasesObject = safeGet(root, "aliases", {});
    ensureObject(aliasesObject, "registry aliases");

    const aliasEntries = Object.entries(aliasesObject);
    const aliasMap = new Map();
    for (const [rawAlias, rawTarget] of aliasEntries) {
      const aliasId = normalizePageId(rawAlias);
      const targetId = normalizePageId(rawTarget);
      aliasMap.set(aliasId, targetId);
    }

    this.rawRegistry = root;
    this.pageMap = pageMap;
    this.aliasMap = aliasMap;
    this.defaults = ensureObject(safeGet(root, "defaults", {}), "registry defaults");
    this.sourcePath = sourcePath;
    this.loaded = true;

    return this.getSnapshot();
  }

  /**
   * Whether registry has been loaded.
   *
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Returns service snapshot with stable return shape.
   *
   * @returns {RegistryServiceSnapshot}
   */
  getSnapshot() {
    return {
      loaded: this.loaded,
      sourcePath: this.sourcePath,
      pageCount: this.pageMap.size,
      aliasCount: this.aliasMap.size,
      pageIds: [...this.pageMap.keys()],
      aliases: Object.fromEntries(this.aliasMap.entries()),
      defaults: { ...this.defaults }
    };
  }

  /**
   * Resolve page id or alias into canonical page id.
   *
   * @param {string} pageIdOrAlias
   * @returns {string}
   */
  resolvePageId(pageIdOrAlias) {
    this.#assertLoaded();

    const resolvedPageId = resolveAlias(pageIdOrAlias, this.aliasMap);
    assert(this.pageMap.has(resolvedPageId), RegistryCode.PAGE_NOT_FOUND, "registry pageId not found", {
      pageIdOrAlias,
      resolvedPageId
    });

    return resolvedPageId;
  }

  /**
   * Check if page id or alias exists.
   *
   * @param {string} pageIdOrAlias
   * @returns {boolean}
   */
  hasPage(pageIdOrAlias) {
    this.#assertLoaded();

    try {
      const resolvedPageId = resolveAlias(pageIdOrAlias, this.aliasMap);
      return this.pageMap.has(resolvedPageId);
    } catch {
      return false;
    }
  }

  /**
   * Get page config by page id or alias.
   *
   * @param {string} pageIdOrAlias
   * @returns {Record<string, any>}
   */
  getPage(pageIdOrAlias) {
    const resolvedPageId = this.resolvePageId(pageIdOrAlias);
    return this.pageMap.get(resolvedPageId);
  }

  /**
   * Get scene path by page id or alias.
   *
   * @param {string} pageIdOrAlias
   * @returns {string}
   */
  getScenePathByPageId(pageIdOrAlias) {
    const page = this.getPage(pageIdOrAlias);
    const scenePath = safeGet(page, "scenePath", null);

    assert(typeof scenePath === "string" && scenePath.trim() !== "", RegistryCode.SCENE_PATH_MISSING, "registry scenePath is missing", {
      pageIdOrAlias,
      pageId: page.id
    });

    return scenePath;
  }

  /**
   * Return all page configs.
   *
   * @returns {Array<Record<string, any>>}
   */
  listPages() {
    this.#assertLoaded();
    return [...this.pageMap.values()];
  }

  /**
   * Return all aliases.
   *
   * @returns {Record<string, string>}
   */
  listAliases() {
    this.#assertLoaded();
    return Object.fromEntries(this.aliasMap.entries());
  }

  /**
   * Return registry defaults.
   *
   * @returns {Record<string, any>}
   */
  getDefaults() {
    this.#assertLoaded();
    return { ...this.defaults };
  }

  #assertLoaded() {
    assert(this.loaded, RegistryCode.NOT_LOADED, "RegistryService is not loaded");
  }
}
