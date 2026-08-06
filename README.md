# HexGame

A hex-grid board game riffing on the double meaning of "Hex" — grid tiles and magic. Two players cast creatures onto a hex-shaped board using mana, fight over territory, and race toward either wiping the other out or outlasting a turn-30 countdown.

Catan-style hex board, Magic/Hearthstone-style creature casting, StarCraft Zerg-inspired color scheme and territory control. See `homages-and-references.md` for the full list of what's borrowed from where, and `implementation-log.md` for current mechanic status, build order, and open design questions — those two files are the source of truth for where the project actually is.

## Stack

React + SVG + [honeycomb-grid](https://github.com/flauwekeul/honeycomb) v4 + framer-motion, on Vite + TypeScript. Chosen over a game engine like Phaser because this is a turn-based, state-heavy game (resource panels, cards, board state) rather than a real-time/physics one — React's declarative state model fits that better than an imperative scene/update-loop model.

**Note:** honeycomb-grid v4's API differs substantially from v3 — most examples found online are v3-era and won't match this codebase (`defineHex`/`Grid`/`spiral` traversers, `hex.corners` already absolute pixel coordinates, not relative).

## Running it

```sh
npm install
npm run dev
```
