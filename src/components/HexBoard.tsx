import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { axialDistance, createGrid, hexKey, keyOf, ownerOf, polygonPoints, Tile, HOME_COORDS } from '../game/board'
import { getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState } from '../game/types'

const OWNER_FILL: Record<'orange' | 'purple' | 'neutral', string> = {
  orange: '#3a2416',
  purple: '#251a3a',
  neutral: '#1a1420',
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
  const viewWidth = grid.pixelWidth
  const viewHeight = grid.pixelHeight

  const validTargets = useMemo(() => {
    const targets = new Set<string>()
    if (state.selection?.type === 'card') {
      for (const hex of hexes) {
        if (ownerOf(hex) === state.activePlayer && !state.creatures[keyOf(hex)]) {
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
    <svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} style={{ background: '#0c0810' }}>
      {hexes.map((hex) => {
        const key = keyOf(hex)
        const owner = ownerOf(hex)
        const isHome = key === hexKey(HOME_COORDS.orange.q, HOME_COORDS.orange.r) || key === hexKey(HOME_COORDS.purple.q, HOME_COORDS.purple.r)
        const isTarget = validTargets.has(key)
        const isSelected = state.selection?.type === 'creature' && state.selection.hexKey === key

        return (
          <motion.polygon
            key={key}
            points={polygonPoints(hex)}
            fill={OWNER_FILL[owner ?? 'neutral']}
            stroke={isSelected ? '#ffb347' : isTarget ? '#ffd9a0' : isHome ? '#8a5cf6' : '#0c0810'}
            strokeWidth={isSelected ? 3 : isTarget ? 2 : isHome ? 2 : 1}
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

        return (
          <motion.g
            key={key}
            initial={{ scale: 0 }}
            animate={{ scale: 1, x: hex.x, y: hex.y }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            style={{ cursor: 'pointer' }}
            onClick={() => dispatch({ type: 'CLICK_HEX', q, r })}
          >
            <circle
              r={HEX_TOKEN_RADIUS}
              fill={CREATURE_COLOR[creature.owner]}
              stroke={isSelected ? '#ffffff' : '#0c0810'}
              strokeWidth={isSelected ? 3 : 1.5}
              opacity={isSpent ? 0.55 : 1}
            />
            <text textAnchor="middle" dy="0.35em" fontSize="12" fontWeight="700" fill="#0c0810">
              {template.power}/{creature.currentToughness}
            </text>
          </motion.g>
        )
      })}
    </svg>
  )
}

const HEX_TOKEN_RADIUS = 16
