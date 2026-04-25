import { BootstrapCode } from "../utils/app-codes.mjs";
import { CommonError, assert } from "../utils/flow-common.mjs";
import { ActionBus } from "./action-bus.mjs";
import { ButtonActionExecutor } from "./button-action-executor.mjs";
import { buttonActionHandlers } from "./button-action-handlers.mjs";
import { FlowRuntime } from "./flow-runtime.mjs";
import { FlowService } from "./flow-service.mjs";
import { FlowValidator } from "./flow-validator.mjs";
import { RegistryService } from "./registry-service.mjs";
import { SceneService } from "./scene-service.mjs";
import { UIRenderer } from "./ui-renderer.mjs";

/**
 * @typedef {object} AppBootstrapSnapshot
 * @property {boolean} initialized
 * @property {string} actionChannel
 * @property {ReturnType<RegistryService['getSnapshot']>} registry
 * @property {ReturnType<FlowService['getSnapshot']>} flow
 * @property {ReturnType<SceneService['getSnapshot']>} scene
 * @property {ReturnType<FlowRuntime['getSnapshot']>} runtime
 * @property {ReturnType<UIRenderer['getRenderSnapshot']>} renderer
 * @property {ReturnType<ActionBus['getSnapshot']>} actionBus
 * @property {ReturnType<ButtonActionExecutor['getSnapshot']>} actionExecutor
 */

/**
 * AppBootstrap: minimal bootstrap wiring for ui flow runtime.
 */
export class AppBootstrap {
  /**
   * @param {object} [options]
   * @param {string} [options.registryPath]
   * @param {string} [options.flowPath]
   * @param {string} [options.themePath]
   * @param {HTMLElement} [options.rootElement]
   * @param {string} [options.actionChannel="ui.action"]
   * @param {RegistryService} [options.registryService]
   * @param {FlowService} [options.flowService]
   * @param {SceneService} [options.sceneService]
   * @param {UIRenderer} [options.renderer]
   * @param {ActionBus} [options.actionBus]
  * @param {ButtonActionExecutor} [options.actionExecutor]
   */
  constructor(options = {}) {
    this.registryPath = options.registryPath || null;
    this.flowPath = options.flowPath || null;
    this.themePath = options.themePath || null;
    this.rootElement = options.rootElement || null;
    this.actionChannel = options.actionChannel || "ui.action";

    this.registryService = options.registryService || new RegistryService({ registryPath: this.registryPath });
    this.flowService = options.flowService || new FlowService({ flowPath: this.flowPath });
    this.actionBus = options.actionBus || new ActionBus();
    this.actionExecutor = options.actionExecutor || new ButtonActionExecutor({
      handlers: buttonActionHandlers
    });
    this.renderer = options.renderer || new UIRenderer();
    this.sceneService = options.sceneService || new SceneService({
      registryService: this.registryService,
      flowService: this.flowService,
      themePath: this.themePath
    });
    this.flowValidator = new FlowValidator({
      flowService: this.flowService,
      registryService: this.registryService
    });
    this.flowRuntime = new FlowRuntime({
      flowService: this.flowService,
      sceneService: this.sceneService,
      renderer: this.renderer,
      actionBus: this.actionBus,
      actionExecutor: this.actionExecutor,
      actionChannel: this.actionChannel
    });

    this.initialized = false;
  }

  /**
   * Initialize all services and start runtime at flow entry.
   *
   * @returns {Promise<AppBootstrapSnapshot>}
   */
  async init() {
    try {
      assert(typeof this.registryPath === "string" && this.registryPath.trim() !== "", BootstrapCode.NOT_READY, "registryPath is required");
      assert(typeof this.flowPath === "string" && this.flowPath.trim() !== "", BootstrapCode.NOT_READY, "flowPath is required");
      assert(typeof this.themePath === "string" && this.themePath.trim() !== "", BootstrapCode.NOT_READY, "themePath is required");

      await this.registryService.loadRegistry(this.registryPath);
      await this.flowService.loadFlow(this.flowPath);
      await this.sceneService.loadTheme(this.themePath);
      await this.flowValidator.assertValid();

      const mountPoint = this.rootElement || this.#getDefaultRootElement();
      this.renderer.mount(mountPoint);
      this.renderer.setActionDispatcher((actionId, payload) => {
        this.actionBus.emit(this.actionChannel, {
          actionId,
          ...payload
        });
      });

      await this.flowRuntime.init();
      await this.flowRuntime.start();
      this.initialized = true;

      return this.getSnapshot();
    } catch (error) {
      throw new CommonError(BootstrapCode.INIT_FAILED, "AppBootstrap init failed", {
        reason: error?.message || "unknown"
      }, error);
    }
  }

  /**
   * Dispose runtime resources.
   */
  dispose() {
    this.flowRuntime.dispose();
    this.initialized = false;
  }

  /**
   * Return bootstrap snapshot.
   *
   * @returns {AppBootstrapSnapshot}
   */
  getSnapshot() {
    return {
      initialized: this.initialized,
      actionChannel: this.actionChannel,
      registry: this.registryService.getSnapshot(),
      flow: this.flowService.getSnapshot(),
      scene: this.sceneService.getSnapshot(),
      runtime: this.flowRuntime.getSnapshot(),
      renderer: this.renderer.getRenderSnapshot(),
      actionBus: this.actionBus.getSnapshot(),
      actionExecutor: this.actionExecutor.getSnapshot()
    };
  }

  #getDefaultRootElement() {
    assert(typeof document !== "undefined", BootstrapCode.NOT_READY, "document is unavailable in current runtime");

    const rootElement = document.body;
    assert(rootElement, BootstrapCode.NOT_READY, "document.body is unavailable");

    rootElement.style.margin = "0";
    rootElement.style.width = "100vw";
    rootElement.style.height = "100vh";
    rootElement.style.overflow = "hidden";
    rootElement.style.position = "relative";

    return rootElement;
  }
}