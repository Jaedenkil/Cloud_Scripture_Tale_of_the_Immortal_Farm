import { ValidatorCode } from "../utils/app-codes.mjs";
import { safeReadYamlFile } from "../utils/read-yaml.mjs";
import { CommonError, assert, safeGet } from "../utils/flow-common.mjs";

const DOMAIN_DEPTH_RANGES = Object.freeze({
  world: Object.freeze([0, 999]),
  hud: Object.freeze([1000, 1999]),
  panel: Object.freeze([2000, 2999]),
  system: Object.freeze([3000, 3999])
});

const INPUT_POLICIES = new Set(["passthrough", "capture", "block"]);
const CONTAINER_COMPONENT_TYPES = new Set(["stack", "panel", "rectangle"]);
const BINDING_REQUIRED_COMPONENT_TYPES = new Set(["dynamicText", "slider", "toggle", "dropdown"]);
const INTERACTIVE_COMPONENT_TYPES = new Set(["button", "slider", "toggle", "dropdown"]);

/**
 * @typedef {object} FlowValidationIssue
 * @property {string} code
 * @property {string} message
 * @property {Record<string, any>} details
 */

/**
 * @typedef {object} FlowValidationReport
 * @property {boolean} ok
 * @property {string|null} entryNodeId
 * @property {number} checkedNodeCount
 * @property {FlowValidationIssue[]} issues
 */

/**
 * FlowValidator: minimal validation gate before starting FlowRuntime.
 */
export class FlowValidator {
  /**
   * @param {object} options
   * @param {import('./flow-service.mjs').FlowService} options.flowService
   * @param {import('./registry-service.mjs').RegistryService} options.registryService
   */
  constructor(options = {}) {
    this.flowService = options.flowService || null;
    this.registryService = options.registryService || null;
  }

  /**
   * Validate entry and node-page mappings.
   *
   * @returns {Promise<FlowValidationReport>}
   */
  async validate() {
    this.#assertReady();

    const issues = [];
    let entryNodeId = null;

    try {
      entryNodeId = this.flowService.getEntryNodeId();
      if (!this.flowService.hasNode(entryNodeId)) {
        issues.push({
          code: ValidatorCode.ENTRY_NOT_FOUND,
          message: "flow entry node not found",
          details: { entryNodeId }
        });
      }
    } catch (error) {
      issues.push({
        code: ValidatorCode.ENTRY_NOT_FOUND,
        message: error?.message || "flow entry node not found",
        details: { errorName: error?.name }
      });
    }

    const nodes = this.flowService.listNodes();
    for (const node of nodes) {
      const nodeId = safeGet(node, "id", null);
      if (typeof nodeId !== "string" || !this.flowService.hasNode(nodeId)) {
        issues.push({
          code: ValidatorCode.NODE_NOT_FOUND,
          message: "flow node missing or invalid",
          details: { nodeId }
        });
        continue;
      }

      const pageId = safeGet(node, "pageId", null);
      try {
        this.registryService.resolvePageId(pageId);
      } catch (error) {
        issues.push({
          code: ValidatorCode.PAGE_NOT_FOUND,
          message: error?.message || "registry pageId not found for node",
          details: {
            nodeId,
            pageId
          }
        });
      }

      const transitions = safeGet(node, "transitions", []);
      const hasTransitions = Array.isArray(transitions) && transitions.length > 0;
      const fallbackNodeId = safeGet(node, "fallback", null);
      const hasFallback = typeof fallbackNodeId === "string" && fallbackNodeId.trim() !== "";

      if (!hasTransitions && !hasFallback) {
        issues.push({
          code: ValidatorCode.NODE_NOT_FOUND,
          message: "flow node must have transitions or fallback",
          details: { nodeId }
        });
      }
    }

    await this.#validateScenes(issues);

    return {
      ok: issues.length === 0,
      entryNodeId,
      checkedNodeCount: nodes.length,
      issues
    };
  }

  /**
   * Validate and throw when invalid.
   *
   * @returns {Promise<FlowValidationReport>}
   */
  async assertValid() {
    const report = await this.validate();
    if (!report.ok) {
      const firstIssue = report.issues[0] || {
        code: ValidatorCode.VALIDATION_FAILED,
        message: "Flow validation failed",
        details: {}
      };

      throw new CommonError(firstIssue.code, firstIssue.message, {
        ...firstIssue.details,
        issues: report.issues
      });
    }

    return report;
  }

  async #validateScenes(issues) {
    const pages = this.registryService.listPages();

