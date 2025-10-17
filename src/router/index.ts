import { createRouter, createWebHistory } from 'vue-router'
import SetupView from '@/views/SetupView.vue'
import GameView from '@/views/GameView.vue'
import GameOverView from '@/views/GameOverView.vue'

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'setup', component: SetupView },
    { path: '/play', name: 'play', component: GameView },
    { path: '/over', name: 'over', component: GameOverView },
  ],
})
