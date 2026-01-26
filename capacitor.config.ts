import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.balanceteammaker',
  appName: 'Belo',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      // 이 설정이 "상태바가 앱 화면을 덮지 않게" 밀어내 줍니다.
      overlaysWebView: false,
      // 앱의 배경색(#020617)과 똑같이 맞춰서 상단바가 튀지 않게 합니다.
      backgroundColor: '#020617',
      // 상태바의 글자(시계, 배터리 등)를 흰색으로 바꿉니다. (배경이 어두우니까요!)
      style: 'DARK'
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '834065889708-h51gv3lorhvq919876lbt91mc06kblj9.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;