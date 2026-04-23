import { ValidatorCode } from "../utils/app-codes.mjs";
import { CommonError, assert, safeGet } from "../utils/flow-common.mjs";

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
   * @returns {FlowValidationReport}
   */
  validate() {
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
    }

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
   * @returns {FlowValidationReport}
   */
  assertValid() {
    const report = this.validate();
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

  #assertReady() {
    assert(this.flowService, ValidatorCode.NOT_READY, "flowService is required");
    assert(this.registryService, ValidatorCode.NOT_READY, "registryService is required");
    assert(this.flowService.isLoaded(), ValidatorCode.NOT_READY, "flowService must be loaded");
    assert(this.registryService.isLoaded(), ValidatorCode.NOT_READY, "registryService must be loaded");
  }
}