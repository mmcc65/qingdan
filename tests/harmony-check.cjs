const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const formConfig = JSON.parse(read("apps/harmony/entry/src/main/resources/base/profile/form_config.json"));
const form = formConfig.forms[0];
assert.equal(form.isDynamic, true, "service card must be dynamic");
assert.ok(form.supportDimensions.includes("4*4"), "service card must support a tablet-friendly size");

const moduleConfig = JSON.parse(read("apps/harmony/entry/src/main/module.json5"));
assert.ok(moduleConfig.module.deviceTypes.includes("tablet"), "HarmonyOS entry must support tablets");
assert.ok(moduleConfig.module.extensionAbilities.some(item => item.type === "form"), "FormExtensionAbility must be registered");

const card = read("apps/harmony/entry/src/main/ets/widget/pages/QingdanCard.ets");
assert.match(card, /List\(\{ space:/, "service card content must use a vertically scrollable list");
assert.match(card, /\.scrollBar\(BarState\.Auto\)/, "service card list must expose scroll state");
assert.match(card, /postCardAction\(this,\s*\{\s*action: 'message'/s, "service card must support item actions");

const nativeState = read("apps/harmony/entry/src/main/ets/common/NativeState.ets");
for (const label of ["待办", "重复", "项目", "日程", "随笔"]) {
  assert.ok(nativeState.includes(`label: '${label}'`), `missing card page: ${label}`);
}
assert.match(nativeState, /const memoItems = ordered\(memos, false\)/, "memos must retain pin/order sorting");

const bundledWeb = read("apps/harmony/entry/src/main/resources/rawfile/web/src/app.js");
assert.match(bundledWeb, /__qingdan_harmony_port__/, "bundled web app must include the HarmonyOS data bridge");
assert.match(bundledWeb, /type: "ready"/, "HarmonyOS bridge must request native state before writing state");

for (const icon of [
  "apps/harmony/AppScope/resources/base/media/app_icon.png",
  "apps/harmony/entry/src/main/resources/base/media/app_icon.png"
]) {
  assert.ok(fs.statSync(path.join(root, icon)).size > 10_000, `missing usable icon: ${icon}`);
}

console.log("HarmonyOS project checks passed.");
