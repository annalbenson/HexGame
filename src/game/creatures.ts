import type { CreatureTemplate } from './types'

export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  { id: 'skitterling', name: 'Skitterling', cost: 1, power: 1, toughness: 1, movement: 3 },
  { id: 'spore-crawler', name: 'Spore Crawler', cost: 2, power: 2, toughness: 3, movement: 1 },
  { id: 'wraithling', name: 'Wraithling', cost: 3, power: 3, toughness: 2, movement: 2 },
  { id: 'behemoth', name: 'Behemoth', cost: 5, power: 6, toughness: 6, movement: 1 },
]

export function getTemplate(templateId: string): CreatureTemplate {
  const template = CREATURE_TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error(`Unknown creature template: ${templateId}`)
  return template
}
