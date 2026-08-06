import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CREATURE_ART } from '../game/art'
import { axialDistance, boardBounds, CENTER_COORDS, createGrid, hexKey, keyOf, ownerOf, polygonPoints, Tile, HOME_COORDS } from '../game/board'
import { getEffectivePower, getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState } from '../game/types'

const OWNER_FILL: Record<'orange' | 'purple' | 'neutral', string> = {
  orange: '#6b3a1c',
  purple: '#432a63',
  neutral: '#2a2136',
}

const OWNER_STROKE: Record<'orange' | 'purple' | 'neutral', string> = {
  orange: '#e8944e',
  purple: '#c290ff',
  neutral: '#6a5885',
}

const CREATURE_COLOR: Record<'orange' | 'purple', string> = {
  orange: '#ff8a3d',
  purple: '#b565f5',
}

interface HexBoardProps {
  state: GameState
  dispatch: (action: GameAction) => void
}

export function HexBoard({ state, dispatch }: HexBoardProps) {
  const grid = useMemo(() => createGrid(), [])
  const hexes = grid.toArray()
  const bounds = useMemo(() => boardBounds(hexes), [hexes])

  const validTargets = useMemo(() => {
    const targets = new Set<string>()
    if (state.selection?.type === 'card') {
      for (const hex of hexes) {
        if (ownerOf(hex, state.creatures) === state.activePlayer && !state.creatures[keyOf(hex)]) {
          targets.add(keyOf(hex))
        }
      }
    } else if (state.selection?.type === 'creature') {
      const attacker = state.creatures[state.selection.hexKey]
      if (attacker) {
        const [aq, ar] = state.selection.hexKey.split(',').map(Number)
        const template = getTemplate(attacker.templateId)
        for (const hex of hexes) {
          if (keyOf(hex) === state.selection.hexKey) continue
          const occupant = state.creatures[keyOf(hex)]
          if (occupant && occupant.owner === attacker.owner) continue
          if (axialDistance({ q: aq, r: ar }, hex) <= template.movement) {
            targets.add(keyOf(hex))
          }
        }
      }
    }
    return targets
  }, [state, hexes])

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      style={{ background: '#0c0810' }}
    >
      {hexes.map((hex) => {
        const key = keyOf(hex)
        const owner = ownerOf(hex, state.creatures)
        const isHome = key === hexKey(HOME_COORDS.orange.q, HOME_COORDS.orange.r) || key === hexKey(HOME_COORDS.purple.q, HOME_COORDS.purple.r)
        const isCenter = key === hexKey(CENTER_COORDS.q, CENTER_COORDS.r)
        const isTarget = validTargets.has(key)
        const isSelected = state.selection?.type === 'creature' && state.selection.hexKey === key

        return (
          <motion.polygon
            key={key}
            points={polygonPoints(hex)}
            fill={OWNER_FILL[owner ?? 'neutral']}
            stroke={
              isSelected
                ? '#ffb347'
                : isTarget
                  ? '#ffd9a0'
                  : isHome
                    ? '#ffffff'
                    : isCenter
                      ? '#ffd24a'
                      : OWNER_STROKE[owner ?? 'neutral']
            }
            strokeWidth={isSelected ? 3 : isTarget ? 2 : isHome || isCenter ? 2.5 : 1.5}
            initial={false}
            animate={{ opacity: 1 }}
            whileHover={isTarget ? { filter: 'brightness(1.3)' } : undefined}
            style={{ cursor: isTarget ? 'pointer' : 'default' }}
            onClick={() => dispatch({ type: 'CLICK_HEX', q: hex.q, r: hex.r })}
          />
        )
      })}
      {Object.entries(state.creatures).map(([key, creature]) => {
        const [q, r] = key.split(',').map(Number)
        const hex = new Tile({ q, r })
        const template = getTemplate(creature.templateId)
        const isSelected = state.selection?.type === 'creature' && state.selection.hexKey === key
        const isSpent = creature.hasSummoningSickness || creature.hasActedThisTurn
        const isBigGuy = Boolean(template.growthPerTurn)
        const radius = TOKEN_BASE_RADIUS + template.cost * TOKEN_RADIUS_PER_COST
        const clipId = `token-clip-${key.replace(',', '_')}`
        const badgeHeight = 13

        return (
          <motion.g
            key={key}
            initial={{ scale: 0 }}
            animate={{ scale: 1, x: hex.x, y: hex.y }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            style={{ cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'CLICK_HEX', q, r })}
          >
            {isBigGuy && (
              <motion.circle
                r={radius + 6}
                fill="none"
                stroke={CREATURE_COLOR[creature.owner]}
                strokeWidth={2}
                animate={{ opacity: [0.15, 0.6, 0.15], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <defs>
              <clipPath id={clipId}>
                <circle r={radius} />
              </clipPath>
            </defs>
            <image
              href={CREATURE_ART[template.id]}
              x={-radius}
              y={-radius}
              width={radius * 2}
              height={radius * 2}
              clipPath={`url(#${clipId})`}
              preserveAspectRatio="xMidYMid slice"
              opacity={isSpent ? 0.55 : 1}
            />
            <circle
              r={radius}
              fill="none"
              stroke={isSelected ? '#ffffff' : CREATURE_COLOR[creature.owner]}
              strokeWidth={isSelected ? 3.5 : 2.5}
            />
            <rect x={-radius} y={radius - badgeHeight} width={radius * 2} height={badgeHeight} rx={badgeHeight / 2} fill="#0c0810" opacity={0.85} />
            <text textAnchor="middle" y={radius - badgeHeight / 2} dy="0.35em" fontSize={10} fontWeight="700" fill="#ffffff">
              {getEffectivePower(creature)}/{creature.currentToughness}
            </text>
            {creature.expiresOnTurn !== undefined && (
              <text textAnchor="middle" y={radius + 14} fontSize={10} fontWeight="700" fill="#ffd24a">
                {Math.max(0, creature.expiresOnTurn - state.turnNumber)} turns left
              </text>
            )}
          </motion.g>
        )
      })}
    </svg>
  )
}

const TOKEN_BASE_RADIUS = 12
const TOKEN_RADIUS_PER_COST = 2
