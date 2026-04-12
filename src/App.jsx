import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, PencilLine, Play, Plus, Settings2 } from "lucide-react";

import MarketingSite from "@/MarketingSite";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OFFICIAL_NAME = "Official";
const LOCALE_STORAGE_KEY = "swtch-locale";
const FORM_FIELDS = [
  {
    key: "ANTHROPIC_AUTH_TOKEN",
    labelZh: "Auth Token",
    labelEn: "Auth Token",
    placeholderZh: "粘贴 ANTHROPIC_AUTH_TOKEN",
    placeholderEn: "Paste ANTHROPIC_AUTH_TOKEN"
  },
  {
    key: "ANTHROPIC_BASE_URL",
    labelZh: "Base URL",
    labelEn: "Base URL",
    placeholderZh: "例如：https://api.example.com",
    placeholderEn: "For example: https://api.example.com"
  },
  {
    key: "ANTHROPIC_MODEL",
    labelZh: "Model",
    labelEn: "Model",
    placeholderZh: "例如：glm-5",
    placeholderEn: "For example: glm-5"
  }
];
const ENV_TEMPLATE = {
  ANTHROPIC_AUTH_TOKEN: "",
  ANTHROPIC_BASE_URL: "",
  ANTHROPIC_MODEL: ""
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
    title: "Env 切换器",
    subtitle: "claude code model switch",
    restartHint: "切换后请关闭终端，并重新启动 Claude。",
    settings: "设置",
    add: "新增",
    currentModel: "当前模型",
    notSet: "未设置",
    unmatchedPreset: "未匹配列表",
    claudeMissingShort: "未安装",
    claudeMissingTitle: "未找到 Claude Code",
    claudeMissingBody: "请先安装并启动一次 Claude Code，然后再切换模型。",
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
    editorTitleNew: "新增配置",
    editorTitleEdit: (name) => `编辑 ${name}`,
    editorDescription: "只改写本地 settings.json 里的 env 对象。",
    editorMode: "编辑模式",
    formMode: "表单",
    jsonMode: "JSON",
    showToken: "显示密码",
    hideToken: "隐藏密码",
    nameLabel: "配置名字",
    namePlaceholder: "例如：glm5",
    jsonLabel: "Env JSON",
    formHint: "常用字段直接填，切到 JSON 可以整段粘贴。",
    envHint: "建议保留 ANTHROPIC_AUTH_TOKEN、ANTHROPIC_BASE_URL、ANTHROPIC_MODEL。",
    delete: "删除",
    cancel: "取消",
    save: "保存",
    saving: "处理中...",
    settingsTitle: "文件位置",
    settingsDescription: "所有配置都保存在 JOSH 自己的目录里。",
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
    language: "界面语言",
    chinese: "中文",
    english: "English",
    settingsPath: "Claude 配置",
    presetPath: "预设文件",
    backupPath: "备份目录",
    appPath: "JOSH 目录",
    status: {
      loading: "正在读取配置...",
      loaded: "配置已加载。",
      claudeMissing: "未找到 Claude Code 配置，请先安装并启动一次 Claude Code。",
      invalidFormat: "当前草稿无法格式化。",
      nameRequired: "请先输入配置名字。",
      duplicateName: "这个名字已经存在了。",
      invalidDraft: "当前 Env 还不能保存。",
      invalidFormMode: "JSON 无效，先修正后再切回表单。",
      saved: (name) => `已保存 ${name}。`,
      renamed: (from, to) => `已将 ${from} 更新为 ${to}。`,
      switched: (name) => `已切换到 ${name}。`,
      deleted: (name) => `已删除 ${name}。`,
      languageChanged: "已切换界面语言。"
    }
  },
  en: {
    title: "Env Switcher",
    subtitle: "claude code model switch",
    restartHint: "After switching, close the terminal and restart Claude.",
    settings: "Settings",
    add: "Add",
    currentModel: "Current Model",
    notSet: "Not set",
    unmatchedPreset: "No preset match",
    claudeMissingShort: "Not installed",
    claudeMissingTitle: "Claude Code Not Found",
    claudeMissingBody: "Install Claude Code and launch it once before switching models.",
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
    editorTitleNew: "New Preset",
    editorTitleEdit: (name) => `Edit ${name}`,
    editorDescription: "Only the env object in local settings.json will be replaced.",
    editorMode: "Edit Mode",
    formMode: "Form",
    jsonMode: "JSON",
    showToken: "Show secret",
    hideToken: "Hide secret",
    nameLabel: "Preset Name",
    namePlaceholder: "For example: glm5",
    jsonLabel: "Env JSON",
    formHint: "Fill the common fields here, or switch to JSON for full paste mode.",
    envHint: "Keep ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, and ANTHROPIC_MODEL.",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Working...",
    settingsTitle: "File Locations",
    settingsDescription: "All presets are stored inside JOSH's own folder.",
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
    language: "Language",
    chinese: "中文",
    english: "English",
    settingsPath: "Claude Settings",
    presetPath: "Preset Store",
    backupPath: "Backups",
    appPath: "JOSH Folder",
    status: {
      loading: "Loading configuration...",
      loaded: "Configuration loaded.",
      claudeMissing: "Claude Code config not found. Install Claude Code and launch it once first.",
      invalidFormat: "The current draft cannot be formatted.",
      nameRequired: "Please enter a preset name first.",
      duplicateName: "That preset name already exists.",
      invalidDraft: "The current env cannot be saved yet.",
      invalidFormMode: "Fix the JSON before switching back to form mode.",
      saved: (name) => `Saved ${name}.`,
      renamed: (from, to) => `Updated ${from} to ${to}.`,
      switched: (name) => `Switched to ${name}.`,
      deleted: (name) => `Deleted ${name}.`,
      languageChanged: "Interface language updated."
    }
  }
};

