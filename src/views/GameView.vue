<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { snapshotForBot } from '@/utils/bot_snapshot'
import type { Color } from '@/model/deck'

const store = useGameStore()
const router = useRouter()
const round = computed(() => store.round)

const HUMAN_INDEX = 0
const BOT_INDEX   = 1

// Web Worker for bot
const botUrl = new URL('@/workers/bot.ts', import.meta.url)
let bot: Worker | null = null

// Track last actor for UNO catching
const lastTurn = ref<{ player:number; handSize:number; saidUno:boolean } | undefined>(undefined)

// Simplified safety wrapper

// Safety wrapper
function safe(fn: () => void) {
  try { 
    fn() 
  } catch (e: any) { 
    console.error('Game action failed:', e?.message ?? 'Illegal action')
  }
}

// --- Wild color picker state + helpers ---
const pendingWildIndex = ref<number | null>(null)

function onPlay(i: number) {
  if (!round.value) return
  if (round.value.playerInTurn() !== HUMAN_INDEX) return
  if (!round.value.canPlay(i)) return
  
  const c = round.value.playerHand(HUMAN_INDEX)[i]
  if (c.type === 'WILD' || c.type === 'WILD DRAW') {
    pendingWildIndex.value = i
  } else {
    safe(() => playWithTracking(i))
  }
}
function confirmWild(color: Color) {
  if (pendingWildIndex.value === null) return
  const idx = pendingWildIndex.value
  pendingWildIndex.value = null
  safe(() => playWithTracking(idx, color))
}

function onDraw()   { safe(() => drawWithTracking()) }
function onSayUno() { safe(() => sayUnoWithTracking()) }
function onCatchBot(){ safe(() => store.catchUno(HUMAN_INDEX, BOT_INDEX)) }



// Store original methods for cleanup
const origPlay = store.play.bind(store)
const origDraw = store.draw.bind(store)
const origSay  = store.sayUno.bind(store)

// Wrapper functions that track turns and notify bot
function playWithTracking(i: number, c?: Color) {
  const p = round.value?.playerInTurn()
  store.play(i, c)
  
  if (p !== undefined && round.value) {
    lastTurn.value = { player: p, handSize: round.value.playerHand(p).length, saidUno: false }
  }
  
  if (bot && round.value?.playerInTurn() === BOT_INDEX) {
    setTimeout(() => sendStateToBot(), 100)
  }
}

function drawWithTracking() {
  const p = round.value?.playerInTurn()
  store.draw()
  
  if (p !== undefined && round.value) {
    lastTurn.value = { player: p, handSize: round.value.playerHand(p).length, saidUno: false }
  }
  
  if (bot && round.value?.playerInTurn() === BOT_INDEX) {
    setTimeout(() => sendStateToBot(), 100)
  }
}

function sayUnoWithTracking(idx?: number) {
  const p = round.value?.playerInTurn()
  store.sayUno(idx)
  
  if (p !== undefined && lastTurn.value?.player === p) {
    lastTurn.value = { ...lastTurn.value, saidUno: true }
  }
  
  if (bot && round.value?.playerInTurn() === BOT_INDEX) {
    setTimeout(() => sendStateToBot(), 100)
  }
}

// --- Worker I/O ---
type BotDecision =
  | { type:'decision'; decision:'sayUno' }
  | { type:'decision'; decision:'draw' }
  | { type:'decision'; decision:'play'; cardIndex:number }
  | { type:'decision'; decision:'catchUno'; accused:number }

function handleBotDecision(e: MessageEvent<BotDecision>) {
  const msg = e.data
  if (!round.value) return
  if (round.value.playerInTurn() !== BOT_INDEX) return

  if (msg.decision === 'sayUno') {
    safe(() => store.sayUno(BOT_INDEX))
  } else if (msg.decision === 'play') {
    if (!round.value.canPlay(msg.cardIndex)) {
      safe(() => drawWithTracking())
      return
    }
    
    const card = round.value.playerHand(BOT_INDEX)[msg.cardIndex]
    if (card && (card.type === 'WILD' || card.type === 'WILD DRAW')) {
      const colors: Color[] = ['RED', 'BLUE', 'GREEN', 'YELLOW']
      const randomColor = colors[Math.floor(Math.random() * colors.length)]
      safe(() => playWithTracking(msg.cardIndex, randomColor))
    } else {
      safe(() => playWithTracking(msg.cardIndex))
    }
  } else if (msg.decision === 'draw') {
    safe(() => drawWithTracking())
  } else if (msg.decision === 'catchUno') {
    safe(() => store.catchUno(BOT_INDEX, msg.accused ?? HUMAN_INDEX))
  }
}

function sendStateToBot() {
  if (!bot || !round.value) return
  if (store.mode === 'over') return
  
  try {
    const state = snapshotForBot(round.value, BOT_INDEX, lastTurn.value)
    bot.postMessage({ state })
  } catch (error) {
    console.error('Failed to send state to bot:', error)
  }
}

// Lifecycle
onMounted(() => {
  if (!round.value) { 
    router.push({ name: 'setup' })
    return 
  }
  
  try {
    bot = new Worker(botUrl, { type: 'module' })
    bot.onmessage = handleBotDecision
    
    if (round.value.playerInTurn() === BOT_INDEX) {
      sendStateToBot()
    }
  } catch (error) {
    console.error('Failed to create bot worker:', error)
  }
})
onBeforeUnmount(() => {
  bot?.terminate()
  bot = null
})

