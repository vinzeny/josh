import { test, expect, _electron as electron } from "@playwright/test";
import electronBinary from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("electron app can save and activate a preset against local files", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-"));
  const claudeDir = path.join(fakeHome, ".claude");
  const codexDir = path.join(fakeHome, ".codex");
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(codexDir, { recursive: true });

  const officialConfig = {
    env: {},
    permissions: {
      allow: ["mcp__pencil"]
    }
  };

  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(officialConfig, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(codexDir, "config.toml"),
    "model = \"gpt-5.3\"\nmodel_reasoning_effort = \"medium\"\n\n[projects.\"/tmp\"]\ntrust_level = \"trusted\"\n",
    "utf8"
  );

  const nextEnv = {
    ANTHROPIC_AUTH_TOKEN: "focus-token",
    ANTHROPIC_BASE_URL: "https://focus.example",
    ANTHROPIC_MODEL: "focus-model"
  };
  const nextCodex = {
    model: "gpt-5.4",
    model_reasoning_effort: "xhigh"
  };

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      JOSH_TERMINAL_CWD: process.cwd(),
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await expect(window.getByText("gpt-5.3")).toBeVisible();
    await window.getByRole("button", { name: /设置|Settings/ }).click();
    const settingsPage = window.locator(".settings-page");
    const addButton = settingsPage.getByRole("button", { name: /新增|Add/ });

    await expect(addButton).toBeVisible();
    await expect(settingsPage.locator(".preset-row")).toHaveCount(1);
    await addButton.click();

    const dialog = window.getByRole("dialog", { name: /新增配置|New Preset/ });
    await dialog.getByLabel(/配置名字|Preset Name/).fill("focus env");
    await dialog.getByLabel("Auth Token").fill(nextEnv.ANTHROPIC_AUTH_TOKEN);
    await dialog.getByLabel("Base URL").fill(nextEnv.ANTHROPIC_BASE_URL);
    await dialog.getByLabel("Claude Model").fill(nextEnv.ANTHROPIC_MODEL);
    await dialog.getByLabel("Codex Model").fill(nextCodex.model);
    await dialog.getByLabel("Codex Reasoning").fill(nextCodex.model_reasoning_effort);
    await dialog.getByRole("button", { name: /保存|Save/ }).click();

    await expect(settingsPage.locator(".preset-row")).toHaveCount(2);
    await settingsPage.locator(".preset-row").nth(1).locator(".launch-button").click();

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets.presets.map((item) => item.name)).toContain("focus env");
    expect(savedPresets.presets.find((item) => item.name === "focus env")?.content).toEqual({
      claude: {
        env: nextEnv
      },
      codex: nextCodex
    });

    await expect
      .poll(async () =>
        JSON.parse(await fs.readFile(path.join(claudeDir, "settings.json"), "utf8"))
      )
      .toEqual({
        ...officialConfig,
        env: nextEnv
      });

    await expect
      .poll(async () => await fs.readFile(path.join(codexDir, "config.toml"), "utf8"))
      .toContain('model = "gpt-5.4"');
    await expect
      .poll(async () => await fs.readFile(path.join(codexDir, "config.toml"), "utf8"))
      .toContain('model_reasoning_effort = "xhigh"');
    await expect(await fs.readFile(path.join(codexDir, "config.toml"), "utf8")).toContain(
      '[projects."/tmp"]'
    );

    await expect(window.getByText("focus-model / gpt-5.4")).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test("legacy preset files are ignored when the JOSH store is missing", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-legacy-"));
  const claudeDir = path.join(fakeHome, ".claude");
  const legacyDir = path.join(fakeHome, ".swtch");
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(legacyDir, { recursive: true });

  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        env: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    path.join(legacyDir, "presets.json"),
    JSON.stringify(
      {
        presets: [
          {
            name: "legacy preset",
            content: {
              ANTHROPIC_MODEL: "legacy-model"
            }
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      JOSH_TERMINAL_CWD: process.cwd(),
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("button", { name: /设置|Settings/ }).click();
    const settingsPage = window.locator(".settings-page");
    await expect(settingsPage.locator(".preset-row")).toHaveCount(1);
    await expect(settingsPage.locator(".preset-row").first()).toContainText("Official");
    await expect(settingsPage.getByText("legacy preset")).toHaveCount(0);

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets.presets).toEqual([
      {
        name: "Official",
        content: {
          claude: {
            env: {}
          },
          codex: {}
        }
      }
    ]);
  } finally {
    await electronApp.close();
  }
});

test("missing Claude Code and Codex configs still initializes the Official preset store", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-missing-claude-"));

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      JOSH_TERMINAL_CWD: process.cwd(),
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("button", { name: /设置|Settings/ }).click();
    const settingsPage = window.locator(".settings-page");
    await expect(settingsPage.locator(".preset-row")).toHaveCount(1);
    await expect(settingsPage.locator(".preset-row").first()).toContainText("Official");
    await expect(
      settingsPage.getByText(/^未找到 Claude Code 或 Codex$|^Claude Code or Codex Not Found$/)
    ).toBeVisible();

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets).toEqual({
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
    });
  } finally {
    await electronApp.close();
  }
});

