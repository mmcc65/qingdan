// Try the directly reachable mobile channel first and keep GitHub as a fallback.
// Desktop packages remain on GitHub because the self-contained ZIP is larger
// than the current Supabase project's per-file limit.
export const OFFICIAL_UPDATE_MANIFESTS = Object.freeze({
  desktop: Object.freeze([
    "https://github.com/mmcc65/qingdan/releases/latest/download/desktop-latest.json"
  ]),
  mobile: Object.freeze([
    "https://isenfwmwaojwujfmmzoc.supabase.co/storage/v1/object/public/qingdan-releases/latest.json",
    "https://github.com/mmcc65/qingdan/releases/latest/download/latest.json"
  ])
});

export function resolveUpdateManifests(platform, legacyCloudUrl = "", manifests = OFFICIAL_UPDATE_MANIFESTS) {
  const configured = manifests[platform];
  const official = (Array.isArray(configured) ? configured : [configured])
    .map(value => String(value || "").trim())
    .filter(Boolean);
  const base = String(legacyCloudUrl || "").trim().replace(/\/$/, "");
  if (base) {
    const file = platform === "desktop" ? "desktop-latest.json" : "latest.json";
    official.push(`${base}/storage/v1/object/public/qingdan-releases/${file}`);
  }
  return [...new Set(official)];
}

export function resolveUpdateManifest(platform, legacyCloudUrl = "", manifests = OFFICIAL_UPDATE_MANIFESTS) {
  return resolveUpdateManifests(platform, legacyCloudUrl, manifests)[0] || "";
}
