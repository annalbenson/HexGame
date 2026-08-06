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
| **Late Game** | after that | Whatever's left standing slugs it out until someone gambles on Big Guy or the backstop closes it out — see win conditions below. |

Magic Mushroom briefly considered at cost 0 ("a mushroom should basically be free") but landed back on cost 1 — under the *old* economy cost 1 wasn't distinctive since turn 1 already afforded more, but under the retuned economy cost 1 **is** exactly a one-drop (turn-1 mana = 1 = cost), so the "always available turn 1" instinct is already satisfied without needing to special-case it to 0.

**Reworked again — win conditions now built around The Big Guy specifically (2026-08-06).** The original two paths (elimination, or a flat turn-30 territory countdown) let games resolve via the countdown with zero connection to whether anyone ever fielded The Big Guy — confirmed by the playtest harness (320 games, 0% Big Guy landed). Per explicit user direction, the countdown itself is now gated on Big Guy rather than running unconditionally. Three paths, all in `gameReducer.ts`'s `checkWinner()`:

- **Elimination:** unchanged — a player who has fielded at least one creature (`PlayerState.hasFielded`) but currently has zero on the board loses. Applies at any point in the game, before or after anyone casts Big Guy. Checked after every single action, not just turn boundaries, so a mid-turn wipe ends the game immediately.
- **Countdown:** casting The Big Guy (`triggersCountdown: true` on its template) starts a `BIG_GUY_COUNTDOWN` (currently 6) turn clock against its *own owner* — if that owner's opponent hasn't been wiped out once it expires, the opponent wins outright, no territory involved. `GameState.bigGuyCastTurn: Record<PlayerId, number | null>` tracks when (if ever) each player cast it. Verified directly (not just via the harness, since it never organically fired in simulated play — see below): fabricated a state with preconditions already met, cast Big Guy at turn 20, confirmed the opponent won with reason `countdown` at exactly turn 26.
- **Backstop:** if *neither* player ever casts Big Guy, nothing above can resolve the game. `BACKSTOP_TURN = 45` is a deliberately distant fallback (territory tiebreak, same shape as the old flat rule) meant to be invisible in a normal game — added specifically because the user flagged that an unconditional countdown removal would let two sufficiently cautious players stall forever.
- Board (`HexBoard.tsx`) and hand panel (`HandPanel.tsx`) both show a live countdown once Big Guy is in play, matching the existing Mushroom-expiry countdown pattern — the tension needs to be visible, not just a hidden clock.

**Finding, not yet acted on:** re-running the harness with the new rules shows `BACKSTOP_TURN` firing 24% of the time overall — and 80-100% of the time in slower/defensive matchups (turtler-vs-turtler, turtler-vs-random) — meaning it's nowhere near "invisible" as intended. Big Guy still landed in 0% of 160 simulated games. This confirms the countdown redesign didn't need tuning so much as it exposed the real problem underneath: Big Guy's own preconditions (cost 8, center control at turn start *and* at cast time, plus the territory gate) appear to be close to unreachable for any of the four scripted bot strategies, independent of what happens after it's cast. Worth investigating directly before spending more effort tuning `BIG_GUY_COUNTDOWN` — that number currently can't be validated against real play since the card it's timing almost never gets cast.

## Card mechanics

### Magic Mushroom (cost 1)

- **Status:** **Done.** Stationary (`movement: 0`). Claims its own hex plus its 6 neighbors as territory for as long as it's alive — and it doesn't live forever (see below).
- **Implementation:** No persistent territory map needed. `ownerOf(coords, creatures)` in `src/game/board.ts` takes the live creatures map and checks for any creature with `capturesTerrain: true` (only Magic Mushroom currently) within 1 hex. Recomputed fresh every call, so capture-while-alive-then-revert (the Creep-like option) falls out for free — a hex just stops being claimed the instant its mushroom dies, no bookkeeping to keep in sync. Contested (mushrooms from both owners in range) renders neutral.
- **Territory starts at zero, not an even split (reworked 2026-08-05).** Originally both players started owning an even 18/18 diagonal-split half of the board for free. Reworked per user's explicit push for a full establish → maintain → gamble → resolve arc: now only each player's **home hex** is permanently, unconditionally owned (the one guaranteed anchor to cast your first creature from) — every other hex, including the old diagonal split, starts neutral. Territory has to be earned via Mushroom placement, one ring at a time, from turn one. Casting still requires the target hex already be yours, so this can't be skipped — your first legal cast is necessarily on your own home hex.
- **Mushrooms expire (added 2026-08-05):** `MUSHROOM_LIFESPAN = 5` turns in gameReducer.ts — a mushroom automatically dies and is pruned at the turn-transition once its lifespan is up. Combined with the "territory reverts on death" behavior above, this means captured ground has to be *actively maintained*, not planted once and forgotten — directly aimed at preventing a static, tic-tac-toe-style stalemate where an early land-grab just sits unchallenged for the rest of the game. Board tokens show a live "N turns left" countdown.
- **Fixed a correctness bug while reworking this:** home-hex ownership is now checked *before* mushroom-claim logic, not after — previously an enemy mushroom placed within 1 hex of your home could flip your own home's ownership to them, since the diagonal-split fallback ran after the claim check. Homes are now unconditionally excluded from capture.
- **Anti-turtling addition (not in the original brainstorm):** mana income includes a `+1/turn` bonus for whichever player controls strictly more hexes (`TERRITORY_ADVANTAGE_BONUS` in gameReducer.ts). Territory counts are shown live in the hand panel (`#territory-status` in HandPanel.tsx) so the incentive is visible, not a hidden number.
- **Non-Mushroom casting now gated on territory (added 2026-08-06):** casting any card *other* than Mushroom requires already controlling a hex beyond your home (`controlsTerritoryBeyondHome` in board.ts, checked in `castCreature`). Makes Mushroom a genuine prerequisite rather than one option among five, and reinforces the establish → maintain arc: this is a **continuous** check, so if a player's only Mushroom dies and they haven't replanted, they're locked out of casting anything else again until they do — not a one-time unlock. Home hex ownership alone doesn't satisfy it, since that's unconditional from turn one and would make the gate a no-op. `HandPanel.tsx` shows a `card-locked` reason on blocked cards, same pattern as The Big Guy's center-control lock.
- **Starting hand guarantees a Mushroom (added 2026-08-06):** a random 3-card hand from the 15-card deck (5 Mushroom copies) had a ~26% chance of holding zero Mushrooms — which, combined with the territory gate above, could strand a player unable to cast *anything* on turn one. `buildStartingHand` in deck.ts reserves one Mushroom out of the shuffle before dealing the rest, guaranteeing at least one in every opening hand without touching deck-list odds for the remainder of the game.

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

