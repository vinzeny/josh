import { test, expect } from "@playwright/test";

function installMockApi(page, options = {}) {
  return page.addInitScript((mockOptions) => {
    const store = {
      installed: mockOptions.installed ?? true,
      settingsPath: "/Users/test/.claude/settings.json",
      appStorageDir: "/Users/test/.josh",
      presetStorePath: "/Users/test/.josh/presets.json",
      backupDir: "/Users/test/.josh/backups",
      parsed: {
        env: {},
        permissions: {
          allow: ["mcp__pencil"]
        }
      },
      presets: [
        {
          name: "Official",
          content: {}
        }
      ]
    };

    window.claudeSettings = {
      read: async () => ({
        installed: store.installed,
        settingsPath: store.settingsPath,
        appStorageDir: store.appStorageDir,
        presetStorePath: store.presetStorePath,
        backupDir: store.backupDir,
        parsed: store.parsed,
        presets: store.presets
      }),
      createPreset: async (preset) => {
        store.presets = store.presets
          .filter((item) => item.name !== preset.name)
          .concat([{ name: preset.name, content: preset.content }]);
        return { presets: store.presets };
      },
      listPresets: async () => ({ presets: store.presets }),
      activate: async (content) => {
        store.parsed = {
          ...store.parsed,
          env: content
        };
        return { saved: store.parsed };
      },
      deletePreset: async (presetName) => {
        store.presets = store.presets.filter((item) => item.name !== presetName);
        return { presets: store.presets };
      }
    };
  }, options);
}

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");
});

test("can save a custom env preset from the add dialog and refresh the list", async ({ page }) => {
  await expect(page.locator(".preset-row").first()).toContainText("Official");
  await expect(page.getByText("未设置")).toBeVisible();

  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  await dialog.getByLabel("配置名字").fill("work env");
  await dialog.getByLabel("Auth Token").fill("token");
  await dialog.getByLabel("Base URL").fill("https://example.test");
  await dialog.getByLabel("Model").fill("claude-demo");

  await dialog.getByRole("button", { name: "保存" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("已保存 work env。")).toBeVisible();
  await expect(page.locator(".preset-row").nth(1)).toContainText("work env");
  await page.getByRole("button", { name: "编辑 work env" }).click();

  const editDialog = page.getByRole("dialog", { name: "编辑 work env" });
  await expect(editDialog.getByLabel("配置名字")).toHaveValue("work env");
});

test("can switch editor to json paste mode", async ({ page }) => {
  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  await dialog.getByRole("tab", { name: "JSON" }).click();
  const jsonInput = dialog.getByLabel("Env JSON");
  await expect(jsonInput).toBeVisible();
  await expect(dialog.getByLabel("Auth Token")).toBeHidden();

  await jsonInput.fill(
    JSON.stringify(
      {
        ANTHROPIC_AUTH_TOKEN: "token",
        ANTHROPIC_BASE_URL: "https://example.test",
        ANTHROPIC_MODEL: "glm-5"
      },
      null,
      2
    )
  );

  await expect(dialog.getByLabel("配置名字")).toHaveValue("glm-5");
  await expect(dialog.getByRole("button", { name: "保存" })).toBeEnabled();
});

test("auth token field can toggle between hidden and visible", async ({ page }) => {
  await page.getByRole("button", { name: "新增" }).click();

  const dialog = page.getByRole("dialog", { name: "新增配置" });
  const tokenInput = dialog.getByLabel("Auth Token");

  await expect(tokenInput).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "显示密码" }).click();
  await expect(tokenInput).toHaveAttribute("type", "text");
});

test("can open settings and show file paths", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const dialog = page.getByRole("dialog", { name: "文件位置" });
  await expect(dialog.getByText("/Users/test/.josh/presets.json")).toBeVisible();
  await expect(dialog.getByText("/Users/test/.josh/backups")).toBeVisible();
  await expect(dialog.getByText("/Users/test/.claude/settings.json")).toBeVisible();
});

test("shows install guidance when Claude Code config is missing", async ({ page }) => {
  await page.goto("about:blank");
  await installMockApi(page, { installed: false });
  await page.goto("/");

  await expect(page.getByText("未找到 Claude Code", { exact: true })).toBeVisible();
  await expect(page.getByText("请先安装并启动一次 Claude Code，然后再切换模型。")).toBeVisible();
  await expect(page.getByText("未安装")).toBeVisible();
  await expect(page.locator(".launch-button").first()).toBeDisabled();
});

test("can switch interface language from settings", async ({ page }) => {
  await page.getByRole("button", { name: "设置" }).click();

  const dialog = page.getByRole("dialog", { name: "文件位置" });
  await dialog.getByRole("button", { name: "English" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
  await expect(page.getByText("claude code model switch")).toBeVisible();
});
