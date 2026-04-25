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
  dev: "home",
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

export const buttonActionHandlers = Object.freeze({
  startgame: createNavigationHandler(actionToNodeMap.startgame),
  settings: createNavigationHandler(actionToNodeMap.settings),
  dev: createNavigationHandler(actionToNodeMap.dev),
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
