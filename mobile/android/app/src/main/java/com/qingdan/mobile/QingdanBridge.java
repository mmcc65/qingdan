package com.qingdan.mobile;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

public final class QingdanBridge {
    private final MainActivity activity;

    QingdanBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void onStateChanged(String json) {
        StateStore.save(activity, json);
        AlarmScheduler.scheduleAll(activity, json);
        QingdanWidget.updateAll(activity);
    }

    @JavascriptInterface
    public void testReminder() {
        NotificationHelper.show(activity, 900001, "清单提醒测试", "手机通知和横幅提醒工作正常");
    }

    @JavascriptInterface
    public boolean hasExactReminderPermission() {
        return AlarmScheduler.canScheduleExact(activity);
    }

    @JavascriptInterface
    public void openExactReminderSettings() {
        Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + activity.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(intent);
        } catch (RuntimeException ignored) {
            Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + activity.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(details);
        }
    }

    @JavascriptInterface
    public void checkForUpdate(String manifestUrl, boolean userInitiated) {
        activity.runOnUiThread(() -> activity.checkForUpdate(manifestUrl, userInitiated));
    }

    @JavascriptInterface
    public String getAppVersion() {
        return activity.getAppVersionName();
    }
}
