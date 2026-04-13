# JOSH

[English README](./README.md)

JOSH 是一个给 Claude Code 用的小型桌面切换器，用来管理模型预设，并且只改写 `~/.claude/settings.json` 里的 `env` 对象。

![JOSH 标志](./src/assets/product-image.png)

## 下载方式

- 从 Releases 页面下载对应芯片的 macOS 安装包：
  - `arm64` 对应 Apple 芯片 Mac
  - `x64` 对应 Intel Mac
- 打开 JOSH，选择想要启用的预设
- 如果界面提示没有安装 Claude Code，请先安装并启动一次 Claude Code

## 它能做什么

- 把常用模型配置保存成可复用的 JSON 预设
- 一键切换当前使用的 Claude Code 模型
- 内置 `Official` 预设，随时回到空 `env`
- 保留 `settings.json` 其他内容不变，只替换 `env`
- 本地没装 Claude Code 时，界面会直接提示先安装
- 支持中英文界面切换

## 存储位置

- Claude Code 配置：`~/.claude/settings.json`
- 预设文件：`~/.josh/presets.json`
- 备份目录：`~/.josh/backups`

JOSH 会自动把旧的内置名字，比如 `official json`，归一成 `Official`。

## 使用说明

- 切换时只会更新 `settings.json` 里的 `env`
- 如果本地没找到 Claude Code，JOSH 会提示先安装并禁用切换
- 切换完成后，请关闭终端并重新启动 Claude

## 发布

- 现在已经接入 Electron Forge，会分别生成 macOS `arm64` 和 `x64` 两套 `zip` / `dmg`
- 本地执行 `npm run make`，会同时产出 Apple 芯片版和 Intel 版，文件都在 `release/make`
- 推送像 `v0.1.0` 这样的 tag，就会触发 GitHub Actions 发布
- 工作流会分别在 Apple Silicon 和 Intel macOS runner 上构建，再统一上传到同一个 GitHub Draft Release
- 现在默认还是未签名包，macOS 可能会提示手动放行一次
