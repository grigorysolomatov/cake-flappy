# Cake Flap

A tiny Flappy Bird-inspired browser game about a determined slice of cake.

## Play locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Controls

- Space / ↑ / click / tap: flap
- P: pause
- R: restart
- M: mute

## Deploy on GitHub Pages

This project has no build step. Put the files in the repository root and enable GitHub Pages:

- Settings → Pages
- Source: Deploy from a branch
- Branch: `main` / root

The site URL will be:

```text
https://<github-username>.github.io/cake-flappy/
```

## Files

- `index.html` — page shell
- `styles.css` — visual theme and responsive layout
- `game.js` — game loop, physics, drawing, collision, audio
- `.nojekyll` — tells GitHub Pages to serve the root as-is