function getInitialLocale() {
  if (typeof window === "undefined") {
    return "zh";
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh";
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

function findMatchingPresetName(settings, presets) {
  const current = JSON.stringify(currentEnv(settings));
  const matched = presets.find((preset) => JSON.stringify(preset.content) === current);
  return matched?.name ?? null;
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

function DesktopApp() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [settingsPath, setSettingsPath] = useState("");
  const [appStorageDir, setAppStorageDir] = useState("");
  const [presetStorePath, setPresetStorePath] = useState("");
  const [backupDir, setBackupDir] = useState("");
  const [currentSettings, setCurrentSettings] = useState(null);
  const [presets, setPresets] = useState([]);
  const [updateInfo, setUpdateInfo] = useState(makeDefaultUpdateState);
  const [claudeInstalled, setClaudeInstalled] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState(stringify(ENV_TEMPLATE));
  const [status, setStatus] = useState(() => MESSAGES[getInitialLocale()].status.loading);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("form");
  const [nameTouched, setNameTouched] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingPresetName, setEditingPresetName] = useState(null);
  const copy = MESSAGES[locale];

  const activePresetName = useMemo(
    () => (claudeInstalled ? findMatchingPresetName(currentSettings, presets) : null),
    [claudeInstalled, currentSettings, presets]
  );

  const currentModel = useMemo(() => {
    if (!claudeInstalled) {
      return copy.claudeMissingShort;
    }
    const model = currentEnv(currentSettings).ANTHROPIC_MODEL?.trim();
    return model || copy.notSet;
  }, [claudeInstalled, copy.claudeMissingShort, copy.notSet, currentSettings]);

  const updateStatusText = useMemo(
    () => formatUpdateStatus(copy, updateInfo),
    [copy, updateInfo]
  );

  const draftState = useMemo(() => {
    try {
      const parsed = JSON.parse(draftContent);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        return {
          parsed: null,
          error: "Env JSON 必须是一个对象。"
        };
      }

      return {
        parsed,
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

    return draftState.parsed.ANTHROPIC_MODEL?.trim() || "";
  }, [draftState.parsed, editingPreset]);

  const settingsItems = useMemo(
    () => [
      { label: copy.settingsPath, value: settingsPath },
      { label: copy.presetPath, value: presetStorePath },
      { label: copy.backupPath, value: backupDir },
      { label: copy.appPath, value: appStorageDir }
    ],
    [appStorageDir, backupDir, copy.appPath, copy.backupPath, copy.presetPath, copy.settingsPath, presetStorePath, settingsPath]
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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  async function refreshPresets() {
    const refreshed = await window.claudeSettings.listPresets();
    setPresets(refreshed.presets);
    return refreshed.presets;
  }

  function openNewEditor() {
    setEditingPresetName(null);
    setDraftName("");
    setDraftContent(stringify(ENV_TEMPLATE));
    setEditorMode("form");
    setNameTouched(false);
    setTokenVisible(false);
    setEditorOpen(true);
  }

  function openPresetEditor(preset) {
    setEditingPresetName(preset.name === OFFICIAL_NAME ? null : preset.name);
    setDraftName(preset.name === OFFICIAL_NAME ? "" : preset.name);
    setDraftContent(stringify(preset.content));
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
    const nextDraft = {
      ...(draftState.parsed ?? {}),
      [field]: value
    };

    setDraftContent(stringify(nextDraft));
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

  const editorTitle = editingPreset
    ? copy.editorTitleEdit(editingPreset.name)
    : copy.editorTitleNew;

  return (
    <div className="dark h-screen overflow-hidden bg-background text-foreground">
      <div
        className={cn("mx-auto flex h-screen max-w-3xl flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-5")}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold uppercase tracking-[0.24em] text-foreground sm:text-xl">
              JOSH
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setSettingsOpen(true)} size="sm" type="button" variant="outline">
              <Settings2 className="size-4" />
              {copy.settings}
            </Button>
            <Button onClick={openNewEditor} size="sm" type="button">
              <Plus className="size-4" />
              {copy.add}
            </Button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden py-4">
          <div className="mb-3 shrink-0 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {copy.presetList}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{copy.presetCount(presets.length)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{status}</p>
            </div>

            <div className="min-w-0 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {copy.currentModel}
              </p>
              <div className="mt-1 flex items-center justify-end gap-2">
                <strong
                  className="max-w-[10rem] truncate text-sm font-medium tracking-tight text-muted-foreground sm:max-w-[14rem]"
                  title={currentModel}
                >
                  {currentModel}
                </strong>
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
            </div>
          </div>

          {!claudeInstalled ? (
            <div className="mb-3 shrink-0 rounded-lg border border-primary/35 bg-primary/10 px-4 py-3">
              <p className="text-sm font-medium text-primary">{copy.claudeMissingTitle}</p>
              <p className="mt-1 text-sm text-primary/85">{copy.claudeMissingBody}</p>
            </div>
          ) : null}

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 pr-3 pb-4">
              {presets.map((preset) => {
                const isActive = preset.name === activePresetName;
                const isOfficial = preset.name === OFFICIAL_NAME;

                const nameBlock = (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold tracking-tight">
                        {preset.name}
                      </span>
                      {isOfficial ? (
                        <Badge className="rounded-md px-2 py-1" variant="outline">
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
                );

                return (
                  <Card
                    key={preset.name}
                    className={cn(
                      "preset-row gap-0 rounded-lg border border-border/70 bg-card/70 py-0 shadow-none ring-0 transition-colors",
                      isActive && "border-primary/45 bg-primary/6"
                    )}
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">{nameBlock}</div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          aria-label={
                            isOfficial ? copy.cloneOfficial : copy.editPreset(preset.name)
                          }
                          onClick={() => openPresetEditor(preset)}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <PencilLine className="size-4" />
                        </Button>
                        <Button
                          className="launch-button shrink-0"
                          disabled={busy || isActive || !claudeInstalled}
                          onClick={() => activatePreset(preset)}
                          size="sm"
                          type="button"
                        >
                          <Play className="size-4" />
                          {isActive ? copy.current : copy.launch}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <div className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-3 text-center">
                <p className="text-sm font-medium text-primary">{copy.restartHint}</p>
              </div>
            </div>
          </ScrollArea>
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
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
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
                  className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5"
                  role="tablist"
                >
                  <button
                    aria-selected={editorMode === "form"}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none",
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
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none",
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
                            value={draftState.parsed?.[field.key] ?? ""}
                            onChange={(event) => setDraftField(field.key, event.target.value)}
                          />
                          <button
                            aria-label={tokenVisible ? copy.hideToken : copy.showToken}
                            className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
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
                          value={draftState.parsed?.[field.key] ?? ""}
                          onChange={(event) => setDraftField(field.key, event.target.value)}
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

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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

      <Dialog onOpenChange={setSettingsOpen} open={settingsOpen}>
        <DialogContent className="flex max-h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle>{copy.settingsTitle}</DialogTitle>
            <DialogDescription>{copy.settingsDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-3">
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
                      disabled={!updateInfo.canCheck || updateInfo.status === "checking"}
                      onClick={checkForUpdates}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {updateInfo.status === "checking" ? copy.updateChecking : copy.updateCheck}
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
                    <p className="mt-1 break-all text-sm leading-6">{updateInfo.repo || "-"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy.updateHint}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {copy.language}
                </p>
                <div className="mt-3 flex items-center gap-2">
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
              {settingsItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border/70 bg-muted/35 px-3 py-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 break-all text-sm leading-6">{item.value}</p>
                </div>
              ))}
            </div>
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
