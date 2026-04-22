const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron')
const path = require('path')

let mainWindowRef = null

function clampResolution(width, height) {
  const safeWidth = Number.isFinite(width) ? Math.max(1024, Math.floor(width)) : 1440
  const safeHeight = Number.isFinite(height) ? Math.max(640, Math.floor(height)) : 900
  return {
    width: safeWidth,
    height: safeHeight
  }
}

function registerWindowIpcHandlers() {
  ipcMain.handle('window:get-resolution', () => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return { width: 1440, height: 900 }
    }
    const [width, height] = mainWindowRef.getContentSize()
    return { width, height }
  })

  ipcMain.handle('window:set-resolution', (_, payload) => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return { ok: false, reason: 'window-missing' }
    }

    const { width: requestedWidth, height: requestedHeight } = clampResolution(payload?.width, payload?.height)

    // Keep window edges reachable: clamp content size to current display work area minus window frame.
    const currentDisplay = screen.getDisplayMatching(mainWindowRef.getBounds())
    const workArea = currentDisplay.workAreaSize
    const [windowWidth, windowHeight] = mainWindowRef.getSize()
    const [contentWidth, contentHeight] = mainWindowRef.getContentSize()
    const frameDeltaWidth = Math.max(0, windowWidth - contentWidth)
    const frameDeltaHeight = Math.max(0, windowHeight - contentHeight)
    const maxContentWidth = Math.max(1024, workArea.width - frameDeltaWidth)
    const maxContentHeight = Math.max(640, workArea.height - frameDeltaHeight)

    const width = Math.min(requestedWidth, maxContentWidth)
    const height = Math.min(requestedHeight, maxContentHeight)

    // Lock window size after applying preset resolution.
    mainWindowRef.setResizable(false)
    mainWindowRef.setMaximizable(false)
    mainWindowRef.setContentSize(width, height)
    mainWindowRef.center()
    return { ok: true, width, height }
  })
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    // Keep native frame/title bar so title, minimize/maximize/close stay outside web content.
    frame: true,
    titleBarStyle: 'default',
    // Hide top menu bar while keeping native window chrome.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Remove app menu to avoid showing top toolbar menu entries.
  Menu.setApplicationMenu(null)

  const devServerURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  mainWindow.loadURL(devServerURL)

  mainWindow.webContents.once('did-finish-load', () => {
    // In development, open DevTools by default; allow explicit opt-out.
    if (!app.isPackaged && process.env.OPEN_DEVTOOLS !== '0') {
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.openDevTools({ mode: 'detach' })
        }
      }, 500)
    }
  })

  mainWindowRef = mainWindow
  return mainWindow
}

app.whenReady().then(() => {
  registerWindowIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
