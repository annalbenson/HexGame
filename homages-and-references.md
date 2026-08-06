# Homages & References

Games HexGame is borrowing mechanics, aesthetics, or design lessons from. Living doc — add an entry whenever we lift something on purpose.

## StarCraft (Zerg)

- **Purple/orange color scheme** — Zerg-inspired palette for the two players and the board itself.
  Status: **Implemented** (`src/App.css`, `CREATURE_COLOR`/`OWNER_FILL` in `src/components/HexBoard.tsx`)
- **Creep** — Zerg spreads a living territory ("Creep") outward from buildings, gating vision, unit speed, and where you can build.
  Status: **Implemented.** Territory is live, not a fixed starting split — only each player's home hex is permanently owned; everything else is neutral until claimed by a Magic Mushroom (self + 6 neighbors), and reverts the instant that mushroom dies or expires. `ownerOf()` in `src/game/board.ts`.
- **"Survive for 30 minutes"** — the StarCraft campaign missions where the win condition is just outlasting a countdown while under pressure.
  Status: **Implemented** as one of two win conditions — `SURVIVAL_COUNTDOWN_TURN = 30` in `src/game/gameReducer.ts`. If nobody's eliminated by turn 30, whoever holds more territory wins.

## Catan

- Hex-grid board as the core structural idea (terrain tiles, territory).
  Status: **Implemented** (board shape/tile system, `src/game/board.ts`)
- The gripe that you build an army (Knights) but can never actually attack anyone — directly motivated HexGame's combat system as the opposite design choice.
  Status: **Addressed** via move-into-contact combat (`moveOrAttack` in `src/game/gameReducer.ts`)

## Magic: The Gathering

- Casting creatures onto the board by spending mana; the "Hex" double meaning (hex-grid tiles *and* magic) is the project's naming pun.
  Status: **Implemented** (`src/game/creatures.ts`, `castCreature` in `src/game/gameReducer.ts`)
- Real deckbuilding (choosing your own deck composition).
  Status: **Not yet implemented.** Current deck list is fixed and identical for both players (`src/game/deck.ts`) — random draw without deckbuilding is an intentional middle step.

## Hearthstone — *Whispers of the Old Gods* (C'Thun)

- "Stall early, unleash a scaling Big Guy late" — a high-cost creature that grows the longer you wait to cast it, creating tension between playing it safe now vs. banking for a payoff.
  Status: **Implemented** as "The Big Guy" (some manner of eldritch octopus) — `growthPerTurn` in `src/game/creatures.ts`, locked in at cast time via `effectiveStats()`.
- Real C'Thun's growth came from feeding it with specific cards played throughout the game, not raw turn count.
  Status: **Not yet implemented** — current version is a simpler turn-count-only approximation. A richer version (cards that specifically buff the Big Guy) is a candidate future layer.
