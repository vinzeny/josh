import { test, expect } from "@playwright/test";

function installMockApi(page, options = {}) {
  return page.addInitScript((mockOptions) => {
    const store = {
      installed: mockOptions.installed ?? true,
      settingsPath: "/Users/test/.claude/settings.json",
      codexConfigPath: "/Users/test/.codex/config.toml",
      appStorageDir: "/Users/test/.josh",
      presetStorePath: "/Users/test/.josh/presets.json",
      backupDir: "/Users/test/.josh/backups",
      parsed: {
        env: {},
        codex: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      presets: [
        {
          name: "Official",
          content: {
            claude: {
              env: {}
            },
            codex: {}
          }
        }
      ]
    };
    const updateStore = {
      supported: true,
      enabled: false,
      canCheck: false,
      checking: false,
      available: false,
      downloaded: false,
      currentVersion: "0.1.4",
      repo: "vinzeny/josh",
      status: "development",
      releaseName: "",
      releaseDate: "",
      releaseNotes: "",
      updateUrl: "",
      lastCheckedAt: "",
      error: ""
    };
    let terminalCounter = 1;
    const dataListeners = [];
    const changeListeners = [];
    window.__terminalWrites = [];
    let terminals = [
      {
        id: "terminal-1",
        name: "Terminal 1",
        folderId: "folder-1",
        cwd: "/Users/test",
        running: true,
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        buffer: "mock-shell$ "
      }
    ];
    let folders = [
      {
        id: "folder-1",
        name: "test",
        cwd: "/Users/test",
        terminalIds: ["terminal-1"],
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z"
      }
    ];

    const emitTerminalData = (id, data) => {
      dataListeners.forEach((listener) => listener({ id, data }));
    };

    const emitTerminalsChanged = (activeId, activeFolderId) => {
      const payload = serializeTerminals(activeId, activeFolderId);
      changeListeners.forEach((listener) => listener(payload));
    };

    const serializeTerminals = (activeId, activeFolderId) => {
      const activeTerminalId = terminals.some((terminal) => terminal.id === activeId)
        ? activeId
        : terminals[0]?.id;
      const selectedTerminal = terminals.find((terminal) => terminal.id === activeTerminalId);
      const selectedFolderId = folders.some((folder) => folder.id === activeFolderId)
        ? activeFolderId
        : selectedTerminal?.folderId ?? folders[0]?.id;

      return {
        folders: folders.map((folder) => ({
          ...folder,
          terminalIds: terminals
            .filter((terminal) => terminal.folderId === folder.id)
            .map((terminal) => terminal.id)
        })),
        terminals,
        activeTerminalId,
        activeFolderId: selectedFolderId
      };
    };

    const normalizePresetContent = (content = {}) => {
      if (content.claude || content.codex) {
        return {
          claude: {
            env: content.claude?.env ?? {}
          },
          codex: content.codex ?? {}
        };
      }

      return {
        claude: {
          env: content.env ?? content
        },
        codex: {}
      };
    };

    window.claudeSettings = {
      read: async () => ({
        installed: store.installed,
        settingsPath: store.settingsPath,
        codexConfigPath: store.codexConfigPath,
        appStorageDir: store.appStorageDir,
        presetStorePath: store.presetStorePath,
        backupDir: store.backupDir,
        parsed: store.parsed,
        presets: store.presets
      }),
      createPreset: async (preset) => {
        const content = normalizePresetContent(preset.content);
        store.presets = store.presets
          .filter((item) => item.name !== preset.name)
          .concat([{ name: preset.name, content }]);
        return { presets: store.presets };
      },
      listPresets: async () => ({ presets: store.presets }),
      activate: async (content) => {
        const normalized = normalizePresetContent(content);
        store.parsed = {
          ...store.parsed,
          env: normalized.claude.env,
          codex: normalized.codex
        };
        return { saved: store.parsed };
      },
      deletePreset: async (presetName) => {
        store.presets = store.presets.filter((item) => item.name !== presetName);
        return { presets: store.presets };
      }
    };

    window.joshUpdates = {
      read: async () => updateStore,
      check: async () => updateStore,
      onDidChange: () => () => {}
    };

    window.joshTerminals = {
      list: async (activeId) => serializeTerminals(activeId),
      selectFolder: async () => {
        const folder = {
          id: "folder-2",
          name: "project",
          cwd: "/Users/test/project",
          terminalIds: [],
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z"
        };
        folders = folders.concat(folder);
        emitTerminalsChanged(undefined, folder.id);
        return {
          canceled: false,
          folder,
          ...serializeTerminals(undefined, folder.id)
        };
      },
      create: async (options = {}) => {
        terminalCounter += 1;
        const folder = folders.find(
          (item) => item.id === options.folderId || item.cwd === options.cwd
        ) ?? folders[0];
        const terminal = {
          id: `terminal-${terminalCounter}`,
          name: `Terminal ${terminalCounter}`,
          folderId: folder.id,
          cwd: folder.cwd,
          running: true,
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
          buffer: "mock-shell$ "
        };
        terminals = terminals.concat(terminal);
        emitTerminalsChanged(terminal.id, folder.id);
        return {
          terminal,
          ...serializeTerminals(terminal.id, folder.id)
        };
      },
      write: async ({ id, data }) => {
        const terminal = terminals.find((item) => item.id === id);
        window.__terminalWrites.push(data);
        terminal.buffer = `${terminal.buffer}${data}`;
        emitTerminalData(id, data);
        return {
          terminal,
          ...serializeTerminals(id, terminal?.folderId)
        };
      },
      rename: async ({ id, name }) => {
        terminals = terminals.map((terminal) =>
          terminal.id === id
            ? {
                ...terminal,
                name: name.trim() || terminal.name,
                updatedAt: "2026-04-22T00:00:01.000Z"
              }
            : terminal
        );
        emitTerminalsChanged(id, terminals.find((terminal) => terminal.id === id)?.folderId);
        return {
          terminal: terminals.find((terminal) => terminal.id === id),
          ...serializeTerminals(id, terminals.find((terminal) => terminal.id === id)?.folderId)
        };
      },
      delete: async ({ id }) => {
        const terminal = terminals.find((item) => item.id === id);
        terminals = terminals.filter((item) => item.id !== id);
        emitTerminalsChanged(terminals[0]?.id);
        return {
          terminal,
          ...serializeTerminals(terminals[0]?.id, terminal?.folderId)
        };
      },
      deleteFolder: async ({ id }) => {
        const folder = folders.find((item) => item.id === id);
        folders = folders.filter((item) => item.id !== id);
        terminals = terminals.filter((item) => item.folderId !== id);
        emitTerminalsChanged(terminals[0]?.id);
        return {
          folder,
          ...serializeTerminals(terminals[0]?.id)
        };
      },
      resize: async ({ id }) => ({
        terminal: terminals.find((item) => item.id === id),
        ...serializeTerminals(id, terminals.find((item) => item.id === id)?.folderId)
      }),
      onData: (callback) => {
        dataListeners.push(callback);
        return () => {
          const index = dataListeners.indexOf(callback);
          if (index >= 0) {
            dataListeners.splice(index, 1);
          }
        };
      },
      onDidChange: (callback) => {
        changeListeners.push(callback);
        return () => {
          const index = changeListeners.indexOf(callback);
          if (index >= 0) {
            changeListeners.splice(index, 1);
          }
        };
      }
    };
  }, options);
}

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");
});

