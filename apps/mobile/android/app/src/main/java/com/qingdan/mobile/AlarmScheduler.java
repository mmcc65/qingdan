package com.qingdan.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

final class AlarmScheduler {
    private static final long CATCH_UP_WINDOW_MS = 86_400_000L;

    private AlarmScheduler() {}

    static void scheduleAll(Context context, String json) {
        cancelAll(context);
        List<Integer> scheduled = new ArrayList<>();
        try {
            JSONObject state = new JSONObject(json);
            scheduleArray(context, state.optJSONArray("tasks"), scheduled);
            scheduleArray(context, state.optJSONArray("schedules"), scheduled);
            JSONArray projects = state.optJSONArray("projects");
            scheduleProjects(context, projects, scheduled);
        } catch (Exception ignored) {
        }
        StateStore.saveAlarmIds(context, join(scheduled));
    }

    private static void scheduleProjects(Context context, JSONArray projects, List<Integer> scheduled) {
        if (projects == null) return;
        for (int i = 0; i < projects.length(); i++) {
            JSONObject project = projects.optJSONObject(i);
            if (project == null) continue;
            scheduleArray(context, project.optJSONArray("tasks"), scheduled);
            scheduleProjects(context, project.optJSONArray("projects"), scheduled);
        }
    }

    private static void scheduleArray(Context context, JSONArray tasks, List<Integer> scheduled) {
        if (tasks == null) return;
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject task = tasks.optJSONObject(i);
            if (task == null || !"active".equals(task.optString("status", "active"))) continue;
            JSONObject reminder = task.optJSONObject("reminder");
            if (reminder == null) continue;
            String mode = reminder.optString("mode", "none");
            boolean repeatTask = "repeat".equals(task.optString("kind"));
            if ("single".equals(mode) && repeatTask) {
                scheduleRepeatSchedules(context, task, scheduled);
            }
            int id = task.optString("id", task.optString("name")).hashCode() & 0x7fffffff;
            long trigger = 0;
            long occurrenceAt = 0;
            long intervalMs = 0;
            long endAt = 0;
            if ("single".equals(mode)) {
                occurrenceAt = parseTime(reminder.optString("at"));
                if (occurrenceAt == 0 && !repeatTask) occurrenceAt = parseTime(task.optString("node"));
                if (occurrenceAt <= StateStore.deliveredAt(context, id)) continue;
                trigger = catchUpOrFuture(occurrenceAt);
            } else if ("interval".equals(mode)) {
                JSONArray slots = reminder.optJSONArray("slots");
                if (slots == null || slots.length() == 0) {
                    scheduleInterval(context, task, id, reminder, scheduled);
                } else {
                    for (int slotIndex = 0; slotIndex < slots.length(); slotIndex++) {
                        JSONObject slot = slots.optJSONObject(slotIndex);
                        if (slot != null) scheduleInterval(context, task, slotId(task, slotIndex), slot, scheduled);
                    }
                }
                continue;
            }
            if (trigger == 0) continue;
            try {
                schedule(context, id, task.optString("name", "清单任务"),
                        trigger, occurrenceAt, intervalMs, endAt);
                scheduled.add(id);
            } catch (RuntimeException ignored) {
                // One malformed task must not prevent every other reminder from being registered.
            }
        }
    }

    private static void scheduleRepeatSchedules(Context context, JSONObject task,
                                                List<Integer> scheduled) {
        JSONArray schedules = task.optJSONArray("repeatSchedules");
        if (schedules == null) return;
        String taskId = task.optString("id", task.optString("name"));
        for (int scheduleIndex = 0; scheduleIndex < schedules.length(); scheduleIndex++) {
            JSONObject repeatSchedule = schedules.optJSONObject(scheduleIndex);
            if (repeatSchedule == null) continue;
            int id = repeatSlotId(task, scheduleIndex);
            long occurrenceAt = nextRepeatOccurrence(task, repeatSchedule,
                    StateStore.deliveredAt(context, id));
            long trigger = catchUpOrFuture(occurrenceAt);
            if (trigger == 0) continue;
            try {
                scheduleRepeat(context, id, task.optString("name", "清单任务"), trigger,
                        occurrenceAt, taskId, scheduleIndex);
                scheduled.add(id);
            } catch (RuntimeException ignored) {
                // One malformed repeat rule must not prevent other reminders.
            }
        }
    }

    static void scheduleNextRepeat(Context context, String taskId, int scheduleIndex) {
        try {
            JSONObject state = new JSONObject(StateStore.load(context));
            JSONArray tasks = state.optJSONArray("tasks");
            if (tasks == null) return;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null || !taskId.equals(task.optString("id"))
                        || !"active".equals(task.optString("status", "active"))
                        || !"repeat".equals(task.optString("kind"))) continue;
                JSONObject reminder = task.optJSONObject("reminder");
                if (reminder == null || !"single".equals(reminder.optString("mode"))) return;
                JSONArray schedules = task.optJSONArray("repeatSchedules");
                JSONObject repeatSchedule = schedules == null ? null : schedules.optJSONObject(scheduleIndex);
                if (repeatSchedule == null) return;
                int id = repeatSlotId(task, scheduleIndex);
                long occurrenceAt = nextRepeatOccurrence(task, repeatSchedule,
                        StateStore.deliveredAt(context, id));
                long trigger = catchUpOrFuture(occurrenceAt);
                if (trigger > 0) {
                    scheduleRepeat(context, id, task.optString("name", "清单任务"), trigger,
                            occurrenceAt, taskId, scheduleIndex);
                }
                return;
            }
        } catch (Exception ignored) {
        }
    }

    private static long nextRepeatOccurrence(JSONObject task, JSONObject schedule, long deliveredAt) {
        LocalTime time;
        try {
            time = LocalTime.parse(schedule.optString("time"));
        } catch (DateTimeParseException ignored) {
            return 0;
        }
        LocalDate today = LocalDate.now();
        LocalDate anchor = repeatAnchor(task, today);
        LocalDate firstDate = today.minusDays(1);
        if (firstDate.isBefore(anchor)) firstDate = anchor;
        long earliestAllowed = System.currentTimeMillis() - CATCH_UP_WINDOW_MS;
        String rule = schedule.optString("rule");
        for (int offset = 0; offset <= 400; offset++) {
            LocalDate date = firstDate.plusDays(offset);
            if (!matchesRepeatRule(rule, anchor, date)) continue;
            long candidate = date.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            if (candidate > deliveredAt && candidate >= earliestAllowed) return candidate;
        }
        return 0;
    }

    private static LocalDate repeatAnchor(JSONObject task, LocalDate fallback) {
        String node = task.optString("node");
        if (!node.isBlank()) {
            try { return LocalDateTime.parse(node).toLocalDate(); }
            catch (DateTimeParseException ignored) { }
        }
        long createdAt = task.optLong("createdAt", 0);
        if (createdAt > 0) {
            try { return Instant.ofEpochMilli(createdAt).atZone(ZoneId.systemDefault()).toLocalDate(); }
            catch (RuntimeException ignored) { }
        }
        return fallback;
    }

    private static boolean matchesRepeatRule(String rule, LocalDate anchor, LocalDate date) {
        if (date.isBefore(anchor)) return false;
        long elapsedDays = java.time.temporal.ChronoUnit.DAYS.between(anchor, date);
        switch (rule) {
            case "每天": return true;
            case "每个工作日":
                return date.getDayOfWeek().getValue() <= 5;
            case "每周": return elapsedDays % 7 == 0;
            case "每月": return date.getDayOfMonth() == anchor.getDayOfMonth();
            case "每隔 2 周": return elapsedDays % 14 == 0;
            default: return false;
        }
    }

    private static void scheduleInterval(Context context, JSONObject task, int id,
                                         JSONObject slot, List<Integer> scheduled) {
        long intervalMs = intervalMillis(slot);
        long start = parseTime(slot.optString("start"));
        if (start == 0) start = System.currentTimeMillis();
        long endAt = parseTime(slot.optString("end"));
        if (endAt == 0) endAt = parseTime(task.optString("node"));
        long occurrenceAt = nextUndeliveredOccurrence(start, intervalMs, StateStore.deliveredAt(context, id));
        if (occurrenceAt > 0 && occurrenceAt <= System.currentTimeMillis()
                && System.currentTimeMillis() - occurrenceAt > CATCH_UP_WINDOW_MS) {
            long now = System.currentTimeMillis();
            occurrenceAt += ((now - occurrenceAt) / intervalMs + 1) * intervalMs;
        }
        if (endAt > 0 && occurrenceAt > endAt) occurrenceAt = 0;
        long trigger = catchUpOrFuture(occurrenceAt);
        if (trigger == 0) return;
        try {
            schedule(context, id, task.optString("name", "清单任务"), trigger, occurrenceAt, intervalMs, endAt);
            scheduled.add(id);
        } catch (RuntimeException ignored) {
            // One malformed slot must not prevent every other reminder from being registered.
        }
    }

    static void schedule(Context context, int id, String name, long triggerAt,
                         long occurrenceAt, long intervalMs, long endAt) {
        Intent intent = new Intent(context, ReminderReceiver.class)
                .putExtra("id", id)
                .putExtra("name", name)
                .putExtra("occurrenceAt", occurrenceAt)
                .putExtra("intervalMs", intervalMs)
                .putExtra("endAt", endAt);
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (canScheduleExact(context)) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
        }
    }

    private static void scheduleRepeat(Context context, int id, String name, long triggerAt,
                                       long occurrenceAt, String taskId, int scheduleIndex) {
        Intent intent = new Intent(context, ReminderReceiver.class)
                .putExtra("id", id)
                .putExtra("name", name)
                .putExtra("occurrenceAt", occurrenceAt)
                .putExtra("repeatSchedule", true)
                .putExtra("repeatTaskId", taskId)
                .putExtra("repeatScheduleIndex", scheduleIndex);
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (canScheduleExact(context)) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
        }
    }

    static boolean canScheduleExact(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms();
    }

    private static void cancelAll(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (String value : StateStore.alarmIds(context).split(",")) {
            if (value.isBlank()) continue;
            int id;
            try { id = Integer.parseInt(value); }
            catch (NumberFormatException ignored) { continue; }
            Intent intent = new Intent(context, ReminderReceiver.class);
            PendingIntent pending = PendingIntent.getBroadcast(context, id, intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pending != null) {
                manager.cancel(pending);
                pending.cancel();
            }
        }
    }

    private static long parseTime(String value) {
        if (value == null || value.isBlank()) return 0;
        try {
            return LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (DateTimeParseException ignored) {
            return 0;
        }
    }

    private static long intervalMillis(JSONObject reminder) {
        long amount = Math.max(1, reminder.optLong("interval", 30));
        String unit = reminder.optString("unit", "minute");
        if ("day".equals(unit)) return amount * 86_400_000L;
        if ("hour".equals(unit)) return amount * 3_600_000L;
        return amount * 60_000L;
    }

    private static int slotId(JSONObject task, int slotIndex) {
        String taskId = task.optString("id", task.optString("name"));
        if (slotIndex == 0) return taskId.hashCode() & 0x7fffffff;
        return (taskId + "|slot|" + slotIndex).hashCode() & 0x7fffffff;
    }

    private static int repeatSlotId(JSONObject task, int scheduleIndex) {
        String taskId = task.optString("id", task.optString("name"));
        return (taskId + "|repeat|" + scheduleIndex).hashCode() & 0x7fffffff;
    }

    private static long nextUndeliveredOccurrence(long start, long interval, long deliveredAt) {
        long now = System.currentTimeMillis();
        long earliest = deliveredAt >= start ? deliveredAt + interval : start;
        if (earliest > now) return earliest;
        return earliest + ((now - earliest) / interval) * interval;
    }

    private static long catchUpOrFuture(long occurrenceAt) {
        if (occurrenceAt <= 0) return 0;
        long now = System.currentTimeMillis();
        if (occurrenceAt > now) return occurrenceAt;
        if (now - occurrenceAt <= CATCH_UP_WINDOW_MS) return now + 1_000L;
        return 0;
    }

    private static String join(List<Integer> ids) {
        StringBuilder value = new StringBuilder();
        for (int id : ids) {
            if (value.length() > 0) value.append(',');
            value.append(id);
        }
        return value.toString();
    }
}
