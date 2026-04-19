import {
  app,
  autoUpdater,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  nativeTheme
} from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { makeUserNotifier, UpdateSourceType, updateElectronApp } = require("update-electron-app");

const APP_NAME = "JOSH";
const DEFAULT_UPDATE_REPOSITORY = "vinzeny/josh";
const APP_STORAGE_DIR = path.join(os.homedir(), ".josh");
const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const BACKUP_DIR = path.join(APP_STORAGE_DIR, "backups");
const PRESET_STORE_PATH = path.join(APP_STORAGE_DIR, "presets.json");
const isDev = !app.isPackaged;
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const OFFICIAL_NAME_ALIASES = new Set(["official", "official json"]);
const OFFICIAL_PRESET = {
  name: "Official",
  content: {}
};
let mainWindow = null;
let tray = null;
let isQuitting = false;
let autoUpdateInitialized = false;
let autoUpdateEventsBound = false;
let updateState = createInitialUpdateState();

app.setName(APP_NAME);
app.setPath("userData", path.join(app.getPath("appData"), APP_NAME));
nativeTheme.themeSource = "dark";

function createWindow() {
  const window = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 680,
    minHeight: 520,
    title: "",
    backgroundColor: "#111312",
    webPreferences: {
      preload: path.join(app.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  window.on("close", (event) => {
    if (isQuitting || process.platform !== "darwin") {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  if (rendererUrl) {
    window.loadURL(rendererUrl);
  } else if (isDev) {
    window.loadURL("http://localhost:5173");
  } else {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow = window;
  return window;
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function ensureAppStorageDir() {
  await fs.mkdir(APP_STORAGE_DIR, { recursive: true });
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, stableStringify(value), "utf8");
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function normalizeRepository(value) {
  const raw = typeof value === "string" ? value : value?.url;
  if (!raw) {
    return "";
  }

  const trimmed = raw.trim();
  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/github\.com[/:]([^/\s]+\/[^/\s.]+?)(?:\.git)?$/i);
  return match?.[1] ?? "";
}

function resolveUpdateRepository() {
  const envRepository = normalizeRepository(
    process.env.JOSH_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY
  );
  if (envRepository) {
    return envRepository;
  }

  return DEFAULT_UPDATE_REPOSITORY;
}

function createInitialUpdateState() {
  const supported = process.platform === "darwin" || process.platform === "win32";
  const canCheck = supported && app.isPackaged;

  return {
    supported,
    enabled: canCheck,
    canCheck,
    checking: false,
    available: false,
    downloaded: false,
    currentVersion: app.getVersion(),
    repo: resolveUpdateRepository(),
    status: supported ? (app.isPackaged ? "idle" : "development") : "unsupported",
    releaseName: "",
    releaseDate: "",
    releaseNotes: "",
    updateUrl: "",
    lastCheckedAt: "",
    error: ""
  };
}

function readUpdatePayload() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    repo: resolveUpdateRepository()
  };
}

function updateDialogCopy() {
  const locale = app.getLocale()?.toLowerCase() ?? "";

  if (locale.startsWith("zh")) {
    return {
      title: "发现新版本",
      detail: "新版本已下载。重新启动 JOSH 后即可完成更新。",
      restartButtonText: "重新启动",
      laterButtonText: "稍后"
    };
  }

  return {
    title: "Update Ready",
    detail: "A new version of JOSH has been downloaded. Restart to finish updating.",
    restartButtonText: "Restart",
    laterButtonText: "Later"
  };
}

function currentEnv(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  const env = settings.env;
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    return {};
  }

  return env;
}

function findMatchingPresetName(settings, presets) {
  const current = stableStringify(currentEnv(settings));
  const matched = presets.find((preset) => stableStringify(preset.content) === current);
  return matched?.name ?? null;
}

function timestampLabel() {
  return new Date().toISOString().replaceAll(":", "-");
}

function isOfficialPresetName(name) {
  return OFFICIAL_NAME_ALIASES.has(String(name ?? "").trim().toLowerCase());
}

function missingClaudeCodeError() {
  const error = new Error("未找到 Claude Code 配置，请先安装并启动一次 Claude Code。");
  error.code = "CLAUDE_CODE_MISSING";
  return error;
}

function invalidPresetStoreError() {
  const error = new Error("Preset store is invalid.");
  error.code = "PRESET_STORE_INVALID";
  return error;
}

function assertPresetContent(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("JSON 内容必须是一个对象。");
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`env.${key} 必须是字符串。`);
    }
  }
}

function normalizePresetContent(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  if ("env" in value && value.env && typeof value.env === "object" && !Array.isArray(value.env)) {
    return value.env;
  }

  return value;
}

function normalizePresetEntry(preset) {
  if (!preset || typeof preset.name !== "string") {
    return null;
  }

  const isOfficial = isOfficialPresetName(preset.name);
  const content = isOfficial ? {} : normalizePresetContent(preset.content ?? preset.env);
  return {
    name: isOfficial ? OFFICIAL_PRESET.name : preset.name,
    content
  };
}

