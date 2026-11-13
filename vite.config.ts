import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Jogo da Memória Visual',
        short_name: 'Memória',
        description: 'Ferramenta de apoio e estimulação de memória visual para crianças',
        lang: 'pt-BR',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#f6f3ee',
        theme_color: '#3b5bdb',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
