import type { Card as DeckCard, Color as DeckColor } from './deck';
import type { Randomizer, Shuffler } from '../utils/random_utils';
import type { RoundMemento } from './round';
import { createRound, createRoundFromMemento } from './round';
import { standardRandomizer, standardShuffler } from '../utils/random_utils';

export type Color = DeckColor;
export type Card  = DeckCard;

export interface Hand {
  readonly cards: ReadonlyArray<Card>;
  add(card: Card): void;
  removeAt(index: number): Card;
  size(): number;
  playableIndices(top: Card, enforcedColor?: Color): number[];
}

export class PlayerHand implements Hand {
  private readonly _cards: Card[] = [];

  get cards(): ReadonlyArray<Card> {
    return this._cards;
  }

  size(): number {
    return this._cards.length;
  }

  add(card: Card): void {
    this._cards.push(card);
  }

  removeAt(index: number): Card {
    if (index < 0 || index >= this._cards.length) {
      throw new Error('Card index out of bounds');
    }
    return this._cards.splice(index, 1)[0];
  }

  playableIndices(top: Card, enforcedColor?: Color): number[] {
    return this._cards
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => canPlay(c, top, enforcedColor))
      .map(({ idx }) => idx);
  }
}

export function canPlay(card: Card, top: Card, enforced?: Color): boolean {
  if (card.type === 'WILD' || card.type === 'WILD DRAW') return true;
  if (enforced) return 'color' in card && card.color === enforced;

  if ('color' in card && 'color' in top && card.color === (top as any).color) return true;
  if (card.type === top.type) return true;
  if (card.type === 'NUMBERED' && top.type === 'NUMBERED' && card.number === (top as any).number) return true;

  return false;
}

export type DirectionLabel = 'clockwise' | 'counterclockwise';

export type GameMemento = {
  players: string[];
  targetScore: number;
  scores: number[];
  cardsPerPlayer: number;
  currentRound?: RoundMemento;
};

export interface Game {
  readonly playerCount: number;
  readonly targetScore: number;
  player(index: number): string;
  score(index: number): number;
  winner(): number | undefined;
  currentRound(): import('./round').Round | undefined;
  toMemento(): GameMemento;
}

export type GameConfig = {
  players?: string[];
  targetScore?: number;
  cardsPerPlayer?: number;
  randomizer?: Randomizer;
  shuffler?: Shuffler<Card>;
};

export function createGame(config: GameConfig = {}): Game {
  const players = normalisePlayers(config.players);
  const targetScore = config.targetScore ?? 500;
  const cardsPerPlayer = config.cardsPerPlayer ?? 7;
  validateGameConfig(targetScore, cardsPerPlayer);
  
  const randomizer = config.randomizer ?? standardRandomizer;
  const shuffler = config.shuffler ?? standardShuffler<Card>;

  const dealer = randomizer(players.length) % players.length;

  return new UnoGame({
    players,
    targetScore,
    cardsPerPlayer,
    shuffler,
    scores: new Array(players.length).fill(0),
    dealer,
  });
}

export function createGameFromMemento(
  memento: GameMemento,
  _randomizer: Randomizer = standardRandomizer,
  shuffler: Shuffler<Card> = standardShuffler,
): Game {
  const players = normalisePlayers(memento.players);
  const targetScore = memento.targetScore;
  validateGameConfig(targetScore, memento.cardsPerPlayer);
  const scores = validateAndCopyScores(memento.scores, players.length);

  const winners = scores.reduce<number[]>((acc, score, index) => {
    if (score >= targetScore) acc.push(index);
    return acc;
  }, []);
  if (winners.length > 1) {
    throw new Error('Game memento cannot include multiple winners');
  }

  const winner = winners.length === 1 ? winners[0] : undefined;

  let currentRound: import('./round').Round | undefined;
  let dealer = 0;

  if (winner === undefined) {
    if (!memento.currentRound) {
      throw new Error('An unfinished game requires a current round');
    }
    currentRound = createRoundFromMemento(memento.currentRound, shuffler);
    dealer = memento.currentRound.dealer;
  } else {
    if (memento.currentRound) {
      throw new Error('Finished games must not contain a current round');
    }
    dealer = mod(winner + 1, players.length); // next dealer if a new round were to start
  }

  const game = new UnoGame({
    players,
    targetScore,
    cardsPerPlayer: memento.cardsPerPlayer,
    shuffler,
    scores,
    dealer,
    winner,
    currentRound,
  });

  return game;
}

