# Zen Garden 🪨

A little 3D desktop zen garden in your browser. Drag in stones, plants, decorations and tiny animals, rake patterns into the sand, and listen to wind chimes while you do it.

It's real 3D, built with [three.js](https://threejs.org): a wooden tray with depth, soft shadows, and rake grooves that are actually pressed into the sand. A 3D rake, stick or smoother follows your cursor and drags through the sand as you work.

## Play

It's plain HTML/JS: no build step and no audio files (every sound is synthesized live). three.js loads from a CDN.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also just double-click `index.html`.

**GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `(root)`.

## What you can do

- **Place things**: drag anything from the panel on the left into the sand, or tap it to drop it in an open spot
  - *Stones*: river stone, granite, rose quartz, amethyst, cairn, slate, mossy boulder, pebbles
  - *Plants*: air plant, blushing air plant, moss, succulent, bonsai, bamboo
  - *Decor*: stone lantern (it glows), bridge, koi pond (the koi swim), torii gate, shell, candle (it flickers)
  - *Animals*: frog, turtle, sleepy cat, sparrow, snail, bunny, butterfly
- **Look around**: right-drag (or two fingers) to turn the garden, and scroll or pinch to zoom. The *3D* / *Top* buttons switch between an angled view and looking straight down.
- **Arrange**: drag to move. Select something to get a toolbar for rotate, resize, flip and remove. You can also drag it out of the tray to remove it.
- **Rake the sand** with five tools:
  - *Rake* (5 tines) and *Wide rake* (9 tines) for flowing lines and waves
  - *Stick* for a single line
  - *Ripples*: tap the sand, or tap a stone or plant, to draw circles around it
  - *Smooth*: brush the sand flat again
- **Animals have a life of their own**: frogs, bunnies and sparrows hop around and leave little prints. The turtle walks and leaves footprints, the snail leaves a shiny trail, the butterfly flutters off to land on your plants, and the cat just naps. Tap any animal to hear it. Turn this off with *Animals roam*.
- **Sounds**: sand scraping that follows how fast you rake, a stone clack, a plant rustle, and animal voices, plus optional *Wind*, *Chimes* and *Stream* ambience and a mute button
- **Customize**: six sand colours (classic, white, pearl, rose, sea glass, charcoal) and five frames (birch, walnut, ebony, bamboo, stone)
- **Undo** strokes, **Smooth all**, or start a **New garden**
- **Save picture**: downloads a PNG of your garden from the current camera angle
- Your garden is **saved automatically** in your browser

### Keyboard

| Key | Action |
| --- | --- |
| `1`–`5` | Rake, Wide rake, Stick, Ripples, Smooth |
| `Ctrl/⌘ + Z` | Undo the last stroke |
| `R` / `Shift + R` | Rotate the selected item |
| `+` / `−` | Resize the selected item (the mouse wheel works too) |
| `F` | Flip the selected item |
| Arrow keys | Nudge the selected item |
| `Delete` | Remove the selected item |
| `Esc` | Deselect |
| `T` | Switch between the 3D and top views |

## Code

| File | What it does |
| --- | --- |
| `js/items.js` | The item list (names, sizes, how animals move) and the SVG icons in the picker |
| `js/models.js` | The 3D models for every item, plus the rake, stick and smoother tools |
| `js/sand.js` | The sand. Each stroke is stored so it can be redrawn, undone and saved, and painted into a colour map and a height map |
| `js/audio.js` | All sound effects and ambience, built with the Web Audio API |
| `js/app.js` | The 3D scene, camera, picking, drag and drop, raking, animal behaviour, saving and the picture export |
| `css/style.css` | Layout |

## License

MIT