function normalizePresetStore(parsed) {
  const presetList = Array.isArray(parsed) ? parsed : parsed?.presets;

  if (!Array.isArray(presetList)) {
    throw invalidPresetStoreError();
  }

  const customPresets = presetList
    .map(normalizePresetEntry)
    .filter((preset) => preset && preset.name !== OFFICIAL_PRESET.name);

  return {
    presets: [OFFICIAL_PRESET, ...customPresets]
  };
}

async function initializePresetStore() {
  const initialStore = { presets: [OFFICIAL_PRESET] };
  await writeJson(PRESET_STORE_PATH, initialStore);
  return initialStore;
}

async function readPresetStore() {
  await ensureAppStorageDir();

  try {
    const parsed = await readJson(PRESET_STORE_PATH);
    const normalizedStore = normalizePresetStore(parsed);

    if (stableStringify(parsed) !== stableStringify(normalizedStore)) {
      await writeJson(PRESET_STORE_PATH, normalizedStore);
    }

    return normalizedStore;
  } catch (error) {
    if (
      error.code !== "ENOENT" &&
      error.code !== "PRESET_STORE_INVALID" &&
      !(error instanceof SyntaxError)
    ) {
      throw error;
    }

    return initializePresetStore();
  }
}

async function savePresetStore(presets) {
  await ensureAppStorageDir();
  const merged = [
    OFFICIAL_PRESET,
    ...presets.filter((preset) => !isOfficialPresetName(preset.name))
  ];
  await writeJson(PRESET_STORE_PATH, { presets: merged });
  return { presets: merged };
}

async function readSettingsPayload() {
  const installed = await pathExists(SETTINGS_PATH);
  const presetStore = await readPresetStore();

  if (!installed) {
    return {
      installed: false,
      settingsPath: SETTINGS_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed: { env: {} },
      raw: "",
      presets: presetStore.presets
    };
  }

  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      installed: true,
      settingsPath: SETTINGS_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed,
      raw,
      presets: presetStore.presets
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      installed: false,
      settingsPath: SETTINGS_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed: { env: {} },
      raw: "",
      presets: presetStore.presets
    };
  }
}

async function activateSettings(nextSettings) {
  assertPresetContent(nextSettings);
  let current;

  try {
    current = await readJson(SETTINGS_PATH);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw missingClaudeCodeError();
    }
    throw error;
  }

  await ensureBackupDir();

  const backupName = `settings-${timestampLabel()}.json`;
  await writeJson(path.join(BACKUP_DIR, backupName), current);
  const merged = {
    ...current,
    env: nextSettings
  };
  await writeJson(SETTINGS_PATH, merged);

  return {
    ok: true,
    saved: merged,
    backupName
  };
}

function menuCopy() {
  const locale = app.getLocale()?.toLowerCase() ?? "";
  const isChinese = locale.startsWith("zh");

  return isChinese
    ? {
        openApp: "打开 JOSH",
        currentModel: "当前模型",
        notSet: "未设置",
        missing: "未找到 Claude Code",
        quickSwitch: "快捷切换",
        quit: "退出"
      }
    : {
        openApp: "Open JOSH",
        currentModel: "Current Model",
        notSet: "Not set",
        missing: "Claude Code Not Found",
        quickSwitch: "Quick Switch",
        quit: "Quit"
      };
}

function getTrayImage() {
  const trayPngPath = path.join(app.getAppPath(), "src", "assets", "josh.png");
  const icnsPath = path.join(app.getAppPath(), "src", "assets", "icon.icns");
  const pngPath = path.join(app.getAppPath(), "src", "josh-logo.png");
  const source = process.platform === "darwin"
    ? nativeImage.createFromPath(trayPngPath)
    : nativeImage.createFromPath(pngPath);
  const fallback = source.isEmpty() ? nativeImage.createFromPath(icnsPath) : source;
  const image = fallback.resize({ width: 18, height: 18 });

  if (process.platform === "darwin" && !image.isEmpty()) {
    image.setTemplateImage(true);
  }

  return image;
}

function trayTitle() {
  return "";
}

function showMainWindow() {
  const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : createWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function notifyRendererSettingsChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("settings:changed");
}

function notifyRendererUpdatesChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("updates:changed", readUpdatePayload());
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion(),
    repo: resolveUpdateRepository()
  };

  notifyRendererUpdatesChanged();
}

