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
    const tabOrder = await desktop.locator(".tabs .tab").evaluateAll(tabs => tabs.map(tab => tab.dataset.view));
    if (JSON.stringify(tabOrder) !== JSON.stringify(["todo", "repeat", "projects", "schedule", "memo"])) throw new Error(`Unexpected tab order: ${JSON.stringify(tabOrder)}`);
    await desktop.screenshot({ path: path.join(output, "qingdan-desktop.png"), fullPage: true });
    await desktop.click("button[data-view=repeat]");
    await desktop.click("button[data-view=schedule]");
    const { today, tomorrow } = await desktop.evaluate(() => {
      const date = new Date();
      const pad = value => String(value).padStart(2, "0");
      const key = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return { today: key(date), tomorrow: key(next) };
    });
    if (!await desktop.locator(".module-filter[data-module=schedule] button[data-status=overview]").evaluate(button => button.classList.contains("active"))) throw new Error("Schedule overview was not the default view");
    await desktop.click(".module-filter[data-module=schedule] button[data-status=active]");
    await desktop.fill("#schedule-date", today);
    await desktop.click("button[data-kind=schedule]");
    await desktop.fill("#task-name", "自动化日程");
    await desktop.fill("#task-node", `${today}T23:30`);
    await desktop.selectOption("#task-reminder", "single");
    await desktop.click("#task-form button[type=submit]");
    const scheduleCard = desktop.locator("#schedule-list .task-card").filter({ has: desktop.getByText("自动化日程", { exact: true }) });
    await scheduleCard.waitFor();
    const savedSchedule = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")).schedules.find(item => item.name === "自动化日程"));
    if (!savedSchedule || savedSchedule.node !== `${today}T23:30` || savedSchedule.reminder.mode !== "single") throw new Error(`Schedule was not persisted: ${JSON.stringify(savedSchedule)}`);
    if (await desktop.locator("#schedule-count").textContent() !== "1") throw new Error("Schedule tab did not count today's active itinerary");
    await desktop.click("[data-schedule-day=next]");
    await desktop.click("button[data-kind=schedule]");
    await desktop.fill("#task-name", "未来自动化日程");
    await desktop.fill("#task-node", `${tomorrow}T10:00`);
    await desktop.click("#task-form button[type=submit]");
    await desktop.click(".module-filter[data-module=schedule] button[data-status=overview]");
    if (await desktop.locator("#schedule-overview-count").textContent() !== "2") throw new Error("Schedule overview did not count today and future itineraries");
    if (await desktop.locator("#schedule-list .schedule-day-group").count() !== 2) throw new Error("Schedule overview did not group itineraries by date");
    await desktop.locator("#schedule-list .task-card", { hasText: "未来自动化日程" }).waitFor();
    await desktop.evaluate(() => scrollTo(0, 0));
    await desktop.waitForTimeout(150);
    await desktop.screenshot({ path: path.join(output, "qingdan-schedule.png") });
    await scheduleCard.locator("[data-action=complete]").click();
    if (await desktop.locator("#schedule-overview-count").textContent() !== "1" || await desktop.locator("#schedule-count").textContent() !== "0") throw new Error("Schedule overview or today badge did not update after completion");
    await desktop.click(".module-filter[data-module=schedule] button[data-status=active]");
    await desktop.click("[data-schedule-day=today]");
    await desktop.click(".module-filter[data-module=schedule] button[data-status=completed]");
    await desktop.locator("#schedule-archive .archive-card", { hasText: "自动化日程" }).waitFor();
    await desktop.click("[data-schedule-day=next]");
    if (await desktop.locator("#schedule-completed-count").textContent() !== "0" || await desktop.locator("#schedule-archive .archive-card").count() !== 0) throw new Error("Schedule archive was not filtered to the selected date");
    await desktop.click("[data-schedule-day=today]");
    await desktop.locator("#schedule-archive .archive-card", { hasText: "自动化日程" }).waitFor();
    await desktop.click("button[data-view=projects]");
    const rootProject = desktop.locator("#projects-list > .project-card").first();
    await rootProject.locator(":scope > .project-body > .project-add-actions > .add-subproject").click();
    await desktop.fill("#project-name", "自动化子项目");
    await desktop.click("#project-form button[type=submit]");
    if (await desktop.locator("#project-count").textContent() !== "1") throw new Error("Project count included a nested subproject");
    const childProject = rootProject.locator(".subproject-card", { hasText: "自动化子项目" });
    await childProject.waitFor();
    await childProject.locator(":scope > .project-body > .project-add-actions > .add-project-task").click();
    await desktop.fill("#task-name", "子项目自动化任务");
    await desktop.click("#task-form button[type=submit]");
    await childProject.getByText("子项目自动化任务").waitFor();
    await childProject.locator(".task-card", { hasText: "子项目自动化任务" }).locator("[data-action=complete]").click();
    const completedToggle = childProject.locator("[data-action=toggle-completed-tasks]");
    await completedToggle.waitFor();
    if (await childProject.locator(".completed-project-tasks").isVisible()) throw new Error("Completed project tasks should be hidden by default");
    await completedToggle.click();
    const completedChildTask = childProject.locator(".completed-project-task", { hasText: "子项目自动化任务" });
    await completedChildTask.waitFor();
    const completedDecoration = await completedChildTask.locator(".task-name").evaluate(element => getComputedStyle(element).textDecorationLine);
    if (!completedDecoration.includes("line-through")) throw new Error("Completed project task is not struck through");
    await completedToggle.click();
    const nestedState = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")));
    const savedChild = nestedState.projects.flatMap(project => project.projects || []).find(project => project.name === "自动化子项目");
    if (!savedChild || savedChild.tasks[0]?.name !== "子项目自动化任务") throw new Error(`Nested project task was not persisted: ${JSON.stringify(savedChild)}`);
    await rootProject.locator(":scope > header .project-open").click();
    await desktop.locator(".project-detail").waitFor();
    if (await desktop.locator(".project-detail").getByText("子项目自动化任务").count() !== 1) throw new Error("Project detail did not show nested project content");
    await desktop.locator(".project-detail [data-action=back-to-projects]").click();
    await rootProject.locator(":scope > header [data-action=complete-project]").click();
    if (await desktop.locator("#project-active-count").textContent() !== "0") throw new Error("Active project count included a completed project");
    if (await desktop.locator("#project-completed-count").textContent() !== "1") throw new Error("Completed project count did not include the completed root project");
    const postCompletionState = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")));
    if (postCompletionState.projects[0].status !== "completed" || postCompletionState.projects[0].projects[0].tasks[0].status !== "completed") throw new Error("Completing a project changed child task states");
    await desktop.locator(".module-filter[data-module=projects] button[data-status=completed]").click();
    const completedProject = desktop.locator(".project-archive-card", { hasText: "示例项目" });
    await completedProject.waitFor();
    await completedProject.locator("[data-action=open-project]").click();
    await desktop.locator(".project-detail [data-action=toggle-completed-tasks]").click();
    await desktop.locator(".project-detail").getByText("子项目自动化任务").waitFor();
    await desktop.locator(".project-detail [data-action=back-to-projects]").click();
    await completedProject.locator("[data-action=restore-project]").click();
    await desktop.evaluate(() => scrollTo(0, 0));
    await desktop.waitForTimeout(250);
    await desktop.screenshot({ path: path.join(output, "qingdan-subprojects.png") });
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
    await desktop.click("#add-reminder-slot");
    if (await desktop.locator("#reminder-slots .reminder-slot").count() !== 2) throw new Error("Reminder slot add button did not create a second time slot");
    await desktop.fill("#reminder-start-1", "2026-08-14T20:00");
    await desktop.fill("#reminder-end-1", "2026-08-14T22:00");
    await desktop.fill("#reminder-interval-1", "60");
    await desktop.click("#task-form button[type=submit]");
    const testCard = desktop.locator("#todo-columns .task-card", { hasText: "自动化测试任务" });
    await testCard.waitFor();
    await desktop.waitForFunction(() => JSON.parse(localStorage.getItem("qingdan.state.v1") || "null")?.tasks?.some(task => task.name === "自动化测试任务"));
    const savedReminder = await desktop.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")).tasks.find(task => task.name === "自动化测试任务").reminder);
    if (savedReminder.mode !== "interval" || savedReminder.interval !== 45 || savedReminder.unit !== "minute" || savedReminder.slots?.length !== 2 || savedReminder.slots[1]?.interval !== 60) throw new Error(`Flexible reminder was not persisted: ${JSON.stringify(savedReminder)}`);
    await testCard.locator("[data-action=complete]").click();
    await desktop.click(".module-filter[data-module=todo] button[data-status=completed]");
    const archivedTask = desktop.locator(".archive-card", { hasText: "自动化测试任务" });
    await archivedTask.waitFor();
    if (await desktop.locator("#todo-columns .priority-column").nth(1).locator(".archive-card", { hasText: "自动化测试任务" }).count() !== 1) throw new Error("Completed todo was not placed in its priority column");
    const decoration = await archivedTask.locator(".archive-name").evaluate(element => getComputedStyle(element).textDecorationLine);
    if (!decoration.includes("line-through")) throw new Error(`Completed task is not struck through: ${decoration}`);
    await archivedTask.locator("[data-archive-action=restore]").click();
    await desktop.click(".module-filter[data-module=todo] button[data-status=active]");
    await desktop.getByText("自动化测试任务").waitFor();
    await desktop.click("button[data-kind=todo]");
    await desktop.fill("#task-name", "排序任务 A");
    await desktop.click("#task-form button[type=submit]");
    await desktop.click("button[data-kind=todo]");
    await desktop.fill("#task-name", "排序任务 B");
    await desktop.click("#task-form button[type=submit]");
    const normalColumn = desktop.locator("#todo-columns .priority-column").nth(1);
    const taskB = normalColumn.locator(".task-card", { hasText: "排序任务 B" });
    await taskB.locator("[data-action=menu]").click();
    await desktop.locator("#todo-view .page-heading").click();
    if (await taskB.evaluate(card => card.classList.contains("menu-open"))) throw new Error("Task menu did not close after clicking outside");
    await taskB.locator("[data-action=menu]").click();
    await taskB.locator("[data-action=move-up]").click();
    const orderedTaskNames = await normalColumn.locator(".task-card .task-name").allTextContents();
    if (orderedTaskNames.indexOf("排序任务 B") !== orderedTaskNames.indexOf("排序任务 A") - 1) throw new Error(`Manual task order was not applied: ${JSON.stringify(orderedTaskNames)}`);
    const taskA = normalColumn.locator(".task-card", { hasText: "排序任务 A" });
    const taskABox = await taskA.boundingBox();
    const taskBBox = await taskB.boundingBox();
    await desktop.mouse.move(taskABox.x + taskABox.width / 2, taskABox.y + taskABox.height / 2);
    await desktop.mouse.down();
    await desktop.waitForTimeout(520);
    await desktop.mouse.move(taskBBox.x + taskBBox.width / 2, taskBBox.y + taskBBox.height / 2, { steps: 4 });
    await desktop.mouse.up();
    const dragOrderedTaskNames = await normalColumn.locator(".task-card .task-name").allTextContents();
    if (dragOrderedTaskNames.indexOf("排序任务 A") !== dragOrderedTaskNames.indexOf("排序任务 B") - 1) throw new Error(`Long-press task order was not applied: ${JSON.stringify(dragOrderedTaskNames)}`);

    await desktop.click("button[data-view=memo]");
    for (const memo of [
      { content: "置顶随笔 A", notes: "随笔备注 A", pinned: true },
      { content: "置顶随笔 B", notes: "", pinned: true },
      { content: "普通随笔 C", notes: "", pinned: false }
    ]) {
      await desktop.click("#memo-view .page-heading button[data-kind=memo]");
      await desktop.fill("#memo-content", memo.content);
      await desktop.fill("#memo-notes", memo.notes);
      if (memo.pinned) await desktop.check("#memo-pinned");
      await desktop.click("#memo-form button[type=submit]");
    }
    if (await desktop.locator("#memo-count").textContent() !== "3") throw new Error("Memo tab count was not updated");
    if (JSON.stringify(await desktop.locator(".memo-index").allTextContents()) !== JSON.stringify(["1.", "2.", "3."])) throw new Error("Memos were not numbered");
    await desktop.getByText("随笔备注 A", { exact: true }).waitFor();
    const memoB = desktop.locator(".memo-card", { hasText: "置顶随笔 B" });
    await memoB.locator("[data-memo-action=menu]").click();
    await memoB.locator("[data-memo-action=move-up]").click();
    const pinnedMemoOrder = await desktop.locator(".memo-content").allTextContents();
    if (pinnedMemoOrder[0] !== "置顶随笔 B" || pinnedMemoOrder[1] !== "置顶随笔 A") throw new Error(`Pinned memo order was not applied: ${JSON.stringify(pinnedMemoOrder)}`);
    const memoA = desktop.locator(".memo-card", { hasText: "置顶随笔 A" });
    const memoABox = await memoA.boundingBox();
    const memoBBox = await memoB.boundingBox();
    await desktop.mouse.move(memoABox.x + memoABox.width / 2, memoABox.y + memoABox.height / 2);
    await desktop.mouse.down();
    await desktop.waitForTimeout(520);
    await desktop.mouse.move(memoBBox.x + memoBBox.width / 2, memoBBox.y + memoBBox.height / 2, { steps: 4 });
    await desktop.mouse.up();
    const draggedMemoOrder = await desktop.locator(".memo-content").allTextContents();
    if (draggedMemoOrder[0] !== "置顶随笔 A" || draggedMemoOrder[1] !== "置顶随笔 B") throw new Error(`Long-press memo order was not applied: ${JSON.stringify(draggedMemoOrder)}`);
    await desktop.reload({ waitUntil: "networkidle" });
    await desktop.click("button[data-view=memo]");
    await desktop.waitForTimeout(350);
    await desktop.screenshot({ path: path.join(output, "qingdan-memo.png") });
    if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await mobile.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    const floatingAdd = mobile.locator("#floating-add");
    if (await floatingAdd.getAttribute("aria-label") !== "添加待办") throw new Error("Mobile add button did not start in todo mode");
    await mobile.click("button[data-view=repeat]");
    if (await floatingAdd.getAttribute("aria-label") !== "添加重复任务") throw new Error("Mobile add button did not switch to repeat mode");
    await floatingAdd.click();
    if (await mobile.locator("#task-dialog").evaluate(dialog => !dialog.open || !dialog.classList.contains("is-repeat"))) throw new Error("Mobile repeat add button did not open a repeat task dialog");
    await mobile.fill("#task-name", "多时间重复任务");
    await mobile.locator("#repeat-schedules [data-repeat-field=time]").fill("09:00");
    await mobile.click("#add-repeat-schedule");
    if (await mobile.locator("#repeat-schedules .repeat-schedule").count() !== 2) throw new Error("Repeat task did not add a second schedule");
    await mobile.locator("#repeat-schedules .repeat-schedule").nth(1).locator("[data-repeat-field=rule]").selectOption("每周");
    await mobile.locator("#repeat-schedules .repeat-schedule").nth(1).locator("[data-repeat-field=time]").fill("18:00");
    await mobile.click("#task-form button[type=submit]");
    const repeatState = await mobile.evaluate(() => JSON.parse(localStorage.getItem("qingdan.state.v1")).tasks.find(task => task.name === "多时间重复任务"));
    if (!repeatState || JSON.stringify(repeatState.repeatSchedules) !== JSON.stringify([{ rule: "每周", time: "09:00" }, { rule: "每周", time: "18:00" }])) throw new Error(`Multiple repeat schedules were not persisted: ${JSON.stringify(repeatState)}`);
    await mobile.getByText("多时间重复任务").waitFor();
    await mobile.click("button[data-view=schedule]");
    if (await floatingAdd.getAttribute("aria-label") !== "添加日程") throw new Error("Mobile add button did not switch to schedule mode");
    await floatingAdd.click();
    if (await mobile.locator("#task-dialog").evaluate(dialog => !dialog.open || !dialog.classList.contains("is-schedule"))) throw new Error("Mobile schedule add button did not open a schedule dialog");
    await mobile.locator("#task-dialog .close-button").click();
    await mobile.click("button[data-view=memo]");
    if (await floatingAdd.getAttribute("aria-label") !== "添加随笔") throw new Error("Mobile add button did not switch to memo mode");
    await floatingAdd.click();
    if (await mobile.locator("#memo-dialog").evaluate(dialog => !dialog.open)) throw new Error("Mobile memo add button did not open memo dialog");
    await mobile.fill("#memo-content", "路上想到：周末整理书架");
    await mobile.fill("#memo-notes", "先把不再看的书整理出来");
    await mobile.check("#memo-pinned");
    await mobile.click("#memo-form button[type=submit]");
    await mobile.locator(".memo-card", { hasText: "路上想到：周末整理书架" }).waitFor();
    await mobile.waitForTimeout(350);
    await mobile.screenshot({ path: path.join(output, "qingdan-mobile-memo.png"), fullPage: true });
    await mobile.click("button[data-view=projects]");
    if (await floatingAdd.getAttribute("aria-label") !== "新建项目") throw new Error("Mobile add button did not switch to project mode");
    await floatingAdd.click();
    if (await mobile.locator("#project-dialog").evaluate(dialog => !dialog.open)) throw new Error("Mobile project add button did not open project dialog");
    await mobile.locator("#project-dialog .close-button").click();
    await mobile.waitForTimeout(350);
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
    console.log("UI check passed: memos with notes/pinning/numbering, menu and long-press ordering, schedule, priority-separated completion, nested projects/tasks, project completion/detail, hidden completed project tasks, navigation, history/restore, blank cancel/close, multiple reminder slots, automatic and flexible reminder, no horizontal overflow, desktop and mobile rendering.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
