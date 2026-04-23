import { safeReadYamlFile } from "../utils/read-yaml.mjs";
import {
  CommonError,
  assert,
  createMapById,
  ensureObject,
  normalizePageId,
  pickTimerTransitions,
  pickTransitionByAction,
  safeGet
} from "../utils/flow-common.mjs";
import { FlowCode } from "../utils/app-codes.mjs";

/**
 * @typedef {object} FlowServiceSnapshot
 * @property {boolean} loaded
 * @property {string|null} sourcePath
 * @property {string|null} flowId
 * @property {number|null} version
 * @property {string|null} entryNodeId
 * @property {number} nodeCount
 * @property {number} presetCount
 */

/**
 * FlowService: manage ui-flow loading and node/transition lookup.
 */
export class FlowService {
  /**
   * @param {object} [options]
   * @param {string} [options.flowPath]
   */
  constructor(options = {}) {
    this.flowPath = options.flowPath || null;
    this.loaded = false;
    this.sourcePath = null;
    this.rawFlow = null;
    this.flowMeta = null;
    this.nodeMap = new Map();
    this.transitionPresetMap = new Map();
    this.entryNodeId = null;
  }

  /**
   * Load flow from yaml file path.
   *
   * @param {string} [flowPath=this.flowPath]
   * @returns {Promise<FlowServiceSnapshot>}
   */
  async loadFlow(flowPath = this.flowPath) {
    assert(typeof flowPath === "string" && flowPath.trim() !== "", FlowCode.INVALID_ROOT, "flowPath is required", {
      flowPath
    });

    const readResult = await safeReadYamlFile(flowPath, { expectedType: "object" });
    if (!readResult.ok) {
      throw new CommonError(readResult.code, readResult.message, {
        ...readResult.details,
        flowPath
      });
    }

    this.sourcePath = readResult.filePath;
    return this.loadFromData(readResult.data, readResult.filePath);
  }

  /**
   * Load flow from object data.
   *
   * @param {any} flowData
   * @param {string} [sourcePath="memory"]
   * @returns {FlowServiceSnapshot}
   */
  loadFromData(flowData, sourcePath = "memory") {
    const root = ensureObject(flowData, "flow root");

    const flowMeta = ensureObject(safeGet(root, "flow", null), "flow meta");
    const entryNodeId = normalizePageId(safeGet(flowMeta, "entry", ""));

    const nodes = safeGet(root, "nodes", []);
    assert(Array.isArray(nodes), FlowCode.INVALID_NODES, "flow.nodes must be an array", {
      actualType: typeof nodes
    });

    const nodeMap = createMapById(nodes, {
      name: "flow.nodes",
      idField: "id",
      normalizeId: normalizePageId
    });

    assert(nodeMap.size > 0, FlowCode.INVALID_NODES, "flow.nodes cannot be empty");
    assert(nodeMap.has(entryNodeId), FlowCode.ENTRY_NOT_FOUND, "flow.entry node does not exist", {
      entryNodeId
    });

    for (const node of nodeMap.values()) {
      const transitions = safeGet(node, "transitions", []);
      assert(Array.isArray(transitions), FlowCode.INVALID_TRANSITIONS, "node.transitions must be an array", {
        nodeId: node.id
      });

      for (const transition of transitions) {
        if (transition == null || typeof transition !== "object") {
          continue;
        }

        const toNodeId = safeGet(transition, "to", null);
        if (typeof toNodeId !== "string") {
          continue;
        }

        const normalizedToNodeId = normalizePageId(toNodeId);
        assert(nodeMap.has(normalizedToNodeId), FlowCode.INVALID_TRANSITION_TARGET, "transition target node not found", {
          nodeId: node.id,
          transitionId: transition.id,
          to: toNodeId
        });
      }
    }

    const presets = ensureObject(safeGet(root, "transitionPresets", {}), "transitionPresets");
    const transitionPresetMap = new Map();
    for (const [name, preset] of Object.entries(presets)) {
      transitionPresetMap.set(name, ensureObject(preset, `transitionPresets.${name}`));
    }

    this.rawFlow = root;
    this.flowMeta = flowMeta;
    this.nodeMap = nodeMap;
    this.transitionPresetMap = transitionPresetMap;
    this.entryNodeId = entryNodeId;
    this.sourcePath = sourcePath;
    this.loaded = true;

    return this.getSnapshot();
  }

