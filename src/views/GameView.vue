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

// Worker
const botUrl = new URL('@/workers/bot.ts', import.meta.url)
let bot: Worker | null = null

// Track last actor for UNO catching
const lastTurn = ref<{ player:number; handSize:number; saidUno:boolean } | undefined>(undefined)

// Safety wrapper
function safe(fn: () => void) {
  try { fn() } catch (e:any) { alert(e?.message ?? 'Illegal action') }
}

// --- Wild color picker state + helpers ---
const pendingWildIndex = ref<number | null>(null)

function onPlay(i: number) {
  if (!round.value) return
  const c = round.value.playerHand(HUMAN_INDEX)[i]
  if (c.type === 'WILD' || c.type === 'WILD DRAW') {
    pendingWildIndex.value = i
  } else {
    safe(() => store.play(i))
  }
}
function confirmWild(color: Color) {
  if (pendingWildIndex.value === null) return
  const idx = pendingWildIndex.value
  pendingWildIndex.value = null
  safe(() => store.play(idx, color))
}

function onDraw()   { safe(() => store.draw()) }
function onSayUno() { safe(() => store.sayUno()) }
function onCatchBot(){ safe(() => store.catchUno(HUMAN_INDEX, BOT_INDEX)) }

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

  if (msg.decision === 'sayUno') safe(() => store.sayUno(BOT_INDEX))
  else if (msg.decision === 'play') safe(() => store.play(msg.cardIndex))
  else if (msg.decision === 'draw') safe(() => store.draw())
  else if (msg.decision === 'catchUno') safe(() => store.catchUno(BOT_INDEX, msg.accused ?? HUMAN_INDEX))
}

function sendStateToBot() {
  if (!bot || !round.value) return
  if (store.mode === 'over') return
  bot.postMessage({ state: snapshotForBot(round.value, BOT_INDEX, lastTurn.value) })
}

// Patch store actions to update lastTurn + notify bot
const origPlay = store.play.bind(store)
const origDraw = store.draw.bind(store)
const origSay  = store.sayUno.bind(store)

store.play = (i:number, c?:Color) => {
  const p = round.value?.playerInTurn()
  safe(() => origPlay(i, c))
  if (p !== undefined && round.value) {
    lastTurn.value = { player: p, handSize: round.value.playerHand(p).length, saidUno: false }
  }
  sendStateToBot()
}
store.draw = () => {
  const p = round.value?.playerInTurn()
  safe(() => origDraw())
  if (p !== undefined && round.value) {
    lastTurn.value = { player: p, handSize: round.value.playerHand(p).length, saidUno: false }
  }
  sendStateToBot()
}
store.sayUno = (idx?: number) => {
  const p = round.value?.playerInTurn()
  safe(() => origSay(idx))
  if (p !== undefined && lastTurn.value?.player === p) {
    lastTurn.value = { ...lastTurn.value, saidUno: true }
  }
  sendStateToBot()
}

// Lifecycle
onMounted(() => {
  if (!round.value) { router.push({ name: 'setup' }); return }
  bot = new Worker(botUrl, { type: 'module' })
  bot.onmessage = handleBotDecision
  sendStateToBot()
})
onBeforeUnmount(() => {
  bot?.terminate(); bot = null
  store.play   = origPlay as any
  store.draw   = origDraw as any
  store.sayUno = origSay  as any
})

// update bot when turn changes
watch(() => round.value?.playerInTurn(), () => sendStateToBot())

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
      <p>In turn: {{ store.playerInTurnName ?? '—' }}</p>
      <p class="mt-2">Top card: <span>{{ label(round.discardPile().top()) }}</span></p>
    </section>

    <section class="mt-4">
      <h3>Your hand</h3>
      <div class="hand">
        <button
          v-for="(c, i) in round.playerHand(HUMAN_INDEX)"
          :key="i"
          class="card"
          :disabled="round.playerInTurn() !== HUMAN_INDEX || !round.canPlay(i)"
          @click="onPlay(i)"
          :title="label(c)"
        >
          {{ label(c) }}
        </button>
      </div>

      <!-- Wild color picker -->
      <div v-if="pendingWildIndex !== null" class="mt-2">
        <strong>Choose color:</strong>
        <button @click="confirmWild('RED')">RED</button>
        <button @click="confirmWild('BLUE')">BLUE</button>
        <button @click="confirmWild('GREEN')">GREEN</button>
        <button @click="confirmWild('YELLOW')">YELLOW</button>
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
.hand  { display: flex; flex-wrap: wrap; gap: .5rem; }
.card  { padding: .5rem; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
button { padding: .5rem 1rem; }
.ml-2  { margin-left: .5rem; }
</style>
