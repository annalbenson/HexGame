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

export type Selection =
  | { type: 'card'; templateId: string }
  | { type: 'creature'; hexKey: string }
  | null

export interface GameState {
  activePlayer: PlayerId
  turnNumber: number
  mana: Record<PlayerId, number>
  creatures: Record<string, CreatureInstance>
  selection: Selection
}
