export type PlayerId = 'orange' | 'purple'

export interface CreatureTemplate {
  id: string
  name: string
  cost: number
  power: number
  toughness: number
  movement: number
  /** If set, this template's effective power/toughness grows by this much per turn elapsed before it's cast. */
  growthPerTurn?: number
  /** If set, this template can only be cast on the board's center hex — see CENTER_COORDS in board.ts. */
  mustCastOnCenter?: boolean
  /** If set, this creature claims territory within 1 hex of itself for as long as it's alive — see `ownerOf` in board.ts. */
  capturesTerrain?: boolean
  /** If set, casting this starts its owner's opponent's win-by-survival countdown — see `bigGuyCastTurn` on GameState. */
  triggersCountdown?: boolean
  /** If set, this creature never moves — instead it strikes the first enemy found in each of the 6 hex directions, at unlimited range, without taking counter-damage. See `tentacleTargets` in board.ts. */
  hasTentacleStrike?: boolean
}

export interface CreatureInstance {
  templateId: string
  owner: PlayerId
  currentToughness: number
  hasSummoningSickness: boolean
  hasActedThisTurn: boolean
  /** Power bonus locked in at cast time, for templates with growthPerTurn. */
  bonusPower?: number
}

export interface CardInstance {
  instanceId: string
  templateId: string
}

export interface PlayerState {
  mana: number
  deck: CardInstance[]
  hand: CardInstance[]
  /** True once this player has ever successfully cast a creature — distinguishes "not eliminated, just hasn't played yet" from a real board wipe. */
  hasFielded: boolean
}

export type Selection =
  | { type: 'card'; instanceId: string }
  | { type: 'creature'; hexKey: string }
  | null

export interface GameState {
  activePlayer: PlayerId
  turnNumber: number
  players: Record<PlayerId, PlayerState>
  creatures: Record<string, CreatureInstance>
  /** Accumulated territory pressure per hex per player — see `updatePressure` in board.ts. Ownership is read off this, not recomputed live from creature positions. */
  territoryPressure: Record<string, Record<PlayerId, number>>
  selection: Selection
  /** Turn number each player cast The Big Guy on, if they have — starts that player's opponent's win-by-survival countdown. Null until cast. */
  bigGuyCastTurn: Record<PlayerId, number | null>
  winner: PlayerId | 'draw' | null
  winReason: 'elimination' | 'countdown' | 'backstop' | null
}
