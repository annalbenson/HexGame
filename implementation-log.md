# Implementation Log

Tracks card-mechanic designs and the order we're tackling them in. Living doc — update status and open questions as we go. See also `homages-and-references.md` for where these ideas come from.

## Build order

1. ~~**Territory/capture system** (unlocks Magic Mushroom)~~ — **done**.
2. **Deepwater Acolyte line movement** — next up.
3. **The Big Guy: center-only casting + tentacle strike**
4. Inkfiend, Behemoth — no mechanic changes needed (see below)

## Game phases & mana pacing

Original flat +2/turn income (starting at 2) let Behemoth (cost 5) land by turn 4 — too early for a card meant to feel like a real power spike. Retuned to `STARTING_MANA = 1`, `MANA_INCOME = 1` (both in gameReducer.ts). Since card costs are already the Fibonacci sequence (1/2/3/5/8), flat +1/turn income means available mana ≈ turn count, so each cost tier unlocks close to on-cue, with real gaps in between. Simulated turn-by-turn (accounting for the existing player-order asymmetry — purple's income lands slightly ahead of orange's each round) to get real thresholds rather than guessing:

| Phase | Turns (global) | What's live |
|---|---|---|
| **Early Game** | 1–4 | Magic Mushroom (1) — a proper one-drop, always castable turn 1 under this economy — and Inkfiend (2). Cheap territory skirmishing. |
| **Mid Game** | 5–9 | Deepwater Acolyte (3) comes online ~turn 4-5; Behemoth (5) lands ~turn 8-9 if hoarding. |
| **The Big Guy** | ~14-15+ | Cost 8 reachable — *and* still gated on holding the center hex at turn start, so contested center fights can push this later still. |
| **Late Game** | after that | Whatever's left standing slugs it out. No explicit win condition exists yet (see open question below). |

Magic Mushroom briefly considered at cost 0 ("a mushroom should basically be free") but landed back on cost 1 — under the *old* economy cost 1 wasn't distinctive since turn 1 already afforded more, but under the retuned economy cost 1 **is** exactly a one-drop (turn-1 mana = 1 = cost), so the "always available turn 1" instinct is already satisfied without needing to special-case it to 0.

**Resolved — win conditions shipped (2026-08-05).** Two paths, both in `gameReducer.ts`:

- **Elimination:** a player who has fielded at least one creature (`PlayerState.hasFielded`) but currently has zero on the board loses. `hasFielded` specifically distinguishes "got wiped out" from "hasn't played anything yet" so the game doesn't falsely end on an empty turn-1 board. Checked after every single action via a `checkWinner()` pass wrapped around the reducer, not just at turn boundaries, so a mid-turn wipe ends the game immediately.
- **Survival/countdown:** if nobody's eliminated by **turn 30**, whoever holds more territory wins (`territoryCounts()`); an exact tie is a draw. 30 is a direct homage to StarCraft's "survive for 30 minutes" missions — logged in `homages-and-references.md`.
- Once `GameState.winner` is set, the reducer short-circuits and ignores all further actions — the game is genuinely over, not just visually. `HandPanel.tsx` swaps to a game-over banner.

This gives exactly the two win paths originally discussed: rush/wipe the opponent's board (the Big Guy's future tentacle strike will be the dramatic way to do this, but any combat wipe already counts today), or play a patient territorial game and let the clock run out in your favor.

## Card mechanics

### Magic Mushroom (cost 1)

