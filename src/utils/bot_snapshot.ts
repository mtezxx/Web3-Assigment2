import type { Round } from '@/model/round'

export function snapshotForBot(
  round: Round,
  botIndex: number,
  lastTurn?: { player:number; handSize:number; saidUno:boolean }
) {
  const hand = round.playerHand(botIndex)
  const canPlay = hand
    .map((_, i) => i)
    .filter(i => round.playerInTurn() === botIndex && round.canPlay(i))
  return { me: botIndex, hand, canPlay, justPlayed: lastTurn }
}
