package com.balanceteammaker;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    private boolean keepSplashScreen = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // React가 준비될 때까지 스플래시 유지
        splashScreen.setKeepOnScreenCondition(() -> keepSplashScreen);

        // 안전 타임아웃: 최대 5초 후 자동 해제
        new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplashScreen = false, 5000);

        // JS에서 스플래시를 닫을 수 있도록 인터페이스 등록
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void hide() {
                new Handler(Looper.getMainLooper()).post(() -> keepSplashScreen = false);
            }
        }, "NativeSplash");

        // 구글 로그인 플러그인 등록
        registerPlugin(GoogleAuth.class);

        /*
         * // 네비게이션 바가 콘텐츠를 가리지 않도록 설정
         * // API 30 (Android 11) 이상에서 사용 가능
         * if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
         * getWindow().setDecorFitsSystemWindows(false);
         * } else {
         * // API 24-29 (Android 7.0-10)에서는 시스템 UI 플래그 사용
         * View decorView = getWindow().getDecorView();
         * int flags = decorView.getSystemUiVisibility();
         * flags |= View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
         * flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
         * decorView.setSystemUiVisibility(flags);
         * }
         * 
         * // WebView에 패딩 추가하여 시스템 바 영역 확보
         * ViewCompat.setOnApplyWindowInsetsListener(
         * getWindow().getDecorView(),
         * (v, insets) -> {
         * // insets는 이미 WindowInsetsCompat 타입입니다
         * int navigationBarHeight = insets.getInsets(
         * WindowInsetsCompat.Type.navigationBars()).bottom;
         * 
         * // JavaScript로 네비게이션 바 높이 전달
         * getBridge().getWebView().post(() -> {
         * String js = String.format(
         * "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');"
         * ,
         * navigationBarHeight);
         * getBridge().getWebView().evaluateJavascript(js, null);
         * });
         * 
         * return insets;
         * });
         */
    }
}
