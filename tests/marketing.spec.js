import { test, expect } from "@playwright/test";

test("renders the marketing homepage without the desktop bridge", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Switch Claude Code model presets without touching the rest of settings\.json\.|切换 Claude Code 模型预设，不动其余 settings\.json。/
    })
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "JOSH logo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download macOS App|下载 macOS App/ }).first()).toBeVisible();
  await expect(
    page.getByText(
      /The newest release will appear here after publishing\.|发布后这里会自动读取最新版本。/
    )
  ).toBeVisible();
});
