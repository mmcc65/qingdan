// Maintainers can point these URLs at GitHub Release assets or another HTTPS host.
// Keep them empty in source-only forks that do not publish official binaries.
export const OFFICIAL_UPDATE_MANIFESTS = Object.freeze({
  desktop: "https://github.com/mmcc65/qingdan/releases/latest/download/desktop-latest.json",
  mobile: "https://github.com/mmcc65/qingdan/releases/latest/download/latest.json"
});

export function resolveUpdateManifest(platform, legacyCloudUrl = "", manifests = OFFICIAL_UPDATE_MANIFESTS) {
  const official = String(manifests[platform] || "").trim();
  if (official) return official;

  // Compatibility for installations created before the update channel was
  // separated from data sync. New public releases should configure an
  // OFFICIAL_UPDATE_MANIFESTS URL above.
  const base = String(legacyCloudUrl || "").trim().replace(/\/$/, "");
  if (!base) return "";
  const file = platform === "desktop" ? "desktop-latest.json" : "latest.json";
  return `${base}/storage/v1/object/public/qingdan-releases/${file}`;
}
