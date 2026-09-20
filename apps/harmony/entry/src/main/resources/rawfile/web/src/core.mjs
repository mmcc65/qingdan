export const PRIORITIES = [
  { id: "important", label: "重要", hint: "需要优先处理" },
  { id: "normal", label: "普通", hint: "按计划稳步完成" },
  { id: "later", label: "随后", hint: "有空时再处理" }
];

export const REPEAT_RULES = ["每天", "每个工作日", "每周", "每月", "每隔 2 周"];

export const createId = (prefix = "item") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function createInitialState() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0);
  return {
    version: 1,
    schedules: [],
    memos: [],
    tasks: [
      { id: createId("task"), kind: "todo", name: "试着添加一项自己的任务", priority: "important", node: toInputDate(tomorrow), reminder: "none", notes: "", pinned: true, status: "active", order: 0, createdAt: Date.now() },
      { id: createId("task"), kind: "todo", name: "点开任务查看详细设置", priority: "normal", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 1, createdAt: Date.now() },
      { id: createId("task"), kind: "repeat", name: "整理本周工作", priority: "normal", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 0, rule: "每周", createdAt: Date.now() }
    ],
    history: [],
    projects: [{ id: createId("project"), name: "示例项目", pinned: false, status: "active", order: 0, tasks: [
      { id: createId("ptask"), name: "明确下一步", priority: "important", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 0, createdAt: Date.now() }
    ], projects: [] }]
  };
}

export function normalizeState(input) {
  if (!input || !Array.isArray(input.tasks) || !Array.isArray(input.projects)) return createInitialState();
  const normalizeProject = project => ({
    ...project,
    status: ["active", "completed", "cancelled"].includes(project?.status) ? project.status : "active",
    tasks: Array.isArray(project?.tasks) ? project.tasks : [],
    projects: Array.isArray(project?.projects) ? project.projects.map(normalizeProject) : []
  });
  return { version: 1, schedules: Array.isArray(input.schedules) ? input.schedules : [], memos: Array.isArray(input.memos) ? input.memos : [], tasks: input.tasks, projects: input.projects.map(normalizeProject), history: Array.isArray(input.history) ? input.history : [], cloudUpdatedAt: Number(input.cloudUpdatedAt) || 0 };
}

export function flattenProjects(projects) {
  const result = [];
  const visit = (items, parent = null, depth = 0) => items.forEach(project => {
    result.push({ project, parent, siblings: items, depth });
    visit(Array.isArray(project.projects) ? project.projects : [], project, depth + 1);
  });
  visit(Array.isArray(projects) ? projects : []);
  return result;
}

export function findProject(projects, id) {
  return flattenProjects(projects).find(entry => entry.project.id === id) || null;
}

export function collectProjectTasks(projects) {
  return flattenProjects(projects).flatMap(({ project }) => project.tasks.map(task => ({ task, project })));
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    const aTime = a.node ? new Date(a.node).getTime() : Infinity;
    const bTime = b.node ? new Date(b.node).getTime() : Infinity;
    return aTime - bTime;
  });
}

