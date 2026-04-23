import yaml from "js-yaml";
import { YamlReadCode } from "./app-codes.mjs";

export { YamlReadCode, AppCodes } from "./app-codes.mjs";

const YAML_EXTENSIONS = new Set([".yaml", ".yml"]);

function hasIpcYamlReader() {
  return (
    typeof window !== "undefined" &&
    window.appApi &&
    typeof window.appApi.readYaml === "function"
  );
}

async function getNodeRuntimeModules() {
  const fsModule = await import("node:fs");
  const pathModule = await import("node:path");

  return {
    fs: fsModule.promises,
    path: pathModule.default
  };
}

function getValueType(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function applyValidation(data, validate, filePath) {
  if (!validate) {
    return;
  }

  let validationResult;
  try {
    validationResult = validate(data);
  } catch (error) {
    throw new YamlReadError(
      YamlReadCode.VALIDATION_FAILED,
      "YAML validation threw an error",
      { filePath, reason: error?.message },
      error
    );
  }

  if (validationResult === true || validationResult == null) {
    return;
  }

  if (validationResult === false) {
    throw new YamlReadError(
      YamlReadCode.VALIDATION_FAILED,
      "YAML validation failed",
      { filePath }
    );
  }

  if (typeof validationResult === "object") {
    if (validationResult.ok === true) {
      return;
    }

    throw new YamlReadError(
      validationResult.code || YamlReadCode.VALIDATION_FAILED,
      validationResult.message || "YAML validation failed",
      {
        filePath,
        ...(validationResult.details || {})
      }
    );
  }

  throw new YamlReadError(
    YamlReadCode.VALIDATION_FAILED,
    "YAML validation returned an unsupported result",
    { filePath }
  );
}

export class YamlReadError extends Error {
  constructor(code, message, details = {}, cause) {
    super(message);
    this.name = "YamlReadError";
    this.code = code;
    this.details = details;
    if (cause) {
      this.cause = cause;
    }
  }
}

async function readViaIpc(filePath, options) {
  const result = await window.appApi.readYaml(filePath, {
    allowEmpty: options.allowEmpty,
    allowNonYamlExtension: options.allowNonYamlExtension,
    expectedType: options.expectedType,
    encoding: options.encoding
  });

  if (!result || result.ok !== true) {
    throw new YamlReadError(
      result?.code || YamlReadCode.UNKNOWN_ERROR,
      result?.message || "YAML read failed in main process",
      result?.details || {}
    );
  }

  return {
    data: result.data,
    filePath: result.filePath,
    size: result.size,
    mtimeMs: result.mtimeMs
  };
}

async function readViaNode(filePath, options) {
  const runtime = await getNodeRuntimeModules();
  const fs = runtime.fs;
  const path = runtime.path;

  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new YamlReadError(YamlReadCode.INVALID_PATH, "filePath must be a non-empty string", {
      filePath
    });
  }

  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (!options.allowNonYamlExtension && !YAML_EXTENSIONS.has(extension)) {
    throw new YamlReadError(
      YamlReadCode.INVALID_EXTENSION,
      "Only .yaml or .yml files are supported",
      { filePath: resolvedPath, extension }
    );
  }

  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (error) {
    throw new YamlReadError(YamlReadCode.FILE_NOT_FOUND, "YAML file does not exist", {
      filePath: resolvedPath
    }, error);
  }

  if (!stats.isFile()) {
    throw new YamlReadError(YamlReadCode.NOT_A_FILE, "Path is not a file", {
      filePath: resolvedPath
    });
  }

  let rawContent;
  try {
    rawContent = await fs.readFile(resolvedPath, { encoding: options.encoding });
  } catch (error) {
    throw new YamlReadError(YamlReadCode.READ_FAILED, "Failed to read YAML file", {
      filePath: resolvedPath,
      encoding: options.encoding
    }, error);
  }

  const normalized = rawContent.replace(/^\uFEFF/, "");

  if (normalized.trim() === "") {
    if (!options.allowEmpty) {
      throw new YamlReadError(YamlReadCode.EMPTY_FILE, "YAML file is empty", {
        filePath: resolvedPath
      });
    }

    return {
      data: null,
      filePath: resolvedPath,
      size: stats.size,
      mtimeMs: stats.mtimeMs
    };
  }

  let parsed;
  try {
    parsed = yaml.load(normalized);
  } catch (error) {
    throw new YamlReadError(YamlReadCode.PARSE_FAILED, "Failed to parse YAML", {
      filePath: resolvedPath,
      reason: error?.message
    }, error);
  }

  if (parsed === undefined) {
    if (!options.allowEmpty) {
      throw new YamlReadError(YamlReadCode.EMPTY_CONTENT, "YAML content resolved to undefined", {
        filePath: resolvedPath
      });
    }

    parsed = null;
  }

  if (options.expectedType) {
    const actualType = getValueType(parsed);
    if (actualType !== options.expectedType) {
      throw new YamlReadError(YamlReadCode.TYPE_MISMATCH, "YAML root type mismatch", {
        filePath: resolvedPath,
        expectedType: options.expectedType,
        actualType
      });
    }
  }

  return {
    data: parsed,
    filePath: resolvedPath,
    size: stats.size,
    mtimeMs: stats.mtimeMs
  };
}

/**
 * Read and parse a local YAML file with guardrails for common failure cases.
 *
 * @param {string} filePath path to a local .yaml/.yml file (relative or absolute)
 * @param {object} [options]
 * @param {boolean} [options.allowEmpty=false] allow empty/comment-only YAML file
 * @param {boolean} [options.allowNonYamlExtension=false] skip extension check
 * @param {string} [options.expectedType] expected root type: object|array|string|number|boolean|null
 * @param {(data:any)=>boolean|{ok?:boolean, code?:string, message?:string, details?:object}} [options.validate] custom validation callback
 * @param {BufferEncoding} [options.encoding="utf8"] file encoding
 * @returns {Promise<{data:any, filePath:string, size:number, mtimeMs:number}>}
 */
export async function readYamlFile(filePath, options = {}) {
  const normalizedOptions = {
    allowEmpty: false,
    allowNonYamlExtension: false,
    expectedType: undefined,
    validate: undefined,
    encoding: "utf8",
    ...options
  };

  const result = hasIpcYamlReader()
    ? await readViaIpc(filePath, normalizedOptions)
    : await readViaNode(filePath, normalizedOptions);

  applyValidation(result.data, normalizedOptions.validate, result.filePath);
  return result;
}

/**
 * Safe wrapper that never throws and always returns a code.
 *
 * @param {string} filePath
 * @param {object} [options]
 * @returns {Promise<{ok:true, code:string, data:any, filePath:string, size:number, mtimeMs:number}|{ok:false, code:string, message:string, details:object}>}
 */
export async function safeReadYamlFile(filePath, options = {}) {
  try {
    const result = await readYamlFile(filePath, options);
    return {
      ok: true,
      code: YamlReadCode.OK,
      ...result
    };
  } catch (error) {
    if (error instanceof YamlReadError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details || {}
      };
    }

    return {
      ok: false,
      code: YamlReadCode.UNKNOWN_ERROR,
      message: error?.message || "Unknown YAML read error",
      details: {}
    };
  }
}