- **Status:** **Done.** Stationary (`movement: 0`). Claims its own hex plus its 6 neighbors as territory for as long as it's alive — and it doesn't live forever (see below).
- **Implementation:** No persistent territory map needed. `ownerOf(coords, creatures)` in `src/game/board.ts` takes the live creatures map and checks for any creature with `capturesTerrain: true` (only Magic Mushroom currently) within 1 hex. Recomputed fresh every call, so capture-while-alive-then-revert (the Creep-like option) falls out for free — a hex just stops being claimed the instant its mushroom dies, no bookkeeping to keep in sync. Contested (mushrooms from both owners in range) renders neutral.
- **Territory starts at zero, not an even split (reworked 2026-08-05).** Originally both players started owning an even 18/18 diagonal-split half of the board for free. Reworked per user's explicit push for a full establish → maintain → gamble → resolve arc: now only each player's **home hex** is permanently, unconditionally owned (the one guaranteed anchor to cast your first creature from) — every other hex, including the old diagonal split, starts neutral. Territory has to be earned via Mushroom placement, one ring at a time, from turn one. Casting still requires the target hex already be yours, so this can't be skipped — your first legal cast is necessarily on your own home hex.
- **Mushrooms expire (added 2026-08-05):** `MUSHROOM_LIFESPAN = 5` turns in gameReducer.ts — a mushroom automatically dies and is pruned at the turn-transition once its lifespan is up. Combined with the "territory reverts on death" behavior above, this means captured ground has to be *actively maintained*, not planted once and forgotten — directly aimed at preventing a static, tic-tac-toe-style stalemate where an early land-grab just sits unchallenged for the rest of the game. Board tokens show a live "N turns left" countdown.
- **Fixed a correctness bug while reworking this:** home-hex ownership is now checked *before* mushroom-claim logic, not after — previously an enemy mushroom placed within 1 hex of your home could flip your own home's ownership to them, since the diagonal-split fallback ran after the claim check. Homes are now unconditionally excluded from capture.
- **Anti-turtling addition (not in the original brainstorm):** mana income includes a `+1/turn` bonus for whichever player controls strictly more hexes (`TERRITORY_ADVANTAGE_BONUS` in gameReducer.ts). Territory counts are shown live in the hand panel (`#territory-status` in HandPanel.tsx) so the incentive is visible, not a hidden number.

### Inkfiend (cost 2)

- **Status:** Done — no change needed. Vanilla pawn: moves 1, no special ability. Current stats already match "moves around but not fast." User explicitly deferred refining this further.

### Deepwater Acolyte (cost 3)

- **Status:** Not started
- **Design:** "Bishop-like" via line movement — instead of moving anywhere within N hex-distance like everyone else, it moves any distance along a single straight axial hex direction (one of the 6 lines), can't turn mid-move. Powerful on an open line, dead if not on one — same tension a chess bishop has.
- **Open questions:**
  - Exact range cap (proposed: ~4-5 hexes, board radius is only 3 so unlimited would basically mean "anywhere on its line")
  - Does it attack normally at the end of a line move (walks into contact like everyone else), or does it need its own ranged-attack rule?

### Behemoth (cost 5)

- **Status:** Done — no change needed. "The Heavy": biggest stats before The Big Guy (6/6, move 1). Role already matches current stats.

### The Big Guy (cost 8)

- **Status:** Center-control precondition already implemented (must control center hex at start of casting turn — see `centerControlAtTurnStart` in `src/game/gameReducer.ts`). Tentacle mechanic itself not started.
- **Design:** Can only be cast on the center hex itself. `movement: 0`. New "tentacle strike" action: hits multiple enemies simultaneously in several directions from a fixed position, without moving — distinct from the normal move-into-contact combat everyone else uses.
- **Open questions:**
  - How many directions/targets can it strike per turn — all 6? A subset within some range?
  - Damage per tentacle: full power stat against each target, or split across targets?
  - Does this replace its "move" for the turn, or is it a free action (moot since movement is 0 anyway)?
  - New reducer action type needed (not a tweak to `moveOrAttack`) plus new UI for selecting multiple targets.

## Board visuals

**Portrait tokens (2026-08-05).** Board tokens used to be flat owner-colored circles with a stat label — fine early on, but with three of five creatures all being "some kind of octopus" (Inkfiend, Behemoth, The Big Guy), flat color alone couldn't tell them apart. Reused each creature's existing card art (`CREATURE_ART` in `src/game/art.ts`) as a circular clipped portrait on its board token instead of inventing new pixel-sprite icons — no new assets needed, and it solves differentiation for all 5 creatures at once, not just the octopi. Token radius now scales with cost (`TOKEN_BASE_RADIUS + cost * TOKEN_RADIUS_PER_COST` in HexBoard.tsx), so size itself reinforces the power curve — Magic Mushroom's token is visibly smaller than Behemoth's, which is smaller than The Big Guy's. Owner color moved from token fill to the ring/stroke around the portrait. Stat text sits in a small dark pill overlapping the bottom edge for legibility over varied art backgrounds.