// Update bot when turn changes
watch(() => round.value?.playerInTurn(), (newPlayer) => {
  if (newPlayer === BOT_INDEX && bot) {
    sendStateToBot()
  }
})

// Navigate to game over when mode changes
watch(() => store.mode, (newMode) => {
  if (newMode === 'over') {
    router.push({ name: 'over' })
  }
})

// Small helper to render card
function label(c:any) {
  if (!c) return ''
  if (c.type === 'NUMBERED') return `${c.color} ${c.number}`
  if ('color' in c) return `${c.type} (${c.color})`
  return c.type
}
</script>

<template>
  <div class="p-4" v-if="round">
    <h1>UNO — Playing</h1>

    <section class="mt-3">
      <div class="game-status">
        <h2>Game Status</h2>
        <p><strong>Current Turn:</strong> {{ store.playerInTurnName ?? '—' }}</p>
        <p><strong>Top Card:</strong> <span class="top-card">{{ label(round.discardPile().top()) }}</span></p>
        
        <div class="players-status mt-3">
          <h3>Players</h3>
          <div v-for="(player, index) in store.players" :key="index" class="player-info">
            <span class="player-name" :class="{ 'current-turn': round.playerInTurn() === index }">
              {{ player }}
            </span>
            <span class="card-count">{{ round.playerHand(index).length }} cards</span>
            <span v-if="round.playerHand(index).length === 1" class="uno-warning">⚠️ UNO!</span>
          </div>
        </div>
      </div>
    </section>



    <section class="mt-4">
      <h3>Your hand ({{ round.playerHand(HUMAN_INDEX).length }} cards)</h3>
      <div class="hand">
        <button
          v-for="(c, i) in round.playerHand(HUMAN_INDEX)"
          :key="i"
          class="card"
          :disabled="round.playerInTurn() !== HUMAN_INDEX || !round.canPlay(i)"
          :class="{ 'playable': round.canPlay(i) }"
          @click="onPlay(i)"
          :title="label(c)"
        >
          {{ label(c) }}
        </button>
      </div>

      <!-- Wild color picker -->
      <div v-if="pendingWildIndex !== null" class="wild-color-picker mt-2">
        <div class="wild-message">
          <strong>🎨 Choose a color for your Wild card:</strong>
        </div>
        <div class="color-buttons">
          <button @click="confirmWild('RED')" class="color-btn red">🔴 RED</button>
          <button @click="confirmWild('BLUE')" class="color-btn blue">🔵 BLUE</button>
          <button @click="confirmWild('GREEN')" class="color-btn green">🟢 GREEN</button>
          <button @click="confirmWild('YELLOW')" class="color-btn yellow">🟡 YELLOW</button>
        </div>
      </div>

      <div class="mt-2">
        <button @click="onDraw"   :disabled="round.playerInTurn()!==HUMAN_INDEX || !round.canDraw()">Draw</button>
        <button @click="onSayUno" :disabled="round.playerInTurn()!==HUMAN_INDEX" class="ml-2">Say UNO</button>
        <button @click="onCatchBot" class="ml-2">Catch UNO (bot)</button>
      </div>
    </section>
  </div>
  <div v-else class="p-4">Loading…</div>
</template>

<style scoped>
.hand { display: flex; flex-wrap: wrap; gap: .5rem; }
.card { 
  padding: .5rem; 
  border: 1px solid #ccc; 
  border-radius: 4px; 
  background: #fff; 
}
.card:disabled { 
  opacity: 0.5; 
  background: #f5f5f5;
}
.card.playable { 
  background: #e8f5e8; 
  border-color: #28a745;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
}
button { padding: .5rem 1rem; }
.ml-2 { margin-left: .5rem; }

.game-status {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.top-card {
  font-weight: bold;
  color: #007bff;
  background: #e7f3ff;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.players-status {
  background: white;
  border-radius: 0.25rem;
  padding: 0.75rem;
  margin-top: 0.75rem;
}

.player-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin: 0.25rem 0;
  border-radius: 0.25rem;
  background: #f8f9fa;
}

.player-name.current-turn {
  background: #fff3cd;
  border: 2px solid #ffc107;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: bold;
}

.card-count {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.9rem;
  font-weight: bold;
}

.uno-warning {
  color: #dc3545;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.game-log {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  max-height: 150px;
  overflow-y: auto;
  padding: 0.5rem;
}

.log-entry {
  font-size: 0.9rem;
  color: #495057;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e9ecef;
}

.log-entry:last-child {
  border-bottom: none;
}

.wild-color-picker {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 0.75rem 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.wild-message {
  color: white;
  text-align: center;
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

.color-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.color-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.color-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.color-btn.red {
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  color: white;
}

.color-btn.blue {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  color: white;
}

.color-btn.green {
  background: linear-gradient(135deg, #a8e6cf, #7fcdcd);
  color: white;
}

.color-btn.yellow {
  background: linear-gradient(135deg, #ffd93d, #ff9a3c);
  color: white;
}

.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.p-4 { padding: 1rem; }
</style>
