<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { useRouter } from 'vue-router'

const store = useGameStore()
const router = useRouter()

function playAgain() {
  store.start(store.players)
  router.push({ name: 'play' })
}

function backToSetup() {
  store.reset()
  router.push({ name: 'setup' })
}
</script>

<template>
  <div class="p-4">
    <h1>Game Over</h1>
    
    <p v-if="store.result" class="mt-2">
      Winner: {{ store.players[store.result.winner] }} — Round score: {{ store.result.score }}
    </p>
    <p v-else class="mt-2">No result available.</p>

    <div class="mt-4">
      <button @click="playAgain">Play Again</button>
      <button @click="backToSetup">Back to Setup</button>
    </div>
  </div>
</template>

<style scoped>
button { padding: .5rem 1rem; margin-right: .5rem; }
</style>