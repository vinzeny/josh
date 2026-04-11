import { test, expect, _electron as electron } from "@playwright/test";
import electronBinary from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("electron app can save and activate a preset against local files", async () => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "josh-"));
  const claudeDir = path.join(fakeHome, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });

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

  const nextEnv = {
    ANTHROPIC_AUTH_TOKEN: "focus-token",
    ANTHROPIC_BASE_URL: "https://focus.example",
    ANTHROPIC_MODEL: "focus-model"
  };

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
    const addButton = window.getByRole("button", { name: /新增|Add/ });

    await window.waitForLoadState("domcontentloaded");
    await expect(addButton).toBeVisible();
    await expect(window.locator(".preset-row")).toHaveCount(1);
    await expect(window.getByText(/未设置|Not set/)).toBeVisible();

    await addButton.click();

    const dialog = window.getByRole("dialog", { name: /新增配置|New Preset/ });
    await dialog.getByLabel(/配置名字|Preset Name/).fill("focus env");
    await dialog.getByLabel("Auth Token").fill(nextEnv.ANTHROPIC_AUTH_TOKEN);
    await dialog.getByLabel("Base URL").fill(nextEnv.ANTHROPIC_BASE_URL);
    await dialog.getByLabel("Model").fill(nextEnv.ANTHROPIC_MODEL);
    await dialog.getByRole("button", { name: /保存|Save/ }).click();

    await expect(window.locator(".preset-row")).toHaveCount(2);
    await window.locator(".preset-row").nth(1).locator(".launch-button").click();

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets.presets.map((item) => item.name)).toContain("focus env");
    expect(savedPresets.presets.find((item) => item.name === "focus env")?.content).toEqual(nextEnv);

    await expect
      .poll(async () =>
        JSON.parse(await fs.readFile(path.join(claudeDir, "settings.json"), "utf8"))
      )
      .toEqual({
        ...officialConfig,
        env: nextEnv
      });

    await expect(window.getByText("focus-model")).toBeVisible();
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
      ELECTRON_RENDERER_URL: "http://127.0.0.1:4173"
    }
  });

  try {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await expect(window.locator(".preset-row")).toHaveCount(1);
    await expect(window.locator(".preset-row").first()).toContainText("Official");
    await expect(window.getByText("legacy preset")).toHaveCount(0);

    const savedPresets = JSON.parse(
      await fs.readFile(path.join(fakeHome, ".josh", "presets.json"), "utf8")
    );
    expect(savedPresets.presets).toEqual([
      {
        name: "Official",
        content: {}
      }
    ]);
  } finally {
    await electronApp.close();
  }
});
