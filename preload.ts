import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    setupObs: (data: any) => ipcRenderer.invoke('setup-obs', data),
});
