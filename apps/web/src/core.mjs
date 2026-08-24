export const PRIORITIES = [
  { id: "important", label: "重要", hint: "需要优先处理" },
  { id: "normal", label: "普通", hint: "按计划稳步完成" },
  { id: "later", label: "随后", hint: "有空时再处理" }
];

export const createId = (prefix = "item") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function createInitialState() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0);
  return {
    version: 1,
    tasks: [
      { id: createId("task"), kind: "todo", name: "试着添加一项自己的任务", priority: "important", node: toInputDate(tomorrow), reminder: "none", notes: "", pinned: true, status: "active", order: 0, createdAt: Date.now() },
      { id: createId("task"), kind: "todo", name: "点开任务查看详细设置", priority: "normal", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 1, createdAt: Date.now() },
      { id: createId("task"), kind: "repeat", name: "整理本周工作", priority: "normal", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 0, rule: "每周", createdAt: Date.now() }
    ],
    history: [],
    projects: [{ id: createId("project"), name: "示例项目", pinned: false, order: 0, tasks: [
      { id: createId("ptask"), name: "明确下一步", priority: "important", node: "", reminder: "none", notes: "", pinned: false, status: "active", order: 0, createdAt: Date.now() }
    ], projects: [] }]
  };
}

export function normalizeState(input) {
  if (!input || !Array.isArray(input.tasks) || !Array.isArray(input.projects)) return createInitialState();
  const normalizeProject = project => ({
    ...project,
    tasks: Array.isArray(project?.tasks) ? project.tasks : [],
    projects: Array.isArray(project?.projects) ? project.projects.map(normalizeProject) : []
  });
  return { version: 1, tasks: input.tasks, projects: input.projects.map(normalizeProject), history: Array.isArray(input.history) ? input.history : [], cloudUpdatedAt: Number(input.cloudUpdatedAt) || 0 };
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

export function searchState(state, query) {
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  if (!needle) return [];
  const results = [];
  state.tasks.filter(t => t.status === "active" && `${t.name} ${t.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(task => results.push({ type: task.kind, task }));
  flattenProjects(state.projects).forEach(({ project }) => {
    if (project.name.toLocaleLowerCase("zh-CN").includes(needle)) results.push({ type: "project", project });
    project.tasks.filter(t => t.status === "active" && `${t.name} ${t.notes || ""}`.toLocaleLowerCase("zh-CN").includes(needle)).forEach(task => results.push({ type: "project-task", task, project }));
  });
  return results;
}
