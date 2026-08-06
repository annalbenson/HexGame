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
  selection: Selection
}
