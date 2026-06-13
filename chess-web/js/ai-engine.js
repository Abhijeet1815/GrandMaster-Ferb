// ai-engine.js — Chess AI with minimax, alpha-beta, and evaluation from Hagnus-Carlsen
const MATE_SCORE = 100000;
const INF = 999999;

// Material values (from your evaluate.h) — midgame, endgame
const MATERIAL = { p: [80, 100], n: [320, 320], b: [330, 360], r: [500, 600], q: [900, 1000], k: [0, 0] };

// Piece-Square Tables ported from your evaluate.h (white perspective, a1=index 0)
const PST = {
    p: {
        mg: [0,0,0,0,0,0,0,0, 5,10,10,-20,-20,10,10,5, 15,5,-10,0,0,-10,5,15, 0,0,0,20,20,0,0,0, 5,5,10,25,25,10,5,5, 10,10,20,30,30,20,10,10, 50,50,50,50,50,50,50,50, 0,0,0,0,0,0,0,0],
        eg: [0,0,0,0,0,0,0,0, 10,10,10,10,10,10,10,10, 10,10,10,10,10,10,10,10, 20,20,20,20,20,20,20,20, 30,30,30,30,30,30,30,30, 50,50,50,50,50,50,50,50, 80,80,80,80,80,80,80,80, 0,0,0,0,0,0,0,0]
    },
    n: {
        mg: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
        eg: [-50,-30,-20,-20,-20,-20,-30,-50, -30,-10,0,5,5,0,-10,-30, -20,0,10,15,15,10,0,-20, -20,5,15,20,20,15,5,-20, -20,5,15,20,20,15,5,-20, -20,0,10,15,15,10,0,-20, -30,-10,0,5,5,0,-10,-30, -50,-30,-20,-20,-20,-20,-30,-50]
    },
    b: {
        mg: [-20,-10,-10,-10,-10,-10,-10,-20, -10,30,0,5,5,0,30,-10, -10,0,8,10,10,8,0,-10, -10,5,10,12,12,10,5,-10, -10,5,10,12,12,10,5,-10, -10,0,8,10,10,8,0,-10, -10,12,0,5,5,0,12,-10, -20,-10,-10,-10,-10,-10,-10,-20],
        eg: [-20,-10,-10,-10,-10,-10,-10,-20, -10,12,5,5,5,5,12,-10, -10,5,10,10,10,10,5,-10, -10,5,10,12,12,10,5,-10, -10,5,10,12,12,10,5,-10, -10,5,10,10,10,10,5,-10, -10,12,5,5,5,5,12,-10, -20,-10,-10,-10,-10,-10,-10,-20]
    },
    r: {
        mg: [0,0,0,0,0,0,0,0, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 5,10,10,10,10,10,10,5, 0,0,0,5,5,0,0,0],
        eg: [0,0,0,0,0,0,0,0, 10,15,15,15,15,15,15,10, 10,15,15,15,15,15,15,10, 10,15,15,15,15,15,15,10, 10,15,15,15,15,15,15,10, 10,15,15,15,15,15,15,10, 10,15,15,15,15,15,15,10, 0,0,0,0,0,0,0,0]
    },
    q: {
        mg: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
        eg: [-30,-20,-10,-10,-10,-10,-20,-30, -20,-10,0,5,5,0,-10,-20, -10,0,10,15,15,10,0,-10, -10,5,15,20,20,15,5,-10, -10,5,15,20,20,15,5,-10, -10,0,10,15,15,10,0,-10, -20,-10,0,5,5,0,-10,-20, -30,-20,-10,-10,-10,-10,-20,-30]
    },
    k: {
        mg: [10,30,10,0,0,10,30,10, 5,20,0,0,0,0,20,5, -10,-20,-20,-20,-20,-20,-20,-10, -20,-30,-30,-40,-40,-30,-30,-20, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30],
        eg: [-50,-30,-20,-10,-10,-20,-30,-50, -30,-10,0,10,0,0,-10,-30, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0]
    }
};

// MVV-LVA table for move ordering
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };

function mirrorSq(s) { return (7 - (s >> 3)) * 8 + (s & 7); }

class AIEngine {
    constructor(difficulty = 'medium') {
        this.setDifficulty(difficulty);
        this.nodesSearched = 0;
        this.moveHistory = []; // UCI move history for book lookup
    }

    setDifficulty(d) {
        this.difficulty = d;
        switch (d) {
            case 'newbie': this.maxDepth = 1; this.randomness = 60; break;
            case 'beginner': this.maxDepth = 2; this.randomness = 30; break;
            case 'intermediate': this.maxDepth = 4; this.randomness = 5; break;
            case 'advanced': this.maxDepth = 5; this.randomness = 0; break;
            default: this.maxDepth = 2; this.randomness = 30;
        }
    }

