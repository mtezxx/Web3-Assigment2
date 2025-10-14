import type { Round } from '@/model/round'

export function snapshotForBot(
  round: Round,
  botIndex: number,
  lastTurn?: { player:number; handSize:number; saidUno:boolean }
) {
  try {
    const hand = round.playerHand(botIndex)
    
    // Serialize cards to completely plain objects using only primitive values
    const serializedHand: any[] = []
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i]
      const plainCard: any = {}
      
      // Only copy primitive values
      if (typeof card.type === 'string') {
        plainCard.type = card.type
      }
      if ('color' in card && typeof (card as any).color === 'string') {
        plainCard.color = (card as any).color
      }
      if ('number' in card && typeof (card as any).number === 'number') {
        plainCard.number = (card as any).number
      }
      
      serializedHand.push(plainCard)
    }
    
    // Get playable card indices safely
    const canPlay: number[] = []
    if (round.playerInTurn() === botIndex) {
      for (let i = 0; i < hand.length; i++) {
        try {
          if (round.canPlay(i)) {
            canPlay.push(i)
          }
        } catch (e) {
          // Skip this card if checking fails
        }
      }
    }
    
    // Create a completely serializable object with only primitives
    const snapshot = {
      me: botIndex, 
      hand: serializedHand, 
      canPlay: canPlay, 
      justPlayed: lastTurn ? {
        player: lastTurn.player,
        handSize: lastTurn.handSize,
        saidUno: lastTurn.saidUno
      } : null
    }
    
    // Test serialization to make sure it works
    const testStr = JSON.stringify(snapshot)
    JSON.parse(testStr) // Parse back to verify
    
    return snapshot
  } catch (error) {
    console.error('Error creating bot snapshot:', error)
    // Return minimal safe snapshot
    return {
      me: Number(botIndex),
      hand: [],
      canPlay: [],
      justPlayed: undefined
    }
  }
}
