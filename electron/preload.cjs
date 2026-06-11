const { contextBridge, ipcRenderer, webUtils } = require("electron");

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

contextBridge.exposeInMainWorld("joshFiles", {
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return "";
    }
  },
  listDirectory: (payload) => ipcRenderer.invoke("files:list-directory", payload)
});

contextBridge.exposeInMainWorld("joshTerminals", {
  list: (activeId) => ipcRenderer.invoke("terminals:list", activeId),
  selectFolder: () => ipcRenderer.invoke("terminals:select-folder"),
  create: (options) => ipcRenderer.invoke("terminals:create", options),
  write: (payload) => ipcRenderer.invoke("terminals:write", payload),
  rename: (payload) => ipcRenderer.invoke("terminals:rename", payload),
  delete: (payload) => ipcRenderer.invoke("terminals:delete", payload),
  deleteFolder: (payload) => ipcRenderer.invoke("terminals:delete-folder", payload),
  resize: (payload) => ipcRenderer.invoke("terminals:resize", payload),
  onData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminals:data", listener);
    return () => ipcRenderer.removeListener("terminals:data", listener);
  },
  onDidChange: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminals:changed", listener);
    return () => ipcRenderer.removeListener("terminals:changed", listener);
  }
});
