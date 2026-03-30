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

export async function setupObs(transformation: any, sceneName: string): Promise<boolean> {
    const obs = new OBSWebSocket();

    try {
        await obs.connect('ws://127.0.0.1:4455');

        const scenes = await obs.call('GetSceneList');

        const portalScene = scenes.scenes.find((scene: any) => scene.sceneName === sceneName);

        if (!portalScene) {
            await obs.call('CreateScene', { sceneName });
        }

        const items = await obs.call('GetSceneItemList', {
            sceneName,
        });

        const windowCapture = items.sceneItems.find(
            (item: any) => item.sourceName === 'Window Capture',
        );

        let sceneItemId: number;

        if (windowCapture) {
            sceneItemId = windowCapture.sceneItemId as number;
        } else {
            const input = await obs.call('CreateInput', {
                sceneName,
                inputName: sceneName + ' Window Capture',
                inputKind: 'window_capture',
                inputSettings: {
                    capture_method: 'automatic',
                },
                sceneItemEnabled: true,
            });

            sceneItemId = input.sceneItemId;
        }

        await obs.call('SetSceneItemTransform', {
            sceneName,
            sceneItemId,
            sceneItemTransform: transformation,
        });

        await obs.disconnect();

        return true;
    } catch (err: any) {
        throw new Error('OBS error: ' + err.message);
    }
}
