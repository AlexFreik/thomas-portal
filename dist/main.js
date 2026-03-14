"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const obs_websocket_js_1 = __importDefault(require("obs-websocket-js"));
let win;
function createWindow() {
    win = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });
    win.loadFile('index.html');
    win.webContents.openDevTools();
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// ===== OBS Integration =====
const obs = new obs_websocket_js_1.default();
electron_1.ipcMain.handle('setup-obs', async (_, args) => {
    console.log(args);
    try {
        if (!obs.identified) {
            await obs.connect('ws://127.0.0.1:4455');
        }
        const scenes = await obs.call('GetSceneList');
        return scenes;
    }
    catch (err) {
        console.error(err);
        throw err;
    }
});