type InternalGameConfig = {
  players: string[];
  targetScore: number;
  cardsPerPlayer: number;
  shuffler: Shuffler<Card>;
  scores: number[];
  dealer: number;
  winner?: number;
  currentRound?: import('./round').Round;
};

class UnoGame implements Game {
  readonly playerCount: number;
  readonly targetScore: number;

  private readonly players: string[];
  private readonly cardsPerPlayer: number;
  private readonly shuffler: Shuffler<Card>;

  private scores: number[];
  private dealerIndex: number;
  private currentRoundInstance?: import('./round').Round;
  private winnerIndex?: number;

  constructor(config: InternalGameConfig) {
    this.players = config.players;
    this.playerCount = this.players.length;
    this.targetScore = config.targetScore;
    this.cardsPerPlayer = config.cardsPerPlayer;
    this.shuffler = config.shuffler;
    this.scores = config.scores;
    this.dealerIndex = mod(config.dealer, this.playerCount);
    this.currentRoundInstance = config.currentRound;
    this.winnerIndex = config.winner;

    if (this.currentRoundInstance) {
      this.attachRound(this.currentRoundInstance);
    } else if (this.winnerIndex === undefined) {
      this.initialiseNewRound();
    }
  }

  player(index: number): string {
    ensureIndex(index, this.playerCount, 'player');
    return this.players[index];
  }

  score(index: number): number {
    ensureIndex(index, this.playerCount, 'player');
    return this.scores[index];
  }

  winner(): number | undefined {
    return this.winnerIndex;
  }

  currentRound(): import('./round').Round | undefined {
    return this.currentRoundInstance;
  }

  toMemento(): GameMemento {
    return {
      players: [...this.players],
      targetScore: this.targetScore,
      scores: [...this.scores],
      cardsPerPlayer: this.cardsPerPlayer,
      currentRound: this.currentRoundInstance?.toMemento(),
    };
  }

  private initialiseNewRound(): void {
    if (this.winnerIndex !== undefined) return;
    const round = createRound(createRoundConfig(
      this.players,
      this.dealerIndex,
      this.cardsPerPlayer,
      this.shuffler
    ));
    this.currentRoundInstance = round;
    this.attachRound(round);
  }

  private attachRound(round: import('./round').Round): void {
    round.onEnd(({ winner }) => this.handleRoundEnd(winner));
  }

  private handleRoundEnd(winner: number): void {
    if (!this.currentRoundInstance) return;
    const score = this.currentRoundInstance.score() ?? 0;
    this.scores[winner] += score;

    if (this.scores[winner] >= this.targetScore) {
      this.winnerIndex = winner;
      this.currentRoundInstance = undefined;
    } else {
      this.dealerIndex = winner;
      const nextRound = createRound(createRoundConfig(
        this.players,
        this.dealerIndex,
        this.cardsPerPlayer,
        this.shuffler
      ));
      this.currentRoundInstance = nextRound;
      this.attachRound(nextRound);
    }
  }
}

// Helper function to validate game configuration parameters
function validateGameConfig(targetScore: number, cardsPerPlayer: number): void {
  if (targetScore <= 0) throw new Error('targetScore must be greater than 0');
  if (cardsPerPlayer <= 0) throw new Error('cardsPerPlayer must be positive');
}

// Helper function to validate and copy score arrays
function validateAndCopyScores(scores: number[], playerCount: number): number[] {
  if (scores.length !== playerCount) {
    throw new Error('scores must contain one entry per player');
  }
  if (scores.some(score => score < 0)) {
    throw new Error('scores cannot be negative');
  }
  return [...scores];
}

// Helper function to create round configuration object
function createRoundConfig(
  players: string[],
  dealer: number,
  cardsPerPlayer: number,
  shuffler: Shuffler<Card>
): { players: string[]; dealer: number; cardsPerPlayer: number; shuffler: Shuffler<Card> } {
  return {
    players,
    dealer,
    cardsPerPlayer,
    shuffler,
  };
}

function normalisePlayers(players?: string[]): string[] {
  const result = players && players.length > 0 ? [...players] : ['A', 'B'];
  if (result.length < 2) throw new Error('A game requires at least two players');
  if (result.length > 10) throw new Error('A game supports at most ten players');
  return result;
}



function ensureIndex(index: number, count: number, label: string): void {
  if (!Number.isInteger(index)) throw new Error(`${label} must be an integer`);
  if (index < 0 || index >= count) throw new Error(`${label} is out of bounds`);
}

function mod(value: number, modulus: number): number {
  const remainder = value % modulus;
  return remainder >= 0 ? remainder : remainder + modulus;
}
