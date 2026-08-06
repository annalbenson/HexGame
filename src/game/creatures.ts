import type { CreatureInstance, CreatureTemplate } from './types'

export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  { id: 'skitterling', name: 'Magic Mushroom', cost: 1, power: 1, toughness: 1, movement: 0, capturesTerrain: true },
  { id: 'spore-crawler', name: 'Inkfiend', cost: 2, power: 2, toughness: 3, movement: 1 },
  { id: 'wraithling', name: 'Deepwater Acolyte', cost: 3, power: 3, toughness: 2, movement: 2 },
  { id: 'behemoth', name: 'Behemoth', cost: 5, power: 6, toughness: 6, movement: 1 },
  // Flavor: some manner of eldritch octopus/kraken. C'Thun-inspired scaling payoff.
  {
    id: 'the-big-guy',
    name: 'The Big Guy',
    cost: 8,
    power: 2,
    toughness: 4,
    movement: 1,
    growthPerTurn: 1,
    requiresCenterControl: true,
    triggersCountdown: true,
  },
]

export function getTemplate(templateId: string): CreatureTemplate {
  const template = CREATURE_TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error(`Unknown creature template: ${templateId}`)
  return template
}

/** Stats a template would have if cast on the given turn — grows over time for scaling templates. */
export function effectiveStats(template: CreatureTemplate, turnNumber: number): { power: number; toughness: number; bonus: number } {
  const bonus = template.growthPerTurn ? template.growthPerTurn * turnNumber : 0
  return { power: template.power + bonus, toughness: template.toughness + bonus, bonus }
}

/** A creature instance's actual power, accounting for any growth bonus locked in when it was cast. */
export function getEffectivePower(creature: CreatureInstance): number {
  return getTemplate(creature.templateId).power + (creature.bonusPower ?? 0)
}
