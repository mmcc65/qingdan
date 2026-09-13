import { Context } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';

const STORE_NAME: string = 'qingdan_native';
const STATE_KEY: string = 'state_json';

export interface QingdanItem {
  id: string;
  name?: string;
  content?: string;
  notes?: string;
  node?: string;
  priority?: string;
  kind?: string;
  rule?: string;
  status?: string;
  pinned?: boolean;
  order?: number;
  completedAt?: number;
  lastCompletedAt?: number;
  recordedAt?: number;
}

export interface QingdanProject extends QingdanItem {
  tasks?: QingdanItem[];
  projects?: QingdanProject[];
}

export interface QingdanState {
  version?: number;
  tasks?: QingdanItem[];
  schedules?: QingdanItem[];
  memos?: QingdanItem[];
  projects?: QingdanProject[];
  history?: QingdanItem[];
  cloudUpdatedAt?: number;
}

export interface CardItem {
  id: string;
  title: string;
  notes: string;
  node: string;
  priority: string;
  pinned: boolean;
}

export interface CardPage {
  key: string;
  label: string;
  items: CardItem[];
}

export interface CardPayload {
  pages: CardPage[];
}

function emptyState(): QingdanState {
  return {
    version: 1,
    tasks: [],
    schedules: [],
    memos: [],
    projects: [],
    history: [],
    cloudUpdatedAt: 0
  };
}

function parseState(stateJson: string): QingdanState {
  try {
    const parsed = JSON.parse(stateJson) as QingdanState;
    parsed.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    parsed.schedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];
    parsed.memos = Array.isArray(parsed.memos) ? parsed.memos : [];
    parsed.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
    return parsed;
  } catch (_) {
    return emptyState();
  }
}

function priorityRank(priority?: string): number {
  if (priority === 'important') return 0;
  if (priority === 'normal') return 1;
  return 2;
}

function ordered(items: QingdanItem[], usePriority: boolean = true): QingdanItem[] {
  return items.slice().sort((left: QingdanItem, right: QingdanItem): number => {
    const leftPinned = left.pinned === true ? 0 : 1;
    const rightPinned = right.pinned === true ? 0 : 1;
    if (leftPinned !== rightPinned) return leftPinned - rightPinned;
    if (usePriority) {
      const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
      if (priorityDelta !== 0) return priorityDelta;
    }
    const orderDelta = (left.order ?? 0) - (right.order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return (left.node ?? '').localeCompare(right.node ?? '');
  });
}

function todayKey(): string {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toCardItem(item: QingdanItem): CardItem {
  return {
    id: item.id,
    title: item.content ?? item.name ?? '未命名',
    notes: item.notes ?? '',
    node: item.node ?? '',
    priority: item.priority ?? 'later',
    pinned: item.pinned === true
  };
}

function active(item: QingdanItem): boolean {
  return (item.status ?? 'active') === 'active';
}

export function buildCardPayload(stateJson: string): string {
  const state = parseState(stateJson);
  const tasks = state.tasks ?? [];
  const schedules = state.schedules ?? [];
  const memos = state.memos ?? [];
  const projects = state.projects ?? [];
  const today = todayKey();

  const todoItems = ordered(tasks.filter((item: QingdanItem): boolean => active(item) && item.kind === 'todo'));
  const repeatItems = ordered(tasks.filter((item: QingdanItem): boolean => active(item) && item.kind === 'repeat'));
  const projectItems = ordered(projects.filter((item: QingdanProject): boolean => active(item)), false);
  const scheduleItems = ordered(schedules.filter((item: QingdanItem): boolean =>
    active(item) && (item.node ?? '').slice(0, 10) === today), false);
  const memoItems = ordered(memos, false);

  const payload: CardPayload = {
    pages: [
      { key: 'todo', label: '待办', items: todoItems.map(toCardItem) },
      { key: 'repeat', label: '重复', items: repeatItems.map(toCardItem) },
      { key: 'projects', label: '项目', items: projectItems.map(toCardItem) },
      { key: 'schedule', label: '日程', items: scheduleItems.map(toCardItem) },
      { key: 'memo', label: '随笔', items: memoItems.map(toCardItem) }
    ]
  };
  return JSON.stringify(payload);
}

function findActive(items: QingdanItem[], itemId: string, kind?: string): QingdanItem | undefined {
  return items.find((item: QingdanItem): boolean =>
    item.id === itemId && active(item) && (!kind || item.kind === kind));
}

export function completeCardItem(stateJson: string, page: string, itemId: string): string {
  const state = parseState(stateJson);
  const now = Date.now();
  let item: QingdanItem | undefined;

  if (page === 'projects') {
    item = findActive(state.projects ?? [], itemId);
  } else if (page === 'schedule') {
    item = findActive(state.schedules ?? [], itemId);
  } else if (page === 'repeat') {
    item = findActive(state.tasks ?? [], itemId, 'repeat');
    if (item) {
      item.lastCompletedAt = now;
      const history = state.history ?? [];
      history.push({
        id: `history_widget_${now}`,
        name: item.name ?? '',
        kind: 'repeat',
        rule: item.rule ?? '',
        status: 'completed',
        recordedAt: now
      });
      state.history = history;
    }
  } else if (page === 'todo') {
    item = findActive(state.tasks ?? [], itemId, 'todo');
  }

  if (!item) return stateJson;
  if (page !== 'repeat') {
    item.status = 'completed';
    item.completedAt = now;
  }
  state.cloudUpdatedAt = now;
  return JSON.stringify(state);
}

export class NativeState {
  static read(context: Context): string {
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      const value = store.getSync(STATE_KEY, '{}');
      return typeof value === 'string' ? value : '{}';
    } catch (_) {
      return '{}';
    }
  }

  static async write(context: Context, stateJson: string): Promise<void> {
    try {
      const store = await preferences.getPreferences(context, { name: STORE_NAME });
      await store.put(STATE_KEY, stateJson);
      await store.flush();
    } catch (_) {
      // Keep the web copy as the source of truth if native persistence is unavailable.
    }
  }
}