test("can save a custom env preset from the add dialog and refresh the list", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();
  const settingsPage = page.locator(".settings-page");

  await expect(page.locator(".preset-row").first()).toContainText("Official");
  await expect(page.getByText("未设置")).toBeVisible();

  await settingsPage.getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  await dialog.getByLabel("配置名字").fill("work env");
  await dialog.getByLabel("Auth Token").fill("token");
  await dialog.getByLabel("Base URL").fill("https://example.test");
  await dialog.getByLabel("Claude Model").fill("claude-demo");
  await dialog.getByLabel("Codex Model").fill("gpt-5.4");

  await dialog.getByRole("button", { name: "保存" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("已保存 work env。")).toBeVisible();
  await expect(page.locator(".preset-row").nth(1)).toContainText("work env");
  await page.getByRole("button", { name: "编辑 work env" }).click();

  const editDialog = page.getByRole("dialog", { name: "编辑 work env" });
  await expect(editDialog.getByLabel("配置名字")).toHaveValue("work env");
});

test("shows local terminal workspace with switcher, output, and project directory", async ({ page }) => {
  await expect(page.getByText("JOSH", { exact: true })).toBeVisible();
  await expect(page.locator(".terminal-row")).toHaveCount(1);
  await expect(page.getByRole("main").getByText("/Users/test", { exact: true })).toBeVisible();
  await expect(page.locator(".xterm")).toBeVisible();
  await page.locator(".xterm").click();
  await page.keyboard.type("pwd");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__terminalWrites.join(""))).toContain("pwd");

  await page.getByRole("button", { name: "在 test 中添加" }).click();
  await expect(page.locator(".terminal-row")).toHaveCount(2);

  await page.getByRole("main").getByRole("textbox", { name: "重命名 Terminal 2" }).fill("API");
  await expect(page.locator(".terminal-row").nth(1)).toContainText("API");
  await expect(page.locator(".terminal-row").locator("input")).toHaveCount(0);
});

