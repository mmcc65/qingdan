const CONFIG_KEY = "qingdan.cloud.config.v1";
const DEVICE_KEY = "qingdan.device.id.v1";
const INITIALIZED_PREFIX = "qingdan.cloud.initialized.";

let client = null;
let channel = null;
let currentUser = null;
let callbacks = null;
let pushTimer = null;
let applyingRemote = false;
let lastPushedStamp = 0;

function config() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; }
  catch { return null; }
}

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, value); }
  return value;
}

function setStatus(text, kind = "idle") {
  callbacks?.onStatus?.({ text, kind, user: currentUser });
}

function validateConfig(url, key) {
  const normalizedUrl = url.trim().replace(/\/$/, "");
  const normalizedKey = key.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalizedUrl)) throw new Error("Project URL 格式不正确");
  if (!(normalizedKey.startsWith("sb_publishable_") || normalizedKey.startsWith("eyJ"))) throw new Error("请填写 Publishable key，不要填写 Secret key");
  return { url: normalizedUrl, key: normalizedKey };
}

export function getCloudConfig() { return config(); }

export async function saveCloudConfig(url, key) {
  const value = validateConfig(url, key);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
  await initializeClient();
  return value;
}

export async function initializeCloud(options) {
  callbacks = options;
  if (!config()) { setStatus("尚未配置", "idle"); return; }
  await initializeClient();
}

async function initializeClient() {
  const value = config();
  if (!value || !globalThis.supabase?.createClient) { setStatus("同步组件不可用", "error"); return; }
  if (channel && client) await client.removeChannel(channel);
  client = globalThis.supabase.createClient(value.url, value.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "qingdan.supabase.auth" }
  });
  client.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    callbacks?.onAuth?.(currentUser);
    if (event === "SIGNED_IN" && currentUser) connectUser().catch(error => setStatus(error.message, "error"));
    if (event === "SIGNED_OUT") { disconnectRealtime(); setStatus("已退出登录", "idle"); }
  });
  const { data, error } = await client.auth.getSession();
  if (error) { setStatus("连接配置无效", "error"); return; }
  currentUser = data.session?.user || null;
  callbacks?.onAuth?.(currentUser);
  setStatus(currentUser ? "正在连接…" : "等待登录", currentUser ? "syncing" : "idle");
  if (currentUser) await connectUser();
}

export async function signUp(email, password) {
  if (!client) throw new Error("请先保存连接配置");
  setStatus("正在注册…", "syncing");
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  if (!data.session) setStatus("注册成功，请查收验证邮件", "idle");
  return data;
}

export async function signIn(email, password) {
  if (!client) throw new Error("请先保存连接配置");
  setStatus("正在登录…", "syncing");
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function connectUser() {
  if (!client || !currentUser) return;
  await initialSync();
  await subscribeRealtime();
  setStatus("已同步", "online");
}

async function initialSync() {
  setStatus("正在同步…", "syncing");
  const { data, error } = await client.from("qingdan_entities").select("payload, revision, device_id").eq("id", currentUser.id).maybeSingle();
  if (error) throw error;
  const initializedKey = INITIALIZED_PREFIX + currentUser.id;
  const initialized = localStorage.getItem(initializedKey) === "true";
  if (data?.payload?.state && !initialized) {
    applyingRemote = true;
    try { callbacks?.replaceState?.(data.payload.state); }
    finally { applyingRemote = false; }
    lastPushedStamp = Number(data.payload.stamp) || 0;
  } else if (!data) {
    await pushNow();
  } else if (initialized) {
    const remoteStamp = Number(data.payload?.stamp) || 0;
    const localStamp = Number(callbacks?.getState?.()?.cloudUpdatedAt) || 0;
    if (remoteStamp > localStamp && data.payload?.state) {
      applyingRemote = true;
      try { callbacks?.replaceState?.(data.payload.state); }
      finally { applyingRemote = false; }
      lastPushedStamp = remoteStamp;
    } else if (localStamp > remoteStamp) await pushNow();
  }
  localStorage.setItem(initializedKey, "true");
}

async function subscribeRealtime() {
  await disconnectRealtime();
  channel = client.channel(`qingdan:${currentUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "qingdan_entities", filter: `user_id=eq.${currentUser.id}` }, payload => {
      if (payload.new?.id === currentUser.id && payload.new?.device_id !== deviceId()) pullNow().catch(error => setStatus(error.message, "error"));
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") setStatus("已同步", "online");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("实时连接中断，将自动重试", "error");
    });
}

async function disconnectRealtime() {
  if (channel && client) await client.removeChannel(channel);
  channel = null;
}

export function scheduleCloudPush() {
  if (applyingRemote || !client || !currentUser) return;
  clearTimeout(pushTimer);
  setStatus("等待同步…", "syncing");
  pushTimer = setTimeout(() => pushNow().catch(error => setStatus(error.message, "error")), 800);
}

export async function pushNow() {
  if (!client || !currentUser) throw new Error("尚未登录");
  const state = structuredClone(callbacks.getState());
  const stamp = Number(state.cloudUpdatedAt) || Date.now();
  setStatus("正在上传…", "syncing");
  const row = { id: currentUser.id, user_id: currentUser.id, entity_type: "setting", payload: { schemaVersion: 1, stamp, state }, device_id: deviceId(), deleted_at: null };
  const { error } = await client.from("qingdan_entities").upsert(row, { onConflict: "id" });
  if (error) throw error;
  lastPushedStamp = stamp;
  setStatus("已同步", "online");
}

export async function pullNow() {
  if (!client || !currentUser) throw new Error("尚未登录");
  setStatus("正在下载…", "syncing");
  const { data, error } = await client.from("qingdan_entities").select("payload, device_id").eq("id", currentUser.id).single();
  if (error) throw error;
  const stamp = Number(data.payload?.stamp) || 0;
  if (data.payload?.state && stamp > lastPushedStamp) {
    applyingRemote = true;
    try { callbacks.replaceState(data.payload.state); }
    finally { applyingRemote = false; }
    lastPushedStamp = stamp;
  }
  setStatus("已同步", "online");
}

export async function syncNow() {
  if (!currentUser) throw new Error("请先登录");
  await pullNow().catch(() => {});
  await pushNow();
}

export function isApplyingRemote() { return applyingRemote; }
