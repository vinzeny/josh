import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

import joshLogo from "./josh-logo.png";

const LOCALE_STORAGE_KEY = "swtch-locale";

const COPY = {
  zh: {
    navLabel: "agent model json switch",
    latestRelease: "最新版本",
    latestReady: "已连接最新 Release。",
    latestPending: "发布后这里会自动读取最新版本。",
    eyebrow: "JOSH",
    headline: "切换 Claude Code 模型预设，不动其余 settings.json。",
    body: "保存常用 env 方案，一键切换，随时回到 Official。",
    downloadMac: "下载 macOS App",
    downloadDmg: "下载 DMG",
    downloadZip: "下载 ZIP",
    openReleases: "查看 Releases",
    appleSilicon: "Apple 芯片",
    intelMac: "Intel 芯片",
    currentModel: "当前模型",
    screenshotLabel: "桌面切换器",
    previewAction: "启动",
    previewCurrent: "当前",
    featureOneTitle: "只改 env",
    featureOneBody: "保留 settings.json 里的其他配置，只替换 env 对象。",
    featureTwoTitle: "回到 Official",
    featureTwoBody: "内置 Official 预设，随时切回干净默认配置。",
    featureThreeTitle: "中英文界面",
    featureThreeBody: "同一套预设，桌面工具和官网入口都能快速理解。",
    ctaTitle: "下载后即可本地切换模型预设。",
    ctaBody: "官网直接区分 Apple 芯片和 Intel，两套安装包分别下载。",
    languageZh: "中文",
    languageEn: "English",
    versionFallback: "Latest"
  },
  en: {
    navLabel: "agent model json switch",
    latestRelease: "Latest release",
    latestReady: "Connected to the newest GitHub release.",
    latestPending: "The newest release will appear here after publishing.",
    eyebrow: "JOSH",
    headline: "Switch Claude Code model presets without touching the rest of settings.json.",
    body: "Save reusable env setups, switch in one click, and jump back to Official any time.",
    downloadMac: "Download macOS App",
    downloadDmg: "Download DMG",
    downloadZip: "Download ZIP",
    openReleases: "Open Releases",
    appleSilicon: "Apple Silicon",
    intelMac: "Intel Mac",
    currentModel: "Current Model",
    screenshotLabel: "Desktop switcher",
    previewAction: "Launch",
    previewCurrent: "Current",
    featureOneTitle: "Only env changes",
    featureOneBody: "Everything outside env stays in place, including the rest of settings.json.",
    featureTwoTitle: "Official stays ready",
    featureTwoBody: "A built-in Official preset keeps the empty fallback one click away.",
    featureThreeTitle: "Bilingual flow",
    featureThreeBody: "The same presets stay easy to use in both English and Chinese.",
    ctaTitle: "Download once and switch model presets locally.",
    ctaBody: "Download pages now split Apple Silicon and Intel builds so the right installer is obvious.",
    languageZh: "中文",
    languageEn: "English",
    versionFallback: "Latest"
  }
};