## Headless playtesting harness (added 2026-08-06)

`npm run playtest` (optionally `-- --games=N`, default 20 per matchup) runs simulated games directly against `gameReducer` — no browser needed. Four scripted bot personalities (`src/sim/strategies.ts`): `random`, `rusher` (aggressive tempo, takes any kill, dumps mana on the cheapest legal cast), `turtler` (keeps a Mushroom alive, only takes safe attacks, never advances without reason), `hoarder` (bank mana for The Big Guy, minimum Mushroom upkeep, contest the center). Legality is enumerated in `src/sim/intents.ts` by re-deriving from the same exported predicates the reducer uses (`ownerOf`, `controlsTerritoryBeyondHome`) rather than trial-running the reducer per candidate hex — fast enough to run hundreds of games in ~1-2 seconds — but the actual state transitions always go through the real `gameReducer`, so results reflect real game rules, not a reimplementation of them. `scripts/playtest.ts` runs every strategy pairing (both sides) and prints win rates, win-condition breakdown, average game length, Big Guy cast rate, cards burned, and final territory.

**First run surfaced three findings, not yet acted on:**
- Orange (first player) wins only ~29% of games aggregated across all matchups — a bigger gap than the documented income-timing asymmetry alone would suggest (see "Game phases & mana pacing" above). Worth a closer look before assuming it's fully explained.
- Aggression currently dominates: `rusher` wins ~60% of its games vs. `turtler` at 32% and `hoarder` at 14%.
- The Big Guy was never fielded once across 320 simulated games, including in the slowest turtler-mirror matchups (~28+ turns). Partly a naive-bot artifact (`hoarder` doesn't defend its lone Mushroom and dies to elimination around turn 6-7, well before turn 8-9 mana), but the fact that *no* strategy ever reached it is a signal the "gamble on Big Guy" arc may not be reachable under current pacing/rules as tuned. Candidate follow-ups if this holds up: soften the elimination condition, buff Mushroom's toughness, or retune Big Guy's cost/timing — not decided yet.

## Parking lot / open ideas

Not scheduled into the build order yet — captured so they don't get lost, not committed to.

- **Home-territory combat buff/debuff.** A creature standing on a hex its owner controls gets some combat bonus (e.g. +power or +toughness); alternately, a creature standing outside its owner's territory gets a debuff. Would make territory matter for combat outcomes directly, not just casting eligibility and mana income — fighting to hold/take ground would have teeth beyond the mana bonus. Open questions once this gets picked up: buff-at-home vs. debuff-away-from-home (or both?), exact magnitude, and whether it applies to all creatures or interacts oddly with Magic Mushroom (which already defines territory) or The Big Guy (stationary, always "home" at the center).
- **Variable decay rate (partially superseded 2026-08-06 — see decision log).** Original idea: a mushroom sitting within the player's own already-established territory decays slower ("home field"), one further out toward the border or in enemy-adjacent ground decays faster ("away field"). Still parked — `MUSHROOM_LIFESPAN` got a flat bump instead (5 → 8) as a quicker fix for the immediate "stranding units" complaint, backed by playtest-harness data. This variable-rate idea remains open if flat lifespan turns out insufficient; ties into the home-territory buff/debuff idea above (same underlying "home vs. away matters" concept), and still has the same open chicken-and-egg question — how is "own established territory" measured for a mushroom that's arguably what's establishing the territory in the first place.
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
- 2026-08-06 — `MUSHROOM_LIFESPAN` raised 5 → 8, per user feedback that mushrooms were timing out too fast and stranding units. Swept 5/8/12/25 with the playtest harness (320 games each) before picking: territory stability roughly triples by 25, and — unexpectedly — orange's turn-order disadvantage shrinks as lifespan grows (28% win rate at 5 → 44% at 25), with no sign of stalemating even at effectively-unlimited (games still averaged ~26 turns). Landed on 8 rather than going higher because it lines up with the Behemoth timing already documented in the phase table above, so a turn-1 Mushroom now survives through that transition instead of expiring mid-transition. Confirmed via the same sweep that lifespan is *not* why The Big Guy never gets cast — 0% Big-Guy-landed rate held at every tested value, including unlimited — so that's a separate open problem, not a Mushroom-timer symptom.
