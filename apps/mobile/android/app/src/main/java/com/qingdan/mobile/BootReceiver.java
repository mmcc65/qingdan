package com.qingdan.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.scheduleAll(context, StateStore.load(context));
        QingdanWidget.updateAll(context);
    }
}
