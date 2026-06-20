import type { CapacitorConfig } from '@capacitor/cli';

const PROD_URL = 'https://credicabs-web.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.credicabs.app',
  appName: 'CrediCabs',
  webDir: 'out',
  server: {
    url: PROD_URL,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#000000',
      showSpinner: false,
      androidSplashResourceName: 'splash_screen',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