    for (const page of pages) {
      const pageId = safeGet(page, "id", null);
      const pageDomain = safeGet(page, "domain", null);
      const scenePath = safeGet(page, "scenePath", null);

      if (typeof scenePath !== "string" || scenePath.trim() === "") {
        issues.push({
          code: ValidatorCode.SCENE_NOT_FOUND,
          message: "registry scenePath is required",
          details: { pageId, scenePath }
        });
        continue;
      }

      const readResult = await safeReadYamlFile(scenePath, { expectedType: "object" });
      if (!readResult.ok) {
        issues.push({
          code: ValidatorCode.SCENE_NOT_FOUND,
          message: readResult.message || "scene file not found or invalid",
          details: {
            pageId,
            pageDomain,
            scenePath,
            sourceCode: readResult.code
          }
        });
        continue;
      }

      const scene = safeGet(readResult, "data", null);
      this.#validateSceneStructure({
        scene,
        pageId,
        pageDomain,
        scenePath: readResult.filePath || scenePath,
        issues
      });
    }
  }

  #validateSceneStructure({ scene, pageId, pageDomain, scenePath, issues }) {
    const page = safeGet(scene, "page", null);
    const layers = safeGet(scene, "layers", []);
    const components = safeGet(scene, "components", []);

    if (!page || typeof page !== "object") {
      issues.push({
        code: ValidatorCode.SCENE_INVALID,
        message: "scene.page must be an object",
        details: { pageId, scenePath }
      });
      return;
    }

    if (!Array.isArray(layers)) {
      issues.push({
        code: ValidatorCode.SCENE_INVALID,
        message: "scene.layers must be an array",
        details: { pageId, scenePath }
      });
      return;
    }

    if (!Array.isArray(components)) {
      issues.push({
        code: ValidatorCode.SCENE_INVALID,
        message: "scene.components must be an array",
        details: { pageId, scenePath }
      });
      return;
    }

    const sceneDomain = safeGet(page, "domain", null);
    if (sceneDomain !== pageDomain) {
      issues.push({
        code: ValidatorCode.DOMAIN_INVALID,
        message: "scene.page.domain must match registry.page.domain",
        details: { pageId, pageDomain, sceneDomain, scenePath }
      });
    }

    const domainRange = DOMAIN_DEPTH_RANGES[sceneDomain];
    if (!domainRange) {
      issues.push({
        code: ValidatorCode.DOMAIN_INVALID,
        message: "scene.page.domain is invalid",
        details: { pageId, sceneDomain, scenePath }
      });
      return;
    }

    const [minDepth, maxDepth] = domainRange;
    const layerIds = new Set();
    const layerInputPolicyById = new Map();
    for (const layer of layers) {
      const layerId = safeGet(layer, "id", null);
      const depth = safeGet(layer, "depth", null);
      const inputPolicy = safeGet(layer, "inputPolicy", null);

      if (typeof layerId !== "string" || layerId.trim() === "") {
        issues.push({
          code: ValidatorCode.SCENE_INVALID,
          message: "layer.id is required",
          details: { pageId, scenePath }
        });
        continue;
      }

      layerIds.add(layerId);
      layerInputPolicyById.set(layerId, inputPolicy == null ? "passthrough" : inputPolicy);

      if (!Number.isFinite(depth)) {
        issues.push({
          code: ValidatorCode.SCENE_INVALID,
          message: "layer.depth must be a finite number",
          details: { pageId, layerId, depth, scenePath }
        });
      } else if (depth < minDepth || depth > maxDepth) {
        issues.push({
          code: ValidatorCode.DEPTH_OUT_OF_RANGE,
          message: "layer.depth out of domain range",
          details: {
            pageId,
            layerId,
            sceneDomain,
            depth,
            minDepth,
            maxDepth,
            scenePath
          }
        });
      }

      if (inputPolicy != null && !INPUT_POLICIES.has(inputPolicy)) {
        issues.push({
          code: ValidatorCode.SCENE_INVALID,
          message: "layer.inputPolicy must be passthrough/capture/block",
          details: { pageId, layerId, inputPolicy, scenePath }
        });
      }
    }

    for (const component of components) {
      const componentId = safeGet(component, "id", null);
      const componentType = safeGet(component, "type", null);
      const layerId = safeGet(component, "layer", null);

      if (typeof layerId !== "string" || !layerIds.has(layerId)) {
        issues.push({
          code: ValidatorCode.LAYER_NOT_FOUND,
          message: "component layer not found",
          details: { pageId, componentId, layerId, scenePath }
        });
      } else if (INTERACTIVE_COMPONENT_TYPES.has(componentType)) {
        const layerInputPolicy = layerInputPolicyById.get(layerId) || "passthrough";
        if (layerInputPolicy === "passthrough") {
          issues.push({
            code: ValidatorCode.SCENE_INVALID,
            message: "interactive component cannot be placed on passthrough layer",
            details: {
              pageId,
              componentId,
              componentType,
              layerId,
              layerInputPolicy,
              scenePath
            }
          });
        }
      }

      if (componentType === "button") {
        const text = safeGet(component, "text", null);
        const binding = safeGet(component, "binding", null);
        const actionId = safeGet(component, "actionId", null);
        const eventId = safeGet(component, "eventId", null);
        const hasTextOrBinding =
          (typeof text === "string" && text.trim() !== "") ||
          (typeof binding === "string" && binding.trim() !== "");
        const hasActionOrEvent =
          (typeof actionId === "string" && actionId.trim() !== "") ||
          (typeof eventId === "string" && eventId.trim() !== "");

        if (!hasTextOrBinding || !hasActionOrEvent) {
          issues.push({
            code: ValidatorCode.SCENE_INVALID,
            message: "button must have text|binding and actionId|eventId",
            details: { pageId, componentId, scenePath }
          });
        }
      }

      if (BINDING_REQUIRED_COMPONENT_TYPES.has(componentType)) {
        const binding = safeGet(component, "binding", null);
        if (!(typeof binding === "string" && binding.trim() !== "")) {
          issues.push({
            code: ValidatorCode.SCENE_INVALID,
            message: `${componentType} requires binding`,
            details: { pageId, componentId, scenePath }
          });
        }
      }

      const children = safeGet(component, "children", null);
      if (children != null && !CONTAINER_COMPONENT_TYPES.has(componentType)) {
        issues.push({
          code: ValidatorCode.SCENE_INVALID,
          message: "children is only allowed on container components",
          details: { pageId, componentId, componentType, scenePath }
        });
      }
    }
  }

  #assertReady() {
    assert(this.flowService, ValidatorCode.NOT_READY, "flowService is required");
    assert(this.registryService, ValidatorCode.NOT_READY, "registryService is required");
    assert(this.flowService.isLoaded(), ValidatorCode.NOT_READY, "flowService must be loaded");
    assert(this.registryService.isLoaded(), ValidatorCode.NOT_READY, "registryService must be loaded");
  }
}