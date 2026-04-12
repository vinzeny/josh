const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claudeSettings", {
  read: () => ipcRenderer.invoke("settings:read"),
  activate: (nextSettings) => ipcRenderer.invoke("settings:activate", nextSettings),
  createPreset: (preset) => ipcRenderer.invoke("presets:create", preset),
  listPresets: () => ipcRenderer.invoke("presets:list"),
  deletePreset: (presetName) => ipcRenderer.invoke("presets:delete", presetName),
  onDidChange: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  }
});

contextBridge.exposeInMainWorld("joshUpdates", {
  read: () => ipcRenderer.invoke("updates:read"),
  check: () => ipcRenderer.invoke("updates:check"),
  install: () => ipcRenderer.invoke("updates:install"),
  onDidChange: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("updates:changed", listener);
    return () => ipcRenderer.removeListener("updates:changed", listener);
  }
});
