/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { UIRenderer } from "../../scripts/services/ui-renderer.mjs";

function createSceneSnapshot({ pageId, domain, layerId, depth }) {
  return {
    pageId,
    scene: {
      page: {
        id: pageId,
        domain
      },
      layers: [
        {
          id: layerId,
          depth
        }
      ],
      components: [
        {
          id: `${pageId}-title`,
          type: "title",
          layer: layerId,
          text: `${domain}-title`
        }
      ]
    },
    themeTokens: {
      colors: {}
    }
  };
}

describe("UIRenderer domain layer priority", () => {
  it("should create four domain roots and respect hit-test priority", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const renderer = new UIRenderer();
    renderer.mount(root);
    renderer.setActionDispatcher(() => {});

    renderer.renderScene(createSceneSnapshot({
      pageId: "home-page",
      domain: "panel",
      layerId: "panel.content",
      depth: 2010
    }));

    renderer.renderScene(createSceneSnapshot({
      pageId: "exit-confirm-page",
      domain: "system",
      layerId: "system.alert",
      depth: 3010
    }));

    const domainRoots = root.querySelectorAll("[data-domain-id]");
    expect(domainRoots.length).toBe(4);

    const snapshot = renderer.getRenderSnapshot();
    expect(snapshot.activePageByDomain.panel).toBe("home-page");
    expect(snapshot.activePageByDomain.system).toBe("exit-confirm-page");
    expect(renderer.hitTestWithPriority()).toEqual(["system", "panel", "hud", "world"]);
  });
});
