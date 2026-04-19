const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function resolveGitHubRepository() {
  const fullRepository =
    process.env.GITHUB_REPOSITORY || process.env.JOSH_GITHUB_REPOSITORY;

  if (fullRepository) {
    const [owner, name] = fullRepository.split("/");
    if (owner && name) {
      return { owner, name };
    }
  }

  const owner =
    process.env.GITHUB_REPOSITORY_OWNER || process.env.JOSH_GITHUB_OWNER;
  const name = process.env.JOSH_GITHUB_REPO;

  if (owner && name) {
    return { owner, name };
  }

  return null;
}

const repository = resolveGitHubRepository();
const appIconPath = path.join(__dirname, "src", "assets", "icon");
const dmgIconPath = path.join(__dirname, "src", "assets", "icon.icns");

function adHocSignPackagedApps(_forgeConfig, packageResult) {
  if (process.platform !== "darwin") {
    return;
  }

  for (const outputPath of packageResult.outputPaths) {
    const entries = fs.readdirSync(outputPath, { withFileTypes: true });
    const appBundle = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));

    if (!appBundle) {
      continue;
    }

    execFileSync("codesign", ["--force", "--deep", "--sign", "-", path.join(outputPath, appBundle.name)], {
      stdio: "inherit"
    });
  }
}

module.exports = {
  outDir: "release",
  hooks: {
    postPackage: adHocSignPackagedApps
  },
  packagerConfig: {
    asar: true,
    osxSign: {},
    appBundleId: "com.josh.app",
    appCategoryType: "public.app-category.developer-tools",
    executableName: "JOSH",
    icon: appIconPath,
    ignore: [
      /^\/\.git($|\/)/,
      /^\/release($|\/)/,
      /^\/test-results($|\/)/,
      /^\/tests($|\/)/,
      /^\/docs($|\/)/,
      /^\/josh-ui\.png$/,
      /^\/README(\.zh-CN)?\.md$/,
      /^\/playwright\.config\.js$/
    ]
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"]
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        format: "ULFO",
        icon: dmgIconPath
      }
    }
  ],
  publishers: repository
    ? [
        {
          name: "@electron-forge/publisher-github",
          platforms: ["darwin"],
          config: {
            repository,
            draft: true,
            generateReleaseNotes: true
          }
        }
      ]
    : []
};
