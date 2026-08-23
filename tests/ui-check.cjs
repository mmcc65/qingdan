const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const repositoryRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repositoryRoot, "apps", "web");
const output = process.argv[2] || path.join(repositoryRoot, ".artifacts", "screenshots");
fs.mkdirSync(output, { recursive: true });
const port = 4174;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const target = path.join(webRoot, requestPath === "/" ? "index.html" : requestPath);
  if (!target.startsWith(webRoot) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "content-type": types[path.extname(target)] || "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
  const configuredBrowser = process.env.QINGDAN_BROWSER_PATH;
  const localEdge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const executablePath = configuredBrowser || (fs.existsSync(localEdge) ? localEdge : undefined);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
    const errors = [];
    desktop.on("pageerror", error => errors.push(error.message));
    await desktop.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await desktop.screenshot({ path: path.join(output, "qingdan-desktop.png"), fullPage: true });
    await desktop.click("button[data-view=repeat]");
    await desktop.click("button[data-view=projects]");
    const rootProject = desktop.locator("#projects-list > .project-card").first();
    await rootProject.locator(":scope > .project-body > .project-add-actions > .add-subproject").click();
    await desktop.fill("#project-name", "自动化子项目");
    await desktop.click("#project-form button[type=submit]");
    const childProject = rootProject.locator(".subproject-card", { hasText: "自动化子项目" });
    await childProject.waitFor();
    await childProject.locator(":scope > .project-body > .project-add-actions > .add-project-task").click();
    await desktop.fill("#task-name", "子项目自动化任务");
    await desktop.click("#task-form button[type=submit]");
    await childProject.getByText("子项目自动化任务").waitFor();
    const nestedState = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")));
    const savedChild = nestedState.projects.flatMap(project => project.projects || []).find(project => project.name === "自动化子项目");
    if (!savedChild || savedChild.tasks[0]?.name !== "子项目自动化任务") throw new Error(`Nested project task was not persisted: ${JSON.stringify(savedChild)}`);
    await desktop.screenshot({ path: path.join(output, "qingdan-subprojects.png"), fullPage: true });
    await desktop.click("button[data-view=todo]");
    await desktop.click("#settings-button");
    await desktop.fill("#cloud-url", "not-a-project-url");
    await desktop.fill("#cloud-key", "not-a-publishable-key");
    await desktop.click("#save-cloud-config");
    await desktop.locator("#cloud-status").getByText("Project URL 格式不正确").waitFor();
    await desktop.click("#settings-dialog .close-button");
    await desktop.click("button[data-kind=todo]");
    await desktop.click("#task-form .dialog-actions .secondary-button");
    if (await desktop.locator("#task-dialog").evaluate(dialog => dialog.open)) throw new Error("Blank task dialog did not close through cancel");
    await desktop.click("button[data-kind=todo]");
    await desktop.click("#task-form .close-button");
    if (await desktop.locator("#task-dialog").evaluate(dialog => dialog.open)) throw new Error("Blank task dialog did not close through close button");
    await desktop.click("button[data-kind=todo]");
    await desktop.fill("#task-name", "自动化测试任务");
    await desktop.fill("#task-node", "2026-08-14T18:00");
    await desktop.selectOption("#task-reminder", "interval");
    const automaticTimes = await desktop.evaluate(() => ({ start: document.querySelector("#reminder-start").value, end: document.querySelector("#reminder-end").value }));
    if (!automaticTimes.start || automaticTimes.end !== "2026-08-14T18:00") throw new Error(`Reminder defaults were not filled: ${JSON.stringify(automaticTimes)}`);
    await desktop.fill("#reminder-end", "2026-08-14T17:00");
    await desktop.fill("#task-node", "2026-08-14T19:00");
    const manualEnd = await desktop.locator("#reminder-end").inputValue();
    if (manualEnd !== "2026-08-14T17:00") throw new Error(`Manual reminder end was overwritten: ${manualEnd}`);
    await desktop.fill("#reminder-interval", "45");
    await desktop.click("#task-form button[type=submit]");
    const testCard = desktop.locator("#todo-columns .task-card", { hasText: "自动化测试任务" });
    await testCard.waitFor();
    await desktop.waitForFunction(() => JSON.parse(localStorage.getItem("qingdan.state.v1") || "null")?.tasks?.some(task => task.name === "自动化测试任务"));
    const savedReminder = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")).tasks.find(task => task.name === "自动化测试任务").reminder);
    if (savedReminder.mode !== "interval" || savedReminder.interval !== 45 || savedReminder.unit !== "minute") throw new Error(`Flexible reminder was not persisted: ${JSON.stringify(savedReminder)}`);
    await testCard.locator("[data-action=complete]").click();
    await desktop.click(".module-filter[data-module=todo] button[data-status=completed]");
    const archivedTask = desktop.locator(".archive-card", { hasText: "自动化测试任务" });
    await archivedTask.waitFor();
    const decoration = await archivedTask.locator(".archive-name").evaluate(element => getComputedStyle(element).textDecorationLine);
    if (!decoration.includes("line-through")) throw new Error(`Completed task is not struck through: ${decoration}`);
    await archivedTask.locator("[data-archive-action=restore]").click();
    await desktop.click(".module-filter[data-module=todo] button[data-status=active]");
    await desktop.getByText("自动化测试任务").waitFor();
    if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await mobile.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    const floatingAdd = mobile.locator("#floating-add");
    if (await floatingAdd.getAttribute("aria-label") !== "添加待办") throw new Error("Mobile add button did not start in todo mode");
    await mobile.click("button[data-view=repeat]");
    if (await floatingAdd.getAttribute("aria-label") !== "添加重复任务") throw new Error("Mobile add button did not switch to repeat mode");
    await floatingAdd.click();
    if (await mobile.locator("#task-dialog").evaluate(dialog => !dialog.open || !dialog.classList.contains("is-repeat"))) throw new Error("Mobile repeat add button did not open a repeat task dialog");
    await mobile.locator("#task-dialog .close-button").click();
    await mobile.click("button[data-view=projects]");
    if (await floatingAdd.getAttribute("aria-label") !== "新建项目") throw new Error("Mobile add button did not switch to project mode");
    await floatingAdd.click();
    if (await mobile.locator("#project-dialog").evaluate(dialog => !dialog.open)) throw new Error("Mobile project add button did not open project dialog");
    await mobile.locator("#project-dialog .close-button").click();
    await mobile.screenshot({ path: path.join(output, "qingdan-mobile.png"), fullPage: true });

    const compact = await browser.newPage({ viewport: { width: 639, height: 700 }, deviceScaleFactor: 1 });
    await compact.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await compact.click(".floating-add");
    const overflow = await compact.locator("#task-dialog").evaluate(dialog => ({
      clientWidth: dialog.clientWidth,
      scrollWidth: dialog.scrollWidth,
      offenders: [...dialog.querySelectorAll("*")].map(element => ({
        tag: element.tagName,
        id: element.id,
        className: typeof element.className === "string" ? element.className : "",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        right: Math.round(element.getBoundingClientRect().right),
        dialogRight: Math.round(dialog.getBoundingClientRect().right)
      })).filter(item => item.scrollWidth > item.clientWidth + 1 || item.right > item.dialogRight + 1).slice(0, 10)
    }));
    if (overflow.scrollWidth > overflow.clientWidth) throw new Error(`Task dialog has horizontal overflow: ${JSON.stringify(overflow)}`);
    await compact.screenshot({ path: path.join(output, "qingdan-dialog-compact.png"), fullPage: true });
    console.log("UI check passed: nested projects/tasks, navigation, history/restore, blank cancel/close, automatic and flexible reminder, no horizontal overflow, desktop and mobile rendering.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
