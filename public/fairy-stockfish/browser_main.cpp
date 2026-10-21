/* Browser transport for Fairy-Stockfish. Distributed under GPL-3.0-or-later. */
#include <emscripten/bind.h>
#include <sstream>
#include "bitboard.h"
#include "endgame.h"
#include "position.h"
#include "psqt.h"
#include "search.h"
#include "thread.h"
#include "tt.h"
#include "uci.h"
#include "piece.h"
#include "variant.h"
namespace Stockfish { void browser_command(std::string); }
using namespace Stockfish;
void initialize_browser() {
  pieceMap.init(); variants.init(); UCI::init(Options); Tune::init();
  std::istringstream config("[cfour]\nmaxRank=6\nmaxFile=7\nimmobile=p\nstartFen=7/7/7/7/7/7[PPPPPPPPPPPPPPPPPPPPPppppppppppppppppppppp] w - - 0 1\npieceDrops=true\nenclosingDrop=top\ndoubleStep=false\ncastling=false\nstalemateValue=draw\nimmobilityIllegal=false\nconnectN=4\nnMoveRule=0\n");
  variants.parse_istream<false>(config);
  Options["UCI_Variant"].set_combo(variants.get_keys());
  Options["Use NNUE"] = std::string("false");
  PSQT::init(variants.find(Options["UCI_Variant"])->second);
  Bitboards::init(); Position::init(); Bitbases::init(); Endgames::init();
  Threads.set(1); Search::clear();
}
EMSCRIPTEN_BINDINGS(fairy_browser) {
  emscripten::function("initialize", &initialize_browser);
  emscripten::function("command", &browser_command);
}
