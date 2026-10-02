# Third-party software notices

The app bundles **Stockfish.js 19 lite single-threaded** (`stockfish@19.0.0`) as `public/stockfish/stockfish-19-lite-single.js` and `.wasm`. Stockfish.js is copyright © 2026 Chess.com, LLC; underlying Stockfish is copyright its contributors. The engine is licensed under **GNU GPL version 3**. The full license accompanies it at [`public/stockfish/Copying.txt`](public/stockfish/Copying.txt), and exact source and binary hashes are recorded in [`public/stockfish/SOURCE.txt`](public/stockfish/SOURCE.txt). The corresponding Stockfish.js source revision is [`54fde71d90c7c403964f6cacef48f7bbec495df1`](https://github.com/nmrugg/stockfish.js/tree/54fde71d90c7c403964f6cacef48f7bbec495df1); the npm archive is pinned by the repository's `package-lock.json` integrity hash. The app has not modified the engine files; checked-in copies match that package's files byte for byte.

Other direct runtime dependencies, with versions from this lockfile, are:

| Dependency | Version | License |
| --- | --- | --- |
| `@capacitor/core`, `@capacitor/ios` | 8.5.2 | MIT |
| `chess.js` | 1.4.0 | BSD-2-Clause |
| `react`, `react-dom` | 19.3.0 | MIT |
| `react-chessboard` | 5.12.1 | MIT |

Their source and license texts are distributed by the respective npm packages. This inventory does not replace the complete dependency license audit needed for release.

## Unresolved release question

The React app exchanges UCI commands and results with Stockfish.js in a Web Worker. Whether this is a separate-program arrangement or one combined GPL-covered work is a legal judgment; the [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation) says the boundary depends on both the communication mechanism and the semantics. If it is a combined work, distributing the iOS app may require licensing the app code under GPLv3 and providing its complete corresponding source and any required installation information. App Store distribution terms also need review; [Apple's Standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) includes a carve-out for open-source component licenses, but that does not by itself establish GPL compliance. Obtain qualified license review before App Store distribution. This notice does not assert that the current app is ready for distribution under GPLv3.

Paid lesson prose is stored separately in a private content repository and is not part of the public web build. Its copyright and licensing should be addressed separately from engine and app-code licensing.
