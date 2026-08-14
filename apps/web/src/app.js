import { PRIORITIES, createId, createInitialState, normalizeState, sortTasks, postponeDate, formatNode, isOverdue, searchState, toInputDate, flattenProjects, findProject, collectProjectTasks } from "./core.mjs";
import { initializeCloud, getCloudConfig, saveCloudConfig, signUp, signIn, signOut, syncNow, scheduleCloudPush, isApplyingRemote } from "./cloud-sync.js";
import { resolveUpdateManifest } from "./release-config.js";

const STORAGE_KEY = "qingdan.state.v1";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let state = loadState();
let activeView = "todo";
let reminderTimeTouched = { start: false, end: false };
const moduleStatus = { todo: "active", repeat: "active", projects: "active" };

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return createInitialState(); }
}

function saveState(message = "已保存到本机") {
  if (!isApplyingRemote()) state.cloudUpdatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  $("#sync-status").textContent = message;
  render();
  syncDesktopState();
  scheduleCloudPush();
}

function replaceStateFromCloud(remoteState) {
  state = normalizeState(remoteState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  syncDesktopState();
  toast("已从云端更新");
}

function syncDesktopState() {
  if (window.chrome?.webview) window.chrome.webview.postMessage({ type: "state", state });
  if (window.QingdanAndroid?.onStateChanged) window.QingdanAndroid.onStateChanged(JSON.stringify(state));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  renderCounts();
  renderTodos();
  renderRepeats();
  renderProjects();
}

function renderCounts() {
  $("#todo-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "active").length;
  $("#repeat-count").textContent = state.tasks.filter(t => t.kind === "repeat" && t.status === "active").length;
  $("#project-count").textContent = flattenProjects(state.projects).length;
  $("#todo-active-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "active").length;
  $("#todo-completed-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "completed").length;
  $("#todo-cancelled-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "cancelled").length;
  $("#repeat-active-count").textContent = state.tasks.filter(t => t.kind === "repeat" && t.status === "active").length;
  $("#repeat-completed-count").textContent = state.history.filter(item => item.kind === "repeat" && item.status === "completed").length;
  $("#repeat-cancelled-count").textContent = state.history.filter(item => item.kind === "repeat" && item.status === "cancelled").length;
  const projectTasks = collectProjectTasks(state.projects).map(({ task }) => task);
  $("#project-active-count").textContent = projectTasks.filter(t => t.status === "active").length;
  $("#project-completed-count").textContent = projectTasks.filter(t => t.status === "completed").length;
  $("#project-cancelled-count").textContent = projectTasks.filter(t => t.status === "cancelled").length;
}

function archiveCard(item, options = {}) {
  const completed = item.status === "completed";
  const date = item.completedAt || item.cancelledAt || item.recordedAt;
  const time = date ? new Date(date).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  return `<article class="archive-card ${completed ? "completed" : "cancelled"}" data-id="${item.id}" data-context="${options.context || "root"}" data-project-id="${options.projectId || ""}" data-history="${options.history ? "true" : "false"}">
    <span class="archive-check">${completed ? "✓" : "×"}</span>
    <div class="archive-main"><span class="archive-name">${escapeHtml(item.name)}</span><span class="archive-meta">${escapeHtml(options.label || "")}${options.label && time ? " · " : ""}${time}</span></div>
    ${!options.history ? '<button class="text-button" data-archive-action="restore">恢复</button>' : ""}
    <button class="more-button" data-archive-action="delete" title="永久删除">•••</button>
  </article>`;
}

function archiveEmpty(status) {
  return `<div class="large-empty archive-empty"><span>${status === "completed" ? "✓" : "×"}</span><h3>${status === "completed" ? "还没有完成记录" : "还没有取消记录"}</h3><p>记录会保留在这里，不会和进行中的任务混在一起。</p></div>`;
}

function taskCard(task, context = "root", projectId = "") {
  const meta = [];
  if (task.node) meta.push(`<span class="${isOverdue(task.node) ? "overdue" : ""}">${isOverdue(task.node) ? "已过节点 · " : ""}${formatNode(task.node)}</span>`);
  const reminder = normalizeReminder(task.reminder);
  if (reminder.mode === "single") meta.push(`<span>单次提醒</span>`);
  if (reminder.mode === "interval") meta.push(`<span>每 ${reminder.interval || 30} ${reminder.unit === "hour" ? "小时" : reminder.unit === "day" ? "天" : "分钟"}提醒</span>`);
  if (task.rule) meta.push(`<span>${escapeHtml(task.rule)}</span>`);
  return `<article class="task-card ${task.pinned ? "pinned" : ""}" data-id="${task.id}" data-context="${context}" data-project-id="${projectId}">
    <button class="complete-button" data-action="complete" title="完成" aria-label="完成任务"></button>
    <button class="task-main" data-action="edit"><span class="task-name"><i class="dot ${task.priority}"></i>${escapeHtml(task.name)}</span>${meta.length ? `<span class="task-meta">${meta.join("")}</span>` : ""}</button>
    ${task.pinned ? '<span class="pin" title="已置顶">⌃</span>' : ""}
    <button class="more-button" data-action="menu" title="更多操作">•••</button>
    <div class="task-menu">
      <button data-action="postpone" data-preset="tomorrow">稍后：明天</button>
      <button data-action="postpone" data-preset="day-after">稍后：后天</button>
      <button data-action="postpone" data-preset="next-week">稍后：下周</button>
      <button data-action="cancel">取消任务</button>
      <button data-action="delete" class="danger">删除记录</button>
    </div>
  </article>`;
}

function normalizeReminder(reminder) {
  if (!reminder || reminder === "none") return { mode: "none" };
  if (typeof reminder === "object") return { mode: reminder.mode || "none", ...reminder };
  if (reminder === "single") return { mode: "single", at: "" };
  if (reminder === "30" || reminder === "60") return { mode: "interval", start: "", end: "", interval: Number(reminder), unit: "minute" };
  return { mode: "none" };
}

function updateReminderFields(mode) {
  $("#single-reminder-settings").classList.toggle("visible", mode === "single");
  $("#interval-reminder-settings").classList.toggle("visible", mode === "interval");
  if (mode === "interval") applyReminderDefaults();
}

function applyReminderDefaults() {
  const start = $("#reminder-start");
  const end = $("#reminder-end");
  const node = $("#task-node").value;
  if (!reminderTimeTouched.start && !start.value) start.value = toInputDate(new Date());
  if (!reminderTimeTouched.end && node) end.value = node;
}

function renderTodos() {
  const status = moduleStatus.todo;
  $("#todo-columns").classList.toggle("hidden", status !== "active");
  $("#todo-archive").classList.toggle("visible", status !== "active");
  const active = state.tasks.filter(t => t.kind === "todo" && t.status === "active");
  $("#todo-columns").innerHTML = PRIORITIES.map(priority => {
    const tasks = sortTasks(active.filter(t => t.priority === priority.id));
    return `<section class="priority-column">
      <header><div><i class="dot ${priority.id}"></i><strong>${priority.label}</strong><small>${priority.hint}</small></div><span>${tasks.length}</span></header>
      <div class="task-list">${tasks.length ? tasks.map(t => taskCard(t)).join("") : `<div class="empty-state"><span>✓</span><p>这里暂时没有任务</p><button class="text-button add-inline" data-priority="${priority.id}">添加一项</button></div>`}</div>
    </section>`;
  }).join("");
  const archived = state.tasks.filter(t => t.kind === "todo" && t.status === status).sort((a, b) => (b.completedAt || b.cancelledAt || 0) - (a.completedAt || a.cancelledAt || 0));
  $("#todo-archive").innerHTML = status === "active" ? "" : archived.length ? archived.map(task => archiveCard(task)).join("") : archiveEmpty(status);
}

function renderRepeats() {
  const status = moduleStatus.repeat;
  $("#repeat-list").classList.toggle("hidden", status !== "active");
  $("#repeat-archive").classList.toggle("visible", status !== "active");
  const tasks = sortTasks(state.tasks.filter(t => t.kind === "repeat" && t.status === "active"));
  $("#repeat-list").innerHTML = tasks.length ? `<div class="section-list">${tasks.map(t => taskCard(t)).join("")}</div>` : `<div class="large-empty"><span>↻</span><h3>还没有重复任务</h3><p>把每周、每天都要做的事情放在这里。</p><button class="primary-button add-button" data-kind="repeat">添加第一项</button></div>`;
  const history = state.history.filter(item => item.kind === "repeat" && item.status === status).sort((a, b) => b.recordedAt - a.recordedAt);
  $("#repeat-archive").innerHTML = status === "active" ? "" : history.length ? history.map(item => archiveCard(item, { history: true, label: item.rule || "重复任务" })).join("") : archiveEmpty(status);
}

function renderProjects() {
  const status = moduleStatus.projects;
  $("#projects-list").classList.toggle("hidden", status !== "active");
  $("#projects-archive").classList.toggle("visible", status !== "active");
  const sortedProjects = projects => [...projects].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.order ?? 0) - (b.order ?? 0));
  const projectTaskSummary = project => {
    const tasks = collectProjectTasks([project]).map(({ task }) => task);
    const total = tasks.filter(task => task.status !== "cancelled").length;
    return { total, complete: tasks.filter(task => task.status === "completed").length };
  };
  const projectCard = (project, depth = 0) => {
    const active = sortTasks(project.tasks.filter(task => task.status === "active"));
    const children = sortedProjects(project.projects || []);
    const { total, complete } = projectTaskSummary(project);
    const percent = total ? Math.round(complete / total * 100) : 0;
    const empty = !active.length && !children.length ? '<p class="project-empty">这个项目还没有待处理任务或子项目</p>' : "";
    return `<section class="project-card ${depth ? "subproject-card" : ""}" data-project-id="${project.id}">
      <header><button class="project-toggle" data-action="toggle-project"><span class="chevron">⌄</span><span><strong>${escapeHtml(project.name)}</strong><small>${complete} / ${total} 已完成${children.length ? ` · ${children.length} 个子项目` : ""}</small></span></button><button class="more-button" data-action="project-menu">•••</button></header>
      <div class="progress-track"><i style="width:${percent}%"></i></div>
      <div class="project-body">${active.map(task => taskCard(task, "project", project.id)).join("")}${empty}${children.length ? `<div class="subprojects">${children.map(child => projectCard(child, depth + 1)).join("")}</div>` : ""}<div class="project-add-actions"><button class="add-project-task" data-project-id="${project.id}">＋ 添加任务</button><button class="add-subproject" data-parent-project-id="${project.id}">◇ 添加子项目</button></div></div>
      <div class="project-menu"><button data-action="pin-project">${project.pinned ? "取消置顶" : "置顶项目"}</button><button data-action="rename-project">重命名</button><button class="danger" data-action="delete-project">删除项目</button></div>
    </section>`;
  };
  const projects = sortedProjects(state.projects);
  $("#projects-list").innerHTML = projects.length ? projects.map(project => projectCard(project)).join("") : `<div class="large-empty"><span>◇</span><h3>还没有项目</h3><p>把有明确先后顺序的一组事情放在项目中。</p></div>`;
  const archived = collectProjectTasks(state.projects).filter(({ task }) => task.status === status).sort((a, b) => (b.task.completedAt || b.task.cancelledAt || 0) - (a.task.completedAt || a.task.cancelledAt || 0));
  $("#projects-archive").innerHTML = status === "active" ? "" : archived.length ? archived.map(({ task, project }) => archiveCard(task, { context: "project", projectId: project.id, label: project.name })).join("") : archiveEmpty(status);
}

function openProjectDialog(parentId = "") {
  const parent = parentId ? findProject(state.projects, parentId)?.project : null;
  $("#project-form").reset();
  $("#project-parent-id").value = parent?.id || "";
  $("#project-dialog-kicker").textContent = parent ? parent.name : "项目";
  $("#project-dialog-title").textContent = parent ? "新建子项目" : "新建项目";
  $("#project-dialog").showModal();
  setTimeout(() => $("#project-name").focus(), 30);
}

function openTaskDialog(kind, task = null, projectId = "", priority = "normal") {
  const dialog = $("#task-dialog");
  $("#task-form").reset();
  $("#task-id").value = task?.id || "";
  $("#task-kind").value = kind;
  $("#task-project-id").value = projectId;
  $("#dialog-kicker").textContent = task ? "编辑" : "新任务";
  $("#dialog-title").textContent = kind === "repeat" ? "重复任务" : projectId ? "项目任务" : "添加待办";
  $("#task-name").value = task?.name || "";
  $("#task-node").value = task?.node || "";
  const reminder = normalizeReminder(task?.reminder);
  reminderTimeTouched = { start: Boolean(reminder.start), end: Boolean(reminder.end) };
  $("#task-reminder").value = reminder.mode;
  $("#reminder-at").value = reminder.at || "";
  $("#reminder-start").value = reminder.start || "";
  $("#reminder-end").value = reminder.end || "";
  $("#reminder-interval").value = reminder.interval || 30;
  $("#reminder-unit").value = reminder.unit || "minute";
  updateReminderFields(reminder.mode);
  $("#task-notes").value = task?.notes || "";
  $("#task-pinned").checked = Boolean(task?.pinned);
  $("#task-rule").value = task?.rule || "每周";
  dialog.classList.toggle("is-repeat", kind === "repeat");
  const selectedPriority = task?.priority || priority;
  $$("input[name=priority]").forEach(input => input.checked = input.value === selectedPriority);
  dialog.showModal();
  setTimeout(() => $("#task-name").focus(), 30);
}

function findTask(card) {
  const id = card.dataset.id;
  if (card.dataset.context === "project") {
    const project = findProject(state.projects, card.dataset.projectId)?.project;
    return { task: project?.tasks.find(t => t.id === id), project };
  }
  return { task: state.tasks.find(t => t.id === id), project: null };
}

function handleTaskAction(event) {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest(".task-card");
  if (!button || !card) return;
  const { task, project } = findTask(card);
  if (!task) return;
  const action = button.dataset.action;
  if (action === "menu") { card.classList.toggle("menu-open"); return; }
  if (action === "edit") { openTaskDialog(task.kind || "todo", task, project?.id || ""); return; }
  if (action === "complete") {
    task.status = "completed"; task.completedAt = Date.now();
    toast(task.kind === "repeat" ? "已完成本次，重复计划仍然保留" : "任务已完成");
    if (task.kind === "repeat") {
      state.history.push({ id: createId("history"), sourceId: task.id, kind: "repeat", name: task.name, rule: task.rule, status: "completed", recordedAt: Date.now() });
      task.status = "active"; task.lastCompletedAt = Date.now();
    }
  }
  if (action === "postpone") { task.node = postponeDate(button.dataset.preset); toast("已调整任务节点"); }
  if (action === "cancel") {
    if (task.kind === "repeat") state.history.push({ id: createId("history"), sourceId: task.id, kind: "repeat", name: task.name, rule: task.rule, status: "cancelled", recordedAt: Date.now() });
    else { task.status = "cancelled"; task.cancelledAt = Date.now(); }
    toast(task.kind === "repeat" ? "已跳过本次" : "任务已取消");
  }
  if (action === "delete" && confirm(`确定删除“${task.name}”吗？删除后不保留记录。`)) {
    const list = project ? project.tasks : state.tasks;
    list.splice(list.indexOf(task), 1); toast("记录已删除");
  }
  saveState();
}

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

$("#task-form").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#task-id").value;
  const kind = $("#task-kind").value;
  const projectId = $("#task-project-id").value;
  const container = projectId ? findProject(state.projects, projectId)?.project.tasks : state.tasks;
  if (!container) return;
  const existing = id ? container.find(t => t.id === id) : null;
  const task = existing || { id: createId(projectId ? "ptask" : "task"), kind, status: "active", order: container.length, createdAt: Date.now() };
  const reminderMode = $("#task-reminder").value;
  const reminder = reminderMode === "single"
    ? { mode: "single", at: $("#reminder-at").value }
    : reminderMode === "interval"
      ? { mode: "interval", start: $("#reminder-start").value, end: $("#reminder-end").value, interval: Math.max(1, Number($("#reminder-interval").value) || 30), unit: $("#reminder-unit").value }
      : { mode: "none" };
  Object.assign(task, { name: $("#task-name").value.trim(), priority: $("input[name=priority]:checked").value, node: $("#task-node").value, reminder, notes: $("#task-notes").value.trim(), pinned: $("#task-pinned").checked });
  if (kind === "repeat") task.rule = $("#task-rule").value;
  if (!existing) container.push(task);
  $("#task-dialog").close(); saveState(); toast(existing ? "修改已保存" : "任务已添加");
});

$("#project-form").addEventListener("submit", event => {
  event.preventDefault();
  const parentId = $("#project-parent-id").value;
  const parent = parentId ? findProject(state.projects, parentId)?.project : null;
  const container = parent ? parent.projects : state.projects;
  container.push({ id: createId("project"), name: $("#project-name").value.trim(), pinned: false, order: container.length, tasks: [], projects: [] });
  $("#project-dialog").close(); $("#project-form").reset(); saveState(); toast("项目已创建");
});

$("#task-reminder").addEventListener("change", event => updateReminderFields(event.target.value));
$("#reminder-start").addEventListener("input", () => { reminderTimeTouched.start = true; });
$("#reminder-end").addEventListener("input", () => { reminderTimeTouched.end = true; });
$("#task-node").addEventListener("input", event => {
  if ($("#task-reminder").value === "interval" && !reminderTimeTouched.end) {
    $("#reminder-end").value = event.target.value;
  }
});

document.addEventListener("click", event => {
  const tab = event.target.closest(".tab");
  if (tab) {
    activeView = tab.dataset.view;
    $$(".tab").forEach(el => el.classList.toggle("active", el === tab));
    $$(".view").forEach(el => el.classList.toggle("active", el.id === `${activeView}-view`));
  }
  const add = event.target.closest(".add-button");
  if (add) openTaskDialog(add.dataset.kind || "todo");
  const inline = event.target.closest(".add-inline");
  if (inline) openTaskDialog("todo", null, "", inline.dataset.priority);
  const projectTask = event.target.closest(".add-project-task");
  if (projectTask) openTaskDialog("todo", null, projectTask.dataset.projectId);
  const subproject = event.target.closest(".add-subproject");
  if (subproject) openProjectDialog(subproject.dataset.parentProjectId);
  if (event.target.closest(".task-card")) handleTaskAction(event);
  if (event.target.closest("#add-project")) openProjectDialog();
  const filter = event.target.closest(".module-filter button");
  if (filter) {
    const wrapper = filter.closest(".module-filter");
    moduleStatus[wrapper.dataset.module] = filter.dataset.status;
    wrapper.querySelectorAll("button").forEach(button => button.classList.toggle("active", button === filter));
    render();
  }
  const archiveAction = event.target.closest("[data-archive-action]");
  const archive = event.target.closest(".archive-card");
  if (archiveAction && archive) {
    if (archive.dataset.history === "true") {
      if (archiveAction.dataset.archiveAction === "delete" && confirm("确定永久删除这条历史记录吗？")) state.history = state.history.filter(item => item.id !== archive.dataset.id);
    } else {
      const project = archive.dataset.context === "project" ? findProject(state.projects, archive.dataset.projectId)?.project : null;
      const list = project ? project.tasks : state.tasks;
      const task = list.find(item => item.id === archive.dataset.id);
      if (task && archiveAction.dataset.archiveAction === "restore") { task.status = "active"; delete task.completedAt; delete task.cancelledAt; toast("任务已恢复"); }
      if (task && archiveAction.dataset.archiveAction === "delete" && confirm(`确定永久删除“${task.name}”吗？`)) list.splice(list.indexOf(task), 1);
    }
    saveState();
  }
  const close = event.target.closest("[data-close]");
  if (close) document.getElementById(close.dataset.close).close();

  const projectCard = event.target.closest(".project-card");
  const projectAction = event.target.closest(".project-card [data-action]");
  if (projectCard && projectAction && !event.target.closest(".task-card")) {
    const projectEntry = findProject(state.projects, projectCard.dataset.projectId);
    const project = projectEntry?.project;
    if (!project || !projectEntry) return;
    const action = projectAction.dataset.action;
    if (action === "toggle-project") projectCard.classList.toggle("collapsed");
    if (action === "project-menu") projectCard.classList.toggle("project-menu-open");
    if (action === "pin-project") { project.pinned = !project.pinned; saveState(); }
    if (action === "rename-project") { const name = prompt("新的项目名称", project.name); if (name?.trim()) { project.name = name.trim(); saveState(); } }
    if (action === "delete-project" && confirm(`确定删除“${project.name}”及其中全部任务和子项目吗？`)) { projectEntry.siblings.splice(projectEntry.siblings.indexOf(project), 1); saveState(); }
  }
});

$("#search-button").addEventListener("click", () => { $("#search-dialog").showModal(); setTimeout(() => $("#search-input").focus(), 30); });
$("#search-input").addEventListener("input", event => {
  const results = searchState(state, event.target.value);
  $("#search-results").innerHTML = results.length ? results.map(result => {
    const label = result.type === "project" ? "项目" : result.type === "repeat" ? "重复" : result.type === "project-task" ? result.project.name : "待办";
    const name = result.project && !result.task ? result.project.name : result.task.name;
    return `<button class="search-result"><span>${escapeHtml(name)}</span><small>${escapeHtml(label)}</small></button>`;
  }).join("") : `<p class="empty-note">${event.target.value ? "没有找到相关内容" : "输入关键词开始搜索"}</p>`;
});

$("#settings-button").addEventListener("click", async () => {
  const bytes = new Blob([localStorage.getItem(STORAGE_KEY) || ""]).size;
  $("#data-size").textContent = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  let cacheBytes = 0;
  if ("caches" in window) for (const key of await caches.keys()) { const cache = await caches.open(key); for (const request of await cache.keys()) { const response = await cache.match(request); cacheBytes += Number(response?.headers.get("content-length")) || 0; } }
  $("#cache-size").textContent = cacheBytes ? `${(cacheBytes / 1024).toFixed(1)} KB` : "很少";
  const cloudConfig = getCloudConfig();
  $("#cloud-url").value = cloudConfig?.url || "";
  $("#cloud-key").value = cloudConfig?.key || "";
  const exactButton = $("#exact-reminder-settings");
  const updateButton = $("#check-app-update");
  if (window.QingdanAndroid?.hasExactReminderPermission) {
    const exact = window.QingdanAndroid.hasExactReminderPermission();
    exactButton.classList.remove("hidden");
    exactButton.textContent = exact ? "手机精确提醒：已开启" : "手机精确提醒：需要开启";
    exactButton.disabled = exact;
    updateButton.classList.remove("hidden");
    const version = window.QingdanAndroid.getAppVersion?.();
    updateButton.textContent = version ? `检查手机更新（当前 ${version}）` : "检查手机更新";
  } else if (window.chrome?.webview) {
    exactButton.classList.add("hidden");
    updateButton.classList.remove("hidden");
    updateButton.textContent = "检查电脑更新";
  } else {
    exactButton.classList.add("hidden");
    updateButton.classList.add("hidden");
  }
  $("#settings-dialog").showModal();
});

function cloudError(error) {
  const message = error?.message === "Invalid login credentials" ? "邮箱或密码不正确" : error?.message || "云同步操作失败";
  toast(message);
  $("#cloud-status").textContent = message;
  $("#cloud-status-dot").className = "status-dot error";
}

$("#save-cloud-config").addEventListener("click", async () => {
  try { await saveCloudConfig($("#cloud-url").value, $("#cloud-key").value); toast("连接配置已保存"); }
  catch (error) { cloudError(error); }
});
$("#cloud-sign-up").addEventListener("click", async () => {
  try { await signUp($("#cloud-email").value, $("#cloud-password").value); toast("注册请求已提交，请查看邮箱"); }
  catch (error) { cloudError(error); }
});
$("#cloud-sign-in").addEventListener("click", async () => {
  try { await signIn($("#cloud-email").value, $("#cloud-password").value); toast("登录成功，正在同步"); }
  catch (error) { cloudError(error); }
});
$("#cloud-sign-out").addEventListener("click", async () => { try { await signOut(); } catch (error) { cloudError(error); } });
$("#sync-now").addEventListener("click", async () => { try { await syncNow(); toast("同步完成"); } catch (error) { cloudError(error); } });
$("#exact-reminder-settings").addEventListener("click", () => window.QingdanAndroid?.openExactReminderSettings?.());

function checkAppUpdate(userInitiated = false) {
  const legacyCloudUrl = getCloudConfig()?.url;
  if (window.QingdanAndroid?.checkForUpdate) {
    window.QingdanAndroid.checkForUpdate(resolveUpdateManifest("mobile", legacyCloudUrl), userInitiated);
  } else if (window.chrome?.webview) {
    window.chrome.webview.postMessage({ type: "check-update", manifestUrl: resolveUpdateManifest("desktop", legacyCloudUrl), userInitiated });
  }
}

$("#check-app-update").addEventListener("click", () => checkAppUpdate(true));

$("#clear-cache").addEventListener("click", async () => {
  if ("caches" in window) await Promise.all((await caches.keys()).map(key => caches.delete(key)));
  $("#cache-size").textContent = "0 KB"; toast("缓存已清理，任务数据未受影响");
});

$("#test-reminder").addEventListener("click", () => {
  if (window.chrome?.webview) {
    window.chrome.webview.postMessage({ type: "test-reminder" });
    $("#settings-dialog").close();
  } else if (window.QingdanAndroid?.testReminder) {
    window.QingdanAndroid.testReminder();
    $("#settings-dialog").close();
  } else toast("测试提醒仅在桌面或手机程序中可用");
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") $$(".menu-open").forEach(el => el.classList.remove("menu-open"));
  if ((event.ctrlKey || event.metaKey) && event.key === "k") { event.preventDefault(); $("#search-button").click(); }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !$("#task-dialog").open) { event.preventDefault(); openTaskDialog("todo"); }
});