    evaluate(game) {
        const board = game.board;
        let mgScore = 0, egScore = 0;
        let phase = 0;
        const phaseVal = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
        let whiteBishops = 0, blackBishops = 0;

        for (let s = 0; s < 64; s++) {
            const p = board[s];
            if (!p) continue;
            const pt = p.toLowerCase();
            const isW = p === p.toUpperCase();
            const idx = isW ? s : mirrorSq(s);
            const mat = MATERIAL[pt];
            const pst = PST[pt];

            phase += phaseVal[pt];

            if (isW) {
                mgScore += mat[0] + pst.mg[idx];
                egScore += mat[1] + pst.eg[idx];
                if (pt === 'b') whiteBishops++;
            } else {
                mgScore -= mat[0] + pst.mg[idx];
                egScore -= mat[1] + pst.eg[idx];
                if (pt === 'b') blackBishops++;
            }
        }

        // Bishop pair bonus
        if (whiteBishops >= 2) { mgScore += 45; egScore += 70; }
        if (blackBishops >= 2) { mgScore -= 45; egScore -= 70; }

        // Pawn structure: doubled/isolated penalties
        for (let f = 0; f < 8; f++) {
            let wp = 0, bp = 0;
            for (let r = 0; r < 8; r++) {
                const p = board[r * 8 + f];
                if (p === 'P') wp++;
                if (p === 'p') bp++;
            }
            if (wp > 1) { mgScore -= 25 * (wp - 1); egScore -= 30 * (wp - 1); }
            if (bp > 1) { mgScore += 25 * (bp - 1); egScore += 30 * (bp - 1); }
        }

        // Tapered eval
        phase = Math.min(phase, 24);
        const score = (mgScore * phase + egScore * (24 - phase)) / 24;
        return game.turn === 'w' ? score : -score;
    }

    orderMoves(moves, game) {
        return moves.map(m => {
            let score = 0;
            if (m.captured) {
                score += 10 * (PIECE_VALUES[m.captured.toLowerCase()] || 0) - (PIECE_VALUES[m.piece.toLowerCase()] || 0);
                score += 1000;
            }
            if (m.promotion) score += PIECE_VALUES[m.promotion.toLowerCase()] * 100;
            if (m.flags & ChessFlags.KCASTLE || m.flags & ChessFlags.QCASTLE) score += 50;
            return { move: m, score };
        }).sort((a, b) => b.score - a.score).map(x => x.move);
    }

    quiescence(game, alpha, beta, depth) {
        this.nodesSearched++;
        const standPat = this.evaluate(game);
        if (depth <= 0) return standPat;
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const moves = game.generateLegalMoves().filter(m => m.captured);
        const ordered = this.orderMoves(moves, game);
        for (const m of ordered) {
            game._doMove(m);
            const score = -this.quiescence(game, -beta, -alpha, depth - 1);
            game._undoMove();
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }

    negamax(game, depth, alpha, beta, isRoot = false) {
        this.nodesSearched++;
        if (depth <= 0) return this.quiescence(game, alpha, beta, 4);

        const moves = game.generateLegalMoves();
        if (moves.length === 0) {
            if (game.isCheck()) return -MATE_SCORE + (this.maxDepth - depth);
            return 0; // stalemate
        }

        if (!isRoot && game.halfmoves >= 100) return 0;
        if (!isRoot && game._isThreefoldRepetition()) return 0;

        const ordered = this.orderMoves(moves, game);
        let bestMove = null;

        for (const m of ordered) {
            game._doMove(m);
            const score = -this.negamax(game, depth - 1, -beta, -alpha);
            game._undoMove();

            if (score > alpha) {
                alpha = score;
                bestMove = m;
                if (alpha >= beta) break;
            }
        }

        if (isRoot) this._bestMove = bestMove;
        return alpha;
    }

    getBestMove(game, uciHistory = []) {
        // Try opening book first
        const bookMove = OpeningBook.getRandomBookMove(uciHistory);
        if (bookMove && uciHistory.length < 16) {
            const uci = bookMove.move;
            const from = ChessUtils.nameToSq(uci.slice(0, 2));
            const to = ChessUtils.nameToSq(uci.slice(2, 4));
            const promo = uci.length > 4 ? uci[4] : null;
            const moves = game.generateLegalMoves();
            const match = moves.find(m => m.from === from && m.to === to &&
                (!promo || m.promotion?.toLowerCase() === promo));
            if (match) {
                match._isBook = true;
                match._bookName = bookMove.name;
                return match;
            }
        }

        this.nodesSearched = 0;
        this._bestMove = null;

        // Iterative deepening
        for (let d = 1; d <= this.maxDepth; d++) {
            this.negamax(game.clone(), d, -INF, INF, true);
        }

        let bestMove = this._bestMove;

        // Add randomness for easy mode
        if (this.randomness > 0 && Math.random() * 100 < this.randomness) {
            const moves = game.generateLegalMoves();
            if (moves.length > 1) {
                bestMove = moves[Math.floor(Math.random() * moves.length)];
            }
        }

        if (!bestMove) {
            const moves = game.generateLegalMoves();
            bestMove = moves[0] || null;
        }

        return bestMove;
    }

    // For review: get eval of a position
    getEvaluation(game, depth) {
        this.nodesSearched = 0;
        const d = depth || Math.min(this.maxDepth, 5);
        const score = this.negamax(game.clone(), d, -INF, INF, true);
        return { score, bestMove: this._bestMove };
    }
}

if (typeof window !== 'undefined') {
    window.AIEngine = AIEngine;
}
