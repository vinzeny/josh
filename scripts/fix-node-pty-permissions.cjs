const fs = require("node:fs");
const path = require("node:path");

const helperPaths = [
  path.join(__dirname, "..", "node_modules", "node-pty", "prebuilds", "darwin-arm64", "spawn-helper"),
  path.join(__dirname, "..", "node_modules", "node-pty", "prebuilds", "darwin-x64", "spawn-helper")
];

for (const helperPath of helperPaths) {
  if (!fs.existsSync(helperPath)) {
    continue;
  }

  fs.chmodSync(helperPath, 0o755);
}
