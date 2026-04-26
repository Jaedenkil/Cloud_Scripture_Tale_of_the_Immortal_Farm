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

describe("dev tools flow", () => {
  it("should navigate home -> hub -> placeholder -> hub -> home and keep save on current placeholder", async () => {
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

    await runtime.handleAction("dev", { actionId: "dev" });
    expect(runtime.getSnapshot().currentNodeId).toBe("dev-tools-hub");

    await runtime.handleAction("dev.tools.open.schema-validator", { actionId: "dev.tools.open.schema-validator" });
    expect(runtime.getSnapshot().currentNodeId).toBe("dev-schema-validator");

    await runtime.handleAction("dev.tools.save", { actionId: "dev.tools.save" });
    expect(runtime.getSnapshot().currentNodeId).toBe("dev-schema-validator");

    await runtime.handleAction("dev.tools.back", { actionId: "dev.tools.back" });
    expect(runtime.getSnapshot().currentNodeId).toBe("dev-tools-hub");

    await runtime.handleAction("dev.tools.home", { actionId: "dev.tools.home" });
    expect(runtime.getSnapshot().currentNodeId).toBe("home");

    runtime.dispose();
  });
});