test("sidebar terminal rows switch back from settings without editing names", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.locator(".settings-page")).toBeVisible();

  await page.locator(".terminal-row").first().click();

  await expect(page.locator(".settings-page")).toBeHidden();
  await expect(page.locator(".xterm")).toBeVisible();
  await expect
    .poll(async () => {
      const box = await page.locator(".xterm-screen").boundingBox();
      return Math.round(box?.width ?? 0);
    })
    .toBeGreaterThan(300);
  await expect
    .poll(async () => {
      const box = await page.locator(".xterm-screen").boundingBox();
      return Math.round(box?.height ?? 0);
    })
    .toBeGreaterThan(300);
  await expect(page.locator(".terminal-row").locator("input")).toHaveCount(0);
});

test("can select a folder and manage terminals inside it", async ({ page }) => {
  await page.getByRole("button", { name: "选择文件夹" }).click();

  await expect(page.locator(".folder-row").filter({ hasText: "project" })).toBeVisible();
  await expect(page.getByRole("main").getByText("/Users/test/project", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("这个文件夹还没有 Terminal。")).toBeVisible();

  await page.getByRole("button", { name: "在 project 中添加" }).click();
  await expect(page.locator(".terminal-row")).toHaveCount(2);
  await expect(page.getByRole("main").getByText("/Users/test/project", { exact: true })).toBeVisible();

  await page.getByRole("main").getByRole("textbox", { name: "重命名 Terminal 2" }).fill("Worker");
  await expect(page.locator(".folder-row").filter({ hasText: "project" })).toContainText("Worker");

  await page.getByRole("button", { name: "删除 Worker" }).click();
  await expect(page.locator(".folder-row").filter({ hasText: "project" }).locator(".terminal-row")).toHaveCount(0);
});

test("can switch editor to json paste mode", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();
  await page.locator(".settings-page").getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  await dialog.getByRole("tab", { name: "JSON" }).click();
  const jsonInput = dialog.getByLabel("Preset JSON");
  await expect(jsonInput).toBeVisible();
  await expect(dialog.getByLabel("Auth Token")).toBeHidden();

  await jsonInput.fill(
    JSON.stringify(
      {
        claude: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "token",
            ANTHROPIC_BASE_URL: "https://example.test",
            ANTHROPIC_MODEL: "glm-5"
          }
        },
        codex: {
          model: "gpt-5.4"
        }
      },
      null,
      2
    )
  );

  await expect(dialog.getByLabel("配置名字")).toHaveValue("glm-5");
  await expect(dialog.getByRole("button", { name: "保存" })).toBeEnabled();
});

test("auth token field can toggle between hidden and visible", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();
  await page.locator(".settings-page").getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  const tokenInput = dialog.getByLabel("Auth Token");

  await expect(tokenInput).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "显示密码" }).click();
  await expect(tokenInput).toHaveAttribute("type", "text");
});

