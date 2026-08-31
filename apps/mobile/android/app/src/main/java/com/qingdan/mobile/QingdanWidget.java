package com.qingdan.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class QingdanWidget extends AppWidgetProvider {
    private static final String ACTION_COMPLETE = "com.qingdan.mobile.WIDGET_COMPLETE";
    private static final String ACTION_PAGE = "com.qingdan.mobile.WIDGET_PAGE";
    private static final String EXTRA_TASK_ID = "task_id";
    private static final String EXTRA_PAGE = "page";
    private static final String EXTRA_DELTA = "delta";
    private static final String EXTRA_WIDGET_ID = "widget_id";
    private static final String PAGE_PREFS = "qingdan_widget_pages";
    private static final String[] PAGES = {"todo", "repeat", "projects", "schedule"};
    private static final String[] LABELS = {"待办", "重复", "项目", "日程"};
    private static final int[] ROWS = {R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3,
            R.id.widget_row_4, R.id.widget_row_5, R.id.widget_row_6, R.id.widget_row_7};
    private static final int[] CHECKS = {R.id.widget_complete_1, R.id.widget_complete_2,
            R.id.widget_complete_3, R.id.widget_complete_4, R.id.widget_complete_5,
            R.id.widget_complete_6, R.id.widget_complete_7};
    private static final int[] TASKS = {R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3,
            R.id.widget_task_4, R.id.widget_task_5, R.id.widget_task_6, R.id.widget_task_7};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) update(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int appWidgetId, Bundle newOptions) {
        update(context, manager, appWidgetId);
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        android.content.SharedPreferences.Editor editor = context
                .getSharedPreferences(PAGE_PREFS, Context.MODE_PRIVATE).edit();
        for (int id : appWidgetIds) editor.remove(pageKey(id));
        editor.apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_PAGE.equals(intent.getAction())) {
            int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int delta = intent.getIntExtra(EXTRA_DELTA, 1);
            if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) changePage(context, widgetId, delta);
            return;
        }
        if (ACTION_COMPLETE.equals(intent.getAction())) {
            complete(context, intent.getStringExtra(EXTRA_TASK_ID), intent.getStringExtra(EXTRA_PAGE));
            return;
        }
        super.onReceive(context, intent);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, QingdanWidget.class);
        for (int id : manager.getAppWidgetIds(component)) update(context, manager, id);
    }

    private static void changePage(Context context, int widgetId, int delta) {
        int next = Math.floorMod(selectedPage(context, widgetId) + delta, PAGES.length);
        context.getSharedPreferences(PAGE_PREFS, Context.MODE_PRIVATE)
                .edit().putInt(pageKey(widgetId), next).apply();
        update(context, AppWidgetManager.getInstance(context), widgetId);
    }

    private static int selectedPage(Context context, int widgetId) {
        int page = context.getSharedPreferences(PAGE_PREFS, Context.MODE_PRIVATE)
                .getInt(pageKey(widgetId), 0);
        return page >= 0 && page < PAGES.length ? page : 0;
    }

    private static String pageKey(int widgetId) {
        return "page_" + widgetId;
    }

    private static void update(Context context, AppWidgetManager manager, int id) {
        manager.updateAppWidget(id, views(context, id));
    }

    private static RemoteViews views(Context context, int widgetId) {
        int pageIndex = selectedPage(context, widgetId);
        String page = PAGES[pageIndex];
        List<JSONObject> items = activeItems(context, page);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.qingdan_widget);
        views.setTextViewText(R.id.widget_title, "清单 · " + LABELS[pageIndex] + " " + items.size());

        PendingIntent open = PendingIntent.getActivity(context, 0,
                new Intent(context, MainActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, open);
        views.setOnClickPendingIntent(R.id.widget_title, open);
        views.setOnClickPendingIntent(R.id.widget_previous, pagePending(context, widgetId, -1));
        views.setOnClickPendingIntent(R.id.widget_next, pagePending(context, widgetId, 1));

        for (int i = 0; i < ROWS.length; i++) {
            boolean shown = i < items.size();
            views.setViewVisibility(ROWS[i], shown ? View.VISIBLE : View.GONE);
            if (!shown) continue;
            JSONObject item = items.get(i);
            String itemId = item.optString("id");
            views.setTextViewText(TASKS[i], item.optString("name"));
            views.setTextViewText(CHECKS[i], "○");
            views.setOnClickPendingIntent(TASKS[i], open);
            Intent complete = new Intent(context, QingdanWidget.class)
                    .setAction(ACTION_COMPLETE)
                    .putExtra(EXTRA_TASK_ID, itemId)
                    .putExtra(EXTRA_PAGE, page);
            PendingIntent completePending = PendingIntent.getBroadcast(context,
                    (page + "|" + itemId).hashCode() & 0x7fffffff, complete,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(CHECKS[i], completePending);
        }
        return views;
    }

    private static PendingIntent pagePending(Context context, int widgetId, int delta) {
        Intent intent = new Intent(context, QingdanWidget.class)
                .setAction(ACTION_PAGE)
                .putExtra(EXTRA_WIDGET_ID, widgetId)
                .putExtra(EXTRA_DELTA, delta);
        int requestCode = (widgetId + "|page|" + delta).hashCode() & 0x7fffffff;
        return PendingIntent.getBroadcast(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static List<JSONObject> activeItems(Context context, String page) {
        List<JSONObject> result = new ArrayList<>();
        try {
            JSONObject state = new JSONObject(StateStore.load(context));
            JSONArray source = "projects".equals(page) ? state.optJSONArray("projects")
                    : "schedule".equals(page) ? state.optJSONArray("schedules")
                    : state.optJSONArray("tasks");
            if (source != null) for (int i = 0; i < source.length(); i++) {
                JSONObject item = source.optJSONObject(i);
                if (item == null || !"active".equals(item.optString("status", "active"))) continue;
                if ("todo".equals(page) && !"todo".equals(item.optString("kind"))) continue;
                if ("repeat".equals(page) && !"repeat".equals(item.optString("kind"))) continue;
                String node = item.optString("node");
                String nodeDate = node.length() >= 10 ? node.substring(0, 10) : node;
                if ("schedule".equals(page) && !LocalDate.now().toString().equals(nodeDate)) continue;
                result.add(item);
            }
        } catch (Exception ignored) {
        }
        if ("schedule".equals(page)) {
            result.sort(Comparator.comparing(item -> item.optString("node")));
        } else {
            result.sort(Comparator
                    .comparing((JSONObject item) -> !item.optBoolean("pinned"))
                    .thenComparingInt(item -> "projects".equals(page) ? 0 : priority(item.optString("priority")))
                    .thenComparingInt(item -> item.optInt("order")));
        }
        return result;
    }

    private static void complete(Context context, String itemId, String page) {
        if (itemId == null || itemId.isBlank() || page == null) return;
        try {
            JSONObject state = new JSONObject(StateStore.load(context));
            long now = System.currentTimeMillis();
            boolean changed;
            if ("projects".equals(page)) {
                changed = markCompleted(state.optJSONArray("projects"), itemId, now);
            } else if ("schedule".equals(page)) {
                changed = markCompleted(state.optJSONArray("schedules"), itemId, now);
            } else if ("repeat".equals(page)) {
                JSONObject task = findActive(state.optJSONArray("tasks"), itemId, "repeat");
                changed = task != null;
                if (task != null) {
                    task.put("lastCompletedAt", now);
                    JSONArray history = state.optJSONArray("history");
                    if (history == null) {
                        history = new JSONArray();
                        state.put("history", history);
                    }
                    history.put(new JSONObject()
                            .put("id", "history_widget_" + now)
                            .put("sourceId", task.optString("id"))
                            .put("kind", "repeat")
                            .put("name", task.optString("name"))
                            .put("rule", task.optString("rule"))
                            .put("status", "completed")
                            .put("recordedAt", now));
                }
            } else {
                JSONObject task = findActive(state.optJSONArray("tasks"), itemId, "todo");
                changed = task != null;
                if (task != null) {
                    task.put("status", "completed");
                    task.put("completedAt", now);
                }
            }
            if (!changed) return;
            state.put("cloudUpdatedAt", now);
            String json = state.toString();
            StateStore.save(context, json);
            AlarmScheduler.scheduleAll(context, json);
            updateAll(context);
            Toast.makeText(context, "repeat".equals(page) ? "已完成本次" : "已完成", Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) {
        }
    }

    private static boolean markCompleted(JSONArray items, String itemId, long now) throws Exception {
        JSONObject item = findActive(items, itemId, null);
        if (item == null) return false;
        item.put("status", "completed");
        item.put("completedAt", now);
        return true;
    }

    private static JSONObject findActive(JSONArray items, String itemId, String kind) {
        if (items == null) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null || !itemId.equals(item.optString("id"))
                    || !"active".equals(item.optString("status", "active"))) continue;
            if (kind == null || kind.equals(item.optString("kind"))) return item;
        }
        return null;
    }

    private static int priority(String value) {
        if ("important".equals(value)) return 0;
        if ("normal".equals(value)) return 1;
        return 2;
    }
}