test("invalid preset store is healed back to Official instead of crashing", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-invalid-store-"));
  const appDir = path.join(fakeHome, ".josh");
  await fs.mkdir(appDir, { recursive: true });
  await fs.writeFile(path.join(appDir, "presets.json"), "{\"broken\":true}", "utf8");

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await window.getByRole("button", { name: /设置|Settings/ }).click();
    const settingsPage = window.locator(".settings-page");
    await expect(settingsPage.locator(".preset-row")).toHaveCount(1);
    await expect(settingsPage.locator(".preset-row").first()).toContainText("Official");
    await expect(
      settingsPage.getByText(/^未找到 Claude Code 或 Codex$|^Claude Code or Codex Not Found$/)
    ).toBeVisible();

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets).toEqual({
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
    });
  } finally {
    await electronApp.close();
  }
});

test("desktop bridge exposes auto-update state", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-update-"));
  const claudeDir = path.join(fakeHome, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });

  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        env: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    const updates = await window.evaluate(() => window.joshUpdates.read());

    expect(updates.currentVersion).toBe("0.1.6");
    expect(updates.repo).toBe("vinzeny/josh");
    expect(updates.status).toBe("development");
    expect(updates.canCheck).toBe(false);
  } finally {
    await electronApp.close();
  }
});

test("desktop bridge can create and write to local terminal sessions", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-terminal-"));
  const projectDir = path.join(fakeHome, "project");
  const claudeDir = path.join(fakeHome, ".claude");
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.writeFile(
    path.join(fakeHome, ".zshrc"),
    "PROMPT='%F{yellow}%/ %f$ '\nPROMPT_EOL_MARK=''\n",
    "utf8"
  );
  await fs.writeFile(path.join(projectDir, "package.json"), "{}", "utf8");
  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        env: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      JOSH_TERMINAL_CWD: process.cwd(),
      SHELL: "/bin/zsh",
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    const initialPayload = await window.evaluate(() => window.joshTerminals.list());
    expect(initialPayload.terminals[0].cwd).toBe(process.cwd());

    const created = await window.evaluate(() => window.joshTerminals.create({}));
    expect(created.activeTerminalId).toBe(created.terminal.id);
    expect(created.terminal.cwd).toBe(process.cwd());
    expect(created.terminal.running).toBe(true);
    await expect
      .poll(async () => {
        const payload = await window.evaluate(
          (id) => window.joshTerminals.list(id),
          created.terminal.id
        );
        return payload.terminals.find((terminal) => terminal.id === created.terminal.id)?.buffer;
      })
      .toContain(process.cwd());

    await expect
      .poll(() =>
        window.evaluate((id) => window.joshTerminals.list(id), created.terminal.id)
      )
      .toMatchObject({
        activeTerminalId: created.terminal.id
      });

    const afterWrite = await window.evaluate(
      (id) => window.joshTerminals.write({ id, data: "echo bridge-ok\r" }),
      created.terminal.id
    );
    expect(afterWrite.terminal.id).toBe(created.terminal.id);

    const afterRename = await window.evaluate(
      (id) => window.joshTerminals.rename({ id, name: "Renamed Terminal" }),
      created.terminal.id
    );
    expect(afterRename.terminal.name).toBe("Renamed Terminal");

    await window.evaluate(
      (id) =>
        window.joshTerminals.write({
          id,
          data: "printf 'josh-env:%s:%s:%s:%s\\n' \"$SHELL_SESSIONS_DISABLE\" \"$TERM_PROGRAM\" \"$JOSH_TERM_PROGRAM\" \"$PROMPT_EOL_MARK\"\r"
        }),
      created.terminal.id
    );

    await expect
      .poll(async () => {
        const payload = await window.evaluate(
          (id) => window.joshTerminals.list(id),
          created.terminal.id
        );
        return payload.terminals.find((terminal) => terminal.id === created.terminal.id)?.buffer;
      })
      .toContain("bridge-ok");
    await expect
      .poll(async () => {
        const payload = await window.evaluate(
          (id) => window.joshTerminals.list(id),
          created.terminal.id
        );
        return payload.terminals.find((terminal) => terminal.id === created.terminal.id)?.buffer;
      })
      .toContain("josh-env:1:Apple_Terminal:JOSH Dev:");

    const afterResize = await window.evaluate(
      (id) => window.joshTerminals.resize({ id, cols: 100, rows: 24 }),
      created.terminal.id
    );
    expect(afterResize.terminal.id).toBe(created.terminal.id);
  } finally {
    await electronApp.close();
  }
});

test("closing the window keeps the app alive for menu bar quick switching", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-tray-"));
  const claudeDir = path.join(fakeHome, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });

  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(
      {
        env: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(process.cwd(), ".")],
    env: {
      ...process.env,
      HOME: fakeHome,
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    const state = await electronApp.evaluate(({ BrowserWindow }) => {
      const currentWindow = BrowserWindow.getAllWindows()[0];
      currentWindow.close();

      return {
        trayReady: globalThis.__JOSH_TRAY_READY__ === true,
        trayTitle: globalThis.__JOSH_TRAY_TITLE__ ?? "",
        visible: currentWindow.isVisible(),
        windowCount: BrowserWindow.getAllWindows().length
      };
    });

    expect(state).toEqual({
      trayReady: true,
      trayTitle: "",
      visible: false,
      windowCount: 1
    });
  } finally {
    await electronApp.close();
  }
});
