// main process
const { app, Menu, BrowserWindow, screen, webContents, mainWindow, ipcMain } = require('electron');
const path = require('path');

// menu config
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        click: () => { console.log('Open'); }
      },
      {
        label: 'Save Preset',
        click: () => { console.log('Save New Preset'); }
      },
      {
        label: 'Save Conductor',
        click: () => { console.log('Save New Conductor'); }
      },
      {
        label: 'Save Orchestra',
        click: () => { console.log('Save New Orchestra'); }
      },
      {
        label: 'Save Circuit',
        click: () => { console.log('Save New Circuit'); }
      },
      {
        label: 'Save FX',
        click: () => { console.log('Save New Circuit'); }
      },
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'settings',
        click: () => { console.log('settings'); }
      },
    ]
  },
  {
    label: 'About',
    click: () => { console.log('About'); }
  }
];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// open
let win; // globally store window
app.whenReady().then(() => {
  // Get the primary display's dimensions
  const primaryDisplay = screen.getPrimaryDisplay();

  // WINDOWS OS
  
  // full screen dimensions
  const { width, height } = primaryDisplay.size;

  // open window
  win = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 572,
    minHeight: 410,
    frame: true,
    icon: path.join(__dirname, 'assets', 'icons', 'win', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'build', 'scripts', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
  })
  win.loadFile('index.html');

  // APPLE IOS
  
  // // exclude OS taskbars/docks
  // const { width: workWidth, height: workHeight } = primaryDisplay.workAreaSize

  // // open window
  // const win = new BrowserWindow({
  //   width: workWidth,
  //   height: workHeight,
  //   minWidth: 200,
  //   minHeight: 400,
  //   // frame: false,
  //   icon: path.join(__dirname, 'assets', 'icon.ico'),
  //   webPreferences: {
  //     preload: path.join(__dirname, 'build', 'scripts', 'preload.js'),
  //     contextIsolation: true,
  //     nodeIntegration: false
  //   },
  // })
  // win.loadFile('index.html');

  // // IOS docker
  // app.on('activate', () => {
  //   if (BrowserWindow.getAllWindows().length === 0) createWindow()
  // })

  // event checks
  win.webContents.on('dom-ready', () => {
    console.log("dom ready");
  })

  win.webContents.on('did-finish-load', () => {
    console.log('did finish load');
    win.webContents.openDevTools({ mode: 'detach' });
  })
})

// main ipc
ipcMain.on('btn1-channel', (event, message) => {
  console.log(message);
  if (message === 'ipc renderer to main') {
    const response = 'ipc main to renderer';
    console.log(response);
    win.webContents.send('main-channel', response);
  }
})

// close application
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
})
