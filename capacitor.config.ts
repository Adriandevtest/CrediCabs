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
    backgroundColor: '#030712',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#030712',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030712',
    },
  },
};

export default config;
