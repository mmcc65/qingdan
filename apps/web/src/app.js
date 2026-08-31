import { PRIORITIES, createId, createInitialState, normalizeState, sortTasks, postponeDate, formatNode, isOverdue, searchState, toInputDate, flattenProjects, findProject, collectProjectTasks } from "./core.mjs";
import { initializeCloud, getCloudConfig, saveCloudConfig, signUp, signIn, signOut, syncNow, scheduleCloudPush, isApplyingRemote } from "./cloud-sync.js";
import { resolveUpdateManifests } from "./release-config.js";

const STORAGE_KEY = "qingdan.state.v1";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let state = loadState();
let activeView = "todo";
let activeProjectId = "";
let scheduleDate = dateKey(new Date());
let reminderTimeTouched = [{ start: false, end: false }];
const moduleStatus = { todo: "active", repeat: "active", schedule: "active", projects: "active" };

restoreStateFromAndroid();

function updateFloatingAdd() {
  const button = $("#floating-add");
  if (!button) return;
  const projectView = activeView === "projects";
  const label = projectView ? "新建项目" : activeView === "repeat" ? "添加重复任务" : activeView === "schedule" ? "添加日程" : "添加待办";
  button.dataset.kind = projectView ? "" : activeView;
  button.dataset.action = projectView ? "add-project" : "add-task";
  button.setAttribute("aria-label", label);
  button.title = label;
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return createInitialState(); }
}

