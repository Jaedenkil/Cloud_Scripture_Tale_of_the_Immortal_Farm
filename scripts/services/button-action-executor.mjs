import { CommonCode, RuntimeCode } from "../utils/app-codes.mjs";
import { assert, normalizePageId } from "../utils/flow-common.mjs";

/**
 * @typedef {(context: {actionId:string, payload:any, runtime:any}) => (void|{handled?:boolean,nextNodeId?:string|null})|Promise<void|{handled?:boolean,nextNodeId?:string|null}>} ButtonActionHandler
 */

/**
 * ButtonActionExecutor: execute registered handlers for button actions.
 */
export class ButtonActionExecutor {
  /**
   * @param {object} [options]
   * @param {Record<string, ButtonActionHandler>|Map<string, ButtonActionHandler>} [options.handlers]
   */
  constructor(options = {}) {
    this.handlerMap = new Map();
    const handlers = options.handlers || {};
    this.registerMany(handlers);
  }

  /**
   * Register one handler by action id.
   *
   * @param {string} actionId
   * @param {ButtonActionHandler} handler
   */
  register(actionId, handler) {
    const normalizedActionId = normalizePageId(actionId);
    assert(typeof handler === "function", CommonCode.INVALID_ARGUMENT, "button action handler must be a function", {
      actionId: normalizedActionId,
      handlerType: typeof handler
    });

    this.handlerMap.set(normalizedActionId, handler);
  }

  /**
   * Register handlers from map or plain object.
   *
   * @param {Record<string, ButtonActionHandler>|Map<string, ButtonActionHandler>} handlers
   */
  registerMany(handlers) {
    if (handlers instanceof Map) {
      for (const [actionId, handler] of handlers.entries()) {
        this.register(actionId, handler);
      }

      return;
    }

    for (const [actionId, handler] of Object.entries(handlers)) {
      this.register(actionId, handler);
    }
  }

  /**
   * Execute one action handler.
   *
   * @param {string} actionId
   * @param {object} context
   * @param {any} [context.payload]
   * @param {any} [context.runtime]
   * @returns {Promise<{handled:boolean,nextNodeId:string|null}>}
   */
  async execute(actionId, context = {}) {
    const normalizedActionId = normalizePageId(actionId);
    const handler = this.handlerMap.get(normalizedActionId);

    if (!handler) {
      return {
        handled: false,
        nextNodeId: null
      };
    }

    const result = await handler({
      actionId: normalizedActionId,
      payload: context.payload,
      runtime: context.runtime
    });

    if (result == null) {
      return {
        handled: true,
        nextNodeId: null
      };
    }

    assert(typeof result === "object", RuntimeCode.INVALID_ACTION, "button action handler result must be an object", {
      actionId: normalizedActionId,
      resultType: typeof result
    });

    const nextNodeId = result.nextNodeId == null
      ? null
      : normalizePageId(result.nextNodeId);

    return {
      handled: result.handled !== false,
      nextNodeId
    };
  }

  /**
   * Return current registry snapshot.
   *
   * @returns {{handlerCount:number,actionIds:string[]}}
   */
  getSnapshot() {
    const actionIds = [...this.handlerMap.keys()];

    return {
      handlerCount: actionIds.length,
      actionIds
    };
  }
}