True custom pixel sprites (mushroom glyph, wand icon, etc., in the style of SeasonsPhaseGame) would need to be generated externally (same dream.ai workflow used for the card art) and dropped into `src/assets/` — happy to wire those in the same way once they exist, but can't generate the images directly in this session.

## Parking lot / open ideas

Not scheduled into the build order yet — captured so they don't get lost, not committed to.

- **Home-territory combat buff/debuff.** A creature standing on a hex its owner controls gets some combat bonus (e.g. +power or +toughness); alternately, a creature standing outside its owner's territory gets a debuff. Would make territory matter for combat outcomes directly, not just casting eligibility and mana income — fighting to hold/take ground would have teeth beyond the mana bonus. Open questions once this gets picked up: buff-at-home vs. debuff-away-from-home (or both?), exact magnitude, and whether it applies to all creatures or interacts oddly with Magic Mushroom (which already defines territory) or The Big Guy (stationary, always "home" at the center).
- **Mushrooms currently time out too fast, stranding units.** Observed problem: at `MUSHROOM_LIFESPAN = 5`, territory reverts to neutral while creatures that pushed out on the strength of that claim are still sitting out in the middle of the board, now stranded away from home base in newly-neutral (or contested) ground. Proposed fix direction: variable decay rate — a mushroom sitting within the player's own already-established territory decays slower ("home field"), one further out toward the border or in enemy-adjacent ground decays faster ("away field"). Ties directly into the home-territory buff/debuff idea above — both are really the same underlying concept (home vs. away matters mechanically), might be worth designing as one unified "home field advantage" pass rather than two separate features. Needs tuning: exact decay rates, how "own established territory" is measured for a mushroom that's arguably what's establishing the territory in the first place (chicken-and-egg — possibly measure distance-to-home instead of current live ownership).
- **Custom pixel sprites** for board tokens (mushroom, wand for the Acolyte, etc.), matching the SeasonsPhaseGame art style — see "Board visuals" above. Needs externally-generated art first.

## Decision log

*(dated entries go here as open questions above get resolved)*

- 2026-08-05 — Card names locked in: Magic Mushroom (1), Inkfiend (2), Deepwater Acolyte (3), Behemoth (5), The Big Guy (8).
- 2026-08-05 — Chess-analogy mechanic brainstorm captured above; build order agreed: territory system → Acolyte movement → Big Guy tentacles.
- 2026-08-05 — Territory system shipped. Resolved capture-permanence question in favor of capture-while-alive-then-revert, implemented as a live recompute rather than stored state (simpler than the structural change originally flagged). Added a territory-advantage mana bonus specifically to prevent turtling, per user's explicit ask.
- 2026-08-05 — Mana economy retuned (2/2 → 1/1 starting/income) after Behemoth was landing turn 4, way too early. Defined 4 game phases mapped to real simulated turn thresholds. Magic Mushroom cost stays at 1, not 0 — the retuned economy already makes cost 1 a proper "one-drop."
- 2026-08-05 — Win conditions shipped: elimination (board wipe, gated on `hasFielded` to avoid false-triggering on an empty turn-1 board) and survival/countdown (turn 30, territory tiebreak — StarCraft homage). Reducer freezes state once `winner` is set.
- 2026-08-05 — Territory reworked from a fixed even 18/18 starting split to zero-starting-territory (home hex only) that must be established via Magic Mushroom and then actively maintained, per user's explicit push for a full establish → maintain → gamble-on-Big-Guy → resolve arc. Fixed a bug in the same pass: enemy mushrooms could previously flip a player's own home hex if placed within range — home ownership now checked first, unconditionally, before any claim logic.
- 2026-08-05 — Magic Mushrooms now expire after `MUSHROOM_LIFESPAN = 5` turns, specifically to prevent a static tic-tac-toe-style stalemate where an early land-grab goes uncontested for the rest of the game. Territory reverting on mushroom death (already true from the live-recompute design) means this "just works" — no extra logic needed beyond pruning expired creatures at turn transitions.
- 2026-08-05 — Board tokens switched from flat color circles to cost-scaled circular portraits using existing card art, to differentiate the three octopus-themed creatures (and everyone else) without needing new sprite assets.
