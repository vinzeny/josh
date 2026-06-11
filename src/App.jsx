import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderPlus,
  Globe2,
  Grid2X2,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Rows3,
  Settings2,
  SquareTerminal,
  Terminal,
  Trash2,
  X
} from "lucide-react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import MarketingSite from "@/MarketingSite";
import joshMark from "@/assets/josh.svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OFFICIAL_NAME = "Official";
const LOCALE_STORAGE_KEY = "swtch-locale";
const THEME_STORAGE_KEY = "swtch-theme-mode";
const THEME_OPTIONS = [
  {
    key: "system",
    labelZh: "跟随系统",
    labelEn: "System",
    swatch: "linear-gradient(135deg, #0b0e12 0 50%, #ffffff 50% 100%)"
  },
  {
    key: "dark",
    labelZh: "黑色",
    labelEn: "Dark",
    swatch: "#0b0e12"
  },
  {
    key: "light",
    labelZh: "白色",
    labelEn: "Light",
    swatch: "#ffffff"
  }
];
const TERMINAL_LAYOUT_OPTIONS = [
  { key: "single", Icon: SquareTerminal },
  { key: "columns", Icon: Columns2 },
  { key: "rows", Icon: Rows3 },
  { key: "grid", Icon: Grid2X2 }
];
const SETTINGS_SECTIONS = ["models", "appearance", "basic"];
const XTERM_THEMES = {
  dark: {
    background: "rgba(11, 14, 18, 0.88)",
    foreground: "#e6e9ee",
    cursor: "#73d2de",
    selectionBackground: "#24374a",
    black: "#0b0e12",
    brightBlack: "#6b7280",
    red: "#ff6b7a",
    brightRed: "#ff8c98",
    green: "#82d173",
    brightGreen: "#a7e59b",
    yellow: "#f6c85f",
    brightYellow: "#f9dc82",
    blue: "#6ea8fe",
    brightBlue: "#9bc3ff",
    magenta: "#c084fc",
    brightMagenta: "#d8b4fe",
    cyan: "#5eead4",
    brightCyan: "#99f6e4",
    white: "#e6e9ee",
    brightWhite: "#ffffff"
  },
  light: {
    background: "rgba(255, 255, 255, 0.84)",
    foreground: "#111827",
    cursor: "#2563eb",
    selectionBackground: "#dbeafe",
    black: "#111827",
    brightBlack: "#6b7280",
    red: "#dc2626",
    brightRed: "#ef4444",
    green: "#15803d",
    brightGreen: "#16a34a",
    yellow: "#a16207",
    brightYellow: "#ca8a04",
    blue: "#2563eb",
    brightBlue: "#3b82f6",
    magenta: "#7c3aed",
    brightMagenta: "#8b5cf6",
    cyan: "#0891b2",
    brightCyan: "#06b6d4",
    white: "#e5e7eb",
    brightWhite: "#f9fafb"
  }
};
const FORM_FIELDS = [
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    target: "claude",
    labelZh: "Auth Token",
    labelEn: "Auth Token",
    placeholderZh: "粘贴 ANTHROPIC_AUTH_TOKEN",
    placeholderEn: "Paste ANTHROPIC_AUTH_TOKEN"
  },
  {
    key: "ANTHROPIC_BASE_URL",
    target: "claude",
    labelZh: "Base URL",
    labelEn: "Base URL",
    placeholderZh: "例如：https://api.example.com",
    placeholderEn: "For example: https://api.example.com"
  },
  {
    key: "ANTHROPIC_MODEL",
    target: "claude",
    labelZh: "Claude Model",
    labelEn: "Claude Model",
    placeholderZh: "例如：glm-5",
    placeholderEn: "For example: glm-5"
  },
  {
    key: "model",
    target: "codex",
    labelZh: "Codex Model",
    labelEn: "Codex Model",
    placeholderZh: "例如：gpt-5.4",
    placeholderEn: "For example: gpt-5.4"
  },
  {
    key: "model_reasoning_effort",
    target: "codex",
    labelZh: "Codex Reasoning",
    labelEn: "Codex Reasoning",
    placeholderZh: "例如：xhigh",
    placeholderEn: "For example: xhigh"
  }
];
const PRESET_TEMPLATE = {
  claude: {
    env: {
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_BASE_URL: "",
      ANTHROPIC_MODEL: ""
    }
  },
  codex: {
    model: "",
    model_reasoning_effort: ""
  }
};
const DEFAULT_UPDATE_STATE = Object.freeze({
  supported: true,
  enabled: false,
  canCheck: false,
  checking: false,
  available: false,
  downloaded: false,
  currentVersion: "",
  repo: "",
  status: "idle",
  releaseName: "",
  releaseDate: "",
  releaseNotes: "",
  updateUrl: "",
  lastCheckedAt: "",
  error: ""
});
const MESSAGES = {
  zh: {
    title: "模型切换器",
    restartHint: "切换后请关闭终端，并重新启动 Claude 或 Codex。",
    settings: "设置",
    add: "新增",
    currentModel: "当前模型",
    notSet: "未设置",
    officialModel: "官方模型",
    unmatchedPreset: "未匹配列表",
    claudeMissingShort: "未安装",
    claudeMissingTitle: "未找到 Claude Code 或 Codex",
    claudeMissingBody: "请先安装并启动一次 Claude Code 或 Codex，然后再切换模型。",
    activeNow: "当前启用",
    manualConfig: "手动配置",
    presetList: "配置列表",
    presetCount: (count) => `${count} 个配置`,
    builtin: "内置",
    activeBadge: "生效中",
    editPreset: (name) => `编辑 ${name}`,
    cloneOfficial: "复制 Official",
    launch: "启动",
    current: "当前",
    terminalPanel: "本地 Terminal",
    terminalCount: (count) => `${count} 个 Terminal`,
    newTerminal: "新建 Terminal",
    selectFolder: "选择文件夹",
    terminalLayout: "Terminal 布局",
    terminalLayouts: {
      single: "单窗",
      columns: "分栏",
      rows: "上下",
      grid: "网格"
    },
    addTerminalToFolder: (name) => `在 ${name} 中添加`,
    renameTerminal: (name) => `重命名 ${name}`,
    deleteTerminal: (name) => `删除 ${name}`,
    deleteFolder: (name) => `移除 ${name}`,
    terminalUnavailable: "当前环境未暴露本地 Terminal。",
    emptyFolderTerminals: "这个文件夹还没有 Terminal。",
    terminalInputPlaceholder: "输入命令，Enter 执行",
    running: "执行中",
    idle: "就绪",
    utilityPanel: "右侧面板",
    collapsePanel: "收起右侧面板",
    expandPanel: "展开右侧面板",
    fileTree: "文件树",
    browser: "浏览器",
    browserUrlPlaceholder: "输入网址",
    browserGo: "前往",
    browserBack: "后退",
    browserForward: "前进",
    browserReload: "刷新",
    fileTreeUnavailable: "当前环境未暴露本地文件树。",
    fileTreeLoading: "读取中...",
    projectDirectory: "项目目录",
    parentDirectory: "上级目录",
    refreshDirectory: "刷新目录",
    directoryEmpty: "这个目录没有可显示的文件。",
    directoryError: "目录读取失败",
    envSection: "模型配置",
    editorTitleNew: "新增配置",
    editorTitleEdit: (name) => `编辑 ${name}`,
    editorDescription: "只改写 Claude Code env 和 Codex config.toml 的模型字段。",
    editorMode: "编辑模式",
    formMode: "表单",
    jsonMode: "JSON",
    showToken: "显示密码",
    hideToken: "隐藏密码",
    nameLabel: "配置名字",
    namePlaceholder: "例如：glm5",
    jsonLabel: "Preset JSON",
    formHint: "常用字段直接填，切到 JSON 可以整段粘贴。",
    envHint: "支持 claude.env 与 codex.model / codex.model_reasoning_effort。",
    delete: "删除",
    cancel: "取消",
    save: "保存",
    saving: "处理中...",
    settingsTitle: "设置",
    settingsDescription: "管理 Claude / Codex 模型预设、更新和本地文件位置。",
    settingsSections: {
      models: "Claude Code模型配置",
      appearance: "外观",
      basic: "基本信息"
    },
    updateTitle: "版本更新",
    updateVersion: "当前版本",
    updateSource: "GitHub Release",
    updateCheck: "检查新版本",
    updateChecking: "检查中...",
    updateInstall: "立即更新",
    updateEnabled: "JOSH 会在启动时检查 GitHub Release，有新版本时会提示你更新。",
    updateCurrent: "当前已经是最新版本。",
    updateAvailable: "发现新版本，正在后台下载，下载完成后会提示你更新。",
    updateDownloaded: (name) =>
      name ? `${name} 已准备好，点“立即更新”后重启即可完成安装。` : "新版本已准备好，点“立即更新”后重启即可完成安装。",
    updateDevelopment: "开发模式下不可用。请安装发布版再测试自动更新。",
    updateUnsupported: "当前平台不支持自动更新。",
    updateError: (message) => `更新检查失败：${message}`,
    updateHint: "只会识别已发布的 GitHub Release；draft 和 pre-release 不会被推送给用户。",
    appearance: "外观",
    themeMode: "主题",
    language: "界面语言",
    chinese: "中文",
    english: "English",
    settingsPath: "Claude 配置",
    codexConfigPath: "Codex 配置",
    presetPath: "预设文件",
    backupPath: "备份目录",
    appPath: "JOSH 目录",
    status: {
      loading: "正在读取配置...",
      loaded: "配置已加载。",
      claudeMissing: "未找到 Claude Code 或 Codex 配置，请先安装并启动一次。",
      invalidFormat: "当前草稿无法格式化。",
      nameRequired: "请先输入配置名字。",
      duplicateName: "这个名字已经存在了。",
      invalidDraft: "当前预设还不能保存。",
      invalidFormMode: "JSON 无效，先修正后再切回表单。",
      saved: (name) => `已保存 ${name}。`,
      renamed: (from, to) => `已将 ${from} 更新为 ${to}。`,
      switched: (name) => `已切换到 ${name}。`,
      deleted: (name) => `已删除 ${name}。`,
      languageChanged: "已切换界面语言。",
      themeChanged: "已切换主题。",
      folderAdded: (name) => `已选择 ${name}。`,
      folderRemoved: (name) => `已移除 ${name}。`,
      terminalCreated: "已新建 Terminal。",
      terminalDeleted: (name) => `已删除 ${name}。`,
      terminalCommandFailed: (message) => `命令执行失败：${message}`,
      terminalDirectoryChanged: "已切换项目目录。"
    }
  },
  en: {
    title: "Model Switcher",
    restartHint: "After switching, close the terminal and restart Claude or Codex.",
    settings: "Settings",
    add: "Add",
    currentModel: "Current Model",
    notSet: "Not set",
    officialModel: "Official Model",
    unmatchedPreset: "No preset match",
    claudeMissingShort: "Not installed",
    claudeMissingTitle: "Claude Code or Codex Not Found",
    claudeMissingBody: "Install Claude Code or Codex and launch it once before switching models.",
    activeNow: "Current Preset",
    manualConfig: "Manual config",
    presetList: "Presets",
    presetCount: (count) => `${count} Presets`,
    builtin: "Built-in",
    activeBadge: "Active",
    editPreset: (name) => `Edit ${name}`,
    cloneOfficial: "Clone Official",
    launch: "Launch",
    current: "Current",
    terminalPanel: "Local Terminal",
    terminalCount: (count) => `${count} Terminals`,
    newTerminal: "New Terminal",
    selectFolder: "Select Folder",
    terminalLayout: "Terminal Layout",
    terminalLayouts: {
      single: "Single",
      columns: "Columns",
      rows: "Rows",
      grid: "Grid"
    },
    addTerminalToFolder: (name) => `Add in ${name}`,
    renameTerminal: (name) => `Rename ${name}`,
    deleteTerminal: (name) => `Delete ${name}`,
    deleteFolder: (name) => `Remove ${name}`,
    terminalUnavailable: "Local Terminal is not exposed in this environment.",
    emptyFolderTerminals: "This folder has no Terminals yet.",
    terminalInputPlaceholder: "Type a command, press Enter to run",
    running: "Running",
    idle: "Ready",
    utilityPanel: "Side Panel",
    collapsePanel: "Collapse side panel",
    expandPanel: "Expand side panel",
    fileTree: "Files",
    browser: "Browser",
    browserUrlPlaceholder: "Enter URL",
    browserGo: "Go",
    browserBack: "Back",
    browserForward: "Forward",
    browserReload: "Reload",
    fileTreeUnavailable: "Local file tree is not exposed in this environment.",
    fileTreeLoading: "Loading...",
    projectDirectory: "Project Directory",
    parentDirectory: "Parent Directory",
    refreshDirectory: "Refresh Directory",
    directoryEmpty: "No visible files in this directory.",
    directoryError: "Could not read directory",
    envSection: "Model Presets",
    editorTitleNew: "New Preset",
    editorTitleEdit: (name) => `Edit ${name}`,
    editorDescription: "Only Claude Code env and Codex config.toml model fields will be replaced.",
    editorMode: "Edit Mode",
    formMode: "Form",
    jsonMode: "JSON",
    showToken: "Show secret",
    hideToken: "Hide secret",
    nameLabel: "Preset Name",
    namePlaceholder: "For example: glm5",
    jsonLabel: "Preset JSON",
    formHint: "Fill the common fields here, or switch to JSON for full paste mode.",
    envHint: "Supports claude.env and codex.model / codex.model_reasoning_effort.",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Working...",
    settingsTitle: "Settings",
    settingsDescription: "Manage Claude / Codex model presets, updates, and local file locations.",
    settingsSections: {
      models: "Claude Code Model Config",
      appearance: "Appearance",
      basic: "Basic Info"
    },
    updateTitle: "Release Updates",
    updateVersion: "Current Version",
    updateSource: "GitHub Release",
    updateCheck: "Check for updates",
    updateChecking: "Checking...",
    updateInstall: "Update now",
    updateEnabled: "JOSH checks GitHub Releases on launch and prompts you when a new version is ready.",
    updateCurrent: "You're already on the latest version.",
    updateAvailable: "Update found. Downloading it in the background, and you'll be prompted when it's ready.",
    updateDownloaded: (name) =>
      name
        ? `${name} is ready. Click Update now to restart and finish installing it.`
        : "A new version is ready. Click Update now to restart and finish installing it.",
    updateDevelopment: "Unavailable in development mode. Install a release build to test auto updates.",
    updateUnsupported: "Auto update is not supported on this platform.",
    updateError: (message) => `Update check failed: ${message}`,
    updateHint:
      "Only published GitHub Releases are picked up; draft and pre-release builds are ignored.",
    appearance: "Appearance",
    themeMode: "Theme",
    language: "Language",
    chinese: "中文",
    english: "English",
    settingsPath: "Claude Settings",
    codexConfigPath: "Codex Config",
    presetPath: "Preset Store",
    backupPath: "Backups",
    appPath: "JOSH Folder",
    status: {
      loading: "Loading configuration...",
      loaded: "Configuration loaded.",
      claudeMissing: "Claude Code or Codex config not found. Install and launch one of them first.",
      invalidFormat: "The current draft cannot be formatted.",
      nameRequired: "Please enter a preset name first.",
      duplicateName: "That preset name already exists.",
      invalidDraft: "The current preset cannot be saved yet.",
      invalidFormMode: "Fix the JSON before switching back to form mode.",
      saved: (name) => `Saved ${name}.`,
      renamed: (from, to) => `Updated ${from} to ${to}.`,
      switched: (name) => `Switched to ${name}.`,
      deleted: (name) => `Deleted ${name}.`,
      languageChanged: "Interface language updated.",
      themeChanged: "Theme updated.",
      folderAdded: (name) => `Selected ${name}.`,
      folderRemoved: (name) => `Removed ${name}.`,
      terminalCreated: "New Terminal created.",
      terminalDeleted: (name) => `Deleted ${name}.`,
      terminalCommandFailed: (message) => `Command failed: ${message}`,
      terminalDirectoryChanged: "Project directory updated."
    }
  }
};

