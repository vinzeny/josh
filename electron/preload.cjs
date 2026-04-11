const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claudeSettings", {
  read: () => ipcRenderer.invoke("settings:read"),
  activate: (nextSettings) => ipcRenderer.invoke("settings:activate", nextSettings),
  createPreset: (preset) => ipcRenderer.invoke("presets:create", preset),
  listPresets: () => ipcRenderer.invoke("presets:list"),
  deletePreset: (presetName) => ipcRenderer.invoke("presets:delete", presetName)
});
