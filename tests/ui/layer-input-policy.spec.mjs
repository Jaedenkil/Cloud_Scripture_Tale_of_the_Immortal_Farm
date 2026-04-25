import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FlowValidator } from "../../scripts/services/flow-validator.mjs";

function createFlowServiceMock() {
  const nodes = [
    {
      id: "home",
      pageId: "home-page",
      transitions: [
        {
          id: "self-loop",
          to: "home"
        }
      ],
      fallback: "home"
    }
  ];

  return {
    isLoaded() {
      return true;
    },
    getEntryNodeId() {
      return "home";
    },
    hasNode(nodeId) {
      return nodeId === "home";
    },
    listNodes() {
      return nodes;
    }
  };
}

function createRegistryServiceMock(scenePath) {
  return {
    isLoaded() {
      return true;
    },
    resolvePageId(pageId) {
      if (pageId !== "home-page") {
        throw new Error("page not found");
      }

      return pageId;
    },
    listPages() {
      return [
        {
          id: "home-page",
          domain: "panel",
          scenePath
        }
      ];
    }
  };
}

async function withSceneFile(sceneContent, callback) {
  const fileName = `scene-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`;
  const filePath = path.join(os.tmpdir(), fileName);

  await fs.writeFile(filePath, sceneContent, "utf8");

  try {
    await callback(filePath);
  } finally {
    await fs.rm(filePath, { force: true });
  }
}

describe("FlowValidator layer input policy guard", () => {
  it("should reject interactive component on passthrough layer", async () => {
    const invalidSceneYaml = `page:\n  id: home-page\n  domain: panel\nlayers:\n  - id: panel.content\n    depth: 2010\ncomponents:\n  - id: start-btn\n    type: button\n    layer: panel.content\n    text: 开始\n    actionId: startGame\n`;

    await withSceneFile(invalidSceneYaml, async (scenePath) => {
      const validator = new FlowValidator({
        flowService: createFlowServiceMock(),
        registryService: createRegistryServiceMock(scenePath)
      });

      const report = await validator.validate();
      expect(report.ok).toBe(false);
      expect(report.issues.some((issue) => issue.message === "interactive component cannot be placed on passthrough layer")).toBe(true);
    });
  });

  it("should allow interactive component on capture layer", async () => {
    const validSceneYaml = `page:\n  id: home-page\n  domain: panel\nlayers:\n  - id: panel.content\n    depth: 2010\n    inputPolicy: capture\ncomponents:\n  - id: start-btn\n    type: button\n    layer: panel.content\n    text: 开始\n    actionId: startGame\n`;

    await withSceneFile(validSceneYaml, async (scenePath) => {
      const validator = new FlowValidator({
        flowService: createFlowServiceMock(),
        registryService: createRegistryServiceMock(scenePath)
      });

      const report = await validator.validate();
      expect(report.ok).toBe(true);
    });
  });
});
