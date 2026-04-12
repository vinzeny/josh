const path = require("path");

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

module.exports = {
  outDir: "release",
  packagerConfig: {
    asar: true,
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
