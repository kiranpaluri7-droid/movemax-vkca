# MoveMax — VKCA Core Chess Foundation

## Included
- Responsive chessboard with tap-to-select and tap-to-move.
- Legal move validation through chess.js.
- Check/checkmate/stalemate and draw-state messaging supported by the rules library.
- Interactive promotion chooser (Queen, Rook, Bishop, Knight).
- Move list, flip board, restart, undo/redo and PGN copy.
- Custom Setup piece tray, erase tool, side-to-move, FEN import/export and validation.
- Analysis board for exploring legal variations.
- Preserves the VKCA dark theme and includes a simple light-mode toggle.

## Run
Because this uses an ES module from a CDN, open the folder using a local static server instead of `file://` when possible.

Example with Python installed:
1. Open a terminal in this folder.
2. Run `python -m http.server 8000`
3. Open `http://localhost:8000`

The app requires internet access to load the chess.js module from jsDelivr.

## Important scope note
This is a Phase 1/2 browser foundation plus a functional custom-position editor. It does not yet include Stockfish analysis, AI gameplay, persistent IndexedDB storage, clocks, accounts, online multiplayer, tournaments, or server-side anti-cheat. The Analysis screen is a legal move-exploration board and clearly does not fabricate engine evaluations.

## Piece art note
The current build uses consistent chess Unicode glyphs with CSS outlines as a lightweight starter renderer. For the final premium visual release, replace these glyphs with a complete, licensed, consistent SVG/PNG piece set and verify sizing on Android devices.