function restoreStateFromAndroid() {
  try {
    const raw = window.QingdanAndroid?.getState?.();
    if (!raw) return;
    const nativeState = normalizeState(JSON.parse(raw));
    if ((nativeState.cloudUpdatedAt || 0) > (state.cloudUpdatedAt || 0)) {
      state = nativeState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch { /* The web app also runs outside Android. */ }
}

function dateKey(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
  renderSchedules();
  renderProjects();
}

function renderCounts() {
  $("#todo-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "active").length;
  $("#repeat-count").textContent = state.tasks.filter(t => t.kind === "repeat" && t.status === "active").length;
  const today = dateKey(new Date());
  $("#schedule-count").textContent = state.schedules.filter(t => t.status === "active" && String(t.node || "").slice(0, 10) === today).length;
  const rootProjects = state.projects;
  $("#project-count").textContent = rootProjects.filter(project => project.status === "active").length;
  $("#todo-active-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "active").length;
  $("#todo-completed-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "completed").length;
  $("#todo-cancelled-count").textContent = state.tasks.filter(t => t.kind === "todo" && t.status === "cancelled").length;
  $("#repeat-active-count").textContent = state.tasks.filter(t => t.kind === "repeat" && t.status === "active").length;
  $("#repeat-completed-count").textContent = state.history.filter(item => item.kind === "repeat" && item.status === "completed").length;
  $("#repeat-cancelled-count").textContent = state.history.filter(item => item.kind === "repeat" && item.status === "cancelled").length;
  $("#schedule-active-count").textContent = state.schedules.filter(t => t.status === "active" && String(t.node || "").slice(0, 10) === scheduleDate).length;
  $("#schedule-completed-count").textContent = state.schedules.filter(t => t.status === "completed" && String(t.node || "").slice(0, 10) === scheduleDate).length;
  $("#schedule-cancelled-count").textContent = state.schedules.filter(t => t.status === "cancelled" && String(t.node || "").slice(0, 10) === scheduleDate).length;
  $("#project-active-count").textContent = rootProjects.filter(project => project.status === "active").length;
  $("#project-completed-count").textContent = rootProjects.filter(project => project.status === "completed").length;
  $("#project-cancelled-count").textContent = rootProjects.filter(project => project.status === "cancelled").length;
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
  if (reminder.mode === "interval") meta.push(`<span>循环提醒${reminder.slots?.length > 1 ? ` · ${reminder.slots.length} 个时间段` : ` · 每 ${reminder.interval || 30} ${reminder.unit === "hour" ? "小时" : reminder.unit === "day" ? "天" : "分钟"}`}</span>`);
  if (task.rule) meta.push(`<span>${escapeHtml(task.rule)}</span>`);
  return `<article class="task-card ${task.pinned ? "pinned" : ""}" data-id="${task.id}" data-context="${context}" data-project-id="${projectId}">
    <button class="complete-button" data-action="complete" title="完成" aria-label="完成任务"></button>
    <button class="task-main" data-action="edit"><span class="task-name"><i class="dot ${task.priority}"></i>${escapeHtml(task.name)}</span>${meta.length ? `<span class="task-meta">${meta.join("")}</span>` : ""}</button>
    ${task.pinned ? '<span class="pin" title="已置顶">⌃</span>' : ""}
    <button class="more-button" data-action="menu" title="更多操作">•••</button>
    <div class="task-menu">
      <button data-action="move-up">上移一项</button>
      <button data-action="move-down">下移一项</button>
      <button data-action="postpone" data-preset="tomorrow">稍后：明天</button>
      <button data-action="postpone" data-preset="day-after">稍后：后天</button>
      <button data-action="postpone" data-preset="next-week">稍后：下周</button>
      <button data-action="cancel">取消任务</button>
      <button data-action="delete" class="danger">删除记录</button>
    </div>
  </article>`;
}

function completedProjectTaskCard(task, projectId) {
  return `<article class="task-card completed-project-task" data-id="${task.id}" data-context="project" data-project-id="${projectId}">
    <button class="complete-button" data-action="restore" title="恢复任务" aria-label="恢复任务">✓</button>
    <button class="task-main" data-action="edit"><span class="task-name"><i class="dot ${task.priority}"></i>${escapeHtml(task.name)}</span><span class="task-meta"><span>已完成</span></span></button>
    <button class="more-button" data-action="menu" title="更多操作">•••</button>
    <div class="task-menu"><button data-action="restore">恢复任务</button><button data-action="cancel">取消任务</button><button data-action="delete" class="danger">删除记录</button></div>
  </article>`;
}

function normalizeReminder(reminder) {
  if (!reminder || reminder === "none") return { mode: "none" };
  const normalizeSlot = slot => ({
    start: slot?.start || "",
    end: slot?.end || "",
    interval: Math.max(1, Number(slot?.interval) || 30),
    unit: slot?.unit || "minute"
  });
  if (typeof reminder === "object") {
    const slots = Array.isArray(reminder.slots) && reminder.slots.length
      ? reminder.slots.map(normalizeSlot)
      : reminder.mode === "interval" ? [normalizeSlot(reminder)] : [];
    return { mode: reminder.mode || "none", ...reminder, slots };
  }
  if (reminder === "single") return { mode: "single", at: "" };
  if (reminder === "30" || reminder === "60") {
    const slot = { start: "", end: "", interval: Number(reminder), unit: "minute" };
    return { mode: "interval", ...slot, slots: [slot] };
  }
  return { mode: "none" };
}

function renderReminderSlots(slots = []) {
  const values = slots.length ? slots : [{ start: "", end: "", interval: 30, unit: "minute" }];
  reminderTimeTouched = values.map(slot => ({ start: Boolean(slot.start), end: Boolean(slot.end) }));
  $("#reminder-slots").innerHTML = values.map((slot, index) => {
    const id = field => index === 0 ? `reminder-${field}` : `reminder-${field}-${index}`;
    return `<div class="reminder-slot" data-slot-index="${index}">
      <div class="reminder-slot-heading"><strong>时间段 ${index + 1}</strong>${index ? '<button type="button" class="text-button remove-reminder-slot" data-slot-index="' + index + '">删除</button>' : ""}</div>
      <div class="two-columns">
        <label class="field"><span>开始时间 <em>可选</em></span><input type="datetime-local" id="${id("start")}" data-field="start" value="${escapeHtml(slot.start || "")}"></label>
        <label class="field"><span>结束时间 <em>可选</em></span><input type="datetime-local" id="${id("end")}" data-field="end" value="${escapeHtml(slot.end || "")}"></label>
      </div>
      <div class="interval-row">
        <label class="field"><span>提醒间隔</span><input type="number" id="${id("interval")}" data-field="interval" min="1" max="999" value="${Math.max(1, Number(slot.interval) || 30)}" inputmode="numeric"></label>
        <label class="field"><span>单位</span><select id="${id("unit")}" data-field="unit"><option value="minute" ${slot.unit === "minute" ? "selected" : ""}>分钟</option><option value="hour" ${slot.unit === "hour" ? "selected" : ""}>小时</option><option value="day" ${slot.unit === "day" ? "selected" : ""}>天</option></select></label>
      </div>
    </div>`;
  }).join("");
}

function readReminderSlots() {
  return $$("#reminder-slots .reminder-slot").map(slot => ({
    start: slot.querySelector('[data-field="start"]').value,
    end: slot.querySelector('[data-field="end"]').value,
    interval: Math.max(1, Number(slot.querySelector('[data-field="interval"]').value) || 30),
    unit: slot.querySelector('[data-field="unit"]').value
  }));
}

function updateReminderFields(mode) {
  $("#single-reminder-settings").classList.toggle("visible", mode === "single");
  $("#interval-reminder-settings").classList.toggle("visible", mode === "interval");
  if (mode === "interval") applyReminderDefaults();
}

function applyReminderDefaults() {
  const start = $("#reminder-slots [data-field=\"start\"]");
  const end = $("#reminder-slots [data-field=\"end\"]");
  const node = $("#task-node").value;
  const touched = reminderTimeTouched[0] || { start: false, end: false };
  if (!touched.start && !start.value) start.value = toInputDate(new Date());
  if (!touched.end && node) end.value = node;
}

function renderTodos() {
  const status = moduleStatus.todo;
  const splitByPriority = status === "active" || status === "completed";
  $("#todo-columns").classList.toggle("hidden", !splitByPriority);
  $("#todo-archive").classList.toggle("visible", status === "cancelled");
  const displayed = state.tasks.filter(t => t.kind === "todo" && t.status === status);
  $("#todo-columns").innerHTML = PRIORITIES.map(priority => {
    const tasks = status === "completed"
      ? displayed.filter(t => t.priority === priority.id).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      : sortTasks(displayed.filter(t => t.priority === priority.id));
    return `<section class="priority-column">
      <header><div><i class="dot ${priority.id}"></i><strong>${priority.label}</strong><small>${priority.hint}</small></div><span>${tasks.length}</span></header>
      <div class="task-list">${tasks.length ? tasks.map(t => status === "completed" ? archiveCard(t) : taskCard(t)).join("") : `<div class="empty-state"><span>✓</span><p>${status === "completed" ? "这里还没有完成记录" : "这里暂时没有任务"}</p>${status === "active" ? `<button class="text-button add-inline" data-priority="${priority.id}">添加一项</button>` : ""}</div>`}</div>
    </section>`;
  }).join("");
  const archived = state.tasks.filter(t => t.kind === "todo" && t.status === status).sort((a, b) => (b.completedAt || b.cancelledAt || 0) - (a.completedAt || a.cancelledAt || 0));
  $("#todo-archive").innerHTML = status === "cancelled" ? (archived.length ? archived.map(task => archiveCard(task)).join("") : archiveEmpty(status)) : "";
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

function renderSchedules() {
  const status = moduleStatus.schedule;
  const selected = new Date(`${scheduleDate}T12:00:00`);
  $("#schedule-date").value = scheduleDate;
  $("#schedule-day-label").textContent = selected.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  $("#schedule-list").classList.toggle("hidden", status !== "active");
  $("#schedule-archive").classList.toggle("visible", status !== "active");
  const tasks = state.schedules
    .filter(item => item.status === "active" && String(item.node || "").slice(0, 10) === scheduleDate)
    .sort((a, b) => new Date(a.node).getTime() - new Date(b.node).getTime());
  $("#schedule-list").innerHTML = tasks.length
    ? `<div class="section-list">${tasks.map(task => taskCard(task, "schedule")).join("")}</div>`
    : `<div class="large-empty"><span>日</span><h3>当天还没有行程</h3><p>添加行程后，可选择单次或循环提醒。</p><button class="primary-button add-button" data-kind="schedule">添加日程</button></div>`;
  const archived = state.schedules
    .filter(item => item.status === status && String(item.node || "").slice(0, 10) === scheduleDate)
    .sort((a, b) => (b.completedAt || b.cancelledAt || 0) - (a.completedAt || a.cancelledAt || 0));
  $("#schedule-archive").innerHTML = status === "active" ? "" : archived.length ? archived.map(item => archiveCard(item, { context: "schedule", label: formatNode(item.node) })).join("") : archiveEmpty(status);
}

function renderProjects() {
  const status = moduleStatus.projects;
  const selected = activeProjectId ? findProject(state.projects, activeProjectId)?.project : null;
  if (activeProjectId && !selected) activeProjectId = "";
  const showingDetail = Boolean(selected);
  $("#projects-list").classList.toggle("hidden", status !== "active" && !showingDetail);
  $("#projects-list").classList.toggle("project-detail-layout", showingDetail);
  $("#projects-archive").classList.toggle("visible", status !== "active" && !showingDetail);
  $$(".module-filter[data-module=projects] button").forEach(button => button.classList.toggle("active", button.dataset.status === status));
  const sortedProjects = projects => [...projects].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.order ?? 0) - (b.order ?? 0));
  const projectTaskSummary = project => {
    const tasks = collectProjectTasks([project]).map(({ task }) => task);
    const total = tasks.filter(task => task.status !== "cancelled").length;
    return { total, complete: tasks.filter(task => task.status === "completed").length };
  };
  const projectCard = (project, depth = 0) => {
    const active = sortTasks(project.tasks.filter(task => task.status === "active"));
    const completed = sortTasks(project.tasks.filter(task => task.status === "completed"));
    const children = sortedProjects(project.projects || []);
    const { total, complete } = projectTaskSummary(project);
    const percent = total ? Math.round(complete / total * 100) : 0;
    const empty = !active.length && !children.length ? '<p class="project-empty">这个项目还没有待处理任务或子项目</p>' : "";
    const completeAction = !depth && project.status === "active" ? `<button class="project-complete-button" data-action="complete-project" title="完成项目" aria-label="完成项目">✓</button>` : "";
    const statusLabel = project.status === "completed" ? "项目已完成" : project.status === "cancelled" ? "项目已取消" : `${complete} / ${total} 已完成${children.length ? ` · ${children.length} 个子项目` : ""}`;
    const completedTasks = completed.length ? `<div class="project-completed-section"><button class="text-button show-completed-button" data-action="toggle-completed-tasks">查看已完成任务（${completed.length}）</button><div class="completed-project-tasks">${completed.map(task => completedProjectTaskCard(task, project.id)).join("")}</div></div>` : "";
    return `<section class="project-card ${depth ? "subproject-card" : ""} project-${project.status}" data-project-id="${project.id}">
      <header><div class="project-header-main">${completeAction}<button class="project-open" data-action="open-project" title="查看项目全部内容"><strong>${escapeHtml(project.name)}</strong><small>${statusLabel}</small></button></div><div class="project-header-actions"><button class="project-toggle" data-action="toggle-project" title="展开或收起项目" aria-label="展开或收起项目"><span class="chevron">⌄</span></button><button class="more-button" data-action="project-menu">•••</button></div></header>
      <div class="progress-track"><i style="width:${percent}%"></i></div>
      <div class="project-body">${active.map(task => taskCard(task, "project", project.id)).join("")}${completedTasks}${empty}${children.length ? `<div class="subprojects">${children.map(child => projectCard(child, depth + 1)).join("")}</div>` : ""}<div class="project-add-actions"><button class="add-project-task" data-project-id="${project.id}">＋ 添加任务</button><button class="add-subproject" data-parent-project-id="${project.id}">◇ 添加子项目</button></div></div>
      <div class="project-menu"><button data-action="move-up">上移一项</button><button data-action="move-down">下移一项</button><button data-action="pin-project">${project.pinned ? "取消置顶" : "置顶项目"}</button><button data-action="rename-project">重命名</button>${!depth && project.status === "active" ? '<button data-action="complete-project">完成项目</button><button data-action="cancel-project">取消项目</button>' : !depth ? '<button data-action="restore-project">重新开启项目</button>' : ""}<button class="danger" data-action="delete-project">删除项目</button></div>
    </section>`;
  };
  const projectArchiveCard = project => {
    const date = project.completedAt || project.cancelledAt;
    const time = date ? new Date(date).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
    const label = project.status === "completed" ? "已完成项目" : "已取消项目";
    return `<article class="project-archive-card" data-project-id="${project.id}"><button class="project-archive-main" data-action="open-project"><span class="archive-check">${project.status === "completed" ? "✓" : "×"}</span><span><strong>${escapeHtml(project.name)}</strong><small>${label}${time ? ` · ${time}` : ""}</small></span></button><button class="text-button" data-action="restore-project">重新开启</button></article>`;
  };
  if (showingDetail) {
    $("#projects-list").innerHTML = `<section class="project-detail"><button class="text-button project-back" data-action="back-to-projects">← 返回项目列表</button><p class="eyebrow">项目详情</p>${projectCard(selected)}</section>`;
  } else {
    const projects = sortedProjects(state.projects.filter(project => project.status === status));
    const emptyCopy = status === "active" ? ["还没有进行中的项目", "把有明确先后顺序的一组事情放在项目中。"] : status === "completed" ? ["还没有已完成项目", "完成项目后会保留在这里。"] : ["还没有已取消项目", "取消项目后会保留在这里。"];
    $("#projects-list").innerHTML = projects.length ? projects.map(project => projectCard(project)).join("") : `<div class="large-empty"><span>◇</span><h3>${emptyCopy[0]}</h3><p>${emptyCopy[1]}</p></div>`;
  }
  const archived = sortedProjects(state.projects.filter(project => project.status === status));
  $("#projects-archive").innerHTML = status === "active" || showingDetail ? "" : archived.length ? archived.map(projectArchiveCard).join("") : archiveEmpty(status);
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
  const isSchedule = kind === "schedule";
  $("#task-form").reset();
  $("#task-id").value = task?.id || "";
  $("#task-kind").value = kind;
  $("#task-project-id").value = projectId;
  $("#dialog-kicker").textContent = task ? "编辑" : isSchedule ? "新日程" : "新任务";
  $("#dialog-title").textContent = kind === "repeat" ? "重复任务" : isSchedule ? "添加日程" : projectId ? "项目任务" : "添加待办";
  $("#task-name-label").textContent = isSchedule ? "行程名称" : "任务名称";
  $("#task-name").placeholder = isSchedule ? "当天准备做什么？" : "准备做什么？";
  $("#task-name").value = task?.name || "";
  $("#task-node-label").innerHTML = isSchedule ? "开始时间" : "节点 <em>可选</em>";
  $("#task-node").required = isSchedule;
  $("#task-node").value = task?.node || (isSchedule ? `${scheduleDate}T09:00` : "");
  const reminder = normalizeReminder(task?.reminder);
  renderReminderSlots(reminder.slots || []);
  $("#task-reminder").value = reminder.mode;
  $("#reminder-at").value = reminder.at || "";
  updateReminderFields(reminder.mode);
  $("#task-notes").value = task?.notes || "";
  $("#task-pinned").checked = Boolean(task?.pinned);
  $("#task-rule").value = task?.rule || "每周";
  dialog.classList.toggle("is-repeat", kind === "repeat");
  dialog.classList.toggle("is-schedule", isSchedule);
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
  if (card.dataset.context === "schedule") return { task: state.schedules.find(t => t.id === id), project: null };
  return { task: state.tasks.find(t => t.id === id), project: null };
}

function taskOrderBucket(task, project) {
  if (project) return sortTasks(project.tasks.filter(item => item.status === "active"));
  if (task.kind === "schedule") return state.schedules.filter(item => item.status === "active").sort((a, b) => new Date(a.node).getTime() - new Date(b.node).getTime());
  if (task.kind === "repeat") return sortTasks(state.tasks.filter(item => item.kind === "repeat" && item.status === "active"));
  return sortTasks(state.tasks.filter(item => item.kind === "todo" && item.priority === task.priority && item.status === "active"));
}

function moveItem(list, item, delta) {
  const index = list.indexOf(item);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return false;
  [list[index], list[target]] = [list[target], list[index]];
  list.forEach((entry, order) => { entry.order = order; });
  return true;
}

function moveProject(siblings, project, delta) {
  const ordered = [...siblings].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.order ?? 0) - (b.order ?? 0));
  if (!moveItem(ordered, project, delta)) return false;
  ordered.forEach((entry, order) => { entry.order = order; });
  return true;
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
  if (action === "restore") {
    task.status = "active";
    delete task.completedAt;
    delete task.cancelledAt;
    toast("任务已恢复");
    saveState();
    return;
  }
  if (action === "move-up" || action === "move-down") {
    const moved = moveItem(taskOrderBucket(task, project), task, action === "move-up" ? -1 : 1);
    toast(moved ? (action === "move-up" ? "任务已上移" : "任务已下移") : (action === "move-up" ? "已经是最前面" : "已经是最后面"));
    saveState();
    return;
  }
  if (action === "complete") {
    task.status = "completed"; task.completedAt = Date.now();
    toast(task.kind === "repeat" ? "已完成本次，重复计划仍然保留" : task.kind === "schedule" ? "日程已完成" : "任务已完成");
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
    const list = project ? project.tasks : task.kind === "schedule" ? state.schedules : state.tasks;
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
  const container = projectId ? findProject(state.projects, projectId)?.project.tasks : kind === "schedule" ? state.schedules : state.tasks;
  if (!container) return;
  const existing = id ? container.find(t => t.id === id) : null;
  const task = existing || { id: createId(projectId ? "ptask" : kind === "schedule" ? "schedule" : "task"), kind, status: "active", order: container.length, createdAt: Date.now() };
  const reminderMode = $("#task-reminder").value;
  const reminder = reminderMode === "single"
    ? { mode: "single", at: $("#reminder-at").value }
    : reminderMode === "interval"
      ? (() => {
        const slots = readReminderSlots();
        const first = slots[0] || { start: "", end: "", interval: 30, unit: "minute" };
        return { mode: "interval", ...first, slots };
      })()
      : { mode: "none" };
  Object.assign(task, { name: $("#task-name").value.trim(), priority: kind === "schedule" ? "normal" : $("input[name=priority]:checked").value, node: $("#task-node").value, reminder, notes: $("#task-notes").value.trim(), pinned: kind === "schedule" ? false : $("#task-pinned").checked });
  if (kind === "repeat") task.rule = $("#task-rule").value;
  if (!existing) container.push(task);
  $("#task-dialog").close(); saveState(); toast(existing ? "修改已保存" : kind === "schedule" ? "日程已添加" : "任务已添加");
});

$("#project-form").addEventListener("submit", event => {
  event.preventDefault();
  const parentId = $("#project-parent-id").value;
  const parent = parentId ? findProject(state.projects, parentId)?.project : null;
  const container = parent ? parent.projects : state.projects;
  container.push({ id: createId("project"), name: $("#project-name").value.trim(), pinned: false, status: "active", order: container.length, tasks: [], projects: [] });
  $("#project-dialog").close(); $("#project-form").reset(); saveState(); toast("项目已创建");
});

$("#task-reminder").addEventListener("change", event => updateReminderFields(event.target.value));
$("#add-reminder-slot").addEventListener("click", () => {
  renderReminderSlots([...readReminderSlots(), { start: "", end: "", interval: 30, unit: "minute" }]);
});
$("#reminder-slots").addEventListener("click", event => {
  const remove = event.target.closest(".remove-reminder-slot");
  if (!remove) return;
  const slots = readReminderSlots();
  slots.splice(Number(remove.dataset.slotIndex), 1);
  renderReminderSlots(slots);
});
$("#reminder-slots").addEventListener("input", event => {
  const field = event.target.dataset.field;
  const slot = event.target.closest(".reminder-slot");
  if (field && slot) reminderTimeTouched[Number(slot.dataset.slotIndex)][field] = true;
});
$("#task-node").addEventListener("input", event => {
  const end = $("#reminder-slots [data-field=\"end\"]");
  if ($("#task-reminder").value === "interval" && end && !reminderTimeTouched[0]?.end) {
    end.value = event.target.value;
  }
});

document.addEventListener("click", event => {
  const tab = event.target.closest(".tab");
  if (tab) {
    activeView = tab.dataset.view;
    $$(".tab").forEach(el => el.classList.toggle("active", el === tab));
    $$(".view").forEach(el => el.classList.toggle("active", el.id === `${activeView}-view`));
    updateFloatingAdd();
  }
  const add = event.target.closest(".add-button");
  if (add) {
    if (add.dataset.action === "add-project") openProjectDialog();
    else openTaskDialog(add.dataset.kind || "todo");
  }
  const inline = event.target.closest(".add-inline");
  if (inline) openTaskDialog("todo", null, "", inline.dataset.priority);
  const projectTask = event.target.closest(".add-project-task");
  if (projectTask) openTaskDialog("todo", null, projectTask.dataset.projectId);
  const subproject = event.target.closest(".add-subproject");
  if (subproject) openProjectDialog(subproject.dataset.parentProjectId);
  const scheduleDay = event.target.closest("[data-schedule-day]");
  if (scheduleDay) {
    const date = new Date(`${scheduleDate}T12:00:00`);
    if (scheduleDay.dataset.scheduleDay === "previous") date.setDate(date.getDate() - 1);
    if (scheduleDay.dataset.scheduleDay === "next") date.setDate(date.getDate() + 1);
    scheduleDate = scheduleDay.dataset.scheduleDay === "today" ? dateKey(new Date()) : dateKey(date);
    renderCounts();
    renderSchedules();
  }
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
      const list = project ? project.tasks : archive.dataset.context === "schedule" ? state.schedules : state.tasks;
      const task = list.find(item => item.id === archive.dataset.id);
      if (task && archiveAction.dataset.archiveAction === "restore") { task.status = "active"; delete task.completedAt; delete task.cancelledAt; toast("任务已恢复"); }
      if (task && archiveAction.dataset.archiveAction === "delete" && confirm(`确定永久删除“${task.name}”吗？`)) list.splice(list.indexOf(task), 1);
    }
    saveState();
  }
  const close = event.target.closest("[data-close]");
  if (close) document.getElementById(close.dataset.close).close();
  if (event.target.closest("[data-action=back-to-projects]")) { activeProjectId = ""; render(); return; }

  const projectCard = event.target.closest(".project-card");
  const projectAction = event.target.closest(".project-card [data-action]");
  if (projectCard && projectAction && !event.target.closest(".task-card")) {
    const projectEntry = findProject(state.projects, projectCard.dataset.projectId);
    const project = projectEntry?.project;
    if (!project || !projectEntry) return;
    const action = projectAction.dataset.action;
    if (action === "toggle-project") projectCard.classList.toggle("collapsed");
    if (action === "toggle-completed-tasks") {
      projectCard.classList.toggle("show-completed-tasks");
      const toggle = projectCard.querySelector(".show-completed-button");
      if (toggle) {
        const count = project.tasks.filter(task => task.status === "completed").length;
        toggle.textContent = projectCard.classList.contains("show-completed-tasks") ? `收起已完成任务（${count}）` : `查看已完成任务（${count}）`;
      }
    }
    if (action === "open-project") { activeProjectId = project.id; render(); }
    if (action === "back-to-projects") { activeProjectId = ""; render(); }
    if (action === "project-menu") projectCard.classList.toggle("project-menu-open");
    if (action === "move-up" || action === "move-down") {
      const moved = moveProject(projectEntry.siblings, project, action === "move-up" ? -1 : 1);
      toast(moved ? (action === "move-up" ? "项目已上移" : "项目已下移") : (action === "move-up" ? "已经是最前面" : "已经是最后面"));
      saveState();
    }
    if (action === "pin-project") { project.pinned = !project.pinned; saveState(); }
    if (action === "rename-project") { const name = prompt("新的项目名称", project.name); if (name?.trim()) { project.name = name.trim(); saveState(); } }
    if (action === "complete-project") {
      project.status = "completed";
      project.completedAt = Date.now();
      delete project.cancelledAt;
      activeProjectId = "";
      moduleStatus.projects = "completed";
      saveState();
      toast("项目已完成；其中的子项目和任务状态保持不变");
    }
    if (action === "cancel-project") {
      project.status = "cancelled";
      project.cancelledAt = Date.now();
      delete project.completedAt;
      activeProjectId = "";
      moduleStatus.projects = "cancelled";
      saveState();
      toast("项目已取消；其中的子项目和任务状态保持不变");
    }
    if (action === "restore-project") {
      project.status = "active";
      delete project.completedAt;
      delete project.cancelledAt;
      activeProjectId = "";
      moduleStatus.projects = "active";
      saveState();
      toast("项目已重新开启");
    }
    if (action === "delete-project" && confirm(`确定删除“${project.name}”及其中全部任务和子项目吗？`)) { projectEntry.siblings.splice(projectEntry.siblings.indexOf(project), 1); saveState(); }
  }

  const archivedProject = event.target.closest(".project-archive-card");
  const archivedProjectAction = event.target.closest(".project-archive-card [data-action]");
  if (archivedProject && archivedProjectAction) {
    const project = findProject(state.projects, archivedProject.dataset.projectId)?.project;
    if (!project) return;
    if (archivedProjectAction.dataset.action === "open-project") { activeProjectId = project.id; render(); }
    if (archivedProjectAction.dataset.action === "restore-project") {
      project.status = "active";
      delete project.completedAt;
      delete project.cancelledAt;
      moduleStatus.projects = "active";
      saveState();
      toast("项目已重新开启");
    }
  }
});

$("#schedule-date").addEventListener("change", event => {
  if (event.target.value) {
    scheduleDate = event.target.value;
    renderCounts();
    renderSchedules();
  }
});

$("#search-button").addEventListener("click", () => { $("#search-dialog").showModal(); setTimeout(() => $("#search-input").focus(), 30); });
$("#search-input").addEventListener("input", event => {
  const results = searchState(state, event.target.value);
  $("#search-results").innerHTML = results.length ? results.map(result => {
    const label = result.type === "project" ? "项目" : result.type === "repeat" ? "重复" : result.type === "schedule" ? "日程" : result.type === "project-task" ? result.project.name : "待办";
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
    const manifestUrls = resolveUpdateManifests("mobile", legacyCloudUrl);
    window.QingdanAndroid.checkForUpdate(JSON.stringify(manifestUrls), userInitiated);
  } else if (window.chrome?.webview) {
    const manifestUrls = resolveUpdateManifests("desktop", legacyCloudUrl);
    window.chrome.webview.postMessage({ type: "check-update", manifestUrl: manifestUrls[0] || "", manifestUrls, userInitiated });
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
  restoreStateFromAndroid();
  render();
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
updateFloatingAdd();
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
