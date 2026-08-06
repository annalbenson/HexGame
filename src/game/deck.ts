import { getTemplate } from './creatures'
import type { CardInstance } from './types'

export const STARTING_HAND_SIZE = 3
export const MAX_HAND_SIZE = 6

/** Copies of each creature template in the standard deck (same list for both players for now). */
const DECK_LIST: Record<string, number> = {
  skitterling: 5,
  'spore-crawler': 4,
  wraithling: 3,
  behemoth: 2,
  'the-big-guy': 1,
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

/**
 * Builds a fresh shuffled deck and deals the opening hand, guaranteeing at
 * least one Mushroom is in it. Non-Mushroom cards now require the caster to
 * already control territory (see `controlsTerritoryBeyondHome` in board.ts),
 * so an opening hand with zero Mushrooms would strand a player unable to
 * cast anything — a ~26% chance if dealt purely at random from this deck
 * list. Reserving one Mushroom out of the shuffle before dealing the rest
 * removes that case entirely without touching deck-list odds for the rest
 * of the game.
 */
export function buildStartingHand(playerId: string): { deck: CardInstance[]; hand: CardInstance[] } {
  const shuffled = buildShuffledDeck(playerId)
  const mushroomIndex = shuffled.findIndex((c) => getTemplate(c.templateId).capturesTerrain)
  const [guaranteedMushroom] = shuffled.splice(mushroomIndex, 1)
  const hand = [guaranteedMushroom, ...shuffled.slice(0, STARTING_HAND_SIZE - 1)]
  const deck = shuffled.slice(STARTING_HAND_SIZE - 1)
  return { deck, hand }
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
