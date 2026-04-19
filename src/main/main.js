const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
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
    // Auto-open devtools on start for development debugging.
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  return mainWindow
}

app.whenReady().then(() => {
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
