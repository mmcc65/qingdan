package com.qingdan.mobile;

import android.content.Context;
import android.content.SharedPreferences;

final class StateStore {
    private static final String PREFS = "qingdan_native";
    private static final String STATE = "state_json";
    private static final String ALARMS = "alarm_ids";
    private static final String DELIVERED_PREFIX = "delivered_";

    private StateStore() {}

    static void save(Context context, String json) {
        prefs(context).edit().putString(STATE, json).apply();
    }

    static String load(Context context) {
        return prefs(context).getString(STATE, "{}");
    }

    static String alarmIds(Context context) {
        return prefs(context).getString(ALARMS, "");
    }

    static void saveAlarmIds(Context context, String ids) {
        prefs(context).edit().putString(ALARMS, ids).apply();
    }

    static long deliveredAt(Context context, int id) {
        return prefs(context).getLong(DELIVERED_PREFIX + id, 0);
    }

    static void markDelivered(Context context, int id, long occurrenceAt) {
        prefs(context).edit().putLong(DELIVERED_PREFIX + id, occurrenceAt).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
