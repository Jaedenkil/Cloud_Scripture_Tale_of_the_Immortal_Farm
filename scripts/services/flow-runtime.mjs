import { RuntimeCode } from "../utils/app-codes.mjs";
import { assert, normalizePageId, safeGet } from "../utils/flow-common.mjs";

/**
 * @typedef {object} FlowRuntimeSnapshot
 * @property {boolean} initialized
 * @property {boolean} started
 * @property {string} actionChannel
 * @property {string} systemBlockChannel
 * @property {string} systemUnblockChannel
 * @property {string|null} currentNodeId
 * @property {string|null} currentPageId
 * @property {string[]} history
 * @property {number} activeTimerCount
 * @property {{trigger:string, fromNodeId:string|null, toNodeId:string|null, transitionId:string|null, actionId:string|null, timestamp:number}|null} lastTransition
 */

/**
 * FlowRuntime: minimal orchestration runtime for flow/action/timer transitions.
 */
export class FlowRuntime {
  /**
   * @param {object} options
   * @param {import('./flow-service.mjs').FlowService} options.flowService
   * @param {import('./scene-service.mjs').SceneService} options.sceneService
   * @param {import('./ui-renderer.mjs').UIRenderer} options.renderer
   * @param {import('./action-bus.mjs').ActionBus} options.actionBus
   * @param {{execute:(actionId:string, context?:any)=>Promise<{handled:boolean,nextNodeId:string|null}>}} [options.actionExecutor]
   * @param {string} [options.actionChannel="ui.action"]
  * @param {string} [options.systemBlockChannel="system.blockInput"]
  * @param {string} [options.systemUnblockChannel="system.unblockInput"]
   */
  constructor(options = {}) {
    this.flowService = options.flowService || null;
    this.sceneService = options.sceneService || null;
    this.renderer = options.renderer || null;
    this.actionBus = options.actionBus || null;
    this.actionExecutor = options.actionExecutor || null;
    this.actionChannel = options.actionChannel || "ui.action";
    this.systemBlockChannel = options.systemBlockChannel || "system.blockInput";
    this.systemUnblockChannel = options.systemUnblockChannel || "system.unblockInput";

    this.initialized = false;
    this.started = false;
    this.currentNodeId = null;
    this.currentPageId = null;
    this.history = [];
    this.timerIds = new Set();
    this.offAction = null;
    this.offSystemBlock = null;
    this.offSystemUnblock = null;
    this.lastTransition = null;
  }

  /**
   * Initialize runtime and subscribe action channel.
   */
  async init() {
    this.#assertReady();

    if (this.offAction) {
      this.offAction();
      this.offAction = null;
    }

    this.offAction = this.actionBus.on(this.actionChannel, (payload) => {
      const actionId = typeof payload === "string"
        ? payload
        : safeGet(payload, "actionId", null);

      if (typeof actionId !== "string" || actionId.trim() === "") {
        return;
      }

      void this.handleAction(actionId, payload);
    });

    this.offSystemBlock = this.actionBus.on(this.systemBlockChannel, () => {
      if (typeof this.renderer.setInputBlocker === "function") {
        this.renderer.setInputBlocker(true);
      }
    });

    this.offSystemUnblock = this.actionBus.on(this.systemUnblockChannel, () => {
      if (typeof this.renderer.setInputBlocker === "function") {
        this.renderer.setInputBlocker(false);
      }
    });

    this.initialized = true;
  }

  /**
   * Emit global block-input event.
   *
   * @param {Record<string, any>} [payload]
   */
  blockInput(payload = {}) {
    this.actionBus.emit(this.systemBlockChannel, {
      source: "flow-runtime",
      timestamp: Date.now(),
      ...payload
    });
  }

  /**
   * Emit global unblock-input event.
   *
   * @param {Record<string, any>} [payload]
   */
  unblockInput(payload = {}) {
    this.actionBus.emit(this.systemUnblockChannel, {
      source: "flow-runtime",
      timestamp: Date.now(),
      ...payload
    });
  }

  /**
   * Start runtime from given node or flow entry node.
   *
   * @param {string} [nodeId]
   * @returns {Promise<FlowRuntimeSnapshot>}
   */
  async start(nodeId = this.flowService.getEntryNodeId()) {
    this.#assertInitialized();

    await this.enterNode(nodeId, {
      trigger: "start"
    });

    this.started = true;
    return this.getSnapshot();
  }

