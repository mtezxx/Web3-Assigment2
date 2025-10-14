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
      return p === undefined ? undefined : state.players[p]
    },
  },

  actions: {
    start(players: string[]) {
      this.players = players
      this.game = createGame({ players })
      this.round = this.game.currentRound() ?? null
      this.mode = 'playing'
    },

    play(cardIndex: number, color?: Color) {
      if (!this.round) return
      try {
        this.round.play(cardIndex, color)
        this.checkGameEnd()
      } catch (error) {
        console.error('Play failed:', error)
      }
    },

    draw() {
      if (!this.round) return
      try {
        this.round.draw()
      } catch (error) {
        console.error('Draw failed:', error)
      }
    },

    sayUno(playerIndex: number) {
      if (!this.round) return
      try {
        this.round.sayUno(playerIndex)
      } catch (error) {
        console.error('Say UNO failed:', error)
      }
    },

    catchUno(accuser: number, accused: number) {
      if (!this.round) return
      try {
        // catchUno method is not available on the round object
        console.log('Catch UNO not implemented')
      } catch (error) {
        console.error('Catch UNO failed:', error)
      }
    },

    checkGameEnd() {
      if (!this.round || !this.game) return
      
      const winner = this.round.winner()
      if (winner !== undefined) {
        const score = this.round.score()
        if (score !== undefined) {
          this.endRound(winner, score)
        }
      }
    },

    endRound(winner: number, score: number) {
      this.result = { winner, score }
      this.mode = 'over'
    },

    reset() {
      this.mode = 'setup'
      this.result = null
      this.round = null
      this.game = null
      this.players = ['You', 'Bot']
    },
  },
})