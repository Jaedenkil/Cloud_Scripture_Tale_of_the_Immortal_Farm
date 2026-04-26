/**
 * Button action handlers collection.
 *
 * Keep business actions here and map by actionId.
 * Return value contract for each handler:
 * - { handled: true, nextNodeId: null }         only run business logic
 * - { handled: true, nextNodeId: "targetNode" } run business logic and navigate
 * - { handled: false }                           delegate to flow transitions
 */
const actionToNodeMap = Object.freeze({
  startgame: "home",
  settings: "settings",
  dev: "dev-tools-hub",
  "dev.tools.home": "home",
  "dev.tools.back": "dev-tools-hub",
  "dev.tools.open.schema-validator": "dev-schema-validator",
  "dev.tools.open.config-compiler": "dev-config-compiler",
  "dev.tools.open.hot-reload-service": "dev-hot-reload-service",
  "dev.tools.open.debug-console": "dev-debug-console",
  "dev.tools.open.block-editor": "dev-block-editor",
  "dev.tools.open.asset-manager": "dev-asset-manager",
  "dev.tools.open.quest-dialog-editor": "dev-quest-dialog-editor",
  "dev.tools.open.skill-editor-lite": "dev-skill-editor-lite",
  "dev.tools.open.spine-animation-manager": "dev-spine-animation-manager",
  "dev.tools.open.save-migration-tool": "dev-save-migration-tool",
  "dev.tools.open.auto-acceptance-tool": "dev-auto-acceptance-tool",
  apply: "settings",
  back: "home"
});

async function requestHostQuit() {
  if (typeof globalThis !== "undefined" && globalThis.appApi && typeof globalThis.appApi.requestQuit === "function") {
    await globalThis.appApi.requestQuit();
    return;
  }

  if (typeof globalThis !== "undefined" && globalThis.window && typeof globalThis.window.close === "function") {
    globalThis.window.close();
  }
}

function createNavigationHandler(expectedNodeId) {
  return function navigationHandler() {
    return {
      handled: true,
      nextNodeId: expectedNodeId
    };
  };
}

function createStayHandler() {
  return function stayHandler() {
    return {
      handled: true,
      nextNodeId: null
    };
  };
}

export const buttonActionHandlers = Object.freeze({
  startgame: createNavigationHandler(actionToNodeMap.startgame),
  settings: createNavigationHandler(actionToNodeMap.settings),
  dev: createNavigationHandler(actionToNodeMap.dev),
  "dev.tools.home": createNavigationHandler(actionToNodeMap["dev.tools.home"]),
  "dev.tools.back": createNavigationHandler(actionToNodeMap["dev.tools.back"]),
  "dev.tools.open.schema-validator": createNavigationHandler(actionToNodeMap["dev.tools.open.schema-validator"]),
  "dev.tools.open.config-compiler": createNavigationHandler(actionToNodeMap["dev.tools.open.config-compiler"]),
  "dev.tools.open.hot-reload-service": createNavigationHandler(actionToNodeMap["dev.tools.open.hot-reload-service"]),
  "dev.tools.open.debug-console": createNavigationHandler(actionToNodeMap["dev.tools.open.debug-console"]),
  "dev.tools.open.block-editor": createNavigationHandler(actionToNodeMap["dev.tools.open.block-editor"]),
  "dev.tools.open.asset-manager": createNavigationHandler(actionToNodeMap["dev.tools.open.asset-manager"]),
  "dev.tools.open.quest-dialog-editor": createNavigationHandler(actionToNodeMap["dev.tools.open.quest-dialog-editor"]),
  "dev.tools.open.skill-editor-lite": createNavigationHandler(actionToNodeMap["dev.tools.open.skill-editor-lite"]),
  "dev.tools.open.spine-animation-manager": createNavigationHandler(actionToNodeMap["dev.tools.open.spine-animation-manager"]),
  "dev.tools.open.save-migration-tool": createNavigationHandler(actionToNodeMap["dev.tools.open.save-migration-tool"]),
  "dev.tools.open.auto-acceptance-tool": createNavigationHandler(actionToNodeMap["dev.tools.open.auto-acceptance-tool"]),
  "dev.tools.save": createStayHandler(),
  quit: () => {
    return {
      handled: false,
      nextNodeId: null
    };
  },
  "ui.exit.request": () => {
    return {
      handled: false,
      nextNodeId: null
    };
  },
  "ui.exit.cancel": () => {
    return {
      handled: false,
      nextNodeId: null
    };
  },
  "ui.exit.confirm": async () => {
    await requestHostQuit();

    return {
      handled: false,
      nextNodeId: null
    };
  },
  apply: createNavigationHandler(actionToNodeMap.apply),
  back: createNavigationHandler(actionToNodeMap.back)
});
