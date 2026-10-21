# Fairy engine inventory

| Component | Version / source | License | Modified | Distributed |
| --- | --- | --- | --- | --- |
| ffish rules | Source corresponding to ffish-es6 0.7.10; Fairy-Stockfish `43b66c8abfebfcab893a3a4c349aa790d18df148` | GPL-3.0-or-later | Recompiled without dynamic execution; explicit move ownership for PGN binding; rules unchanged | JS and WASM |
| Fairy-Stockfish AI | Same source revision | GPL-3.0-or-later | Single-worker scheduler and UCI transport; search/rules unchanged | JS and WASM |
| cfour profile | Same revision, `src/variants.ini` | GPL-3.0-or-later | No rule changes | Config embedded in wrappers |

Corresponding upstream source: https://github.com/fairy-stockfish/Fairy-Stockfish/tree/43b66c8abfebfcab893a3a4c349aa790d18df148

The distributed directory `/engines/fairy/` contains `COPYING.txt`, `AUTHORS`, the complete pinned upstream source archive `fairy-source.tar.gz`, `single-worker.patch`, `browser_main.cpp`, and `Makefile.browser`. It contains everything needed to rebuild the AI and rules binding with Emscripten 3.1.74. Rules compile with upstream's `NO_THREADS` define and `DYNAMIC_EXECUTION=0`; the browser keeps its restrictive CSP, including no `unsafe-eval`. The PGN binding explicitly transfers move ownership for compatibility with current embind. Preserve this complete source distribution and notices whenever redistributing the binaries. The runtime and integration code in `packages/fairy-chess` are GPL-3.0-or-later.

Build AI and rules from the accompanying source:

```sh
tar -xzf fairy-source.tar.gz --strip-components=1 -C SOURCE_DIRECTORY
cd SOURCE_DIRECTORY
patch -p1 < /path/to/single-worker.patch
cp /path/to/browser_main.cpp /path/to/Makefile.browser src/
cd src
make -f Makefile.browser CXX=em++
make -f Makefile.browser rules CXX=em++
```

Or run `bun scripts/fairy-build.ts` with Emscripten 3.1.74 on PATH. The script verifies the upstream archive's SHA-256 before compilation. It uses no NNUE model, SIMD, pthreads, SharedArrayBuffer, COOP, or COEP.

The browser UI starts the AI Worker only for a computer game. Each session reuses its Worker across moves. Search uses stock Fairy-Stockfish iterative deepening with a bounded time budget. The Worker is terminated for cancellation, crashes and route disposal; pooled functional calls release it after 30 seconds idle. Termination is required to interrupt synchronous WASM search, so a cancelled search creates a new Worker on retry. Normal completed moves do not.

Royal pieces, mandatory captures, promotion limits, equalizing moves, end conditions and legal moves are all evaluated by the pinned Fairy rules WASM. The application does not implement an alternate chess/Connect Four rules engine. Coordinates, board display, notation and winning-chain highlighting are adapters only.