function getInitialLocale() {
  if (typeof window === "undefined") {
    return "zh";
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh";
}

function readMetaValue(name) {
  if (typeof document === "undefined") {
    return "";
  }

  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function resolveRepoFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const ownerFromMeta = readMetaValue("josh-github-owner");
  const repoFromMeta = readMetaValue("josh-github-repo");

  if (ownerFromMeta && repoFromMeta) {
    return { owner: ownerFromMeta, repo: repoFromMeta };
  }

  const hostname = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (hostname.endsWith(".github.io") && pathParts.length > 0) {
    return {
      owner: hostname.replace(".github.io", ""),
      repo: pathParts[0]
    };
  }

  return null;
}

function releaseStateFromRepo(repo) {
  const releaseUrl = repo ? `https://github.com/${repo.owner}/${repo.repo}/releases/latest` : "";

  return {
    repo,
    releaseUrl,
    arm64DmgUrl: "",
    x64DmgUrl: "",
    arm64ZipUrl: "",
    x64ZipUrl: "",
    version: "",
    connected: false
  };
}

function findAssetUrl(assets, arch, extension) {
  return (
    assets.find((asset) => {
      const name = asset.name.toLowerCase();
      return name.includes(arch) && name.endsWith(extension);
    })?.browser_download_url || ""
  );
}

function DownloadButton({ href, icon: Icon, label, variant = "default" }) {
  if (!href) {
    return (
      <Button className="h-10 px-4 text-sm" disabled size="lg" type="button" variant={variant}>
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button asChild className="h-10 px-4 text-sm" size="lg" variant={variant}>
      <a href={href} rel="noreferrer" target="_blank">
        <Icon className="size-4" />
        {label}
      </a>
    </Button>
  );
}

function DownloadGroup({ copy, dmgUrl, title, zipUrl }) {
  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-semibold tracking-tight text-slate-950">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <DownloadButton href={dmgUrl} icon={Download} label={copy.downloadDmg} />
        <DownloadButton href={zipUrl} icon={Download} label={copy.downloadZip} variant="outline" />
      </div>
    </div>
  );
}

const DEMO_PRESETS = [
  { name: "Official", tag: "Built-in", active: false },
  { name: "Demo Team", tag: "Active", active: true },
  { name: "Research", tag: "", active: false },
  { name: "Local Sandbox", tag: "", active: false }
];

function ProductPreview({ copy, versionLabel }) {
  return (
    <div className="mt-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-[0_30px_100px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.32em] text-white/55">
        <span>{copy.screenshotLabel}</span>
        <span>{versionLabel}</span>
      </div>

      <div className="space-y-6 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/45">
              JOSH
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white/96">4 Presets</p>
            <p className="mt-2 text-base text-white/58">Configuration loaded.</p>
          </div>

          <div className="min-w-[250px] rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
              {copy.currentModel}
            </p>
            <div className="mt-3 flex items-center justify-end gap-3">
              <span className="text-xl font-semibold tracking-tight text-white/82">demo-model</span>
              <span className="rounded-full bg-emerald-500/16 px-3 py-1 text-sm font-medium text-emerald-300">
                Demo Team
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className={`flex items-center justify-between rounded-xl border px-4 py-4 ${
                preset.active
                  ? "border-emerald-400/40 bg-emerald-400/[0.08]"
                  : "border-white/8 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tracking-tight text-white/92">
                  {preset.name}
                </span>
                {preset.tag ? (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      preset.active
                        ? "bg-emerald-400/18 text-emerald-300"
                        : "bg-white/7 text-white/62"
                    }`}
                  >
                    {preset.tag}
                  </span>
                ) : null}
              </div>

              <span
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  preset.active
                    ? "bg-emerald-400/18 text-emerald-300"
                    : "bg-white/7 text-white/70"
                }`}
              >
                {preset.active ? copy.previewCurrent : copy.previewAction}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MarketingSite() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [release, setRelease] = useState(() => releaseStateFromRepo(resolveRepoFromLocation()));
  const copy = COPY[locale];

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    const repo = resolveRepoFromLocation();
    const initial = releaseStateFromRepo(repo);
    setRelease(initial);

    if (!repo) {
      return;
    }

    let cancelled = false;

    async function loadLatestRelease() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`
        );
        if (!response.ok) {
          throw new Error("latest release unavailable");
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        setRelease({
          repo,
          releaseUrl: data.html_url || initial.releaseUrl,
          arm64DmgUrl: findAssetUrl(data.assets || [], "arm64", ".dmg"),
          x64DmgUrl: findAssetUrl(data.assets || [], "x64", ".dmg"),
          arm64ZipUrl: findAssetUrl(data.assets || [], "arm64", ".zip"),
          x64ZipUrl: findAssetUrl(data.assets || [], "x64", ".zip"),
          version: data.tag_name || "",
          connected: true
        });
      } catch (error) {
        if (!cancelled) {
          setRelease(initial);
        }
      }
    }

    loadLatestRelease();

    return () => {
      cancelled = true;
    };
  }, []);

  const versionLabel = useMemo(() => {
    return release.version || copy.versionFallback;
  }, [copy.versionFallback, release.version]);

  const releaseHint = release.connected ? copy.latestReady : copy.latestPending;

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-12 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-[0.32em] text-slate-900">JOSH</p>
            <p className="mt-1 text-sm text-slate-500">{copy.navLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setLocale("zh")}
              size="sm"
              type="button"
              variant={locale === "zh" ? "default" : "outline"}
            >
              {copy.languageZh}
            </Button>
            <Button
              onClick={() => setLocale("en")}
              size="sm"
              type="button"
              variant={locale === "en" ? "default" : "outline"}
            >
              {copy.languageEn}
            </Button>
          </div>
        </header>

        <main className="flex-1">
          <section className="border-b border-slate-200/80 py-12 sm:py-16">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto flex h-[9.5rem] w-[min(18rem,72vw)] items-center justify-center overflow-hidden sm:h-[11rem]">
                <img
                  alt="JOSH logo"
                  className="h-full w-full scale-[1.55] object-contain"
                  src={joshLogo}
                />
              </div>

              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.4em] text-sky-700/80">
                {copy.eyebrow}
              </p>
              <h1 className="mx-auto mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
                {copy.headline}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
                {copy.body}
              </p>

              <div className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                <DownloadGroup
                  copy={copy}
                  dmgUrl={release.arm64DmgUrl || release.releaseUrl}
                  title={copy.appleSilicon}
                  zipUrl={release.arm64ZipUrl || release.releaseUrl}
                />
                <DownloadGroup
                  copy={copy}
                  dmgUrl={release.x64DmgUrl || release.releaseUrl}
                  title={copy.intelMac}
                  zipUrl={release.x64ZipUrl || release.releaseUrl}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <DownloadButton
                  href={release.releaseUrl}
                  icon={ExternalLink}
                  label={copy.openReleases}
                  variant="outline"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-500">
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
                  {copy.latestRelease} {versionLabel}
                </span>
                <span>{releaseHint}</span>
              </div>
            </div>

            <ProductPreview copy={copy} versionLabel={versionLabel} />
          </section>

          <section className="grid gap-8 border-b border-slate-200/80 py-10 md:grid-cols-3">
            <article>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                {copy.featureOneTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{copy.featureOneBody}</p>
            </article>
            <article>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                {copy.featureTwoTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{copy.featureTwoBody}</p>
            </article>
            <article>
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                {copy.featureThreeTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{copy.featureThreeBody}</p>
            </article>
          </section>

          <section className="py-10">
            <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:px-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {copy.ctaTitle}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{copy.ctaBody}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <DownloadButton
                  href={release.arm64DmgUrl || release.releaseUrl}
                  icon={Download}
                  label={`${copy.appleSilicon} DMG`}
                />
                <DownloadButton
                  href={release.x64DmgUrl || release.releaseUrl}
                  icon={Download}
                  label={`${copy.intelMac} DMG`}
                  variant="outline"
                />
                <DownloadButton
                  href={release.releaseUrl}
                  icon={ExternalLink}
                  label={copy.openReleases}
                  variant="outline"
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
