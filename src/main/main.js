const { app, BrowserWindow, Menu } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: true
  });

  win.setMenuBarVisibility(false);

  const url = process.env.VITE_DEV_SERVER_URL;

  if (url) {
    win.loadURL(url);
  } else {
    win.loadURL("about:blank");
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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
