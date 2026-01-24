import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';
import { Capacitor } from '@capacitor/core';

/**
 * Firebase Analytics 이벤트 추적을 위한 서비스
 */
export const AnalyticsService = {
  /**
   * 앱 실행 시 Analytics 초기화 및 기본 정보 설정
   */
  async logAppOpen() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await FirebaseAnalytics.logEvent({
        name: 'app_open',
        params: {}
      });
    } catch (e) {
      console.error('Firebase Analytics app_open log failed', e);
    }
  },

  /**
   * 커스텀 이벤트 기록
   * @param name 이벤트 이름
   * @param params 이벤트 파라미터 (선택 사항)
   */
  async logEvent(name: string, params: object = {}) {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await FirebaseAnalytics.logEvent({
        name,
        params
      });
    } catch (e) {
      console.error(`Firebase Analytics ${name} log failed`, e);
    }
  }
};
