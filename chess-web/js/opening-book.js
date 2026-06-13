// opening-book.js — Embedded opening book for book move detection and AI play
const OPENING_BOOK = {
    // Key: sequence of moves (space separated UCI), Value: { name, next moves }
    lines: [
        { name: "Italian Game", moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5" },
        { name: "Ruy Lopez", moves: "e2e4 e7e5 g1f3 b8c6 f1b5" },
        { name: "Sicilian Defense (Open)", moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4" },
        { name: "Sicilian Najdorf", moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6" },
        { name: "Sicilian Dragon", moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6" },
        { name: "French Defense", moves: "e2e4 e7e6 d2d4 d7d5" },
        { name: "French Winawer", moves: "e2e4 e7e6 d2d4 d7d5 b1c3 f8b4" },
        { name: "Caro-Kann Defense", moves: "e2e4 c7c6 d2d4 d7d5" },
        { name: "Pirc Defense", moves: "e2e4 d7d6 d2d4 g8f6 b1c3 g7g6" },
        { name: "Scandinavian Defense", moves: "e2e4 d7d5 e4d5 d8d5" },
        { name: "Queen's Gambit Declined", moves: "d2d4 d7d5 c2c4 e7e6" },
        { name: "Queen's Gambit Accepted", moves: "d2d4 d7d5 c2c4 d5c4" },
        { name: "Slav Defense", moves: "d2d4 d7d5 c2c4 c7c6" },
        { name: "King's Indian Defense", moves: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7" },
        { name: "Nimzo-Indian Defense", moves: "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4" },
        { name: "Queen's Indian Defense", moves: "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6" },
        { name: "Grünfeld Defense", moves: "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5" },
        { name: "English Opening", moves: "c2c4 e7e5" },
        { name: "Réti Opening", moves: "g1f3 d7d5 c2c4" },
        { name: "London System", moves: "d2d4 d7d5 g1f3 g8f6 c1f4" },
        { name: "Scotch Game", moves: "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4" },
        { name: "Petrov's Defense", moves: "e2e4 e7e5 g1f3 g8f6" },
        { name: "Vienna Game", moves: "e2e4 e7e5 b1c3" },
        { name: "King's Gambit", moves: "e2e4 e7e5 f2f4" },
        { name: "Dutch Defense", moves: "d2d4 f7f5" },
        { name: "Catalan Opening", moves: "d2d4 g8f6 c2c4 e7e6 g2g3" },
        { name: "Benoni Defense", moves: "d2d4 g8f6 c2c4 c7c5 d4d5" },
        { name: "Philidor Defense", moves: "e2e4 e7e5 g1f3 d7d6" },
        { name: "Alekhine's Defense", moves: "e2e4 g8f6" },
        { name: "Bird's Opening", moves: "f2f4" },
        { name: "Four Knights Game", moves: "e2e4 e7e5 g1f3 b8c6 b1c3 g8f6" },
        { name: "Giuoco Piano", moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3" },
        { name: "Evans Gambit", moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4" },
        { name: "Bogo-Indian Defense", moves: "d2d4 g8f6 c2c4 e7e6 g1f3 f8b4" },
        { name: "Modern Defense", moves: "e2e4 g7g6 d2d4 f8g7" },
        { name: "Sicilian Alapin", moves: "e2e4 c7c5 c2c3" },
        { name: "Sicilian Closed", moves: "e2e4 c7c5 b1c3" },
        { name: "Semi-Slav Defense", moves: "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6" },
        { name: "Tarrasch Defense", moves: "d2d4 d7d5 c2c4 e7e6 b1c3 c7c5" },
    ]
};

// Build a trie-like lookup from move sequences
const _bookMap = new Map();
for (const line of OPENING_BOOK.lines) {
    const moves = line.moves.split(' ');
    for (let i = 0; i < moves.length; i++) {
        const key = moves.slice(0, i).join(' ');
        if (!_bookMap.has(key)) _bookMap.set(key, []);
        const existing = _bookMap.get(key);
        if (!existing.find(e => e.move === moves[i])) {
            existing.push({ move: moves[i], name: line.name });
        }
    }
}

function getBookMoves(moveHistory) {
    const key = moveHistory.join(' ');
    return _bookMap.get(key) || [];
}

function isBookMove(moveHistory, uciMove) {
    const bookMoves = getBookMoves(moveHistory);
    const found = bookMoves.find(b => b.move === uciMove);
    return found ? { isBook: true, name: found.name } : { isBook: false, name: null };
}

function getRandomBookMove(moveHistory) {
    const bookMoves = getBookMoves(moveHistory);
    if (bookMoves.length === 0) return null;
    return bookMoves[Math.floor(Math.random() * bookMoves.length)];
}

if (typeof window !== 'undefined') {
    window.OpeningBook = { getBookMoves, isBookMove, getRandomBookMove, OPENING_BOOK };
}
