package com.qingdan.mobile;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public final class QingdanWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getStringExtra(QingdanWidget.EXTRA_PAGE));
    }

    private static final class Factory implements RemoteViewsFactory {
        private final Context context;
        private final String page;
        private List<JSONObject> items = new ArrayList<>();

        Factory(Context context, String page) {
            this.context = context;
            this.page = page == null ? "todo" : page;
        }

        @Override public void onCreate() { onDataSetChanged(); }
        @Override public void onDataSetChanged() { items = QingdanWidget.activeItems(context, page); }
        @Override public void onDestroy() { items.clear(); }
        @Override public int getCount() { return items.size(); }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= items.size()) return null;
            JSONObject item = items.get(position);
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.qingdan_widget_item);
            boolean memo = "memo".equals(page);
            boolean showsPriority = "todo".equals(page) || "repeat".equals(page);
            String text = memo ? (position + 1) + ". " + item.optString("content") : item.optString("name");
            if (memo && !item.optString("notes").isBlank()) text += " · 有备注";
            if (item.optBoolean("pinned")) text = "⌃ " + text;
            row.setTextViewText(R.id.widget_task, text);
            row.setViewVisibility(R.id.widget_complete, memo ? View.GONE : View.VISIBLE);
            row.setViewVisibility(R.id.widget_priority, showsPriority ? View.VISIBLE : View.GONE);
            if (showsPriority) row.setTextColor(R.id.widget_priority, QingdanWidget.priorityColor(item.optString("priority")));

            Intent open = new Intent()
                    .putExtra(QingdanWidget.EXTRA_ITEM_ACTION, QingdanWidget.ITEM_OPEN)
                    .putExtra(QingdanWidget.EXTRA_PAGE, page);
            row.setOnClickFillInIntent(R.id.widget_item_root, open);
            if (!memo) {
                Intent complete = new Intent()
                        .putExtra(QingdanWidget.EXTRA_ITEM_ACTION, QingdanWidget.ITEM_COMPLETE)
                        .putExtra(QingdanWidget.EXTRA_TASK_ID, item.optString("id"))
                        .putExtra(QingdanWidget.EXTRA_PAGE, page);
                row.setOnClickFillInIntent(R.id.widget_complete, complete);
            }
            return row;
        }

        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int position) { return items.get(position).optString("id").hashCode() & 0xffffffffL; }
        @Override public boolean hasStableIds() { return true; }
    }
}
