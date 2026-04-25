/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { UIRenderer } from "../../scripts/services/ui-renderer.mjs";

function createPanelScene() {
  return {
    pageId: "home-page",
    scene: {
      page: {
        id: "home-page",
        domain: "panel"
      },
      layers: [
        {
          id: "panel.content",
          depth: 2010,
          inputPolicy: "capture"
        }
      ],
      components: [
        {
          id: "home-button",
          type: "button",
          layer: "panel.content",
          text: "退出",
          actionId: "ui.exit.request"
        }
      ]
    },
    themeTokens: {
      colors: {}
    }
  };
}

describe("system input blocker", () => {
  it("should block world/hud/panel domain pointer events and keep system enabled", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher(() => {});
    renderer.renderScene(createPanelScene());

    renderer.setInputBlocker(true);

    const panelRoot = root.querySelector('[data-domain-id="panel"]');
    const systemRoot = root.querySelector('[data-domain-id="system"]');
    expect(panelRoot.style.pointerEvents).toBe("none");
    expect(systemRoot.style.pointerEvents).toBe("auto");

    renderer.setInputBlocker(false);
    expect(panelRoot.style.pointerEvents).toBe("auto");
  });
});
