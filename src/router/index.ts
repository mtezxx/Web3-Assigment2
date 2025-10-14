import { createRouter, createWebHistory } from 'vue-router'
import SetupView from '@/views/SetupView.vue'
import GameView from '@/views/GameView.vue'
import GameOverView from '@/views/GameOverView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: 'setup' } },
    { name: 'setup', path: '/setup', component: SetupView },
    { name: 'play', path: '/play', component: GameView },
    { name: 'over', path: '/over', component: GameOverView },
  ],
})

export default router
