import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
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
const pty = require("node-pty");

const isDev = !app.isPackaged;
const APP_NAME = isDev ? "JOSH Dev" : "JOSH";
const DEFAULT_UPDATE_REPOSITORY = "vinzeny/josh";
const APP_STORAGE_DIR = path.join(os.homedir(), ".josh");
const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const CODEX_CONFIG_PATH = path.join(os.homedir(), ".codex", "config.toml");
const BACKUP_DIR = path.join(APP_STORAGE_DIR, "backups");
const PRESET_STORE_PATH = path.join(APP_STORAGE_DIR, "presets.json");
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const OFFICIAL_NAME_ALIASES = new Set(["official", "official json"]);
const OFFICIAL_PRESET = {
  name: "Official",
  content: {
    claude: {
      env: {}
    },
    codex: {}
  }
};
let mainWindow = null;
let tray = null;
let isQuitting = false;
let autoUpdateInitialized = false;
let autoUpdateEventsBound = false;
let updateState = createInitialUpdateState();
let folderCounter = 0;
let terminalCounter = 0;
let didInitializeDefaultTerminal = false;
const terminalFolders = new Map();
const terminalSessions = new Map();
const FILE_TREE_MAX_ENTRIES = 400;
const FILE_TREE_IGNORED_NAMES = new Set([
  ".DS_Store",
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out"
]);

