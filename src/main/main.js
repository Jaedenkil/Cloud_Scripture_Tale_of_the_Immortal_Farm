const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')

// 开发模式检测
const isDev = !app.isPackaged

let mainWindow = null

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: '云笈仙田录',
    frame: false,           // 无边框窗口
    titleBarStyle: 'hidden', // 隐藏标题栏
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发模式加载 Vite 服务器
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' }) // 独立窗口打开控制台
  } else {
    // 生产模式设置 Content-Security-Policy
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"]
        }
      })
    })
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// 窗口控制 IPC
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
