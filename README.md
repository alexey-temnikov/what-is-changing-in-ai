# What Is Changing in AI (2022–2026)

A visual retrospective of the global shift in AI — from generative sequence prediction to stateful autonomous agents, modular hardware, sovereign local networks, and economic restructuring.

> **Note:** This codebase is not intended to be human-readable; it is optimized for generating and serving the static experience.

## Pages

| File | Description |
|------|-------------|
| `index.html` | Main interactive timeline |
| `talk.html` | Presentation / talk mode |
| `present.html` | Slide presenter view |
| `live-demo.html` | In-browser LLM live demo (runs models locally via WebGPU) |

## Start a local Python HTTP server

From the project root, start Python's built-in static file server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

You can also open a specific page directly:

- [http://localhost:8000/index.html](http://localhost:8000/index.html)
- [http://localhost:8000/talk.html](http://localhost:8000/talk.html)
- [http://localhost:8000/present.html](http://localhost:8000/present.html)
- [http://localhost:8000/live-demo.html](http://localhost:8000/live-demo.html)

To use a different port, replace `8000` with another number:

```bash
python3 -m http.server 8080
```

Press `Ctrl+C` in the terminal to stop the server.

> **Note:** Pages must be served over HTTP — Chrome blocks `fetch()` from `file://` URLs.

## Live demo (optional)

The live demo page runs small LLMs entirely in the browser using WebGPU (no server needed beyond the static file server). Pre-download the models once before going offline:

```bash
./download-models.sh        # recommended small set
./download-models.sh all    # every available model
```

Models are saved to `./models/` and served by the same local server.

**Requirements:** A browser with WebGPU support (Chrome 113+ / Edge 113+).
