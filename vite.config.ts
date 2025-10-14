import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173, // optional: change dev port if you like
  },
  resolve: {
    alias: {
      '@': '/src', // so you can import like '@/components/Hello.vue'
    },
  },
})