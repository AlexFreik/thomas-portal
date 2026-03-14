import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import OBSWebSocket from 'obs-websocket-js';

let win: BrowserWindow;

function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    win.loadFile('index.html');
    win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ===== OBS Integration =====
const obs = new OBSWebSocket();

ipcMain.handle('setup-obs', async (_, args) => {
    console.log(args);
    try {
        if (!obs.identified) {
            await obs.connect('ws://127.0.0.1:4455');
        }

        const scenes = await obs.call('GetSceneList');

        return scenes;
    } catch (err) {
        console.error(err);
        throw err;
    }
});
