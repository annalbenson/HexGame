import { useReducer, useState } from 'react'
import { HexBoard } from './components/HexBoard'
import { HandPanel } from './components/HandPanel'
import { createInitialState, gameReducer } from './game/gameReducer'
import { useAiOpponent } from './hooks/useAiOpponent'
import type { StrategyName } from './sim/strategies'
import './App.css'

type OpponentSetting = 'none' | StrategyName

const OPPONENT_OPTIONS: { value: OpponentSetting; label: string }[] = [
  { value: 'none', label: '2-player (no AI)' },
  { value: 'random', label: 'Random' },
  { value: 'rusher', label: 'Rusher' },
  { value: 'turtler', label: 'Turtler' },
  { value: 'hoarder', label: 'Hoarder' },
]

/** Orange is always the AI seat when one's selected — orange also goes first, so the AI opens the game. Purple stays the human seat. */
const AI_PLAYER = 'orange'

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [opponent, setOpponent] = useState<OpponentSetting>('none')
  useAiOpponent(state, dispatch, AI_PLAYER, opponent === 'none' ? null : opponent)

  // Neither HexBoard nor HandPanel know an AI seat exists — they just call
  // whatever dispatch they're given. Swapping in a no-op during the AI's
  // turn is what actually stops the human from clicking the AI's cards or
  // pieces out from under it mid-move, without threading an "interactive"
  // flag through every click handler in both components.
  const isAiTurn = opponent !== 'none' && state.activePlayer === AI_PLAYER
  const guardedDispatch = isAiTurn ? () => {} : dispatch

  return (
    <div id="app-root">
      <h1>HexGame</h1>
      <div id="opponent-select">
        <label htmlFor="opponent-strategy">Opponent</label>
        <select id="opponent-strategy" value={opponent} onChange={(e) => setOpponent(e.target.value as OpponentSetting)}>
          {OPPONENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {isAiTurn && <span id="ai-turn-indicator">AI is playing…</span>}
      </div>
      <div id="board-container">
        <HexBoard state={state} dispatch={guardedDispatch} />
      </div>
      <HandPanel state={state} dispatch={guardedDispatch} />
    </div>
  )
}

export default App