function getInitialLocale() {
  if (typeof window === "undefined") {
    return "zh";
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh";
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.some((themeOption) => themeOption.key === storedTheme)
    ? storedTheme
    : "system";
}

function getInitialTerminalLayout() {
  return "single";
}

function getSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function stringify(value) {
  return JSON.stringify(value, null, 2);
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function normalizePresetContent(value) {
  return {
    claude: {
      env: extractClaudeEnv(value)
    },
    codex: extractCodexConfig(value)
  };
}

function currentCodex(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  return normalizeCodexConfig(settings.codex);
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
  const current = JSON.stringify(currentPresetContent(settings));
  const matched = presets.find(
    (preset) => JSON.stringify(normalizePresetContent(preset.content)) === current
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

function readableError(error) {
  if (error instanceof SyntaxError) {
    return `JSON 格式错误：${error.message}`;
  }

  return error?.message ?? "发生了未知错误。";
}

function makeDefaultUpdateState() {
  return { ...DEFAULT_UPDATE_STATE };
}

function normalizeUpdateState(nextState) {
  return {
    ...makeDefaultUpdateState(),
    ...(nextState ?? {})
  };
}

function formatUpdateStatus(copy, updateState) {
  switch (updateState.status) {
    case "development":
      return copy.updateDevelopment;
    case "unsupported":
      return copy.updateUnsupported;
    case "checking":
      return copy.updateChecking;
    case "available":
      return copy.updateAvailable;
    case "downloaded":
      return copy.updateDownloaded(updateState.releaseName);
    case "up-to-date":
      return copy.updateCurrent;
    case "error":
      return copy.updateError(updateState.error || "Unknown error");
    case "idle":
    default:
      return copy.updateEnabled;
  }
}

function escapePathLikeTerminalApp(value) {
  return String(value ?? "").replace(/([ \\'"`$!&;|<>(){}\[\]*?#~=\t\n])/g, "\\$1");
}

function droppedTerminalInput(dataTransfer) {
  const files = Array.from(dataTransfer?.files ?? []);
  const parts = files
    .map((file) => window.joshFiles?.getPathForFile?.(file))
    .filter((path) => typeof path === "string" && path.length > 0)
    .map(escapePathLikeTerminalApp);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const uriList = dataTransfer?.getData?.("text/uri-list") ?? "";
  const textData = dataTransfer?.getData?.("text/plain") ?? "";
  return (uriList || textData)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(escapePathLikeTerminalApp)
    .join(" ");
}

function terminalLayoutClass(layoutMode) {
  switch (layoutMode) {
    case "columns":
      return "terminal-layout terminal-layout-columns grid grid-flow-col auto-cols-[minmax(20rem,1fr)] overflow-x-auto";
    case "rows":
      return "terminal-layout terminal-layout-rows flex flex-col overflow-y-auto";
    case "grid":
      return "terminal-layout terminal-layout-grid grid grid-cols-1 overflow-y-auto lg:grid-cols-2";
    case "single":
    default:
      return "terminal-layout terminal-layout-single grid grid-cols-1 overflow-hidden";
  }
}

function terminalPaneClass(layoutMode) {
  if (layoutMode === "rows") {
    return "min-h-[12rem] flex-1";
  }

  if (layoutMode === "grid") {
    return "min-h-[14rem]";
  }

  return "min-h-0";
}

function terminalLayoutLimit(layoutMode) {
  switch (layoutMode) {
    case "single":
    default:
      return 1;
  }
}

function visibleTerminalsForLayout(terminals, activeTerminal, layoutMode) {
  if (layoutMode !== "single") {
    return terminals;
  }

  const limit = terminalLayoutLimit(layoutMode);
  if (!activeTerminal) {
    return terminals.slice(0, limit);
  }

  const activeIndex = terminals.findIndex((terminal) => terminal.id === activeTerminal.id);
  if (activeIndex < 0) {
    return [activeTerminal];
  }

  const start = Math.max(0, Math.min(activeIndex - limit + 1, terminals.length - limit));
  return terminals.slice(start, start + limit);
}

function basename(filePath) {
  if (!filePath) {
    return "";
  }

  const normalized = filePath.replace(/\/+$/, "");
  return normalized.split("/").pop() || normalized;
}

function foldersFromTerminals(terminals) {
  const byCwd = new Map();

  for (const terminal of terminals) {
    const cwd = terminal.cwd || "";
    const id = terminal.folderId || cwd;

    if (!byCwd.has(id)) {
      byCwd.set(id, {
        id,
        name: basename(cwd) || cwd || "Terminal",
        cwd,
        terminalIds: []
      });
    }

    byCwd.get(id).terminalIds.push(terminal.id);
  }

  return Array.from(byCwd.values());
}

function normalizeBrowserUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "https://www.google.com";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(".") || trimmed.startsWith("localhost")) {
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function TerminalPane({
  activePage,
  effectiveTheme,
  isActive,
  layoutMode,
  onSelect,
  onStatus,
  terminalSession
}) {
  const hostRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const renderedBufferRef = useRef("");
  const activePageRef = useRef(activePage);
  const showPaneLabel = layoutMode !== "single";

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  const fitTerminalToHost = useCallback(() => {
    const terminal = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    const host = hostRef.current;

    if (!terminal || !fitAddon || !host || activePageRef.current !== "terminal") {
      return false;
    }

    const rect = host.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) {
      return false;
    }

    try {
      fitAddon.fit();
      terminal.refresh(0, Math.max(0, terminal.rows - 1));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!hostRef.current || xtermRef.current) {
      return undefined;
    }

    const terminal = new XTerm({
      allowProposedApi: false,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      convertEol: true,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.15,
      scrollback: 5000,
      theme: XTERM_THEMES[effectiveTheme]
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    renderedBufferRef.current = "";

    const dataDisposable = terminal.onData((data) => {
      if (!window.joshTerminals?.write) {
        return;
      }

      window.joshTerminals.write({ id: terminalSession.id, data }).catch((error) => {
        onStatus(readableError(error));
      });
    });

    const observer = new ResizeObserver(() => {
      fitTerminalToHost();
    });
    observer.observe(hostRef.current);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    requestAnimationFrame(fitTerminalToHost);

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fitTerminalToHost, onStatus, terminalSession.id]);

  useEffect(() => {
    if (!xtermRef.current) {
      return;
    }

    xtermRef.current.options.theme = XTERM_THEMES[effectiveTheme];
  }, [effectiveTheme]);

  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal || activePage !== "terminal") {
      return undefined;
    }

    const nextBuffer = String(terminalSession.buffer ?? "");
    const renderedBuffer = renderedBufferRef.current;
    if (nextBuffer === renderedBuffer) {
      return undefined;
    }

    if (renderedBuffer && nextBuffer.startsWith(renderedBuffer)) {
      terminal.write(nextBuffer.slice(renderedBuffer.length));
    } else {
      terminal.clear();
      if (nextBuffer) {
        terminal.write(nextBuffer);
      }
    }
    renderedBufferRef.current = nextBuffer;

    return undefined;
  }, [activePage, terminalSession.buffer, terminalSession.id]);

  useEffect(() => {
    if (activePage !== "terminal") {
      return undefined;
    }

    let canceled = false;

    const refreshTerminal = () => {
      if (canceled) {
        return;
      }

      fitTerminalToHost();
      if (isActive) {
        xtermRef.current?.focus();
      }
    };

    const frame = requestAnimationFrame(() => {
      refreshTerminal();
      window.setTimeout(refreshTerminal, 160);
    });

    return () => {
      canceled = true;
      cancelAnimationFrame(frame);
    };
  }, [activePage, fitTerminalToHost, isActive, layoutMode]);

  useEffect(() => {
    if (isActive && activePage === "terminal") {
      requestAnimationFrame(() => xtermRef.current?.focus());
    }
  }, [activePage, isActive]);

  return (
    <section
      className={cn(
        "terminal-pane flex min-h-0 flex-col overflow-hidden transition-colors duration-200 ease-out",
        effectiveTheme === "dark" ? "bg-[#0b0e12]/45" : "bg-white/45",
        terminalPaneClass(layoutMode)
      )}
      onMouseDown={onSelect}
    >
      {showPaneLabel ? (
        <div className="terminal-pane-header">
          <div className="terminal-pane-label">
            <span className="min-w-0 truncate">{terminalSession.name}</span>
          </div>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className={cn("min-h-0 flex-1 overflow-hidden p-2", showPaneLabel && "pt-1")}
        onClick={() => {
          onSelect();
          xtermRef.current?.focus();
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const data = droppedTerminalInput(event.dataTransfer);
          if (!data || !window.joshTerminals?.write) {
            return;
          }

          onSelect();
          xtermRef.current?.focus();
          window.joshTerminals.write({ id: terminalSession.id, data }).catch((error) => {
            onStatus(readableError(error));
          });
        }}
      />
    </section>
  );
}

function FileTreeEntry({
  childrenByPath,
  copy,
  depth,
  entry,
  expandedPaths,
  loadingPath,
  onToggle
}) {
  const isDirectory = entry.type === "directory";
  const isExpanded = expandedPaths.has(entry.path);
  const children = childrenByPath[entry.path] ?? [];

  return (
    <div>
      <button
        className="file-tree-row flex h-7 w-full min-w-0 items-center gap-1.5 px-2 text-left text-xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-background/35 hover:text-foreground"
        onClick={() => {
          if (isDirectory) {
            onToggle(entry);
          }
        }}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        title={entry.path}
        type="button"
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {isDirectory ? (
          <Folder className="size-3.5 shrink-0 text-primary/85" />
        ) : (
          <FileText className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>

      {isDirectory && isExpanded ? (
        <div>
          {loadingPath === entry.path ? (
            <p
              className="px-2 py-1 text-[11px] text-muted-foreground/75"
              style={{ paddingLeft: `${28 + (depth + 1) * 12}px` }}
            >
              {copy.fileTreeLoading}
            </p>
          ) : null}
          {children.map((child) => (
            <FileTreeEntry
              key={child.path}
              childrenByPath={childrenByPath}
              copy={copy}
              depth={depth + 1}
              entry={child}
              expandedPaths={expandedPaths}
              loadingPath={loadingPath}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileTreePanel({
  childrenByPath,
  copy,
  error,
  expandedPaths,
  loadingPath,
  onRefresh,
  onToggle,
  root
}) {
  const rootEntries = root ? childrenByPath[root.path] ?? root.entries ?? [] : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-2.5 shadow-divider-bottom">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{copy.fileTree}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={root?.path ?? ""}>
              {root?.name ?? copy.projectDirectory}
            </p>
          </div>
          <Button
            aria-label={copy.refreshDirectory}
            disabled={!root}
            onClick={onRefresh}
            size="icon-xs"
            title={copy.refreshDirectory}
            type="button"
            variant="ghost"
          >
            <RefreshCw className={cn("size-3.5", loadingPath === root?.path && "animate-spin")} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {!root ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {copy.fileTreeUnavailable}
            </p>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {copy.directoryError}: {error}
            </p>
          ) : rootEntries.length === 0 && loadingPath !== root.path ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {copy.directoryEmpty}
            </p>
          ) : (
            rootEntries.map((entry) => (
              <FileTreeEntry
                key={entry.path}
                childrenByPath={childrenByPath}
                copy={copy}
                depth={0}
                entry={entry}
                expandedPaths={expandedPaths}
                loadingPath={loadingPath}
                onToggle={onToggle}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function BrowserPanel({
  copy,
  draftUrl,
  onDraftUrlChange,
  onNavigate,
  url,
  webviewRef
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <form
        className="flex shrink-0 items-center gap-1.5 px-2 py-2 shadow-divider-bottom"
        onSubmit={(event) => {
          event.preventDefault();
          onNavigate(draftUrl);
        }}
      >
        <Button
          aria-label={copy.browserBack}
          onClick={() => webviewRef.current?.goBack?.()}
          size="icon-xs"
          title={copy.browserBack}
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Button
          aria-label={copy.browserForward}
          onClick={() => webviewRef.current?.goForward?.()}
          size="icon-xs"
          title={copy.browserForward}
          type="button"
          variant="ghost"
        >
          <ArrowRight className="size-3.5" />
        </Button>
        <Button
          aria-label={copy.browserReload}
          onClick={() => webviewRef.current?.reload?.()}
          size="icon-xs"
          title={copy.browserReload}
          type="button"
          variant="ghost"
        >
          <RefreshCw className="size-3.5" />
        </Button>
        <Input
          aria-label={copy.browserUrlPlaceholder}
          className="h-7 min-w-0 flex-1 rounded-md px-2 text-xs"
          onChange={(event) => onDraftUrlChange(event.target.value)}
          placeholder={copy.browserUrlPlaceholder}
          value={draftUrl}
        />
        <Button className="h-7 px-2 text-xs" size="sm" type="submit" variant="outline">
          {copy.browserGo}
        </Button>
      </form>
      <webview
        ref={webviewRef}
        className="min-h-0 flex-1 bg-background/35"
        src={url}
        title={copy.browser}
      />
    </div>
  );
}

function UtilityPanel({
  browserDraftUrl,
  browserUrl,
  childrenByPath,
  copy,
  error,
  expandedPaths,
  loadingPath,
  onBrowserDraftUrlChange,
  onBrowserNavigate,
  onRefresh,
  onToggle,
  onToggleOpen,
  onViewChange,
  open,
  root,
  view,
  webviewRef
}) {
  if (!open) {
    return (
      <aside className="hidden min-h-0 items-center justify-start rounded-r-lg bg-card/35 px-1 py-2 shadow-panel xl:flex">
        <Button
          aria-label={copy.expandPanel}
          onClick={onToggleOpen}
          size="icon-sm"
          title={copy.expandPanel}
          type="button"
          variant="ghost"
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden rounded-r-lg bg-card/35 shadow-panel xl:flex">
      <div className="flex shrink-0 items-center gap-2 px-2 py-2 shadow-divider-bottom">
        <div
          aria-label={copy.utilityPanel}
          className="flex min-w-0 flex-1 items-center gap-0.5 rounded-md bg-background/35 p-0.5 shadow-control"
          role="tablist"
        >
          <Button
            aria-selected={view === "files"}
            onClick={() => onViewChange("files")}
            role="tab"
            size="sm"
            type="button"
            variant={view === "files" ? "default" : "ghost"}
          >
            <Folder className="size-3.5" />
            {copy.fileTree}
          </Button>
          <Button
            aria-selected={view === "browser"}
            onClick={() => onViewChange("browser")}
            role="tab"
            size="sm"
            type="button"
            variant={view === "browser" ? "default" : "ghost"}
          >
            <Globe2 className="size-3.5" />
            {copy.browser}
          </Button>
        </div>
        <Button
          aria-label={copy.collapsePanel}
          onClick={onToggleOpen}
          size="icon-xs"
          title={copy.collapsePanel}
          type="button"
          variant="ghost"
        >
          <PanelRightClose className="size-3.5" />
        </Button>
      </div>

      {view === "files" ? (
        <FileTreePanel
          childrenByPath={childrenByPath}
          copy={copy}
          error={error}
          expandedPaths={expandedPaths}
          loadingPath={loadingPath}
          onRefresh={onRefresh}
          onToggle={onToggle}
          root={root}
        />
      ) : (
        <BrowserPanel
          copy={copy}
          draftUrl={browserDraftUrl}
          onDraftUrlChange={onBrowserDraftUrlChange}
          onNavigate={onBrowserNavigate}
          url={browserUrl}
          webviewRef={webviewRef}
        />
      )}
    </aside>
  );
}

function DesktopApp() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [theme, setTheme] = useState(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [settingsPath, setSettingsPath] = useState("");
  const [codexConfigPath, setCodexConfigPath] = useState("");
  const [appStorageDir, setAppStorageDir] = useState("");
  const [presetStorePath, setPresetStorePath] = useState("");
  const [backupDir, setBackupDir] = useState("");
  const [currentSettings, setCurrentSettings] = useState(null);
  const [presets, setPresets] = useState([]);
  const [updateInfo, setUpdateInfo] = useState(makeDefaultUpdateState);
  const [claudeInstalled, setClaudeInstalled] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState(stringify(PRESET_TEMPLATE));
  const [status, setStatus] = useState(() => MESSAGES[getInitialLocale()].status.loading);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("form");
  const [nameTouched, setNameTouched] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [activePage, setActivePage] = useState("terminal");
  const [settingsSection, setSettingsSection] = useState("models");
  const [terminalLayout, setTerminalLayout] = useState(getInitialTerminalLayout);
  const [editingPresetName, setEditingPresetName] = useState(null);
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState("");
  const [fileTreeRoot, setFileTreeRoot] = useState(null);
  const [fileTreeChildren, setFileTreeChildren] = useState({});
  const [expandedFilePaths, setExpandedFilePaths] = useState(() => new Set());
  const [fileTreeLoadingPath, setFileTreeLoadingPath] = useState("");
  const [fileTreeError, setFileTreeError] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [rightPanelView, setRightPanelView] = useState("files");
  const [browserUrl, setBrowserUrl] = useState("https://www.google.com");
  const [browserDraftUrl, setBrowserDraftUrl] = useState("https://www.google.com");
  const [editingTerminalId, setEditingTerminalId] = useState("");
  const activeTerminalIdRef = useRef("");
  const browserWebviewRef = useRef(null);
  const copy = MESSAGES[locale];
  const effectiveTheme = theme === "system" ? systemTheme : theme;

  const activePresetName = useMemo(
    () => (claudeInstalled ? findMatchingPresetName(currentSettings, presets) : null),
    [claudeInstalled, currentSettings, presets]
  );

  const currentModel = useMemo(() => {
    if (!claudeInstalled) {
      return copy.claudeMissingShort;
    }
    if (activePresetName === OFFICIAL_NAME) {
      return copy.officialModel;
    }
    return currentModelLabel(currentSettings, copy.notSet);
  }, [
    activePresetName,
    claudeInstalled,
    copy.claudeMissingShort,
    copy.notSet,
    copy.officialModel,
    currentSettings
  ]);

  const updateStatusText = useMemo(
    () => formatUpdateStatus(copy, updateInfo),
    [copy, updateInfo]
  );

  const activeFolder = useMemo(() => {
    const selectedFolder = folders.find((folder) => folder.id === activeFolderId);
    if (selectedFolder) {
      return selectedFolder;
    }

    const selectedTerminal = terminals.find((terminal) => terminal.id === activeTerminalId);
    if (selectedTerminal) {
      return (
        folders.find(
          (folder) =>
            folder.id === selectedTerminal.folderId || folder.cwd === selectedTerminal.cwd
        ) ?? null
      );
    }

    return folders[0] ?? null;
  }, [activeFolderId, activeTerminalId, folders, terminals]);

  const activeFolderTerminals = useMemo(() => {
    if (!activeFolder) {
      return [];
    }

    return terminals.filter(
      (terminal) => terminal.folderId === activeFolder.id || terminal.cwd === activeFolder.cwd
    );
  }, [activeFolder, terminals]);

  const activeTerminal = useMemo(() => {
    const selectedTerminal = terminals.find((terminal) => terminal.id === activeTerminalId);
    if (
      selectedTerminal &&
      (!activeFolder ||
        selectedTerminal.folderId === activeFolder.id ||
        selectedTerminal.cwd === activeFolder.cwd)
    ) {
      return selectedTerminal;
    }

    return activeFolderTerminals[0] ?? null;
  }, [activeFolder, activeFolderTerminals, activeTerminalId, terminals]);

  const visibleTerminals = useMemo(() => {
    return visibleTerminalsForLayout(activeFolderTerminals, activeTerminal, terminalLayout);
  }, [activeFolderTerminals, activeTerminal, terminalLayout]);

  const desktopLayoutStyle = useMemo(
    () => ({
      "--right-panel-width": `${rightPanelWidth}px`
    }),
    [rightPanelWidth]
  );

  const loadFileTreeDirectory = useCallback(async (targetPath, options = {}) => {
    if (!targetPath || !window.joshFiles?.listDirectory) {
      setFileTreeRoot(null);
      setFileTreeChildren({});
      setExpandedFilePaths(new Set());
      return null;
    }

    setFileTreeLoadingPath(targetPath);
    setFileTreeError("");

    try {
      const payload = await window.joshFiles.listDirectory({ path: targetPath });
      const entries = payload.entries ?? [];

      setFileTreeChildren((current) => ({
        ...current,
        [payload.path]: entries
      }));

      if (options.replaceRoot) {
        setFileTreeRoot(payload);
        setExpandedFilePaths(new Set([payload.path]));
      }

      return payload;
    } catch (error) {
      setFileTreeError(readableError(error));
      if (options.replaceRoot) {
        setFileTreeRoot({
          path: targetPath,
          name: basename(targetPath) || targetPath,
          entries: []
        });
      }
      return null;
    } finally {
      setFileTreeLoadingPath((current) => (current === targetPath ? "" : current));
    }
  }, []);

  const toggleFileTreeDirectory = useCallback((entry) => {
    if (entry.type !== "directory") {
      return;
    }

    const isExpanded = expandedFilePaths.has(entry.path);
    setExpandedFilePaths((current) => {
      const next = new Set(current);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.add(entry.path);
      }
      return next;
    });

    if (!isExpanded && !fileTreeChildren[entry.path]) {
      loadFileTreeDirectory(entry.path);
    }
  }, [expandedFilePaths, fileTreeChildren, loadFileTreeDirectory]);

  const refreshFileTree = useCallback(() => {
    if (fileTreeRoot?.path) {
      loadFileTreeDirectory(fileTreeRoot.path, { replaceRoot: true });
    }
  }, [fileTreeRoot?.path, loadFileTreeDirectory]);

  const navigateBrowser = useCallback((value) => {
    const nextUrl = normalizeBrowserUrl(value);
    setBrowserUrl(nextUrl);
    setBrowserDraftUrl(nextUrl);
  }, []);

  useEffect(() => {
    activeTerminalIdRef.current = activeTerminal?.id ?? "";
  }, [activeTerminal?.id]);

  useEffect(() => {
    if (!isResizingRightPanel) {
      return undefined;
    }

    const stopResizing = () => {
      setIsResizingRightPanel(false);
    };

    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizingRightPanel]);

  useEffect(() => {
    if (!activeFolder?.cwd) {
      setFileTreeRoot(null);
      setFileTreeChildren({});
      setExpandedFilePaths(new Set());
      return;
    }

    setFileTreeRoot(null);
    setFileTreeChildren({});
    setExpandedFilePaths(new Set([activeFolder.cwd]));
    loadFileTreeDirectory(activeFolder.cwd, { replaceRoot: true });
  }, [activeFolder?.cwd, loadFileTreeDirectory]);

  const draftState = useMemo(() => {
    try {
      const parsed = JSON.parse(draftContent);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        return {
          parsed: null,
          error: "Preset JSON 必须是一个对象。"
        };
      }

      return {
        parsed: normalizePresetContent(parsed),
        error: ""
      };
    } catch (error) {
      return {
        parsed: null,
        error: readableError(error)
      };
    }
  }, [draftContent]);

  const editingPreset = useMemo(() => {
    if (!editingPresetName) {
      return null;
    }

    return presets.find((preset) => preset.name === editingPresetName) ?? null;
  }, [editingPresetName, presets]);

  const suggestedDraftName = useMemo(() => {
    if (editingPreset || !draftState.parsed) {
      return "";
    }

    return (
      draftState.parsed.claude.env.ANTHROPIC_MODEL?.trim() ||
      draftState.parsed.codex.model?.trim() ||
      ""
    );
  }, [draftState.parsed, editingPreset]);

  const settingsItems = useMemo(
    () => [
      { label: copy.settingsPath, value: settingsPath },
      { label: copy.codexConfigPath, value: codexConfigPath },
      { label: copy.presetPath, value: presetStorePath },
      { label: copy.backupPath, value: backupDir },
      { label: copy.appPath, value: appStorageDir }
    ],
    [
      appStorageDir,
      backupDir,
      codexConfigPath,
      copy.appPath,
      copy.backupPath,
      copy.codexConfigPath,
      copy.presetPath,
      copy.settingsPath,
      presetStorePath,
      settingsPath
    ]
  );

  useEffect(() => {
    if (presets.length === 0) {
      return;
    }

    if (editingPresetName && !presets.some((preset) => preset.name === editingPresetName)) {
      setEditingPresetName(null);
    }
  }, [editingPresetName, presets]);

  useEffect(() => {
    if (!editorOpen || editingPreset || nameTouched || draftName.trim() || !suggestedDraftName) {
      return;
    }

    setDraftName(suggestedDraftName);
  }, [draftName, editorOpen, editingPreset, nameTouched, suggestedDraftName]);

  const loadAll = useCallback(async (message = copy.status.loaded) => {
    try {
      setBusy(true);
      const [data, updates] = await Promise.all([
        window.claudeSettings.read(),
        window.joshUpdates?.read
          ? window.joshUpdates.read().catch(() => makeDefaultUpdateState())
          : Promise.resolve(makeDefaultUpdateState())
      ]);
      const installed = data.installed !== false;
      setSettingsPath(data.settingsPath);
      setCodexConfigPath(data.codexConfigPath ?? "");
      setAppStorageDir(data.appStorageDir);
      setPresetStorePath(data.presetStorePath);
      setBackupDir(data.backupDir);
      setClaudeInstalled(installed);
      setCurrentSettings(data.parsed ?? { env: {} });
      setPresets(data.presets);
      setUpdateInfo(normalizeUpdateState(updates));
      setStatus(installed ? message : copy.status.claudeMissing);
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setBusy(false);
    }
  }, [copy.status.claudeMissing, copy.status.loaded]);

  const loadTerminals = useCallback(async (preferredId = activeTerminalId) => {
    if (!window.joshTerminals?.list) {
      setStatus(copy.terminalUnavailable);
      return;
    }

    try {
      const payload = await window.joshTerminals.list(preferredId);
      const nextTerminals = payload.terminals ?? [];
      const nextFolders = payload.folders ?? foldersFromTerminals(nextTerminals);
      setFolders(nextFolders);
      setTerminals(nextTerminals);
      setActiveFolderId(payload.activeFolderId ?? nextFolders[0]?.id ?? "");
      setActiveTerminalId(payload.activeTerminalId ?? nextTerminals[0]?.id ?? "");
    } catch (error) {
      setStatus(readableError(error));
    }
  }, [activeTerminalId, copy.terminalUnavailable]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadTerminals();
  }, [loadTerminals]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    handleSystemThemeChange();
    mediaQuery.addEventListener?.("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    const unsubscribeData = window.joshTerminals?.onData?.(({ id, data }) => {
      const nextData = String(data ?? "");
      if (!nextData) {
        return;
      }

      setTerminals((current) =>
        current.map((terminal) =>
          terminal.id === id
            ? {
                ...terminal,
                buffer: `${terminal.buffer ?? ""}${nextData}`.slice(-200000),
                updatedAt: new Date().toISOString()
              }
            : terminal
        )
      );
    });
    const unsubscribeTerminals = window.joshTerminals?.onDidChange?.((payload) => {
      const nextTerminals = payload.terminals ?? [];
      const nextFolders = payload.folders ?? foldersFromTerminals(nextTerminals);
      const payloadFolder = payload.activeFolderId
        ? nextFolders.find((folder) => folder.id === payload.activeFolderId)
        : null;
      const nextActiveTerminalId =
        payload.activeTerminalId && nextTerminals.some((terminal) => terminal.id === payload.activeTerminalId)
          ? payload.activeTerminalId
          : payloadFolder
          ? nextTerminals.find(
              (terminal) =>
                terminal.folderId === payloadFolder.id || terminal.cwd === payloadFolder.cwd
            )?.id ?? ""
          : nextTerminals.some((terminal) => terminal.id === activeTerminalIdRef.current)
          ? activeTerminalIdRef.current
          : payload.activeTerminalId ?? nextTerminals[0]?.id ?? "";
      const nextActiveFolderId =
        payload.activeFolderId && nextFolders.some((folder) => folder.id === payload.activeFolderId)
          ? payload.activeFolderId
          : payload.activeFolderId ?? nextFolders[0]?.id ?? "";

      activeTerminalIdRef.current = nextActiveTerminalId;
      setFolders(nextFolders);
      setTerminals(nextTerminals);
      setActiveTerminalId(nextActiveTerminalId);
      setActiveFolderId((current) =>
        payloadFolder || !nextFolders.some((folder) => folder.id === current)
          ? nextActiveFolderId
          : current
      );
    });

    return () => {
      unsubscribeData?.();
      unsubscribeTerminals?.();
    };
  }, []);

  useEffect(() => {
    const unsubscribeSettings = window.claudeSettings.onDidChange?.(() => {
      loadAll();
    });
    const unsubscribeUpdates = window.joshUpdates?.onDidChange?.((nextState) => {
      setUpdateInfo(normalizeUpdateState(nextState));
    });

    const handleFocus = () => {
      loadAll();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribeSettings?.();
      unsubscribeUpdates?.();
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAll]);

  async function checkForUpdates() {
    if (!window.joshUpdates?.check) {
      return;
    }

    try {
      const nextState = await window.joshUpdates.check();
      setUpdateInfo(normalizeUpdateState(nextState));
    } catch (error) {
      setUpdateInfo((current) =>
        normalizeUpdateState({
          ...current,
          status: "error",
          error: readableError(error)
        })
      );
    }
  }

  async function installUpdate() {
    if (!window.joshUpdates?.install || !updateInfo.downloaded) {
      return;
    }

    try {
      await window.joshUpdates.install();
    } catch (error) {
      setUpdateInfo((current) =>
        normalizeUpdateState({
          ...current,
          status: "error",
          error: readableError(error)
        })
      );
    }
  }

  function applyTerminalsPayload(payload) {
    const nextTerminals = payload.terminals ?? [];
    const nextFolders = payload.folders ?? foldersFromTerminals(nextTerminals);
    const nextActiveTerminalId = payload.activeTerminalId ?? nextTerminals[0]?.id ?? "";
    const nextActiveFolderId = payload.activeFolderId ?? nextFolders[0]?.id ?? "";

    activeTerminalIdRef.current = nextActiveTerminalId;
    setFolders(nextFolders);
    setTerminals(nextTerminals);
    setActiveFolderId(nextActiveFolderId);
    setActiveTerminalId(nextActiveTerminalId);
  }

  async function selectFolder() {
    if (!window.joshTerminals?.selectFolder) {
      setStatus(copy.terminalUnavailable);
      return;
    }

    try {
      const payload = await window.joshTerminals.selectFolder();
      applyTerminalsPayload(payload);
      if (!payload.canceled && payload.folder) {
        setStatus(copy.status.folderAdded(payload.folder.name));
      }
    } catch (error) {
      setStatus(readableError(error));
    }
  }

  async function createTerminal(folder = activeFolder) {
    if (!window.joshTerminals?.create) {
      setStatus(copy.terminalUnavailable);
      return;
    }

    try {
      const payload = await window.joshTerminals.create({
        folderId: folder?.id,
        cwd: folder?.cwd
      });
      applyTerminalsPayload(payload);
      setStatus(copy.status.terminalCreated);
    } catch (error) {
      setStatus(readableError(error));
    }
  }

  async function deleteTerminal(id, name) {
    if (!id || !window.joshTerminals?.delete) {
      return;
    }

    try {
      const payload = await window.joshTerminals.delete({ id });
      applyTerminalsPayload(payload);
      setStatus(copy.status.terminalDeleted(name));
    } catch (error) {
      setStatus(readableError(error));
    }
  }

  async function deleteFolder(folder) {
    if (!folder || !window.joshTerminals?.deleteFolder) {
      return;
    }

    try {
      const payload = await window.joshTerminals.deleteFolder({ id: folder.id });
      applyTerminalsPayload(payload);
      setStatus(copy.status.folderRemoved(folder.name));
    } catch (error) {
      setStatus(readableError(error));
    }
  }

  function renameTerminal(id, name) {
    if (!id) {
      return;
    }

    setTerminals((current) =>
      current.map((terminal) =>
        terminal.id === id
          ? {
              ...terminal,
              name
            }
          : terminal
      )
    );

    if (!window.joshTerminals?.rename) {
      return;
    }

    window.joshTerminals.rename({ id, name }).then((payload) => {
      setTerminals(payload.terminals ?? []);
      setActiveTerminalId(payload.activeTerminalId ?? payload.terminal?.id ?? id);
    }).catch((error) => {
      setStatus(readableError(error));
    });
  }

  async function refreshPresets() {
    const refreshed = await window.claudeSettings.listPresets();
    setPresets(refreshed.presets);
    return refreshed.presets;
  }

  function openNewEditor() {
    setEditingPresetName(null);
    setDraftName("");
    setDraftContent(stringify(PRESET_TEMPLATE));
    setEditorMode("form");
    setNameTouched(false);
    setTokenVisible(false);
    setEditorOpen(true);
  }

  function openPresetEditor(preset) {
    setEditingPresetName(preset.name === OFFICIAL_NAME ? null : preset.name);
    setDraftName(preset.name === OFFICIAL_NAME ? "" : preset.name);
    setDraftContent(stringify(normalizePresetContent(preset.content)));
    setEditorMode("form");
    setNameTouched(true);
    setTokenVisible(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingPresetName(null);
    setNameTouched(false);
    setTokenVisible(false);
  }

  function setDraftField(field, value) {
    const nextDraft = normalizePresetContent(draftState.parsed ?? PRESET_TEMPLATE);

    if (field.target === "codex") {
      nextDraft.codex = {
        ...nextDraft.codex,
        [field.key]: value
      };
    } else {
      nextDraft.claude = {
        env: {
          ...nextDraft.claude.env,
          [field.key]: value
        }
      };
    }

    setDraftContent(stringify(nextDraft));
  }

  function draftFieldValue(field) {
    if (field.target === "codex") {
      return draftState.parsed?.codex?.[field.key] ?? "";
    }

    return draftState.parsed?.claude?.env?.[field.key] ?? "";
  }

  function switchEditorMode(nextMode) {
    if (nextMode === editorMode) {
      return;
    }

    if (nextMode === "form" && (draftState.error || !draftState.parsed)) {
      setStatus(copy.status.invalidFormMode);
      return;
    }

    setEditorMode(nextMode);
  }

  async function savePreset() {
    const trimmedName = draftName.trim() || suggestedDraftName;
    const originalName = editingPreset?.name ?? null;

    if (!trimmedName) {
      setStatus(copy.status.nameRequired);
      return;
    }

    if (
      presets.some((preset) => preset.name === trimmedName && preset.name !== originalName)
    ) {
      setStatus(copy.status.duplicateName);
      return;
    }

    if (draftState.error || !draftState.parsed) {
      setStatus(draftState.error || copy.status.invalidDraft);
      return;
    }

    try {
      setBusy(true);
      await window.claudeSettings.createPreset({
        name: trimmedName,
        content: draftState.parsed
      });

      if (originalName && originalName !== trimmedName) {
        await window.claudeSettings.deletePreset(originalName);
      }

      await refreshPresets();
      setStatus(
        originalName && originalName !== trimmedName
          ? copy.status.renamed(originalName, trimmedName)
          : copy.status.saved(trimmedName)
      );
      closeEditor();
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function activatePreset(preset) {
    if (!claudeInstalled) {
      setStatus(copy.status.claudeMissing);
      return;
    }

    try {
      setBusy(true);
      const response = await window.claudeSettings.activate(preset.content);
      setCurrentSettings(response.saved);
      setStatus(copy.status.switched(preset.name));
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEditingPreset() {
    if (!editingPreset || editingPreset.name === OFFICIAL_NAME) {
      return;
    }

    try {
      setBusy(true);
      await window.claudeSettings.deletePreset(editingPreset.name);
      await refreshPresets();
      setStatus(copy.status.deleted(editingPreset.name));
      closeEditor();
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  function changeLocale(nextLocale) {
    if (nextLocale === locale) {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocale(nextLocale);
    setStatus(MESSAGES[nextLocale].status.languageChanged);
  }

  function changeTheme(nextTheme) {
    if (nextTheme === theme || !THEME_OPTIONS.some((themeOption) => themeOption.key === nextTheme)) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
    setStatus(copy.status.themeChanged);
  }

  function changeTerminalLayout(nextLayout) {
    if (
      nextLayout === terminalLayout ||
      !TERMINAL_LAYOUT_OPTIONS.some((layoutOption) => layoutOption.key === nextLayout)
    ) {
      return;
    }

    setTerminalLayout(nextLayout);
  }

  const editorTitle = editingPreset
    ? copy.editorTitleEdit(editingPreset.name)
    : copy.editorTitleNew;

  return (
    <div
      className={cn(
        "h-screen overflow-hidden bg-background text-foreground",
        effectiveTheme === "dark" && "dark"
      )}
      data-theme-mode={theme}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
      }}
      onDrop={(event) => {
        event.preventDefault();
      }}
    >
      {isResizingRightPanel ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-50 cursor-col-resize"
          onMouseMove={(event) => {
            const nextWidth = Math.min(920, Math.max(280, window.innerWidth - event.clientX - 12));
            setRightPanelWidth(nextWidth);
          }}
          onMouseUp={() => setIsResizingRightPanel(false)}
        />
      ) : null}
      <div className="flex h-screen w-screen max-w-none flex-col overflow-hidden p-2 sm:p-3">
        <section
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden md:grid-cols-[14.75rem_minmax(0,1fr)]",
            activePage === "terminal" &&
              (rightPanelOpen
                ? "gap-0 xl:grid-cols-[14.75rem_minmax(0,1fr)_1px_var(--right-panel-width)]"
                : "gap-0 xl:grid-cols-[14.75rem_minmax(0,1fr)_2.5rem]")
          )}
          style={desktopLayoutStyle}
        >
          <aside className="relative z-10 flex min-h-0 flex-col overflow-hidden rounded-l-lg rounded-r-none bg-card/35 shadow-panel">
            <div className="shrink-0 p-2.5 shadow-divider-bottom">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <img alt="" className="size-6 shrink-0" src={joshMark} />
                  <p className="text-base font-semibold uppercase tracking-[0.2em] text-foreground">
                    JOSH
                  </p>
                </div>
                <Button
                  aria-label={copy.selectFolder}
                  onClick={selectFolder}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <FolderPlus className="size-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="min-h-[10rem] flex-1">
              <div className="space-y-1.5 p-2">
                {folders.map((folder) => {
                  const folderTerminals = terminals.filter(
                    (terminal) => terminal.folderId === folder.id || terminal.cwd === folder.cwd
                  );
                  const isFolderActive = folder.id === activeFolder?.id;

                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "folder-row group/folder rounded-md bg-background/35 shadow-hairline transition-all duration-200 ease-out",
                        isFolderActive && "bg-primary/8 shadow-active"
                      )}
                    >
                      <div
                        className="flex min-w-0 items-center gap-1.5 px-1.5 py-1.5"
                        onClick={() => {
                          setActiveFolderId(folder.id);
                          setActiveTerminalId(folderTerminals[0]?.id ?? "");
                          setActivePage("terminal");
                        }}
                      >
                        <Folder className="size-3.5 shrink-0 text-primary" />
                        <button
                          className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
                          type="button"
                        >
                          {folder.name}
                        </button>
                        <div className="flex shrink-0 items-center gap-0">
                          <Button
                            aria-label={copy.addTerminalToFolder(folder.name)}
                            className="text-muted-foreground/65 opacity-0 transition-opacity hover:text-muted-foreground group-hover/folder:opacity-100 group-focus-within/folder:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveFolderId(folder.id);
                              setActivePage("terminal");
                              createTerminal(folder);
                            }}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <Button
                            aria-label={copy.deleteFolder(folder.name)}
                            className="text-muted-foreground/65 opacity-0 transition-opacity hover:text-muted-foreground group-hover/folder:opacity-100 group-focus-within/folder:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteFolder(folder);
                            }}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-0.5 px-1.5 pb-1.5">
                        {folderTerminals.map((terminal) => {
                          const isActive = terminal.id === activeTerminal?.id;

                          return (
                            <div
                              key={terminal.id}
                              className={cn(
                                "terminal-row group/terminal w-full rounded-[0.35rem] bg-background/45 px-1.5 py-1 text-left shadow-hairline transition-all duration-200 ease-out hover:bg-accent/50",
                                isActive && "bg-primary/12 shadow-active"
                              )}
                              onClick={() => {
                                setActiveFolderId(folder.id);
                                setActiveTerminalId(terminal.id);
                                setActivePage("terminal");
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Terminal className="size-3 shrink-0 text-muted-foreground" />
                                {editingTerminalId === terminal.id ? (
                                  <input
                                    aria-label={copy.renameTerminal(terminal.name)}
                                    autoFocus
                                    className="min-w-0 flex-1 truncate rounded-sm bg-background/45 px-1 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                                    onBlur={() => setEditingTerminalId("")}
                                    onChange={(event) => renameTerminal(terminal.id, event.target.value)}
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === "Escape") {
                                        event.currentTarget.blur();
                                      }
                                    }}
                                    value={terminal.name}
                                  />
                                ) : (
                                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                    {terminal.name}
                                  </span>
                                )}
                                <div className="flex shrink-0 items-center gap-0">
                                  <Button
                                    aria-label={copy.renameTerminal(terminal.name)}
                                    className="size-7 p-0 text-muted-foreground/65 opacity-0 transition-opacity hover:text-muted-foreground group-hover/terminal:opacity-100 group-focus-within/terminal:opacity-100"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditingTerminalId(terminal.id);
                                    }}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <PencilLine className="size-3.5" />
                                  </Button>
                                  <Button
                                    aria-label={copy.deleteTerminal(terminal.name)}
                                    className="size-7 p-0 text-muted-foreground/65 opacity-0 transition-opacity hover:text-muted-foreground group-hover/terminal:opacity-100 group-focus-within/terminal:opacity-100"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteTerminal(terminal.id, terminal.name);
                                    }}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {folderTerminals.length === 0 ? (
                          <p className="rounded-md px-1.5 py-1 text-[11px] text-muted-foreground shadow-hairline">
                            {copy.emptyFolderTerminals}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {folders.length === 0 ? (
                  <p className="rounded-md px-2 py-1.5 text-xs text-muted-foreground shadow-hairline">
                    {copy.terminalUnavailable}
                  </p>
                ) : null}
              </div>
            </ScrollArea>

            <div className="shrink-0 space-y-1.5 p-2 shadow-divider-top">
              <div className="rounded-md bg-background/45 px-2 py-1.5 shadow-hairline">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {copy.currentModel}
                </p>
                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  <strong
                    className="min-w-0 flex-1 truncate text-xs font-medium tracking-tight text-muted-foreground"
                    title={currentModel}
                  >
                    {currentModel}
                  </strong>
                  {activePresetName ? (
                    <Badge className="shrink-0 rounded-md bg-primary/14 px-2 py-0.5 text-primary hover:bg-primary/14">
                      {activePresetName}
                    </Badge>
                  ) : claudeInstalled ? (
                    <Badge className="shrink-0 rounded-md px-2 py-0.5" variant="outline">
                      {copy.unmatchedPreset}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <Button
                className="w-full justify-start"
                onClick={() => setActivePage("settings")}
                size="sm"
                type="button"
                variant={activePage === "settings" ? "default" : "outline"}
              >
                <Settings2 className="size-4" />
                {copy.settings}
              </Button>
            </div>
          </aside>

          <div className="min-h-0 overflow-hidden">
            <main
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden rounded-none bg-card/35 shadow-panel",
                activePage !== "terminal" && "hidden"
              )}
            >
              <div className="shrink-0 px-3 py-2.5 shadow-divider-bottom">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      {terminalLayout === "single" && activeFolderTerminals.length > 0 ? (
                        <div
                          aria-label={copy.terminalPanel}
                          className="terminal-tabs flex min-w-0 flex-1 items-end overflow-x-auto"
                          role="tablist"
                        >
                          {activeFolderTerminals.map((terminal) => {
                            const isActive = terminal.id === activeTerminal?.id;

                            if (isActive) {
                              return (
                                <div
                                  key={terminal.id}
                                  aria-selected="true"
                                  className="terminal-tab terminal-tab-active"
                                  onMouseDown={() => {
                                    setActiveFolderId(activeFolder?.id ?? terminal.folderId ?? "");
                                    setActiveTerminalId(terminal.id);
                                    setActivePage("terminal");
                                  }}
                                  role="tab"
                                >
                                  <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate text-left">
                                    {terminal.name}
                                  </span>
                                  <button
                                    aria-label={copy.deleteTerminal(terminal.name)}
                                    className="terminal-tab-close"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      deleteTerminal(terminal.id, terminal.name);
                                    }}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    type="button"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={terminal.id}
                                aria-selected="false"
                                className="terminal-tab terminal-tab-inactive"
                                onMouseDown={() => {
                                  setActiveFolderId(activeFolder?.id ?? terminal.folderId ?? "");
                                  setActiveTerminalId(terminal.id);
                                  setActivePage("terminal");
                                }}
                                role="tab"
                              >
                                <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate text-left">
                                  {terminal.name}
                                </span>
                                <button
                                  aria-label={copy.deleteTerminal(terminal.name)}
                                  className="terminal-tab-close"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    deleteTerminal(terminal.id, terminal.name);
                                  }}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  type="button"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div
                      aria-label={copy.terminalLayout}
                      className="flex items-center gap-0.5 rounded-md bg-background/45 p-0.5 shadow-control"
                      role="group"
                    >
                      {TERMINAL_LAYOUT_OPTIONS.map(({ key, Icon }) => (
                        <Button
                          key={key}
                          aria-label={`${copy.terminalLayout}: ${copy.terminalLayouts[key]}`}
                          aria-pressed={terminalLayout === key}
                          onClick={() => changeTerminalLayout(key)}
                          size="icon-xs"
                          title={copy.terminalLayouts[key]}
                          type="button"
                          variant={terminalLayout === key ? "default" : "ghost"}
                        >
                          <Icon className="size-3.5" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 p-2 transition-colors duration-200 ease-out",
                  effectiveTheme === "dark" ? "bg-[#0b0e12]/45" : "bg-white/45"
                )}
              >
                {visibleTerminals.length > 0 ? (
                  <div
                    className={cn(
                      "h-full min-h-0",
                      terminalLayoutClass(terminalLayout)
                    )}
                  >
                    {visibleTerminals.map((terminalSession) => (
                      <TerminalPane
                        key={terminalSession.id}
                        activePage={activePage}
                        effectiveTheme={effectiveTheme}
                        isActive={terminalSession.id === activeTerminal?.id}
                        layoutMode={terminalLayout}
                        onSelect={() => {
                          const terminalFolder = folders.find(
                            (folder) =>
                              folder.id === terminalSession.folderId ||
                              folder.cwd === terminalSession.cwd
                          );
                          setActiveFolderId(terminalFolder?.id ?? activeFolder?.id ?? "");
                          setActiveTerminalId(terminalSession.id);
                          setActivePage("terminal");
                        }}
                        onStatus={setStatus}
                        terminalSession={terminalSession}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-full min-h-0 flex-col items-center justify-center rounded-md px-4 text-center shadow-hairline transition-colors duration-200 ease-out",
                      effectiveTheme === "dark" ? "bg-[#0b0e12]/45" : "bg-white/45"
                    )}
                  >
                    <p className="text-sm text-muted-foreground">
                      {activeFolder ? copy.emptyFolderTerminals : copy.terminalUnavailable}
                    </p>
                    {activeFolder ? (
                      <Button
                        className="mt-3"
                        onClick={() => createTerminal(activeFolder)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Plus className="size-4" />
                        {copy.newTerminal}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </main>

            {activePage === "settings" ? (
              <main
                aria-label={copy.settingsTitle}
                className="settings-page h-full min-h-0 overflow-hidden rounded-lg bg-card/30 shadow-panel"
              >
                <div className="grid h-full min-h-0 grid-cols-[13rem_minmax(0,1fr)]">
                  <aside className="min-h-0 bg-background/10 p-3 shadow-divider-right">
                    <div className="pb-3">
                      <h2 className="text-lg font-semibold">{copy.settingsTitle}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {copy.settingsDescription}
                      </p>
                    </div>
                    <nav className="mt-2 flex flex-col gap-1" aria-label={copy.settingsTitle}>
                      {SETTINGS_SECTIONS.map((sectionKey) => (
                        <button
                          key={sectionKey}
                          aria-current={settingsSection === sectionKey ? "page" : undefined}
                          className={cn(
                            "w-full rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/50 hover:text-foreground",
                            settingsSection === sectionKey &&
                              "bg-primary/12 text-foreground shadow-active"
                          )}
                          onClick={() => setSettingsSection(sectionKey)}
                          type="button"
                        >
                          {copy.settingsSections[sectionKey]}
                        </button>
                      ))}
                    </nav>
                  </aside>

                  <ScrollArea className="min-h-0">
                    <div className="flex max-w-5xl flex-col gap-3 p-4">
                      <div className="pb-3 shadow-divider-bottom">
                        <h3 className="text-xl font-semibold">
                          {copy.settingsSections[settingsSection]}
                        </h3>
                      </div>

                      {settingsSection === "models" ? (
                        <div className="rounded-lg bg-card/30 px-3 py-3 shadow-hairline">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                {copy.envSection}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="text-sm leading-6">
                                  {copy.presetCount(presets.length)}
                                </p>
                                {activePresetName ? (
                                  <Badge className="rounded-md bg-primary/14 px-2 py-0.5 text-primary hover:bg-primary/14">
                                    {activePresetName}
                                  </Badge>
                                ) : claudeInstalled ? (
                                  <Badge className="rounded-md px-2 py-0.5" variant="outline">
                                    {copy.unmatchedPreset}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{status}</p>
                            </div>
                            <Button onClick={openNewEditor} size="sm" type="button">
                              <Plus className="size-4" />
                              {copy.add}
                            </Button>
                          </div>

                          {!claudeInstalled ? (
                            <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 shadow-active">
                              <p className="text-sm font-medium text-primary">
                                {copy.claudeMissingTitle}
                              </p>
                              <p className="mt-1 text-sm text-primary/85">
                                {copy.claudeMissingBody}
                              </p>
                            </div>
                          ) : null}

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {presets.map((preset) => {
                              const isActive = preset.name === activePresetName;
                              const isOfficial = preset.name === OFFICIAL_NAME;

                              return (
                                <Card
                                  key={preset.name}
                                  className={cn(
                                    "preset-row gap-0 rounded-lg bg-background/45 py-0 shadow-hairline transition-all duration-200 ease-out",
                                    isActive && "bg-primary/6 shadow-active"
                                  )}
                                >
                                  <CardContent className="flex items-center justify-between gap-3 p-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-sm font-semibold tracking-tight">
                                          {preset.name}
                                        </span>
                                        {isOfficial ? (
                                          <Badge
                                            className="rounded-md px-1.5 py-0 text-[10px]"
                                            variant="outline"
                                          >
                                            {copy.builtin}
                                          </Badge>
                                        ) : null}
                                        {isActive ? (
                                          <Badge className="rounded-md bg-primary text-primary-foreground hover:bg-primary">
                                            {copy.activeBadge}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <Button
                                        aria-label={
                                          isOfficial
                                            ? copy.cloneOfficial
                                            : copy.editPreset(preset.name)
                                        }
                                        onClick={() => openPresetEditor(preset)}
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        <PencilLine className="size-4" />
                                      </Button>
                                      <Button
                                        aria-label={isActive ? copy.current : copy.launch}
                                        className="launch-button shrink-0"
                                        disabled={busy || isActive || !claudeInstalled}
                                        onClick={() => activatePreset(preset)}
                                        size="icon-sm"
                                        type="button"
                                      >
                                        <Play className="size-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {settingsSection === "appearance" ? (
                        <div className="rounded-lg bg-card/30 px-3 py-3 shadow-hairline">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            {copy.appearance}
                          </p>
                          <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {copy.themeMode}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {THEME_OPTIONS.map((themeOption) => (
                                  <button
                                    key={themeOption.key}
                                    aria-label={`${copy.themeMode}: ${
                                      locale === "zh"
                                        ? themeOption.labelZh
                                        : themeOption.labelEn
                                    }`}
                                    aria-pressed={theme === themeOption.key}
                                    className={cn(
                                      "inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium shadow-control transition-all duration-200 ease-out hover:bg-muted/70",
                                      theme === themeOption.key
                                        ? "bg-primary/14 text-foreground shadow-active"
                                        : "bg-background/35 text-muted-foreground"
                                    )}
                                    onClick={() => changeTheme(themeOption.key)}
                                    type="button"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="size-3 rounded-full shadow-hairline"
                                      style={{ background: themeOption.swatch }}
                                    />
                                    {locale === "zh"
                                      ? themeOption.labelZh
                                      : themeOption.labelEn}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {copy.language}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  onClick={() => changeLocale("zh")}
                                  size="sm"
                                  type="button"
                                  variant={locale === "zh" ? "default" : "outline"}
                                >
                                  {copy.chinese}
                                </Button>
                                <Button
                                  onClick={() => changeLocale("en")}
                                  size="sm"
                                  type="button"
                                  variant={locale === "en" ? "default" : "outline"}
                                >
                                  {copy.english}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {settingsSection === "basic" ? (
                        <>
                          <div className="rounded-lg bg-card/30 px-3 py-3 shadow-hairline">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                  {copy.updateTitle}
                                </p>
                                <p className="mt-1 text-sm leading-6">{updateStatusText}</p>
                              </div>
                              {updateInfo.downloaded ? (
                                <Button onClick={installUpdate} size="sm" type="button">
                                  {copy.updateInstall}
                                </Button>
                              ) : (
                                <Button
                                  disabled={
                                    !updateInfo.canCheck || updateInfo.status === "checking"
                                  }
                                  onClick={checkForUpdates}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {updateInfo.status === "checking"
                                    ? copy.updateChecking
                                    : copy.updateCheck}
                                </Button>
                              )}
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                  {copy.updateVersion}
                                </p>
                                <p className="mt-1 text-sm leading-6">
                                  {updateInfo.currentVersion || "0.0.0"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                  {copy.updateSource}
                                </p>
                                <p className="mt-1 break-all text-sm leading-6">
                                  {updateInfo.repo || "-"}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-muted-foreground">
                              {copy.updateHint}
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {settingsItems.map((item) => (
                              <div
                                key={item.label}
                                className="rounded-lg bg-card/30 px-3 py-3 shadow-hairline"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                  {item.label}
                                </p>
                                <p className="mt-1 break-all text-sm leading-6">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </main>
            ) : null}
          </div>

          {activePage === "terminal" && rightPanelOpen ? (
            <div
              aria-hidden="true"
              className="panel-resize-handle hidden min-h-0 rounded-none xl:block"
              onMouseDown={(event) => {
                event.preventDefault();
                setIsResizingRightPanel(true);
              }}
            />
          ) : null}

          {activePage === "terminal" ? (
            <UtilityPanel
              browserDraftUrl={browserDraftUrl}
              browserUrl={browserUrl}
              childrenByPath={fileTreeChildren}
              copy={copy}
              error={fileTreeError}
              expandedPaths={expandedFilePaths}
              loadingPath={fileTreeLoadingPath}
              onBrowserDraftUrlChange={setBrowserDraftUrl}
              onBrowserNavigate={navigateBrowser}
              onRefresh={refreshFileTree}
              onToggle={toggleFileTreeDirectory}
              onToggleOpen={() => setRightPanelOpen((current) => !current)}
              onViewChange={setRightPanelView}
              open={rightPanelOpen}
              root={fileTreeRoot}
              view={rightPanelView}
              webviewRef={browserWebviewRef}
            />
          ) : null}
        </section>

      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          } else {
            setEditorOpen(true);
          }
        }}
        open={editorOpen}
      >
        <DialogContent className="flex max-h-[calc(100vh-1.5rem)] w-[min(92vw,84rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-5 py-4 pr-12 shadow-divider-bottom">
            <DialogTitle>{editorTitle}</DialogTitle>
            <DialogDescription>{copy.editorDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="env-name">{copy.nameLabel}</Label>
                <Input
                  id="env-name"
                  placeholder={copy.namePlaceholder}
                  value={draftName}
                  onChange={(event) => {
                    setNameTouched(true);
                    setDraftName(event.target.value);
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label>{copy.editorMode}</Label>
                </div>
                <div
                  aria-label={copy.editorMode}
                  className="inline-flex rounded-lg bg-muted/30 p-0.5 shadow-control"
                  role="tablist"
                >
                  <button
                    aria-selected={editorMode === "form"}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out outline-none",
                      editorMode === "form"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => switchEditorMode("form")}
                    role="tab"
                    type="button"
                  >
                    {copy.formMode}
                  </button>
                  <button
                    aria-selected={editorMode === "json"}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out outline-none",
                      editorMode === "json"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => switchEditorMode("json")}
                    role="tab"
                    type="button"
                  >
                    {copy.jsonMode}
                  </button>
                </div>
              </div>

              {editorMode === "form" ? (
                <div className="space-y-4">
                  {FORM_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {locale === "zh" ? field.labelZh : field.labelEn}
                      </Label>
                      {field.key === "ANTHROPIC_AUTH_TOKEN" ? (
                        <div className="relative">
                          <Input
                            id={field.key}
                            className="pr-10"
                            placeholder={
                              locale === "zh" ? field.placeholderZh : field.placeholderEn
                            }
                            type={tokenVisible ? "text" : "password"}
                            value={draftFieldValue(field)}
                            onChange={(event) => setDraftField(field, event.target.value)}
                          />
                          <button
                            aria-label={tokenVisible ? copy.hideToken : copy.showToken}
                            className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-muted-foreground transition-all duration-200 ease-out hover:text-foreground"
                            onClick={() => setTokenVisible((visible) => !visible)}
                            type="button"
                          >
                            {tokenVisible ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <Input
                          id={field.key}
                          placeholder={locale === "zh" ? field.placeholderZh : field.placeholderEn}
                          value={draftFieldValue(field)}
                          onChange={(event) => setDraftField(field, event.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  <p className="text-sm text-muted-foreground">{copy.formHint}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="env-json">{copy.jsonLabel}</Label>
                  <Textarea
                    id="env-json"
                    className="h-[min(42vh,320px)] min-h-[220px] resize-none font-mono text-[13px] leading-6"
                    spellCheck="false"
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                  />
                  <p
                    className={cn(
                      "text-sm",
                      draftState.error ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {draftState.error ? draftState.error : copy.envHint}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 bg-muted/50 px-5 py-4 shadow-divider-top sm:flex-row sm:items-center sm:justify-between">
            <div className="mr-auto">
              {editingPreset ? (
                <Button onClick={deleteEditingPreset} type="button" variant="destructive">
                  {copy.delete}
                </Button>
              ) : null}
            </div>
            <Button onClick={closeEditor} type="button" variant="outline">
              {copy.cancel}
            </Button>
            <Button
              disabled={
                busy ||
                !(draftName.trim() || suggestedDraftName) ||
                Boolean(draftState.error)
              }
              onClick={savePreset}
              type="button"
            >
              {busy ? copy.saving : copy.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function hasDesktopBridge() {
  if (typeof window === "undefined") {
    return false;
  }

  return typeof window.claudeSettings?.read === "function";
}

export default function App() {
  return hasDesktopBridge() ? <DesktopApp /> : <MarketingSite />;
}
