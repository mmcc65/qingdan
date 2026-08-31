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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class QingdanWidget extends AppWidgetProvider {
    private static final String ACTION_COMPLETE = "com.qingdan.mobile.WIDGET_COMPLETE";
    private static final String EXTRA_TASK_ID = "task_id";
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
    public void onReceive(Context context, Intent intent) {
        if (ACTION_COMPLETE.equals(intent.getAction())) {
            complete(context, intent.getStringExtra(EXTRA_TASK_ID));
            return;
        }
        super.onReceive(context, intent);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, QingdanWidget.class);
        for (int id : manager.getAppWidgetIds(component)) update(context, manager, id);
    }

    private static void update(Context context, AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 115);
        manager.updateAppWidget(id, views(context, visibleRows(height)));
    }

    private static int visibleRows(int height) {
        if (height >= 225) return 7;
        if (height >= 195) return 6;
        if (height >= 165) return 5;
        if (height >= 135) return 4;
        return 3;
    }

    private static RemoteViews views(Context context, int capacity) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.qingdan_widget);
        List<JSONObject> tasks = activeTodos(context);
        views.setTextViewText(R.id.widget_title, "清单 · 待办 " + tasks.size());
        PendingIntent open = PendingIntent.getActivity(context, 0,
                new Intent(context, MainActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, open);
        views.setOnClickPendingIntent(R.id.widget_title, open);
        for (int i = 0; i < ROWS.length; i++) {
            boolean shown = i < capacity && i < tasks.size();
            views.setViewVisibility(ROWS[i], shown ? View.VISIBLE : View.GONE);
            if (!shown) continue;
            JSONObject task = tasks.get(i);
            String taskId = task.optString("id");
            views.setTextViewText(TASKS[i], task.optString("name"));
            views.setTextViewText(CHECKS[i], "○");
            views.setOnClickPendingIntent(TASKS[i], open);
            Intent complete = new Intent(context, QingdanWidget.class)
                    .setAction(ACTION_COMPLETE)
                    .putExtra(EXTRA_TASK_ID, taskId);
            PendingIntent completePending = PendingIntent.getBroadcast(context,
                    taskId.hashCode() & 0x7fffffff, complete,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(CHECKS[i], completePending);
        }
        return views;
    }

    private static void complete(Context context, String taskId) {
        if (taskId == null || taskId.isBlank()) return;
        try {
            JSONObject state = new JSONObject(StateStore.load(context));
            JSONArray tasks = state.optJSONArray("tasks");
            if (tasks == null) return;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null || !taskId.equals(task.optString("id"))
                        || !"todo".equals(task.optString("kind"))
                        || !"active".equals(task.optString("status", "active"))) continue;
                long now = System.currentTimeMillis();
                task.put("status", "completed");
                task.put("completedAt", now);
                state.put("cloudUpdatedAt", now);
                String json = state.toString();
                StateStore.save(context, json);
                AlarmScheduler.scheduleAll(context, json);
                updateAll(context);
                return;
            }
        } catch (Exception ignored) {
        }
    }

    private static List<JSONObject> activeTodos(Context context) {
        List<JSONObject> result = new ArrayList<>();
        try {
            JSONArray tasks = new JSONObject(StateStore.load(context)).optJSONArray("tasks");
            if (tasks != null) for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task != null && "todo".equals(task.optString("kind")) && "active".equals(task.optString("status", "active"))) result.add(task);
            }
        } catch (Exception ignored) {
        }
        result.sort(Comparator
                .comparing((JSONObject task) -> !task.optBoolean("pinned"))
                .thenComparingInt(task -> priority(task.optString("priority")))
                .thenComparingInt(task -> task.optInt("order")));
        return result;
    }

    private static int priority(String value) {
        if ("important".equals(value)) return 0;
        if ("normal".equals(value)) return 1;
        return 2;
    }
}
