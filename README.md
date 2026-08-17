# WRCdle 🏁

**WRCdle** is a free daily guessing game for World Rally Championship fans.

Guess the mystery WRC driver in **six tries** using feedback on nationality, manufacturer/team, titles, rally wins and WRC debut year.

### ▶️ Play

**https://wrcdle.com**

## How it works

Each guess gives you a set of clues:

- 🟩 **Green** — correct
- 🟥 **Red** — incorrect
- 🟨 **Yellow manufacturer/team** — the mystery driver has driven for that manufacturer/team before
- ⬆️ / ⬇️ — the mystery driver's value is higher or lower

A new puzzle is available each day. Your game state, stats, streak and guess distribution are stored locally in your browser, so no account is required.

## Driver pool

WRCdle focuses on top-level WRC drivers from the **World Rally Car / Rally1 era**. The current pool is intended to include drivers who were eligible to score manufacturer points or have achieved at least one WRC podium during that era.

Driver data lives in [`drivers.json`](drivers.json).

A driver entry follows this general structure:

```json
{
  "id": "pajari_sami",
  "name": "Sami Pajari",
  "nationality": "Finland",
  "manufacturer": "Toyota",
  "manufacturers": ["Toyota"],
  "firstWRCStart": 2019,
  "titles": 0,
  "wins": 2
}
```

The game validates the driver data on load and reports duplicate IDs, missing required fields and invalid values in the browser console.

## Daily puzzle selection

The daily driver is selected using a deterministic seeded shuffle, so players receive the same puzzle for a given day while the order still feels random.

**Maintenance note:** changing statistics such as wins or titles does not alter the shuffle order, but adding, removing or reordering driver records can change the generated puzzle sequence. Pool changes are therefore best made between daily puzzles rather than during an active day.

## Features

- Daily WRC driver puzzle
- Six guesses per day
- Desktop table and mobile card layouts
- Autocomplete with keyboard navigation
- Manufacturer/team history feedback
- Persistent game state using `localStorage`
- Win rate, streaks and guess distribution
- Results modal and daily countdown
- Shareable emoji result grid
- Responsive mobile-first layout

## Running locally

WRCdle is a static site built with plain HTML, CSS and JavaScript — no build step or package install is required.

1. Clone or download the repository.
2. Serve the repository root with a local web server, such as **VS Code Live Server**.
3. Open `index.html` through the local server.

Opening the HTML directly as a `file://` URL is not recommended because the game loads `drivers.json` with `fetch()`.

## Project structure

```text
wrcdle/
├── index.html          # Interface and styles
├── game.js             # Game logic, persistence, stats and sharing
├── drivers.json        # Driver database
├── images/logos/       # Manufacturer/team logos
├── CNAME               # GitHub Pages custom domain
└── favicon files       # Browser and mobile icons
```

## Feedback / Service Park Support 🔧

Questions, corrections, comments or driver-data updates are welcome:

**timo@wrcdle.com**

> “The speed was OK, but the corner was too tight.”

## Disclaimer

WRCdle is an independent fan-made project and is not affiliated with, endorsed by or sponsored by the FIA, WRC Promoter, the World Rally Championship, its teams or manufacturers. Names, logos and trademarks belong to their respective owners.