function bindAutoUpdaterEvents() {
  if (autoUpdateEventsBound) {
    return;
  }

  autoUpdateEventsBound = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({
      status: "checking",
      checking: true,
      error: "",
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("update-available", () => {
    setUpdateState({
      status: "available",
      checking: false,
      available: true,
      downloaded: false,
      error: "",
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({
      status: "up-to-date",
      checking: false,
      available: false,
      downloaded: false,
      error: "",
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName, releaseDate, updateURL) => {
    setUpdateState({
      status: "downloaded",
      checking: false,
      available: true,
      downloaded: true,
      error: "",
      releaseNotes: releaseNotes || "",
      releaseName: releaseName || "",
      releaseDate: releaseDate ? new Date(releaseDate).toISOString() : "",
      updateUrl: updateURL || "",
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("error", (error) => {
    setUpdateState({
      status: "error",
      checking: false,
      error: error?.message ?? String(error),
      lastCheckedAt: new Date().toISOString()
    });
  });
}

function initializeAutoUpdates() {
  if (autoUpdateInitialized) {
    return;
  }

  autoUpdateInitialized = true;

  if (!updateState.enabled) {
    return;
  }

  bindAutoUpdaterEvents();

  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: resolveUpdateRepository()
      },
      updateInterval: "1 hour",
      notifyUser: true,
      onNotifyUser: makeUserNotifier(updateDialogCopy()),
      logger: console
    });
  } catch (error) {
    setUpdateState({
      status: "error",
      checking: false,
      error: error?.message ?? String(error)
    });
  }
}

async function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const copy = menuCopy();
  const payload = await readSettingsPayload();
  const installed = payload.installed !== false;
  const currentModel = currentEnv(payload.parsed).ANTHROPIC_MODEL?.trim() || copy.notSet;
  const activePresetName = installed
    ? findMatchingPresetName(payload.parsed, payload.presets)
    : null;

  const menu = Menu.buildFromTemplate([
    {
      label: copy.openApp,
      click: () => showMainWindow()
    },
    {
      label: `${copy.currentModel}: ${installed ? currentModel : copy.missing}`,
      click: () => {}
    },
    { type: "separator" },
    {
      label: copy.quickSwitch,
      enabled: false
    },
    ...payload.presets.map((preset) => ({
      label: preset.name,
      type: "radio",
      checked: preset.name === activePresetName,
      enabled: installed,
      click: async () => {
        try {
          await activateSettings(preset.content);
          notifyRendererSettingsChanged();
          await refreshTrayMenu();
        } catch (error) {
          console.error("Failed to switch preset from tray:", error);
        }
      }
    })),
    { type: "separator" },
    {
      label: copy.quit,
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
  tray.setTitle(trayTitle());
  tray.setToolTip(APP_NAME);
  globalThis.__JOSH_TRAY_READY__ = true;
  globalThis.__JOSH_TRAY_TITLE__ = trayTitle();
}

function createTray() {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayImage());
  tray.setTitle(trayTitle());
  tray.on("click", async () => {
    await refreshTrayMenu();
    tray.popUpContextMenu();
  });
  tray.on("right-click", async () => {
    await refreshTrayMenu();
    tray.popUpContextMenu();
  });

  refreshTrayMenu().catch(() => {});

  return tray;
}

ipcMain.handle("settings:read", async () => {
  return readSettingsPayload();
});

ipcMain.handle("updates:read", async () => {
  return readUpdatePayload();
});

ipcMain.handle("updates:check", async () => {
  if (!updateState.enabled) {
    return readUpdatePayload();
  }

  if (!autoUpdateInitialized) {
    initializeAutoUpdates();
  }

  try {
    setUpdateState({
      status: "checking",
      checking: true,
      error: "",
      lastCheckedAt: new Date().toISOString()
    });
    autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateState({
      status: "error",
      checking: false,
      error: error?.message ?? String(error),
      lastCheckedAt: new Date().toISOString()
    });
  }

  return readUpdatePayload();
});

ipcMain.handle("updates:install", async () => {
  if (!updateState.downloaded) {
    return readUpdatePayload();
  }

  autoUpdater.quitAndInstall();
  return readUpdatePayload();
});

ipcMain.handle("settings:activate", async (_event, nextSettings) => {
  const response = await activateSettings(nextSettings);
  notifyRendererSettingsChanged();
  await refreshTrayMenu();
  return response;
});

ipcMain.handle("presets:create", async (_event, preset) => {
  const presetStore = await readPresetStore();
  const trimmedName = preset.name.trim();

  if (!trimmedName) {
    throw new Error("JSON 名称不能为空。");
  }

  if (isOfficialPresetName(trimmedName)) {
    throw new Error("Official 是内置配置，不能覆盖。");
  }

  assertPresetContent(preset.content);

  const nextPresets = presetStore.presets.filter((item) => item.name !== trimmedName);
  nextPresets.push({
    name: trimmedName,
    content: normalizePresetContent(preset.content)
  });

  const response = await savePresetStore(nextPresets);
  await refreshTrayMenu();
  return response;
});

ipcMain.handle("presets:list", async () => {
  return readPresetStore();
});

ipcMain.handle("presets:delete", async (_event, presetName) => {
  const trimmedName = String(presetName ?? "").trim();
  if (!trimmedName) {
    throw new Error("没有指定要删除的 JSON。");
  }

  if (isOfficialPresetName(trimmedName)) {
    throw new Error("Official 不能删除。");
  }

  const presetStore = await readPresetStore();
  const nextPresets = presetStore.presets.filter((item) => item.name !== trimmedName);

  const response = await savePresetStore(nextPresets);
  await refreshTrayMenu();
  return response;
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  initializeAutoUpdates();

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }

    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