window.addEventListener("qingdan-native-resume", () => {
  syncNow().catch(() => {});
  syncDesktopState();
  checkAppUpdate();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", event => {
    const message = event.data;
    if (!message || message.type !== "task-action") return;
    let task;
    if (message.projectId) task = findProject(state.projects, message.projectId)?.project.tasks.find(item => item.id === message.taskId);
    else task = state.tasks.find(item => item.id === message.taskId);
    if (!task) return;
    if (message.action === "complete") {
      task.status = "completed";
      task.completedAt = Date.now();
      if (task.kind === "repeat") {
        state.history.push({ id: createId("history"), sourceId: task.id, kind: "repeat", name: task.name, rule: task.rule, status: "completed", recordedAt: Date.now() });
        task.status = "active";
        task.lastCompletedAt = Date.now();
      }
      saveState("提醒操作已保存");
      toast("任务已完成");
    }
  });
}
render();
syncDesktopState();
initializeCloud({
  getState: () => state,
  replaceState: replaceStateFromCloud,
  onStatus: ({ text, kind }) => {
    $("#cloud-status").textContent = text;
    $("#cloud-status-dot").className = `status-dot ${kind}`;
    if (kind === "online") $("#sync-status").textContent = "云端已同步";
  },
  onAuth: user => {
    $("#cloud-config-panel").classList.toggle("hidden", Boolean(user));
    $("#cloud-auth-panel").classList.toggle("hidden", Boolean(user) || !getCloudConfig());
    $("#cloud-user-panel").classList.toggle("hidden", !user);
    $("#cloud-user-email").textContent = user?.email || "";
  }
}).then(() => checkAppUpdate()).catch(cloudError);
