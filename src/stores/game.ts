import { defineStore } from 'pinia'
import { createGame, type Color } from '@/model/uno'

type Mode = 'setup' | 'playing' | 'over'

export const useGameStore = defineStore('game', {
  state: () => ({
    mode: 'setup' as Mode,
    players: ['You', 'Bot'] as string[],
    game: null as ReturnType<typeof createGame> | null,
    round: null as ReturnType<ReturnType<typeof createGame>['currentRound']> | null,
    result: null as { winner: number; score: number } | null,
  }),

  getters: {
    playerInTurnName(state): string | undefined {
      const p = state.round?.playerInTurn()
      return p !== undefined ? state.players[p] : undefined
    },
  },

  actions: {
    start(players: string[]) {
      this.players = players
      this.game = createGame({ players })
      this.round = this.game.currentRound() ?? null
      this.mode = 'playing'
    },

    // DRY wrapper for round actions
    executeRoundAction(action: () => void) {
      if (!this.round) return
      action()
      this.checkGameEnd()
    },

    play(cardIndex: number, color?: Color) {
      this.executeRoundAction(() => this.round!.play(cardIndex, color))
    },

    draw() {
      this.executeRoundAction(() => this.round!.draw())
    },

    sayUno(playerIndex?: number) {
      const player = playerIndex ?? this.round?.playerInTurn()
      if (player !== undefined) {
        this.executeRoundAction(() => this.round!.sayUno(player))
      }
    },

    catchUno(accuser: number, accused: number) {
      this.executeRoundAction(() => {
        if (this.round && 'catchUno' in this.round) {
          (this.round as any).catchUno(accuser, accused)
        }
      })
    },

    checkGameEnd() {
      if (!this.round) return
      
      // Check if any player won
      const winner = this.players.findIndex((_, i) => this.round!.playerHand(i).length === 0)
      if (winner !== -1) {
        const score = this.round.winner?.() ?? 0
        this.endRound(winner, score)
      }
    },

    endRound(winner: number, score: number) {
      this.result = { winner, score }
      this.mode = 'over'
    },

    reset() {
      Object.assign(this, {
        mode: 'setup' as Mode,
        result: null,
        round: null,
        game: null,
        players: ['You', 'Bot']
      })
    },
  },
})