import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mediaindoorsignage.tv',
  appName: 'Mídia Indoor TV',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
