import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@supabase/supabase-js/dist/umd/supabase.js");
const destination = resolve(root, "vendor/supabase.js");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Vendored Supabase browser client to ${destination}`);