test("can open settings and show file paths", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPage = page.locator(".settings-page");
  await expect(settingsPage.getByText("模型配置")).toBeVisible();
  await expect(settingsPage.locator(".preset-row").first()).toContainText("Official");
  await expect(settingsPage.getByText("0.1.4")).toBeVisible();
  await expect(settingsPage.getByText("vinzeny/josh")).toBeVisible();
  await expect(settingsPage.getByRole("button", { name: "检查新版本" })).toBeDisabled();
  await expect(settingsPage.getByText("/Users/test/.josh/presets.json")).toBeVisible();
  await expect(settingsPage.getByText("/Users/test/.josh/backups")).toBeVisible();
  await expect(settingsPage.getByText("/Users/test/.claude/settings.json")).toBeVisible();
  await expect(settingsPage.getByText("/Users/test/.codex/config.toml")).toBeVisible();
});

test("shows install guidance when Claude Code and Codex configs are missing", async ({ page }) => {
  await page.goto("about:blank");
  await installMockApi(page, { installed: false });
  await page.goto("/");

  await expect(page.getByText("未安装")).toBeVisible();
  await page.getByRole("button", { name: "设置" }).click();
  const settingsPage = page.locator(".settings-page");
  await expect(settingsPage.getByText("未找到 Claude Code 或 Codex", { exact: true })).toBeVisible();
  await expect(settingsPage.getByText("请先安装并启动一次 Claude Code 或 Codex，然后再切换模型。")).toBeVisible();
  await expect(settingsPage.locator(".launch-button").first()).toBeDisabled();
});

test("can switch interface language from settings", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const settingsPage = page.locator(".settings-page");
  await settingsPage.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("JOSH", { exact: true })).toBeVisible();
});

test("can switch appearance theme from settings", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  await page.getByRole("button", { name: "主题: 白色" }).click();

  await expect(page.locator("[data-theme-mode]")).toHaveAttribute("data-theme-mode", "light");
  await expect(page.locator("[data-theme-mode]")).not.toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("swtch-theme-mode")))
    .toBe("light");

  await page.getByRole("button", { name: "主题: 黑色" }).click();

  await expect(page.locator("[data-theme-mode]")).toHaveAttribute("data-theme-mode", "dark");
  await expect(page.locator("[data-theme-mode]")).toHaveClass(/dark/);
});

test("settings shows update action when a downloaded release is ready", async ({ page }) => {
  await page.goto("about:blank");
  await page.addInitScript(() => {
    const store = {
      installed: true,
      settingsPath: "/Users/test/.claude/settings.json",
      codexConfigPath: "/Users/test/.codex/config.toml",
      appStorageDir: "/Users/test/.josh",
      presetStorePath: "/Users/test/.josh/presets.json",
      backupDir: "/Users/test/.josh/backups",
      parsed: {
        env: {},
        codex: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      presets: [
        {
          name: "Official",
          content: {
            claude: {
              env: {}
            },
            codex: {}
          }
        }
      ]
    };

    window.claudeSettings = {
      read: async () => store,
      createPreset: async () => ({ presets: store.presets }),
      listPresets: async () => ({ presets: store.presets }),
      activate: async () => ({ saved: store.parsed }),
      deletePreset: async () => ({ presets: store.presets }),
      onDidChange: () => () => {}
    };

    window.__installClicked = false;
    window.joshUpdates = {
      read: async () => ({
        supported: true,
        enabled: true,
        canCheck: true,
        checking: false,
        available: true,
        downloaded: true,
        currentVersion: "0.1.4",
        repo: "vinzeny/josh",
        status: "downloaded",
        releaseName: "v0.2.0",
        releaseDate: "",
        releaseNotes: "",
        updateUrl: "",
        lastCheckedAt: "",
        error: ""
      }),
      check: async () => ({}),
      install: async () => {
        window.__installClicked = true;
        return {};
      },
      onDidChange: () => () => {}
    };
  });
  await page.goto("/");

  await page.getByRole("button", { name: "设置" }).click();
  const settingsPage = page.locator(".settings-page");
  await expect(settingsPage.getByRole("button", { name: "立即更新" })).toBeVisible();
  await settingsPage.getByRole("button", { name: "立即更新" }).click();
  await expect.poll(() => page.evaluate(() => window.__installClicked)).toBe(true);
});
