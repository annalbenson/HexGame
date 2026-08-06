export type PlayerId = 'orange' | 'purple'

export interface CreatureTemplate {
  id: string
  name: string
  cost: number
  power: number
  toughness: number
  movement: number
}

export interface CreatureInstance {
  templateId: string
  owner: PlayerId
  currentToughness: number
  hasSummoningSickness: boolean
  hasActedThisTurn: boolean
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
