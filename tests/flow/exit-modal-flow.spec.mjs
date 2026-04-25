import path from "node:path";
import { describe, expect, it } from "vitest";
import { ActionBus } from "../../scripts/services/action-bus.mjs";
import { ButtonActionExecutor } from "../../scripts/services/button-action-executor.mjs";
import { buttonActionHandlers } from "../../scripts/services/button-action-handlers.mjs";
import { FlowRuntime } from "../../scripts/services/flow-runtime.mjs";
import { FlowService } from "../../scripts/services/flow-service.mjs";
import { RegistryService } from "../../scripts/services/registry-service.mjs";
import { SceneService } from "../../scripts/services/scene-service.mjs";

class MockRenderer {
  blocked = false;
  removedDomains = [];
  lastScene = null;

  renderScene(sceneSnapshot) {
    this.lastScene = sceneSnapshot;
  }

  setInputBlocker(enabled) {
    this.blocked = Boolean(enabled);
  }

  removeDomainScene(domain) {
    this.removedDomains.push(domain);
    return true;
  }

  getRenderSnapshot() {
    return {
      mounted: true,
      currentPageId: this.lastScene?.pageId || null,
      renderedComponentCount: 0,
      inputBlocked: this.blocked,
      activePageByDomain: {
        world: null,
        hud: null,
        panel: null,
        system: null
      },
      overlayPageIds: []
    };
  }
}

describe("exit confirm flow", () => {
  it("should open confirm modal on exit request and return home on cancel", async () => {
    const rootPath = process.cwd();
    const registryPath = path.resolve(rootPath, "scenes/ui-registry.yaml");
    const flowPath = path.resolve(rootPath, "scenes/ui-flow.yaml");
    const themePath = path.resolve(rootPath, "scenes/theme.yaml");

    const registryService = new RegistryService({ registryPath });
    const flowService = new FlowService({ flowPath });
    const sceneService = new SceneService({ registryService, flowService, themePath });
    const actionBus = new ActionBus();
    const actionExecutor = new ButtonActionExecutor({ handlers: buttonActionHandlers });
    const renderer = new MockRenderer();

    await registryService.loadRegistry(registryPath);
    await flowService.loadFlow(flowPath);
    await sceneService.loadTheme(themePath);

    const runtime = new FlowRuntime({
      flowService,
      sceneService,
      renderer,
      actionBus,
      actionExecutor,
      actionChannel: "ui.action"
    });

    await runtime.init();
    await runtime.start("home");
    expect(runtime.getSnapshot().currentNodeId).toBe("home");

    await runtime.handleAction("ui.exit.request", {
      actionId: "ui.exit.request"
    });
    expect(runtime.getSnapshot().currentNodeId).toBe("exit-confirm");
    expect(renderer.blocked).toBe(true);

    await runtime.handleAction("ui.exit.cancel", {
      actionId: "ui.exit.cancel"
    });
    expect(runtime.getSnapshot().currentNodeId).toBe("home");
    expect(renderer.removedDomains).toContain("system");
    expect(renderer.blocked).toBe(false);

    runtime.dispose();
  });
});
