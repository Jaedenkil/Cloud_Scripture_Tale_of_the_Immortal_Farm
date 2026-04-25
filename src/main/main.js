const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const yaml = require("js-yaml");

const YAML_EXTENSIONS = new Set([".yaml", ".yml"]);

let yamlReadCodeCache = null;
let yamlReadCodePromise = null;

async function getYamlReadCode() {
  if (yamlReadCodeCache) {
    return yamlReadCodeCache;
  }

  if (!yamlReadCodePromise) {
    const modulePath = path.resolve(__dirname, "../../scripts/utils/app-codes.mjs");
    const moduleUrl = pathToFileURL(modulePath).href;
    yamlReadCodePromise = import(moduleUrl).then((moduleData) => {
      yamlReadCodeCache = moduleData.YamlReadCode;
      return yamlReadCodeCache;
    });
  }

  return yamlReadCodePromise;
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

function resolveYamlPath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }

  return path.resolve(app.getAppPath(), filePath);
}

async function readYamlFromMain(filePath, options = {}) {
  const YamlReadCode = await getYamlReadCode();
  const allowEmpty = options.allowEmpty === true;
  const allowNonYamlExtension = options.allowNonYamlExtension === true;
  const expectedType = options.expectedType;
  const encoding = options.encoding || "utf8";

  const resolvedPath = resolveYamlPath(filePath);
  if (!resolvedPath) {
    return {
      ok: false,
      code: YamlReadCode.INVALID_PATH,
      message: "filePath must be a non-empty string",
      details: { filePath }
    };
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (!allowNonYamlExtension && !YAML_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      code: YamlReadCode.INVALID_EXTENSION,
      message: "Only .yaml or .yml files are supported",
      details: { filePath: resolvedPath, extension }
    };
  }

  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch (error) {
    return {
      ok: false,
      code: YamlReadCode.FILE_NOT_FOUND,
      message: "YAML file does not exist",
      details: {
        filePath: resolvedPath,
        reason: error?.message || "unknown"
      }
    };
  }

  if (!stats.isFile()) {
    return {
      ok: false,
      code: YamlReadCode.NOT_A_FILE,
      message: "Path is not a file",
      details: { filePath: resolvedPath }
    };
  }

  let rawContent;
  try {
    rawContent = await fs.readFile(resolvedPath, { encoding });
  } catch (error) {
    return {
      ok: false,
      code: YamlReadCode.READ_FAILED,
      message: "Failed to read YAML file",
      details: {
        filePath: resolvedPath,
        encoding,
        reason: error?.message || "unknown"
      }
    };
  }

  const normalized = rawContent.replace(/^\uFEFF/, "");
  if (normalized.trim() === "") {
    if (!allowEmpty) {
      return {
        ok: false,
        code: YamlReadCode.EMPTY_FILE,
        message: "YAML file is empty",
        details: { filePath: resolvedPath }
      };
    }

    return {
      ok: true,
      code: YamlReadCode.OK,
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
    return {
      ok: false,
      code: YamlReadCode.PARSE_FAILED,
      message: "Failed to parse YAML",
      details: {
        filePath: resolvedPath,
        reason: error?.message || "unknown"
      }
    };
  }

  if (parsed === undefined) {
    if (!allowEmpty) {
      return {
        ok: false,
        code: YamlReadCode.EMPTY_CONTENT,
        message: "YAML content resolved to undefined",
        details: { filePath: resolvedPath }
      };
    }

    parsed = null;
  }

  if (expectedType) {
    const actualType = getValueType(parsed);
    if (actualType !== expectedType) {
      return {
        ok: false,
        code: YamlReadCode.TYPE_MISMATCH,
        message: "YAML root type mismatch",
        details: {
          filePath: resolvedPath,
          expectedType,
          actualType
        }
      };
    }
  }

  return {
    ok: true,
    code: YamlReadCode.OK,
    data: parsed,
    filePath: resolvedPath,
    size: stats.size,
    mtimeMs: stats.mtimeMs
  };
}

function registerIpcHandlers() {
  ipcMain.handle("app:read-yaml", async (_event, payload = {}) => {
    try {
      const filePath = payload.filePath;
      const options = payload.options || {};
      return await readYamlFromMain(filePath, options);
    } catch (error) {
      const YamlReadCode = await getYamlReadCode();
      return {
        ok: false,
        code: YamlReadCode.UNKNOWN_ERROR,
        message: error?.message || "Unknown YAML read error",
        details: {}
      };
    }
  });

  ipcMain.handle("app:request-quit", async () => {
    app.quit();
    return {
      ok: true
    };
  });
}

function createWindow() {
  const isDevelopment = process.env.NODE_ENV === "development";

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDevelopment
    }
  });

  win.setMenuBarVisibility(false);

  const url = process.env.VITE_DEV_SERVER_URL;

  if (url) {
    win.loadURL(url);
    win.webContents.once("did-finish-load", () => {
      if (isDevelopment) {
        win.webContents.openDevTools({ mode: "detach" });
      } else {
        win.webContents.closeDevTools();
      }
    });
  } else {
    win.loadURL("about:blank");
    win.webContents.closeDevTools();
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
