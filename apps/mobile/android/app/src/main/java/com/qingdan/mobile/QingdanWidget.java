package com.qingdan.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class QingdanWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) manager.updateAppWidget(id, views(context));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, QingdanWidget.class);
        for (int id : manager.getAppWidgetIds(component)) manager.updateAppWidget(id, views(context));
    }

    private static RemoteViews views(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.qingdan_widget);
        List<JSONObject> tasks = activeTodos(context);
        views.setTextViewText(R.id.widget_title, "清单 · 待办 " + tasks.size());
        int[] fields = {R.id.widget_task_1, R.id.widget_task_2};
        for (int i = 0; i < fields.length; i++) {
            String text = i < tasks.size() ? dot(tasks.get(i)) + "  " + tasks.get(i).optString("name") : (i == 0 ? "暂时没有待办" : "");
            views.setTextViewText(fields[i], text);
        }
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_title, pending);
        for (int field : fields) views.setOnClickPendingIntent(field, pending);
        return views;
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
                .thenComparingInt(task -> priority(task.optString("priority"))));
        return result;
    }

    private static int priority(String value) {
        if ("important".equals(value)) return 0;
        if ("normal".equals(value)) return 1;
        return 2;
    }

    private static String dot(JSONObject task) {
        String priority = task.optString("priority");
        if ("important".equals(priority)) return "●";
        if ("normal".equals(priority)) return "•";
        return "·";
    }
}
