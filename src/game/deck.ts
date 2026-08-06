import type { CardInstance } from './types'

export const STARTING_HAND_SIZE = 3
export const MAX_HAND_SIZE = 6

/** Copies of each creature template in the standard deck (same list for both players for now). */
const DECK_LIST: Record<string, number> = {
  skitterling: 5,
  'spore-crawler': 4,
  wraithling: 3,
  behemoth: 2,
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function buildShuffledDeck(playerId: string): CardInstance[] {
  const cards: CardInstance[] = []
  let counter = 0
  for (const [templateId, count] of Object.entries(DECK_LIST)) {
    for (let i = 0; i < count; i++) {
      cards.push({ instanceId: `${playerId}-${templateId}-${counter++}`, templateId })
    }
  }
  return shuffle(cards)
}

/** Draws up to `count` cards from the front of the deck into the hand, respecting the hand-size cap. Excess draws are burned. */
export function drawCards(deck: CardInstance[], hand: CardInstance[], count: number): { deck: CardInstance[]; hand: CardInstance[] } {
  const nextDeck = [...deck]
  const nextHand = [...hand]
  for (let i = 0; i < count; i++) {
    const card = nextDeck.shift()
    if (!card) break
    if (nextHand.length < MAX_HAND_SIZE) nextHand.push(card)
  }
  return { deck: nextDeck, hand: nextHand }
}
