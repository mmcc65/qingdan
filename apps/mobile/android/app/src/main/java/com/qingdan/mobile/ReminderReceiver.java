package com.qingdan.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 1);
        String name = intent.getStringExtra("name");
        long occurrenceAt = intent.getLongExtra("occurrenceAt", System.currentTimeMillis());
        StateStore.markDelivered(context, id, occurrenceAt);
        NotificationHelper.show(context, id, "清单提醒", name == null ? "有任务需要处理" : name);

        if (intent.getBooleanExtra("repeatSchedule", false)) {
            String taskId = intent.getStringExtra("repeatTaskId");
            int scheduleIndex = intent.getIntExtra("repeatScheduleIndex", -1);
            if (taskId != null && scheduleIndex >= 0) {
                AlarmScheduler.scheduleNextRepeat(context, taskId, scheduleIndex);
            }
            return;
        }

        long interval = intent.getLongExtra("intervalMs", 0);
        long endAt = intent.getLongExtra("endAt", 0);
        long nextOccurrence = occurrenceAt + interval;
        long now = System.currentTimeMillis();
        if (interval > 0 && nextOccurrence <= now) {
            nextOccurrence += ((now - nextOccurrence) / interval + 1) * interval;
        }
        if (interval > 0 && (endAt == 0 || nextOccurrence <= endAt)) {
            AlarmScheduler.schedule(context, id, name, nextOccurrence, nextOccurrence, interval, endAt);
        }
    }
}
