import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, normalizeState, sortTasks, postponeDate, formatNode, searchState, flattenProjects, findProject, collectProjectTasks } from "../apps/web/src/core.mjs";
import { resolveUpdateManifest, resolveUpdateManifests } from "../apps/web/src/release-config.js";

test("creates a valid initial state", () => {
  const state = createInitialState();
  assert.equal(state.version, 1);
  assert.ok(state.tasks.length >= 1);
  assert.ok(Array.isArray(state.projects));
});

test("normalizes invalid persisted data", () => {
  assert.ok(normalizeState(null).tasks.length);
  assert.deepEqual(normalizeState({ tasks: [], projects: [] }).history, []);
  assert.deepEqual(normalizeState({ tasks: [], projects: [{ id: "old", tasks: [] }] }).projects[0].projects, []);
  assert.equal(normalizeState({ tasks: [], projects: [{ id: "old", tasks: [] }] }).projects[0].status, "active");
});

test("walks nested projects and their tasks", () => {
  const projects = [{ id: "root", tasks: [{ id: "a" }], projects: [{ id: "child", tasks: [{ id: "b" }], projects: [{ id: "leaf", tasks: [{ id: "c" }], projects: [] }] }] }];
  assert.deepEqual(flattenProjects(projects).map(({ project }) => project.id), ["root", "child", "leaf"]);
  assert.equal(findProject(projects, "child").parent.id, "root");
  assert.deepEqual(collectProjectTasks(projects).map(({ task }) => task.id), ["a", "b", "c"]);
});

test("sort order is pinned, then manual order, then node", () => {
  const tasks = [
    { id: "late", pinned: false, node: "2026-08-14T10:00", order: 0 },
    { id: "pin", pinned: true, node: "", order: 2 },
    { id: "early", pinned: false, node: "2026-08-13T10:00", order: 1 }
  ];
  assert.deepEqual(sortTasks(tasks).map(t => t.id), ["pin", "late", "early"]);
});

test("postpone presets produce expected days", () => {
  const base = new Date(2026, 7, 13, 22, 0);
  assert.match(postponeDate("tomorrow", base), /^2026-08-14T09:00$/);
  assert.match(postponeDate("day-after", base), /^2026-08-15T09:00$/);
  assert.match(postponeDate("next-week", base), /^2026-08-20T09:00$/);
});

test("formats nearby nodes in plain Chinese", () => {
  const now = new Date(2026, 7, 13, 8, 0);
  assert.equal(formatNode("2026-08-14T09:30", now), "明天 09:30");
});

test("search includes tasks, notes and nested project tasks", () => {
  const state = { tasks: [{ id: "a", kind: "todo", name: "调 PID", notes: "", status: "active" }], projects: [{ id: "p", name: "小车", tasks: [], projects: [{ id: "sub", name: "底盘", tasks: [{ id: "b", name: "测试电机", notes: "PID", status: "active" }], projects: [] }] }] };
  assert.equal(searchState(state, "PID").length, 2);
  assert.equal(searchState(state, "底盘")[0].project.id, "sub");
});

test("uses official update manifests with a legacy Supabase fallback", () => {
  assert.equal(
    resolveUpdateManifest("desktop"),
    "https://github.com/mmcc65/qingdan/releases/latest/download/desktop-latest.json"
  );
  assert.equal(
    resolveUpdateManifest("desktop", "https://example.supabase.co/", {}),
    "https://example.supabase.co/storage/v1/object/public/qingdan-releases/desktop-latest.json"
  );
  assert.equal(
    resolveUpdateManifest("mobile", "https://example.supabase.co", {}),
    "https://example.supabase.co/storage/v1/object/public/qingdan-releases/latest.json"
  );
  assert.equal(resolveUpdateManifest("desktop", "", {}), "");
  assert.deepEqual(resolveUpdateManifests("mobile"), [
    "https://isenfwmwaojwujfmmzoc.supabase.co/storage/v1/object/public/qingdan-releases/latest.json",
    "https://github.com/mmcc65/qingdan/releases/latest/download/latest.json"
  ]);
  assert.deepEqual(
    resolveUpdateManifests("mobile", "https://isenfwmwaojwujfmmzoc.supabase.co"),
    [
      "https://isenfwmwaojwujfmmzoc.supabase.co/storage/v1/object/public/qingdan-releases/latest.json",
      "https://github.com/mmcc65/qingdan/releases/latest/download/latest.json"
    ]
  );
});
