import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const APP_NAME = "JOSH";
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

  if (rendererUrl) {
    window.loadURL(rendererUrl);
  } else if (isDev) {
    window.loadURL("http://localhost:5173");
  } else {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
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

async function readPresetStore() {
  await ensureAppStorageDir();

  try {
    const parsed = await readJson(PRESET_STORE_PATH);
    if (!Array.isArray(parsed.presets)) {
      throw new Error("Preset store is invalid.");
    }

    const customPresets = parsed.presets
      .map(normalizePresetEntry)
      .filter((preset) => preset && preset.name !== OFFICIAL_PRESET.name);

    const normalizedStore = {
      presets: [OFFICIAL_PRESET, ...customPresets]
    };

    if (stableStringify(parsed) !== stableStringify(normalizedStore)) {
      await writeJson(PRESET_STORE_PATH, normalizedStore);
    }

    return normalizedStore;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const initialStore = { presets: [OFFICIAL_PRESET] };
    await writeJson(PRESET_STORE_PATH, initialStore);
    return initialStore;
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

ipcMain.handle("settings:read", async () => {
  const presetStore = await readPresetStore();
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
});

ipcMain.handle("settings:activate", async (_event, nextSettings) => {
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

  return savePresetStore(nextPresets);
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

  return savePresetStore(nextPresets);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