export function toInputDate(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function postponeDate(preset, from = new Date()) {
  const result = new Date(from);
  if (preset === "tomorrow") result.setDate(result.getDate() + 1);
  if (preset === "day-after") result.setDate(result.getDate() + 2);
  if (preset === "next-week") result.setDate(result.getDate() + 7);
  result.setHours(9, 0, 0, 0);
  return toInputDate(result);
}

export function formatNode(value, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((target - today) / 86400000);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (diff === 0) return `今天 ${time}`;
  if (diff === 1) return `明天 ${time}`;
  if (diff === -1) return `昨天 ${time}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

export function isOverdue(value, now = new Date()) {
  return Boolean(value && new Date(value).getTime() < now.getTime());
}

function localDate(value, fallback = null) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return fallback;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function repeatAnchor(task, now = new Date()) {
  const created = Number(task?.createdAt) ? new Date(Number(task.createdAt)) : now;
  return localDate(task?.node, new Date(created.getFullYear(), created.getMonth(), created.getDate()));
}

export function matchesRepeatRule(rule, anchor, date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (day < start) return false;
  const elapsedDays = Math.round((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  if (rule === "每天") return true;
  if (rule === "每个工作日") return day.getDay() >= 1 && day.getDay() <= 5;
  if (rule === "每周") return elapsedDays % 7 === 0;
  if (rule === "每月") return day.getDate() === start.getDate();
  if (rule === "每隔 2 周") return elapsedDays % 14 === 0;
  return false;
}

export function normalizeRepeatReminder(reminder) {
  if (!reminder || reminder === "none" || reminder.mode === "none") return { mode: "none" };
  if (reminder === "single" || reminder.mode === "single") return { mode: "single" };
  if (typeof reminder === "object" && reminder.mode === "repeat-interval") {
    const startOffset = Math.max(-1440, Math.min(1440, Number(reminder.startOffset) || 0));
    const endOffset = Math.max(startOffset, Math.min(1440, Number(reminder.endOffset) || 0));
    return { mode: "repeat-interval", startOffset, endOffset, interval: Math.max(1, Math.min(1440, Number(reminder.interval) || 10)) };
  }
  if (typeof reminder === "object" && reminder.mode === "interval") {
    return { mode: "repeat-interval", startOffset: -30, endOffset: 0, interval: Math.max(1, Math.min(1440, Number(reminder.interval) || 10)) };
  }
  return { mode: "none" };
}

export function repeatReminderMoments(execution, reminder) {
  const normalized = normalizeRepeatReminder(reminder);
  if (normalized.mode === "none") return [];
  if (normalized.mode === "single") return [new Date(execution)];
  const moments = [];
  for (let offset = normalized.startOffset; offset <= normalized.endOffset; offset += normalized.interval) {
    moments.push(new Date(execution.getTime() + offset * 60000));
    if (moments.length >= 300) break;
  }
  const finalAt = execution.getTime() + normalized.endOffset * 60000;
  if (!moments.some(item => item.getTime() === finalAt)) moments.push(new Date(finalAt));
  return moments;
}

export function nextRepeatExecutions(task, from = new Date(), count = 3) {
  const schedules = Array.isArray(task?.repeatSchedules) ? task.repeatSchedules : [];
  const anchor = repeatAnchor(task, from);
  const end = localDate(task?.repeatEndDate);
  const first = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (first < anchor) first.setTime(anchor.getTime());
  const results = [];
  for (let offset = 0; offset <= 1462 && results.length < count; offset++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + offset);
    if (end && day > end) break;
    schedules.forEach((schedule, scheduleIndex) => {
      if (!/^\d{2}:\d{2}$/.test(schedule?.time || "") || !matchesRepeatRule(schedule.rule, anchor, day)) return;
      const [hour, minute] = schedule.time.split(":").map(Number);
      const execution = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      if (execution >= from) results.push({ execution, scheduleIndex, rule: schedule.rule });
    });
    results.sort((a, b) => a.execution - b.execution || a.scheduleIndex - b.scheduleIndex);
    if (results.length >= count) return results.slice(0, count);
  }
  return results.slice(0, count);
}

export function searchState(state, query) {
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  if (!needle) return [];
  const results = [];
  state.tasks.filter(t => t.status === "active" && `${t.name} ${t.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(task => results.push({ type: task.kind, task }));
  (state.schedules || []).filter(t => t.status === "active" && `${t.name} ${t.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(task => results.push({ type: "schedule", task }));
  (state.memos || []).filter(memo => `${memo.content || ""} ${memo.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(memo => results.push({ type: "memo", memo }));
  flattenProjects(state.projects).forEach(({ project }) => {
    if (project.name.toLocaleLowerCase("zh-CN").includes(needle)) results.push({ type: "project", project });
    project.tasks.filter(t => t.status === "active" && `${t.name} ${t.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(task => results.push({ type: "project-task", task, project }));
  });
  return results;
}
