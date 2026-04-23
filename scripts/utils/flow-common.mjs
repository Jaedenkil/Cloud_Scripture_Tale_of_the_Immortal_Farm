import { AppCodes, CommonCode } from "./app-codes.mjs";

export { AppCodes, CommonCode };

function getValueType(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

export class CommonError extends Error {
  constructor(code, message, details = {}, cause) {
    super(message);
    this.name = "CommonError";
    this.code = code;
    this.details = details;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Fail-fast assertion with unified error shape.
 *
 * @param {boolean} condition
 * @param {string} code
 * @param {string} message
 * @param {object} [details]
 */
export function assert(condition, code, message, details = {}) {
  if (!condition) {
    throw new CommonError(code || CommonCode.ASSERT_FAILED, message || "Assertion failed", details);
  }
}

/**
 * Ensure a value is a plain object.
 *
 * @param {any} value
 * @param {string} [name="value"]
 * @returns {Record<string, any>}
 */
export function ensureObject(value, name = "value") {
  const type = getValueType(value);
  assert(
    type === "object",
    CommonCode.EXPECTED_OBJECT,
    `${name} must be an object`,
    { name, actualType: type }
  );

  return value;
}

/**
 * Normalize page id for stable lookups.
 *
 * @param {string} id
 * @returns {string}
 */
export function normalizePageId(id) {
  assert(typeof id === "string", CommonCode.INVALID_ARGUMENT, "pageId must be a string", { id });
  const normalized = id.trim().toLowerCase();
  assert(normalized !== "", CommonCode.EMPTY_ID, "pageId cannot be empty", { id });
  return normalized;
}

/**
 * Build id -> item map and guard against duplicate ids.
 *
 * @template T
 * @param {T[]} list
 * @param {object} [options]
 * @param {string} [options.name="items"]
 * @param {string} [options.idField="id"]
 * @param {(id:string)=>string} [options.normalizeId]
 * @returns {Map<string, T>}
 */
export function createMapById(list, options = {}) {
  const {
    name = "items",
    idField = "id",
    normalizeId
  } = options;

  assert(Array.isArray(list), CommonCode.EXPECTED_ARRAY, `${name} must be an array`, {
    name,
    actualType: getValueType(list)
  });

  const idToItemMap = new Map();

  for (const item of list) {
    ensureObject(item, `${name} item`);

    const rawId = item[idField];
    assert(typeof rawId === "string", CommonCode.EMPTY_ID, `${name} item id must be a string`, {
      idField,
      rawId
    });

    const id = normalizeId ? normalizeId(rawId) : rawId.trim();

    assert(id !== "", CommonCode.EMPTY_ID, `${name} item id cannot be empty`, {
      idField,
      rawId
    });

    assert(!idToItemMap.has(id), CommonCode.DUPLICATE_ID, `${name} contains duplicate id`, {
      id,
      idField
    });

    idToItemMap.set(id, item);
  }

  return idToItemMap;
}

/**
 * Resolve page aliases recursively and detect cycles.
 *
 * @param {string} pageId
 * @param {Map<string,string>|Record<string,string>|undefined|null} aliasMap
 * @returns {string}
 */
export function resolveAlias(pageId, aliasMap) {
  const normalizedId = normalizePageId(pageId);

  if (!aliasMap) {
    return normalizedId;
  }

  const readAlias = (id) => {
    if (aliasMap instanceof Map) {
      return aliasMap.get(id);
    }

    if (typeof aliasMap === "object") {
      return aliasMap[id];
    }

    return undefined;
  };

  const visited = new Set();
  let current = normalizedId;

  while (true) {
    assert(!visited.has(current), CommonCode.ALIAS_CYCLE, "Alias cycle detected", {
      pageId: normalizedId,
      current,
      chain: [...visited, current]
    });

    visited.add(current);

    const next = readAlias(current);
    if (next == null) {
      return current;
    }

    current = normalizePageId(next);
  }
}

/**
 * Pick a transition by ui action from a transition list.
 *
 * @param {Array<Record<string, any>>} transitions
 * @param {string} actionId
 * @returns {Record<string, any>|null}
 */
export function pickTransitionByAction(transitions, actionId) {
  if (!Array.isArray(transitions)) {
    return null;
  }

  const normalizedActionId = normalizePageId(actionId);
  let picked = null;

  for (const transition of transitions) {
    if (getValueType(transition) !== "object") {
      continue;
    }

    if (transition.trigger !== "uiAction") {
      continue;
    }

    if (typeof transition.fromActionId !== "string") {
      continue;
    }

    const fromActionId = normalizePageId(transition.fromActionId);
    if (fromActionId !== normalizedActionId) {
      continue;
    }

    if (!picked) {
      picked = transition;
      continue;
    }

    const currentPriority = Number.isFinite(transition.priority) ? transition.priority : 0;
    const pickedPriority = Number.isFinite(picked.priority) ? picked.priority : 0;

    if (currentPriority > pickedPriority) {
      picked = transition;
    }
  }

  return picked;
}

/**
 * Return all valid timer transitions from a transition list.
 *
 * @param {Array<Record<string, any>>} transitions
 * @returns {Array<Record<string, any>>}
 */
export function pickTimerTransitions(transitions) {
  if (!Array.isArray(transitions)) {
    return [];
  }

  return transitions.filter((transition) => {
    if (getValueType(transition) !== "object") {
      return false;
    }

    if (transition.trigger !== "timer") {
      return false;
    }

    return Number.isFinite(transition.afterMs) && transition.afterMs >= 0;
  });
}

/**
 * Safely read nested values by a path string or string[] path.
 *
 * @param {any} target
 * @param {string|string[]} path
 * @param {any} defaultValue
 * @returns {any}
 */
export function safeGet(target, path, defaultValue) {
  if (path == null || path === "") {
    return target ?? defaultValue;
  }

  const pathParts = Array.isArray(path)
    ? path
    : String(path)
      .split(".")
      .filter(Boolean);

  if (pathParts.length === 0) {
    return target ?? defaultValue;
  }

  let current = target;
  for (const part of pathParts) {
    if (current == null || typeof current !== "object") {
      return defaultValue;
    }

    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return defaultValue;
    }

    current = current[part];
  }

  return current === undefined ? defaultValue : current;
}