  /**
   * Whether flow has been loaded.
   *
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Returns service snapshot with stable return shape.
   *
   * @returns {FlowServiceSnapshot}
   */
  getSnapshot() {
    return {
      loaded: this.loaded,
      sourcePath: this.sourcePath,
      flowId: this.flowMeta ? safeGet(this.flowMeta, "id", null) : null,
      version: this.flowMeta ? safeGet(this.flowMeta, "version", null) : null,
      entryNodeId: this.entryNodeId,
      nodeCount: this.nodeMap.size,
      presetCount: this.transitionPresetMap.size
    };
  }

  /**
   * Get flow entry node id.
   *
   * @returns {string}
   */
  getEntryNodeId() {
    this.#assertLoaded();
    return this.entryNodeId;
  }

  /**
   * Get node by id.
   *
   * @param {string} nodeId
   * @returns {Record<string, any>}
   */
  getNode(nodeId) {
    this.#assertLoaded();

    const normalizedNodeId = normalizePageId(nodeId);
    assert(this.nodeMap.has(normalizedNodeId), FlowCode.NODE_NOT_FOUND, "flow node not found", {
      nodeId,
      normalizedNodeId
    });

    return this.nodeMap.get(normalizedNodeId);
  }

  /**
   * Check node existence.
   *
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasNode(nodeId) {
    this.#assertLoaded();

    try {
      return this.nodeMap.has(normalizePageId(nodeId));
    } catch {
      return false;
    }
  }

  /**
   * Get transitions from a node.
   *
   * @param {string} nodeId
   * @returns {Array<Record<string, any>>}
   */
  getTransitions(nodeId) {
    const node = this.getNode(nodeId);
    const transitions = safeGet(node, "transitions", []);

    assert(Array.isArray(transitions), FlowCode.INVALID_TRANSITIONS, "node.transitions must be an array", {
      nodeId
    });

    return transitions;
  }

  /**
   * Find transition for a ui action under a node.
   *
   * @param {string} nodeId
   * @param {string} actionId
   * @returns {Record<string, any>|null}
   */
  findTransitionByAction(nodeId, actionId) {
    const transitions = this.getTransitions(nodeId);
    const transition = pickTransitionByAction(transitions, actionId);

    if (!transition) {
      return null;
    }

    const toNodeId = normalizePageId(safeGet(transition, "to", ""));
    assert(this.nodeMap.has(toNodeId), FlowCode.INVALID_TRANSITION_TARGET, "action transition target node not found", {
      nodeId,
      actionId,
      transitionId: transition.id,
      toNodeId
    });

    return transition;
  }

  /**
   * Return valid timer transitions for a node.
   *
   * @param {string} nodeId
   * @returns {Array<Record<string, any>>}
   */
  getTimerTransitions(nodeId) {
    const transitions = this.getTransitions(nodeId);
    return pickTimerTransitions(transitions);
  }

  /**
   * Get fallback node id of a node.
   *
   * @param {string} nodeId
   * @returns {string|null}
   */
  getFallbackNodeId(nodeId) {
    const node = this.getNode(nodeId);
    const fallbackNodeId = safeGet(node, "fallback", null);

    if (fallbackNodeId == null) {
      return null;
    }

    const normalizedFallbackNodeId = normalizePageId(fallbackNodeId);
    assert(this.nodeMap.has(normalizedFallbackNodeId), FlowCode.INVALID_TRANSITION_TARGET, "fallback node not found", {
      nodeId,
      fallbackNodeId
    });

    return normalizedFallbackNodeId;
  }

  /**
   * Resolve transition preset by name.
   *
   * @param {string} presetName
   * @returns {Record<string, any>}
   */
  getTransitionPreset(presetName) {
    this.#assertLoaded();

    assert(typeof presetName === "string" && presetName.trim() !== "", FlowCode.TRANSITION_PRESET_NOT_FOUND, "presetName is required", {
      presetName
    });

    assert(this.transitionPresetMap.has(presetName), FlowCode.TRANSITION_PRESET_NOT_FOUND, "transition preset not found", {
      presetName
    });

    return this.transitionPresetMap.get(presetName);
  }

  /**
   * Resolve transition config from inline object or preset string.
   *
   * @param {string|Record<string, any>|undefined|null} transitionConfig
   * @returns {Record<string, any>|null}
   */
  resolveTransitionConfig(transitionConfig) {
    this.#assertLoaded();

    if (transitionConfig == null) {
      return null;
    }

    if (typeof transitionConfig === "string") {
      return this.getTransitionPreset(transitionConfig);
    }

    return ensureObject(transitionConfig, "transition config");
  }

  /**
   * Return all node configs.
   *
   * @returns {Array<Record<string, any>>}
   */
  listNodes() {
    this.#assertLoaded();
    return [...this.nodeMap.values()];
  }

  #assertLoaded() {
    assert(this.loaded, FlowCode.NOT_LOADED, "FlowService is not loaded");
  }
}
