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
    <div class="game-over-card">
      <h1>🎉 Game Over!</h1>
      
      <div v-if="store.result" class="result-section">
        <div class="winner-announcement">
          <h2>🏆 {{ store.players[store.result.winner] }} Wins!</h2>
          <p class="score">Round Score: <strong>{{ store.result.score }} points</strong></p>
        </div>
        
        <div class="final-standings mt-4">
          <h3>Final Hand Counts:</h3>
          <div class="standings-list">
            <div v-for="(player, index) in store.players" :key="index" 
                 class="player-result"
                 :class="{ 'winner': index === store.result.winner }">
              <span class="player-name">{{ player }}</span>
              <span class="final-cards">{{ store.round?.playerHand(index)?.length ?? 0 }} cards remaining</span>
              <span v-if="index === store.result.winner" class="crown">👑</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="mt-2">
        <p class="error-message">⚠️ No result available.</p>
      </div>

      <div class="actions mt-4">
        <button @click="playAgain" class="primary-btn">🎮 Play Again</button>
        <button @click="backToSetup" class="secondary-btn">⚙️ Back to Setup</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-over-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.winner-announcement h2 {
  font-size: 2rem;
  margin: 1rem 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.score {
  font-size: 1.2rem;
  background: rgba(255,255,255,0.2);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: inline-block;
  margin-top: 0.5rem;
}

.final-standings {
  background: rgba(255,255,255,0.1);
  border-radius: 0.5rem;
  padding: 1rem;
  backdrop-filter: blur(10px);
}

.standings-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.player-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255,255,255,0.1);
  border-radius: 0.25rem;
  border: 1px solid rgba(255,255,255,0.2);
}

.player-result.winner {
  background: rgba(255,215,0,0.3);
  border-color: rgba(255,215,0,0.5);
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from { box-shadow: 0 0 5px rgba(255,215,0,0.5); }
  to { box-shadow: 0 0 20px rgba(255,215,0,0.8), 0 0 30px rgba(255,215,0,0.6); }
}

.player-name {
  font-weight: bold;
}

.final-cards {
  font-size: 0.9rem;
  opacity: 0.9;
}

.crown {
  font-size: 1.5rem;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.primary-btn, .secondary-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-btn {
  background: #28a745;
  color: white;
}

.primary-btn:hover {
  background: #218838;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40,167,69,0.4);
}

.secondary-btn {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
}

.secondary-btn:hover {
  background: rgba(255,255,255,0.3);
  transform: translateY(-2px);
}

.error-message {
  color: #ffc107;
  font-size: 1.1rem;
}

.p-4 { padding: 1rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
</style>