  /**
   * Enter node and render mapped page.
   *
   * @param {string} nodeId
   * @param {object} [transitionMeta]
   */
  async enterNode(nodeId, transitionMeta = {}) {
    this.#assertInitialized();

    const normalizedNodeId = normalizePageId(nodeId);
    assert(this.flowService.hasNode(normalizedNodeId), RuntimeCode.NODE_NOT_FOUND, "target node not found", {
      nodeId
    });

    const previousNodeId = this.currentNodeId;
    const previousNodeDomain = previousNodeId
      ? safeGet(this.flowService.getNode(previousNodeId), "domain", null)
      : null;

    if (previousNodeId && previousNodeId !== normalizedNodeId) {
      this.history.push(previousNodeId);
    }

    this.clearTimers();

    const sceneSnapshot = await this.sceneService.loadSceneByNodeId(normalizedNodeId);
    const targetDomain = safeGet(sceneSnapshot, "scene.page.domain", null);

    if (previousNodeDomain === "system" && targetDomain !== "system" && typeof this.renderer.removeDomainScene === "function") {
      this.renderer.removeDomainScene("system");
      this.unblockInput({
        reason: "leave-system-domain",
        fromNodeId: previousNodeId,
        toNodeId: normalizedNodeId
      });
    }

    this.renderer.renderScene(sceneSnapshot);

    if (targetDomain === "system") {
      this.blockInput({
        reason: "enter-system-domain",
        fromNodeId: previousNodeId,
        toNodeId: normalizedNodeId
      });
    }

    this.currentNodeId = normalizedNodeId;
    this.currentPageId = sceneSnapshot.pageId;
    this.lastTransition = {
      trigger: safeGet(transitionMeta, "trigger", "manual"),
      fromNodeId: previousNodeId,
      toNodeId: normalizedNodeId,
      transitionId: safeGet(transitionMeta, "transitionId", null),
      actionId: safeGet(transitionMeta, "actionId", null),
      timestamp: Date.now()
    };

    this.scheduleNodeTimers(normalizedNodeId);
  }

  /**
   * Open system modal page without changing current node.
   *
   * @param {string} pageIdOrAlias
   */
  async openSystemModal(pageIdOrAlias) {
    this.#assertStarted();

    const sceneSnapshot = await this.sceneService.loadSceneByPageId(pageIdOrAlias);
    const domain = safeGet(sceneSnapshot, "scene.page.domain", null);

    assert(domain === "system", RuntimeCode.INVALID_ACTION, "openSystemModal only supports system domain scene", {
      pageIdOrAlias,
      domain
    });

    if (typeof this.renderer.showOverlay === "function") {
      this.renderer.showOverlay(sceneSnapshot);
    } else {
      this.renderer.renderScene(sceneSnapshot);
    }

    this.blockInput({
      reason: "open-system-modal",
      pageId: sceneSnapshot.pageId
    });
  }

  /**
   * Close one system modal page.
   *
   * @param {string} pageId
   */
  closeSystemModal(pageId) {
    this.#assertStarted();

    if (typeof this.renderer.hideOverlay === "function") {
      this.renderer.hideOverlay(pageId);
    }

    this.unblockInput({
      reason: "close-system-modal",
      pageId
    });
  }

