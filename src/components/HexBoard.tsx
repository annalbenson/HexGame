import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CREATURE_ART } from '../game/art'
import { axialDistance, boardBounds, CENTER_COORDS, createGrid, hexKey, keyOf, ownerOf, polygonPoints, Tile, HOME_COORDS } from '../game/board'
import { getEffectivePower, getTemplate } from '../game/creatures'
import { BIG_GUY_COUNTDOWN } from '../game/gameReducer'
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
      const instanceId = state.selection.instanceId
      const card = state.players[state.activePlayer].hand.find((c) => c.instanceId === instanceId)
      const template = card ? getTemplate(card.templateId) : null
      for (const hex of hexes) {
        const key = keyOf(hex)
        const occupant = state.creatures[key]
        // The Big Guy sacrifices its own occupant instead of requiring an
        // empty hex — mirrors castCreature in gameReducer.ts.
        const isSacrifice = template?.mustCastOnCenter && occupant?.owner === state.activePlayer
        if (occupant && !isSacrifice) continue
        if (ownerOf(hex, state.territoryPressure) === state.activePlayer) targets.add(key)
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
        const isHomeOrange = key === hexKey(HOME_COORDS.orange.q, HOME_COORDS.orange.r)
        const isHomePurple = key === hexKey(HOME_COORDS.purple.q, HOME_COORDS.purple.r)
        const isHome = isHomeOrange || isHomePurple
        const isCenter = key === hexKey(CENTER_COORDS.q, CENTER_COORDS.r)
        const isTarget = validTargets.has(key)
        const isSelected = state.selection?.type === 'creature' && state.selection.hexKey === key
        const owner = ownerOf(hex, state.territoryPressure)

        const pressure = state.territoryPressure[key] ?? { orange: 0, purple: 0 }
        const total = pressure.orange + pressure.purple
        const points = polygonPoints(hex)

        // Split-fill: the divider's position (not a color blend) carries the
        // pressure ratio, plus an explicit boundary line — legible without
        // needing to distinguish orange from purple by hue or shade at all.
        const xs = hex.corners.map((c) => c.x)
        const ys = hex.corners.map((c) => c.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const dividerX = total > 0 ? minX + (maxX - minX) * (pressure.orange / total) : minX
        const clipId = `hexfill-${key.replace(',', '_')}`

        return (
          <motion.g
            key={key}
            initial={false}
            animate={{ opacity: 1 }}
            whileHover={isTarget ? { filter: 'brightness(1.3)' } : undefined}
            style={{ cursor: isTarget ? 'pointer' : 'default' }}
            onClick={() => dispatch({ type: 'CLICK_HEX', q: hex.q, r: hex.r })}
          >
            {isHome || total === 0 ? (
              <polygon points={points} fill={isHome ? OWNER_FILL[isHomeOrange ? 'orange' : 'purple'] : OWNER_FILL.neutral} />
            ) : (
              <>
                <clipPath id={clipId}>
                  <polygon points={points} />
                </clipPath>
                <g clipPath={`url(#${clipId})`}>
                  <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill={OWNER_FILL.orange} />
                  <rect x={dividerX} y={minY} width={maxX - dividerX} height={maxY - minY} fill={OWNER_FILL.purple} />
                </g>
                <line x1={dividerX} y1={minY} x2={dividerX} y2={maxY} stroke="#eee0f5" strokeWidth={2} clipPath={`url(#${clipId})`} />
              </>
            )}
            <polygon
              points={points}
              fill="none"
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
            />
          </motion.g>
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
            {template.triggersCountdown && state.bigGuyCastTurn[creature.owner] !== null && (
              <text textAnchor="middle" y={radius + 14} fontSize={10} fontWeight="700" fill="#ff6b6b">
                opponent wins in {Math.max(0, BIG_GUY_COUNTDOWN - (state.turnNumber - state.bigGuyCastTurn[creature.owner]!))}
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
