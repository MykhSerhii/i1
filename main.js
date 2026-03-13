const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');

let mainWindow;
let serverPort = null;

function startExpressServer() {
  return new Promise((resolve, reject) => {
    const expressApp = express();

    // CORS headers for range requests (needed for PMTiles)
    expressApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    const dataDir = path.join(app.getAppPath(), 'data');
    const publicDir = path.join(app.getAppPath(), 'public');

    // Serve PMTiles and other data files
    expressApp.use('/data', express.static(dataDir, {
      acceptRanges: true,
      setHeaders: (res) => {
        res.setHeader('Accept-Ranges', 'bytes');
      }
    }));

    // Serve fonts and other public assets
    expressApp.use('/fonts', express.static(path.join(publicDir, 'fonts')));
    expressApp.use('/public', express.static(publicDir));

    const server = http.createServer(expressApp);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve(port);
    });
    server.on('error', reject);
  });
}

function getDataDir() {
  return path.join(app.getAppPath(), 'data');
}

async function createWindow() {
  try {
    serverPort = await startExpressServer();
    console.log(`Express server started on port ${serverPort}`);
  } catch (err) {
    console.error('Failed to start Express server:', err);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Карта висот України',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-data-port', () => {
  return serverPort;
});

ipcMain.handle('check-data-files', () => {
  const dataDir = getDataDir();
  const basemapPath = path.join(dataDir, 'ukraine.pmtiles');
  const terrainPath = path.join(dataDir, 'ukraine-terrain.pmtiles');

  const basemapExists = fs.existsSync(basemapPath);
  const terrainExists = fs.existsSync(terrainPath);

  return {
    basemap: basemapExists,
    terrain: terrainExists,
    allPresent: basemapExists && terrainExists,
    dataDir: dataDir
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
