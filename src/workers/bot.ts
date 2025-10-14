export type BotState = {
  me: number
  hand: Array<{
    type: string
    color?: string
    number?: number
  }>
  canPlay: number[]
  justPlayed?: { player:number; handSize:number; saidUno:boolean }
}

const UNO_FORGET_PROB = 0.15
const UNO_CATCH_PROB  = 0.50
const rand=(a:number,b:number)=>a+Math.floor(Math.random()*(b-a+1))
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))
const chance=(p:number)=>Math.random()<p

self.onmessage = async (e: MessageEvent) => {
  const { state } = e.data as { state: BotState }
  if (!state) return

  // Try to catch UNO
  const j = state.justPlayed
  if (j && j.player !== state.me && j.handSize === 1 && !j.saidUno && chance(UNO_CATCH_PROB)) {
    await delay(rand(250, 800))
    ;(self as any).postMessage({ type:'decision', decision:'catchUno', accused: j.player })
    return
  }

  // Maybe say UNO before penultimate play
  if (state.hand.length === 2 && state.canPlay.length > 0 && !chance(UNO_FORGET_PROB)) {
    await delay(rand(150, 300))
    ;(self as any).postMessage({ type:'decision', decision:'sayUno' })
    await delay(rand(50, 200))
  }

  // Play or draw
  const idx = state.canPlay[0]
  await delay(rand(250, 900))
  ;(self as any).postMessage(
    idx !== undefined ? { type:'decision', decision:'play', cardIndex: idx }
                      : { type:'decision', decision:'draw' }
  )
}
