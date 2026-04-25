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

function createNavigationHandler(expectedNodeId) {
  return function navigationHandler({ actionId, payload }) {
    console.info("[buttonActionHandlers] executed", {
      actionId,
      payload,
      nextNodeId: expectedNodeId
    });

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
  quit: ({ actionId, payload }) => {
    const canConfirm = typeof window !== "undefined" && typeof window.confirm === "function";
    const shouldQuit = canConfirm
      ? window.confirm("确定要退出游戏吗？")
      : false;

    console.info("[buttonActionHandlers] executed", {
      actionId,
      payload,
      shouldQuit
    });

    if (shouldQuit && typeof window !== "undefined" && typeof window.close === "function") {
      window.close();
    }

    return {
      handled: true,
      nextNodeId: null
    };
  },
  apply: createNavigationHandler(actionToNodeMap.apply),
  back: createNavigationHandler(actionToNodeMap.back)
});
