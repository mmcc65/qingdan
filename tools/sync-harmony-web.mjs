import { copyFile, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const web = resolve(root, "apps/web");
const rawWeb = resolve(root, "apps/harmony/entry/src/main/resources/rawfile/web");
const appMedia = resolve(root, "apps/harmony/AppScope/resources/base/media");
const entryMedia = resolve(root, "apps/harmony/entry/src/main/resources/base/media");

await mkdir(rawWeb, { recursive: true });
await mkdir(appMedia, { recursive: true });
await mkdir(entryMedia, { recursive: true });

for (const file of ["index.html", "styles.css", "sw.js", "manifest.webmanifest"]) {
  await copyFile(resolve(web, file), resolve(rawWeb, file));
}
await cp(resolve(web, "src"), resolve(rawWeb, "src"), { recursive: true, force: true });
await cp(resolve(web, "vendor"), resolve(rawWeb, "vendor"), { recursive: true, force: true });
await cp(resolve(web, "assets"), resolve(rawWeb, "assets"), { recursive: true, force: true });

const icon = resolve(web, "assets/qingdan-icon-512.png");
await copyFile(icon, resolve(appMedia, "app_icon.png"));
await copyFile(icon, resolve(entryMedia, "app_icon.png"));

console.log("HarmonyOS web resources and icons are synchronized.");