  /**
   * Handle one ui action and apply transition or fallback.
   *
   * @param {string} actionId
   * @param {any} [payload]
   * @returns {Promise<{matched:boolean,toNodeId:string|null,transitionId:string|null}>}
   */
  async handleAction(actionId, payload = null) {
    this.#assertStarted();

    assert(typeof actionId === "string" && actionId.trim() !== "", RuntimeCode.INVALID_ACTION, "actionId is required", {
      actionId
    });

    const currentNodeId = this.currentNodeId;
    if (!currentNodeId) {
      return {
        matched: false,
        toNodeId: null,
        transitionId: null
      };
    }

    const executeResult = await this.#executeAction(actionId, payload);
    if (executeResult.handled) {
      if (executeResult.nextNodeId) {
        await this.enterNode(executeResult.nextNodeId, {
          trigger: "actionHandler",
          transitionId: null,
          actionId
        });

        return {
          matched: true,
          toNodeId: executeResult.nextNodeId,
          transitionId: null
        };
      }

      return {
        matched: false,
        toNodeId: null,
        transitionId: null
      };
    }

    const transition = this.flowService.findTransitionByAction(currentNodeId, actionId);
    if (transition) {
      const toNodeId = safeGet(transition, "to", null);
      await this.enterNode(toNodeId, {
        trigger: "uiAction",
        transitionId: safeGet(transition, "id", null),
        actionId
      });

      return {
        matched: true,
        toNodeId: normalizePageId(toNodeId),
        transitionId: safeGet(transition, "id", null)
      };
    }

    const fallbackNodeId = this.flowService.getFallbackNodeId(currentNodeId);
    if (!fallbackNodeId) {
      return {
        matched: false,
        toNodeId: null,
        transitionId: null
      };
    }

    await this.enterNode(fallbackNodeId, {
      trigger: "fallback",
      actionId
    });

    return {
      matched: false,
      toNodeId: fallbackNodeId,
      transitionId: null
    };
  }

  /**
   * Schedule timer transitions for a node.
   *
   * @param {string} nodeId
   */
  scheduleNodeTimers(nodeId) {
    const timerTransitions = this.flowService.getTimerTransitions(nodeId);
    for (const transition of timerTransitions) {
      const transitionId = safeGet(transition, "id", null);
      const toNodeId = safeGet(transition, "to", null);
      const afterMs = safeGet(transition, "afterMs", 0);

      const timerId = setTimeout(() => {
        this.timerIds.delete(timerId);
        void this.enterNode(toNodeId, {
          trigger: "timer",
          transitionId,
          actionId: null
        });
      }, afterMs);

      this.timerIds.add(timerId);
    }
  }

  /**
   * Clear all active timers.
   */
  clearTimers() {
    for (const timerId of this.timerIds) {
      clearTimeout(timerId);
    }

    this.timerIds.clear();
  }

  /**
   * Dispose runtime resources.
   */
  dispose() {
    this.clearTimers();

    if (this.offAction) {
      this.offAction();
      this.offAction = null;
    }

    if (this.offSystemBlock) {
      this.offSystemBlock();
      this.offSystemBlock = null;
    }

    if (this.offSystemUnblock) {
      this.offSystemUnblock();
      this.offSystemUnblock = null;
    }

    this.initialized = false;
    this.started = false;
    this.currentNodeId = null;
    this.currentPageId = null;
    this.history = [];
    this.lastTransition = null;
  }

  /**
   * Return runtime snapshot.
   *
   * @returns {FlowRuntimeSnapshot}
   */
  getSnapshot() {
    return {
      initialized: this.initialized,
      started: this.started,
      actionChannel: this.actionChannel,
      systemBlockChannel: this.systemBlockChannel,
      systemUnblockChannel: this.systemUnblockChannel,
      currentNodeId: this.currentNodeId,
      currentPageId: this.currentPageId,
      history: [...this.history],
      activeTimerCount: this.timerIds.size,
      lastTransition: this.lastTransition ? { ...this.lastTransition } : null
    };
  }

  #assertReady() {
    assert(this.flowService, RuntimeCode.NOT_READY, "flowService is required");
    assert(this.sceneService, RuntimeCode.NOT_READY, "sceneService is required");
    assert(this.renderer, RuntimeCode.NOT_READY, "renderer is required");
    assert(this.actionBus, RuntimeCode.NOT_READY, "actionBus is required");
    assert(this.flowService.isLoaded(), RuntimeCode.NOT_READY, "flowService must be loaded");
  }

  #assertInitialized() {
    assert(this.initialized, RuntimeCode.NOT_READY, "FlowRuntime is not initialized");
  }

  #assertStarted() {
    assert(this.started, RuntimeCode.NOT_STARTED, "FlowRuntime has not started");
  }

  async #executeAction(actionId, payload) {
    if (!this.actionExecutor || typeof this.actionExecutor.execute !== "function") {
      return {
        handled: false,
        nextNodeId: null
      };
    }

    return this.actionExecutor.execute(actionId, {
      payload,
      runtime: this
    });
  }
}
