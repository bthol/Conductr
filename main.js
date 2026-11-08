// // handle squirrel events (install, uninstall, obsolete, updated) before main process
// if (require('electron-squirrel-startup')) {
//   const { app } = require('electron');
//   if (app) {
//     app.quit(); // closes application
//     // process.exit(0); // stops processes from continuing in background
//   }
// }

const { app } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const exeName = path.basename(process.execPath);

  const spawnUpdate = function(args) {
    let spawnedProcess;
    try {
      spawnedProcess = spawn(path.join(rootAtomFolder, 'Update.exe'), args, { detached: true });
    } catch (error) {
      // Update.exe not found or failed to spawn
    }
    return spawnedProcess;
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
      spawnUpdate(['--createShortcut', exeName]);
    case '--squirrel-updated':
      spawnUpdate(['--removeShortcut', exeName]);
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
      
      case '--squirrel-obsolete':
      spawnUpdate(['--removeShortcut', exeName]);
      app.quit();
      return true;
  }
  return false;
}

// Check the events before doing anything else
if (handleSquirrelEvent()) {
  return; 
}







// main process (back-end)
const { Menu, BrowserWindow, screen, webContents, mainWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises'); // Using promises for clean async/await
const fssync = require('fs'); // Synchronous methods

// open
let win; // globally store window
app.whenReady().then(() => {
  // Get the primary display's dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  // full screen dimensions
  const { width, height } = primaryDisplay.size;

  // WINDOWS OS

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
  // win.webContents.on('dom-ready', () => {
  //   console.log("dom ready");
  // })

  // console display
  win.webContents.on('did-finish-load', () => {
    console.log('did finish load');
    // win.webContents.openDevTools({ mode: 'detach' });
    win.webContents.openDevTools();
  })

  // menu config
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            // create directory if it doesn't already exist
            const directory = path.join(app.getPath('userData'), 'presets');
            if (!fssync.existsSync(directory)) {
              fssync.mkdirSync(directory, { recursive: true });
            }

            
            // prompt user with save dialog
            const { filePaths, canceled } = await dialog.showOpenDialog({
              title: 'Open Preset',
              buttonLabel: 'load',
              defaultPath: path.join(app.getPath('userData'), 'presets', 'preset.json'),
              filters: [{ name: 'JSON Files', extensions: ['json'] }],
              properties: ['openFile']
            });
            if (canceled || filePaths.length === 0) return { success: false };
            
            // open file from file path chosen by user
            try {
              const json = await fs.readFile(filePaths[0], 'utf-8');
              win.webContents.send('open-channel', json, path.basename(path.dirname(filePaths[0])));
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
        },
        {
          label: 'Save Preset',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // send request to renderer for save data, and file name
            win.webContents.send('save-channel', 'save-all');
          }
        },
        {
          label: 'Save Macro',
          // accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            // send request to renderer for save data, and file name
            win.webContents.send('save-channel', 'save-macros');
          }
        },
        {
          label: 'Save Orchestra',
          // accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            // send request to renderer for save data, and file name
            win.webContents.send('save-channel', 'save-orchestra');
          }
        },
        {
          label: 'Save Circuit',
          // accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            // send request to renderer for save data, and file name
            win.webContents.send('save-channel', 'save-circuit');
          }
        },
        {
          label: 'Save FX',
          // accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            // send request to renderer for save data, and file name
            win.webContents.send('save-channel', 'save-fx');
          }
        },
      ]
    },
    // {
    //   label: 'Edit',
    //   submenu: [
    //     {
    //       label: 'settings',
    //       click: () => { console.log('settings'); }
    //     },
    //     {
    //       label: 'logs',
    //       click: () => { console.log('logs'); }
    //     },
    //   ]
    // },
    // {
    //   label: 'About',
    //   click: () => { console.log('About'); }
    // }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// main ipc
// ipcMain.on('btn1-channel', (event, message) => {
//   console.log(message);
//   if (message === 'ipc renderer to main') {
//     const response = 'ipc main to renderer';
//     console.log(response);
//     win.webContents.send('main-channel', response);
//   }
// })

// save macros
ipcMain.on('save-macros', async (event, json) => {
  // create directory if it doesn't already exist
  const directory = path.join(app.getPath('userData'), 'presets', 'macros');
  if (!fssync.existsSync(directory)) {
    fssync.mkdirSync(directory, { recursive: true });
  }

  // prompt user with save dialog
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Macro Preset',
    buttonLabel: 'save preset',
    defaultPath: path.join(app.getPath('userData'), 'presets', 'macros', 'preset.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };

  // write to filepath chosen by user
  try {
    fssync.writeFileSync(filePath, json, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
})

// save orchestra
ipcMain.on('save-orchestra', async (event, json) => {
  // create directory if it doesn't already exist
  const directory = path.join(app.getPath('userData'), 'presets', 'orchestra');
  if (!fssync.existsSync(directory)) {
    fssync.mkdirSync(directory, { recursive: true });
  }

  // prompt user with save dialog
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Orchestra Preset',
    buttonLabel: 'save preset',
    defaultPath: path.join(app.getPath('userData'), 'presets', 'orchestra', 'preset.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };

  // write to filepath chosen by user
  try {
    fssync.writeFileSync(filePath, json, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
})

// save circuit
ipcMain.on('save-circuit', async (event, json) => {
  // create directory if it doesn't already exist
  const directory = path.join(app.getPath('userData'), 'presets', 'circuit');
  if (!fssync.existsSync(directory)) {
    fssync.mkdirSync(directory, { recursive: true });
  }

  // prompt user with save dialog
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Circuit Preset',
    buttonLabel: 'save preset',
    defaultPath: path.join(app.getPath('userData'), 'presets', 'circuit', 'preset.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };

  // write to filepath chosen by user
  try {
    fssync.writeFileSync(filePath, json, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
})

// save fx
ipcMain.on('save-fx', async (event, json) => {
  // create directory if it doesn't already exist
  const directory = path.join(app.getPath('userData'), 'presets', 'fx');
  if (!fssync.existsSync(directory)) {
    fssync.mkdirSync(directory, { recursive: true });
  }

  // prompt user with save dialog
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'FX preset',
    buttonLabel: 'save preset',
    defaultPath: path.join(app.getPath('userData'), 'presets', 'fx', 'preset.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };

  // write to filepath chosen by user
  try {
    fssync.writeFileSync(filePath, json, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
})

// save all
ipcMain.on('save-all', async (event, json) => {
  
  // create directory if it doesn't already exist
  const directory = path.join(app.getPath('userData'), 'presets', 'all');
  if (!fssync.existsSync(directory)) {
    fssync.mkdirSync(directory, { recursive: true });
  }

  // prompt user with save dialog
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'All Preset',
    buttonLabel: 'save preset',
    defaultPath: path.join(app.getPath('userData'), 'presets', 'all', 'preset.json'),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };

  // write to filepath chosen by user
  try {
    fssync.writeFileSync(filePath, json, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
})

// close application
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
})
