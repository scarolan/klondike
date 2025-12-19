# Klondike Solitaire

A classic Klondike solitaire card game built with vanilla JavaScript, HTML, and CSS. Features beautiful pixel art fantasy playing cards.

## Play

Open `index.html` in a web browser, or serve the files with any HTTP server:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`

## Features

- **Drag and drop** - Move cards between tableau piles and to foundations
- **Double-click** - Automatically move cards to foundations when valid
- **Auto-complete** - When all cards are face-up and stock is empty, cards automatically fly to foundations
- **Hints toggle** - Enable hints to highlight valid drop targets while dragging
- **Move counter** - Track your progress
- **Responsive design** - Works on various screen sizes

## Game Rules

- **Goal**: Move all 52 cards to the four foundation piles, sorted by suit from Ace to King
- **Tableau**: Build down in alternating colors (red on black, black on red)
- **Foundation**: Build up by suit (Ace, 2, 3... Queen, King)
- **Empty columns**: Only Kings can be placed on empty tableau columns
- **Stock**: Click to draw cards to the waste pile

## Card Assets

This game uses the [Pixel Fantasy Cards](https://cazwolf.itch.io/pixel-fantasy-cards) asset pack by CazWolf.

## License

MIT License - see [LICENSE](LICENSE) file for details.