app.setName(APP_NAME);
app.setPath("userData", path.join(app.getPath("appData"), APP_NAME));
nativeTheme.themeSource = "system";

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: "",
    backgroundColor: "#111312",
    webPreferences: {
      preload: path.join(app.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

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
    window.loadURL("http://localhost:5174");
  } else {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  window.show();
  window.focus();

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

function currentCodex(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  const codex = settings.codex;
  if (!codex || typeof codex !== "object" || Array.isArray(codex)) {
    return {};
  }

  return normalizeCodexConfig(codex);
}

function currentPresetContent(settings) {
  return normalizePresetContent({
    claude: {
      env: currentEnv(settings)
    },
    codex: currentCodex(settings)
  });
}

function findMatchingPresetName(settings, presets) {
  const current = stableStringify(currentPresetContent(settings));
  const matched = presets.find(
    (preset) => stableStringify(normalizePresetContent(preset.content)) === current
  );
  return matched?.name ?? null;
}

function currentModelLabel(settings, fallback) {
  const claudeModel = currentEnv(settings).ANTHROPIC_MODEL?.trim();
  const codexModel = currentCodex(settings).model?.trim();

  if (claudeModel && codexModel) {
    return `${claudeModel} / ${codexModel}`;
  }

  return claudeModel || codexModel || fallback;
}

function timestampLabel() {
  return new Date().toISOString().replaceAll(":", "-");
}

function isOfficialPresetName(name) {
  return OFFICIAL_NAME_ALIASES.has(String(name ?? "").trim().toLowerCase());
}

function missingClaudeCodeError() {
  const error = new Error("未找到 Claude Code 或 Codex 配置，请先安装并启动一次。");
  error.code = "CLAUDE_CODE_MISSING";
  return error;
}

function sanitizeTerminalName(value, fallback) {
  const name = String(value ?? "").trim();
  return name || fallback;
}

function serializeTerminalFolder(folder) {
  const terminalIds = Array.from(terminalSessions.values())
    .filter((session) => session.folderId === folder.id)
    .map((session) => session.id);

  return {
    id: folder.id,
    name: folder.name,
    cwd: folder.cwd,
    terminalIds,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
  };
}

function serializeTerminal(session) {
  return {
    id: session.id,
    name: session.name,
    folderId: session.folderId,
    cwd: session.cwd,
    running: session.running,
    buffer: session.buffer,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function ensureTerminalFolder(cwd) {
  const normalizedCwd = path.resolve(cwd || os.homedir());
  const existing = Array.from(terminalFolders.values()).find(
    (folder) => folder.cwd === normalizedCwd
  );

  if (existing) {
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const now = new Date().toISOString();
  const folder = {
    id: `folder-${++folderCounter}`,
    name: path.basename(normalizedCwd) || normalizedCwd,
    cwd: normalizedCwd,
    createdAt: now,
    updatedAt: now
  };

  terminalFolders.set(folder.id, folder);
  return folder;
}

function defaultTerminalCwd() {
  const candidates = [
    process.env.JOSH_TERMINAL_CWD,
    process.env.INIT_CWD,
    process.cwd(),
    process.env.PWD,
    isDev ? app.getAppPath() : ""
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      path.isAbsolute(candidate) &&
      candidate !== "/" &&
      !candidate.includes(`${path.sep}.app${path.sep}Contents`)
    ) {
      return candidate;
    }
  }

  return os.homedir();
}

function buildTerminalEnvironment() {
  const env = { ...process.env };

  delete env.SHELL_SESSION_ID;
  delete env.SHELL_SESSION_FILE;
  delete env.SHELL_SESSION_HISTORY;
  delete env.SHELL_SESSION_HISTFILE;

  return {
    ...env,
    TERM: "xterm-256color",
    TERM_PROGRAM: process.platform === "darwin" ? "Apple_Terminal" : APP_NAME,
    JOSH_TERM_PROGRAM: APP_NAME,
    TERM_PROGRAM_VERSION: app.getVersion(),
    COLORTERM: "truecolor",
    SHELL_SESSIONS_DISABLE: "1",
    PROMPT_EOL_MARK: ""
  };
}

function terminalShellArgs(shell) {
  const shellName = path.basename(String(shell));
  return /^(bash|fish|sh|zsh)$/.test(shellName) ? ["-l"] : [];
}

function terminalLoginBanner() {
  if (process.platform !== "darwin") {
    return "";
  }

  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const formatted = `${parts.weekday} ${parts.month} ${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

  return `Last login: ${formatted} on ${process.env.TTY_NAME || "ttys000"}\r\n`;
}

function skipAnsiSequence(value, index) {
  if (value[index] !== "\u001b") {
    return index;
  }

  const next = value[index + 1];
  if (next === "[") {
    let cursor = index + 2;
    while (cursor < value.length) {
      const code = value.charCodeAt(cursor);
      cursor += 1;

      if (code >= 0x40 && code <= 0x7e) {
        return cursor;
      }
    }

    return value.length;
  }

  if (next === "]") {
    let cursor = index + 2;
    while (cursor < value.length) {
      if (value[cursor] === "\u0007") {
        return cursor + 1;
      }

      if (value[cursor] === "\u001b" && value[cursor + 1] === "\\") {
        return cursor + 2;
      }

      cursor += 1;
    }

    return value.length;
  }

  return Math.min(index + 2, value.length);
}

function stripInitialTerminalBlankRows(output) {
  let cursor = 0;
  let rowStart = 0;

  while (cursor < output.length) {
    const character = output[cursor];

    if (character === "\u001b") {
      cursor = skipAnsiSequence(output, cursor);
      continue;
    }

    if (character === "\r" || character === " " || character === "\t") {
      cursor += 1;
      continue;
    }

    if (character === "\n") {
      cursor += 1;
      rowStart = cursor;
      continue;
    }

    return output.slice(rowStart);
  }

  return "";
}

function normalizeInitialTerminalOutput(session, data) {
  const output = String(data ?? "");
  if (session.hasTerminalOutput) {
    return output;
  }

  const normalizedOutput = stripInitialTerminalBlankRows(output);
  if (!normalizedOutput) {
    return "";
  }

  session.hasTerminalOutput = true;
  return normalizedOutput;
}

async function resolveDirectory(inputPath, basePath = os.homedir()) {
  const rawPath = String(inputPath || "").trim();
  const expandedPath = rawPath.startsWith("~")
    ? path.join(os.homedir(), rawPath.slice(1))
    : rawPath;
  const resolvedPath = path.resolve(basePath, expandedPath || ".");
  const stat = await fs.stat(resolvedPath);

  if (!stat.isDirectory()) {
    throw new Error("目标路径不是目录。");
  }

  return resolvedPath;
}

async function readFileTreeDirectory(inputPath) {
  const directory = await resolveDirectory(inputPath);
  const dirents = await fs.readdir(directory, { withFileTypes: true });
  const entries = dirents
    .filter((entry) => !FILE_TREE_IGNORED_NAMES.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
      type: entry.isDirectory() ? "directory" : "file",
      hidden: entry.name.startsWith(".")
    }))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    })
    .slice(0, FILE_TREE_MAX_ENTRIES);

  return {
    path: directory,
    name: path.basename(directory) || directory,
    entries
  };
}

function createTerminalSession(options = {}) {
  const id = `terminal-${++terminalCounter}`;
  const folder = options.folderId && terminalFolders.has(options.folderId)
    ? terminalFolders.get(options.folderId)
    : ensureTerminalFolder(options.cwd || defaultTerminalCwd());
  const cwd = folder.cwd;
  const now = new Date().toISOString();
  const shell = process.platform === "win32"
    ? process.env.COMSPEC || "powershell.exe"
    : process.platform === "darwin"
      ? process.env.SHELL || "/bin/zsh"
      : process.env.SHELL || "/bin/bash";
  const session = {
    id,
    name: sanitizeTerminalName(options.name, `Terminal ${terminalCounter}`),
    folderId: folder.id,
    cwd,
    running: true,
    buffer: terminalLoginBanner(),
    hasTerminalOutput: false,
    ptyProcess: null,
    createdAt: now,
    updatedAt: now
  };

  session.ptyProcess = pty.spawn(shell, terminalShellArgs(shell), {
    name: "xterm-256color",
    cols: Math.max(80, Number(options.cols) || 120),
    rows: Math.max(24, Number(options.rows) || 32),
    cwd,
    env: buildTerminalEnvironment()
  });

  session.ptyProcess.onData((data) => {
    const output = normalizeInitialTerminalOutput(session, data);
    if (!output) {
      return;
    }

    session.buffer = `${session.buffer}${output}`.slice(-200000);
    session.updatedAt = new Date().toISOString();
    notifyRendererTerminalData(session.id, output);
  });

  session.ptyProcess.onExit(({ exitCode }) => {
    session.running = false;
    session.updatedAt = new Date().toISOString();
    const data = `\r\n[process exited with code ${exitCode}]\r\n`;
    session.buffer = `${session.buffer}${data}`.slice(-200000);
    notifyRendererTerminalData(session.id, data);
    notifyRendererTerminalsChanged();
  });

  terminalSessions.set(id, session);
  folder.updatedAt = now;
  return session;
}

function ensureInitialTerminal() {
  if (
    terminalSessions.size === 0 &&
    terminalFolders.size === 0 &&
    !didInitializeDefaultTerminal
  ) {
    didInitializeDefaultTerminal = true;
    createTerminalSession({ name: "Terminal 1" });
  }
}

function getTerminalSession(id) {
  ensureInitialTerminal();

  const session = terminalSessions.get(id) ?? terminalSessions.values().next().value;
  if (!session) {
    throw new Error("未找到 Terminal。");
  }

  return session;
}

function readTerminalsPayload(activeId, activeFolderId) {
  ensureInitialTerminal();

  const terminals = Array.from(terminalSessions.values()).map(serializeTerminal);
  const folders = Array.from(terminalFolders.values()).map(serializeTerminalFolder);
  const explicitFolder = terminalFolders.get(activeFolderId);
  const requestedTerminal = terminalSessions.get(activeId);
  const requestedTerminalInFolder =
    requestedTerminal &&
    explicitFolder &&
    (requestedTerminal.folderId === explicitFolder.id || requestedTerminal.cwd === explicitFolder.cwd);
  const folderTerminal = explicitFolder
    ? Array.from(terminalSessions.values()).find(
        (session) => session.folderId === explicitFolder.id || session.cwd === explicitFolder.cwd
      )
    : null;
  const activeTerminal = explicitFolder
    ? (requestedTerminalInFolder ? requestedTerminal : folderTerminal)
    : requestedTerminal ?? terminalSessions.values().next().value ?? null;
  const nextActiveFolderId =
    explicitFolder?.id ?? activeTerminal?.folderId ?? folders[0]?.id ?? "";

  return {
    folders,
    terminals,
    activeTerminalId: activeTerminal?.id ?? "",
    activeFolderId: nextActiveFolderId
  };
}

function writeTerminalInput(id, input) {
  const session = getTerminalSession(id);

  if (!session.running || !session.ptyProcess) {
    return serializeTerminal(session);
  }

  session.ptyProcess.write(String(input ?? ""));
  session.updatedAt = new Date().toISOString();
  return serializeTerminal(session);
}

function renameTerminal(id, name) {
  const session = getTerminalSession(id);
  session.name = sanitizeTerminalName(name, session.name);
  session.updatedAt = new Date().toISOString();
  notifyRendererTerminalsChanged();
  return serializeTerminal(session);
}

function deleteTerminal(id) {
  const session = terminalSessions.get(id);
  if (!session) {
    return null;
  }

  const folderId = session.folderId;
  destroyTerminalSession(session);
  terminalSessions.delete(id);
  const folder = terminalFolders.get(folderId);
  if (folder) {
    folder.updatedAt = new Date().toISOString();
  }
  notifyRendererTerminalsChanged(undefined, folderId);
  return serializeTerminal(session);
}

function deleteTerminalFolder(id) {
  const folder = terminalFolders.get(id);
  if (!folder) {
    return null;
  }

  for (const session of Array.from(terminalSessions.values())) {
    if (session.folderId === id) {
      destroyTerminalSession(session);
      terminalSessions.delete(session.id);
    }
  }

  terminalFolders.delete(id);
  notifyRendererTerminalsChanged();
  return serializeTerminalFolder(folder);
}

function resizeTerminal(id, dimensions = {}) {
  const session = getTerminalSession(id);
  const cols = Math.max(20, Number(dimensions.cols) || 120);
  const rows = Math.max(8, Number(dimensions.rows) || 32);

  if (session.running && session.ptyProcess) {
    session.ptyProcess.resize(cols, rows);
  }

  return serializeTerminal(session);
}

function destroyTerminalSession(session) {
  if (!session?.ptyProcess) {
    return;
  }

  try {
    session.ptyProcess.kill();
  } catch {
    // Process may already be gone.
  }
}

function notifyRendererTerminalData(id, data) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("terminals:data", { id, data });
}

function notifyRendererTerminalsChanged(activeId, activeFolderId) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("terminals:changed", readTerminalsPayload(activeId, activeFolderId));
}

function invalidPresetStoreError() {
  const error = new Error("Preset store is invalid.");
  error.code = "PRESET_STORE_INVALID";
  return error;
}

function isPlainObject(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return false;
  }

  return true;
}

function assertStringMap(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} 必须是一个对象。`);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${label}.${key} 必须是字符串。`);
    }
  }
}

function normalizeStringMap(value, options = {}) {
  if (!isPlainObject(value)) {
    return {};
  }

  const allowEmpty = options.allowEmpty !== false;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === "string")
      .filter(([, entry]) => allowEmpty || entry.trim())
  );
}

function isStructuredPresetContent(value) {
  return isPlainObject(value) && ("claude" in value || "codex" in value);
}

function extractClaudeEnv(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  if (isStructuredPresetContent(value)) {
    const claude = isPlainObject(value.claude) ? value.claude : {};
    if (isPlainObject(claude.env)) {
      return normalizeStringMap(claude.env);
    }

    if (isPlainObject(value.env)) {
      return normalizeStringMap(value.env);
    }

    return {};
  }

  if (isPlainObject(value.env)) {
    return normalizeStringMap(value.env);
  }

  return normalizeStringMap(value);
}

function normalizeCodexConfig(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  const model = typeof value.model === "string" ? value.model.trim() : "";
  const reasoningEffort = typeof value.model_reasoning_effort === "string"
    ? value.model_reasoning_effort.trim()
    : "";
  const codex = {};

  if (model) {
    codex.model = model;
  }

  if (reasoningEffort) {
    codex.model_reasoning_effort = reasoningEffort;
  }

  return codex;
}

function extractCodexConfig(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  if (isStructuredPresetContent(value)) {
    return normalizeCodexConfig(value.codex);
  }

  return normalizeCodexConfig({
    model: value.CODEX_MODEL,
    model_reasoning_effort: value.CODEX_REASONING_EFFORT
  });
}

function assertPresetContent(value) {
  if (!isPlainObject(value)) {
    throw new Error("JSON 内容必须是一个对象。");
  }

  if (isStructuredPresetContent(value)) {
    const claude = isPlainObject(value.claude) ? value.claude : {};
    assertStringMap(isPlainObject(claude.env) ? claude.env : {}, "claude.env");
    assertStringMap(isPlainObject(value.codex) ? value.codex : {}, "codex");
    return;
  }

  assertStringMap(isPlainObject(value.env) ? value.env : value, "env");
}

function normalizePresetContent(value) {
  return {
    claude: {
      env: extractClaudeEnv(value)
    },
    codex: extractCodexConfig(value)
  };
}

function normalizePresetEntry(preset) {
  if (!preset || typeof preset.name !== "string") {
    return null;
  }

  const isOfficial = isOfficialPresetName(preset.name);
  const content = isOfficial ? OFFICIAL_PRESET.content : normalizePresetContent(preset.content ?? preset.env);
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

function stripTomlComment(value) {
  let quote = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }

    if (char === "#" && !quote) {
      return value.slice(0, index);
    }
  }

  return value;
}

function parseTomlStringValue(value) {
  const trimmed = stripTomlComment(value).trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("\"")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, trimmed.lastIndexOf("\""));
    }
  }

  if (trimmed.startsWith("'")) {
    const closingIndex = trimmed.indexOf("'", 1);
    return closingIndex > 0 ? trimmed.slice(1, closingIndex) : trimmed.slice(1);
  }

  return trimmed;
}

function isTomlTableHeader(line) {
  return /^\s*\[[^\]]+\]/.test(line);
}

function readTopLevelTomlString(raw, key) {
  const lines = String(raw ?? "").split(/\r?\n/);
  const pattern = new RegExp(`^\\s*${key}\\s*=`);

  for (const line of lines) {
    if (isTomlTableHeader(line)) {
      break;
    }

    if (!pattern.test(line)) {
      continue;
    }

    return parseTomlStringValue(line.slice(line.indexOf("=") + 1));
  }

  return "";
}

function encodeTomlString(value) {
  return JSON.stringify(String(value));
}

function upsertTopLevelTomlString(raw, key, value) {
  const stringValue = String(value ?? "").trim();
  const hadTrailingNewline = /\r?\n$/.test(raw ?? "");
  const lines = raw ? String(raw).replace(/\r\n/g, "\n").split("\n") : [];
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  const tableIndex = lines.findIndex(isTomlTableHeader);
  const searchEnd = tableIndex >= 0 ? tableIndex : lines.length;
  const existingIndex = lines.findIndex((line, index) => index < searchEnd && pattern.test(line));

  if (!stringValue) {
    if (existingIndex >= 0) {
      lines.splice(existingIndex, 1);
    }
    return lines.length ? `${lines.join("\n")}${hadTrailingNewline ? "\n" : ""}` : "";
  }

  const nextLine = `${key} = ${encodeTomlString(stringValue)}`;
  if (existingIndex >= 0) {
    lines[existingIndex] = nextLine;
  } else {
    lines.splice(searchEnd, 0, nextLine);
  }

  return `${lines.join("\n")}\n`;
}

function parseCodexConfig(raw) {
  return normalizeCodexConfig({
    model: readTopLevelTomlString(raw, "model"),
    model_reasoning_effort: readTopLevelTomlString(raw, "model_reasoning_effort")
  });
}

function updateCodexConfigRaw(raw, codex) {
  let nextRaw = raw ?? "";

  nextRaw = upsertTopLevelTomlString(nextRaw, "model", codex.model);
  nextRaw = upsertTopLevelTomlString(
    nextRaw,
    "model_reasoning_effort",
    codex.model_reasoning_effort
  );

  return nextRaw;
}

async function readCodexConfigPayload() {
  try {
    const raw = await fs.readFile(CODEX_CONFIG_PATH, "utf8");
    return {
      installed: true,
      raw,
      parsed: parseCodexConfig(raw)
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      installed: false,
      raw: "",
      parsed: {}
    };
  }
}

async function readSettingsPayload() {
  const claudeInstalled = await pathExists(SETTINGS_PATH);
  const codexConfig = await readCodexConfigPayload();
  const installed = claudeInstalled || codexConfig.installed;
  const presetStore = await readPresetStore();

  if (!claudeInstalled) {
    return {
      installed,
      claudeInstalled: false,
      codexInstalled: codexConfig.installed,
      settingsPath: SETTINGS_PATH,
      codexConfigPath: CODEX_CONFIG_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed: {
        env: {},
        codex: codexConfig.parsed
      },
      raw: "",
      presets: presetStore.presets
    };
  }

  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      installed: true,
      claudeInstalled: true,
      codexInstalled: codexConfig.installed,
      settingsPath: SETTINGS_PATH,
      codexConfigPath: CODEX_CONFIG_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed: {
        ...parsed,
        codex: codexConfig.parsed
      },
      raw,
      presets: presetStore.presets
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      installed: codexConfig.installed,
      claudeInstalled: false,
      codexInstalled: codexConfig.installed,
      settingsPath: SETTINGS_PATH,
      codexConfigPath: CODEX_CONFIG_PATH,
      appStorageDir: APP_STORAGE_DIR,
      presetStorePath: PRESET_STORE_PATH,
      backupDir: BACKUP_DIR,
      parsed: {
        env: {},
        codex: codexConfig.parsed
      },
      raw: "",
      presets: presetStore.presets
    };
  }
}

async function activateSettings(nextSettings) {
  assertPresetContent(nextSettings);
  const normalized = normalizePresetContent(nextSettings);
  const nextEnv = normalized.claude.env;
  const nextCodex = normalized.codex;
  let current = null;
  let claudeInstalled = true;
  let codexRaw = "";
  let codexInstalled = true;

  try {
    current = await readJson(SETTINGS_PATH);
  } catch (error) {
    if (error.code === "ENOENT") {
      claudeInstalled = false;
    } else {
      throw error;
    }
  }

  try {
    codexRaw = await fs.readFile(CODEX_CONFIG_PATH, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      codexInstalled = false;
    } else {
      throw error;
    }
  }

  const shouldWriteClaude = claudeInstalled;
  const shouldWriteCodex = codexInstalled || Object.keys(nextCodex).length > 0;

  if (!shouldWriteClaude && !shouldWriteCodex) {
    throw missingClaudeCodeError();
  }

  let merged = current
    ? {
        ...current,
        env: nextEnv
      }
    : {
        env: nextEnv
      };
  let backupName = "";
  let codexBackupName = "";

  await ensureBackupDir();

  if (shouldWriteClaude) {
    backupName = `settings-${timestampLabel()}.json`;
    await writeJson(path.join(BACKUP_DIR, backupName), current);
    await writeJson(SETTINGS_PATH, merged);
  }

  if (shouldWriteCodex) {
    if (codexInstalled) {
      codexBackupName = `codex-config-${timestampLabel()}.toml`;
      await fs.writeFile(path.join(BACKUP_DIR, codexBackupName), codexRaw, "utf8");
    }

    await fs.mkdir(path.dirname(CODEX_CONFIG_PATH), { recursive: true });
    codexRaw = updateCodexConfigRaw(codexRaw, nextCodex);
    await fs.writeFile(CODEX_CONFIG_PATH, codexRaw, "utf8");
  }

  merged = {
    ...merged,
    codex: parseCodexConfig(codexRaw)
  };

  return {
    ok: true,
    saved: merged,
    backupName,
    codexBackupName
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
        officialModel: "官方模型",
        missing: "未找到 Claude Code 或 Codex",
        quickSwitch: "快捷切换",
        quit: "退出"
      }
    : {
        openApp: "Open JOSH",
        currentModel: "Current Model",
        notSet: "Not set",
        officialModel: "Official Model",
        missing: "Claude Code or Codex Not Found",
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
  const activePresetName = installed
    ? findMatchingPresetName(payload.parsed, payload.presets)
    : null;
  const currentModel = activePresetName === OFFICIAL_PRESET.name
    ? copy.officialModel
    : currentModelLabel(payload.parsed, copy.notSet);

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

ipcMain.handle("terminals:list", async (_event, activeId) => {
  return readTerminalsPayload(activeId);
});

ipcMain.handle("terminals:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "选择 Terminal 文件夹"
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      ...readTerminalsPayload()
    };
  }

  const cwd = await resolveDirectory(result.filePaths[0]);
  const folder = ensureTerminalFolder(cwd);
  notifyRendererTerminalsChanged(undefined, folder.id);

  return {
    canceled: false,
    folder: serializeTerminalFolder(folder),
    ...readTerminalsPayload(undefined, folder.id)
  };
});

ipcMain.handle("terminals:create", async (_event, options = {}) => {
  const cwd = options.cwd ? await resolveDirectory(options.cwd) : undefined;
  const session = createTerminalSession({
    name: options.name,
    folderId: options.folderId,
    cwd,
    cols: options.cols,
    rows: options.rows
  });

  notifyRendererTerminalsChanged(session.id, session.folderId);

  return {
    terminal: serializeTerminal(session),
    ...readTerminalsPayload(session.id, session.folderId)
  };
});

ipcMain.handle("terminals:write", async (_event, payload = {}) => {
  const terminal = writeTerminalInput(payload.id, payload.data);
  return {
    terminal,
    ...readTerminalsPayload(terminal.id, terminal.folderId)
  };
});

ipcMain.handle("terminals:rename", async (_event, payload = {}) => {
  const terminal = renameTerminal(payload.id, payload.name);
  return {
    terminal,
    ...readTerminalsPayload(terminal.id, terminal.folderId)
  };
});

ipcMain.handle("terminals:delete", async (_event, payload = {}) => {
  const deleted = deleteTerminal(payload.id);
  return {
    terminal: deleted,
    ...readTerminalsPayload(undefined, deleted?.folderId)
  };
});

ipcMain.handle("terminals:delete-folder", async (_event, payload = {}) => {
  const deleted = deleteTerminalFolder(payload.id);
  return {
    folder: deleted,
    ...readTerminalsPayload()
  };
});

ipcMain.handle("terminals:resize", async (_event, payload = {}) => {
  const terminal = resizeTerminal(payload.id, {
    cols: payload.cols,
    rows: payload.rows
  });
  return {
    terminal,
    ...readTerminalsPayload(terminal.id, terminal.folderId)
  };
});

ipcMain.handle("files:list-directory", async (_event, payload = {}) => {
  return readFileTreeDirectory(payload.path);
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
  for (const session of terminalSessions.values()) {
    destroyTerminalSession(session);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
