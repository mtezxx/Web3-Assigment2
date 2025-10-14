<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useRouter } from 'vue-router'

const store = useGameStore()
const router = useRouter()

// Choose number of bots (1-3)
const botCount = ref(1)
const players = () => ['You', ...Array(botCount.value).fill(0).map((_, i) => `Bot ${i + 1}`)]

function start() {
  console.log('Start button clicked!')
  console.log('Players:', players())
  
  try {
    store.start(players())
    console.log('Store started successfully, navigating to play...')
    router.push({ name: 'play' })
  } catch (error) {
    console.error('Failed to start game:', error)
    alert('Failed to start game: ' + (error instanceof Error ? error.message : String(error)))
  }
}
</script>

<template>
  <div class="p-4">
    <h1>UNO — Setup</h1>

    <label class="block mt-4">
      Number of Bots:
      <select v-model.number="botCount">
        <option :value="1">1</option>
        <option :value="2">2</option>
        <option :value="3">3</option>
      </select>
    </label>

    <p class="mt-2">Players: {{ players().join(', ') }}</p>

    <div class="mt-4">
      <button @click="start">Start Game</button>
    </div>
  </div>
</template>

<style scoped>
button { padding: .5rem 1rem; margin-right: .5rem; }
select { margin-left: .5rem; }
.block { display: block; }
.mt-4 { margin-top: 1rem; }
.mt-2 { margin-top: 0.5rem; }
.p-4 { padding: 1rem; }
</style>