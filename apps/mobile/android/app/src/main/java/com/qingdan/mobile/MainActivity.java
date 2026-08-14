package com.qingdan.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private WebView webView;
    private boolean pageReady;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        NotificationHelper.createChannel(this);
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, android.webkit.WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                notifyNativeResume();
                offerExactAlarmPermission();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new QingdanBridge(this), "QingdanAndroid");
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        AlarmScheduler.scheduleAll(this, StateStore.load(this));
        MobileUpdater.resumePendingInstall(this);
        notifyNativeResume();
    }

    void checkForUpdate(String manifestUrl, boolean userInitiated) {
        MobileUpdater.check(this, manifestUrl, userInitiated);
    }

    private void notifyNativeResume() {
        if (pageReady && webView != null) {
            webView.evaluateJavascript(
                    "window.dispatchEvent(new Event('qingdan-native-resume'))", null);
        }
    }

    private void offerExactAlarmPermission() {
        if (Build.VERSION.SDK_INT < 31 || AlarmScheduler.canScheduleExact(this)) return;
        String key = "exact_alarm_prompt_" + getPackageManagerVersionCode();
        if (getPreferences(MODE_PRIVATE).getBoolean(key, false)) return;
        getPreferences(MODE_PRIVATE).edit().putBoolean(key, true).apply();
        new AlertDialog.Builder(this)
                .setTitle("提高提醒可靠性")
                .setMessage("请允许“清单”使用精确闹钟，这样锁屏和待机时也能按节点及时提醒。")
                .setNegativeButton("稍后", null)
                .setPositiveButton("去开启", (dialog, which) -> openExactAlarmSettings())
                .show();
    }

    private long getPackageManagerVersionCode() {
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                return getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            }
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception ignored) {
            return 0;
        }
    }

    String getAppVersionName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception ignored) { return ""; }
    }

    private void openExactAlarmSettings() {
        Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + getPackageName()));
        try { startActivity(intent); }
        catch (RuntimeException ignored) {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName())));
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
