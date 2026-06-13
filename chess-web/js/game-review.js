// game-review.js — Post-game analysis with move classification
// Categories: Brilliant, Great, Best, Good, Book, Inaccuracy, Mistake, Blunder, Missed Win

const CLASSIFICATIONS = {
    BRILLIANT:   { key: 'brilliant',   symbol: '!!', label: 'Brilliant',   color: '#1abc9c', class: 'badge-brilliant' },
    GREAT:       { key: 'great',       symbol: '!',  label: 'Great',      color: '#3498db', class: 'badge-great' },
    BEST:        { key: 'best',        symbol: '✓',  label: 'Best',       color: '#27ae60', class: 'badge-best' },
    GOOD:        { key: 'good',        symbol: '●',  label: 'Good',       color: '#82e0aa', class: 'badge-good' },
    BOOK:        { key: 'book',        symbol: '📖', label: 'Book',       color: '#d4a574', class: 'badge-book' },
    FORCED:      { key: 'forced',      symbol: '—',  label: 'Forced',     color: '#888888', class: 'badge-forced' },
    INACCURACY:  { key: 'inaccuracy',  symbol: '?!', label: 'Inaccuracy', color: '#f1c40f', class: 'badge-inaccuracy' },
    MISTAKE:     { key: 'mistake',     symbol: '?',  label: 'Mistake',    color: '#e67e22', class: 'badge-mistake' },
    BLUNDER:     { key: 'blunder',     symbol: '??', label: 'Blunder',    color: '#e74c3c', class: 'badge-blunder' },
    MISSED_WIN:  { key: 'missed_win',  symbol: '⊘',  label: 'Missed Win', color: '#9b59b6', class: 'badge-missed-win' },
};

class GameReview {
    constructor() {
        this.engine = new AIEngine('hard');
        this.analysisDepth = 5;
        this.results = null;
    }

    async analyze(originalGame, progressCallback) {
        const moves = originalGame.sanHistory.slice();
        const historyMoves = originalGame.history.map(h => h.move);
        const results = {
            moves: [],
            whiteSummary: this._emptySummary(),
            blackSummary: this._emptySummary(),
            whiteAccuracy: 0,
            blackAccuracy: 0
        };

        // Replay the game and analyze each position
        const analysisGame = new ChessGame();
        const uciHistory = [];
        let prevEval = 0;

        for (let i = 0; i < historyMoves.length; i++) {
            const move = historyMoves[i];
            const isWhiteMove = i % 2 === 0;
            const moveNum = Math.floor(i / 2) + 1;
            const san = moves[i];

            if (progressCallback) {
                progressCallback(i + 1, historyMoves.length, san);
            }

            // Get engine evaluation BEFORE the move
            const { score: bestScore, bestMove } = this.engine.getEvaluation(analysisGame, this.analysisDepth);
            const evalBefore = isWhiteMove ? bestScore : -bestScore; // Always from white's perspective

            // Check if this is a book move
            const uciMove = ChessUtils.sqName(move.from) + ChessUtils.sqName(move.to) + (move.promotion ? move.promotion.toLowerCase() : '');
            const bookCheck = OpeningBook.isBookMove(uciHistory, uciMove);

            // Check how many legal moves were available (for forced move detection)
            const legalMovesCount = analysisGame.generateLegalMoves().length;

            // Check if the played move matches the engine's best
            const isEngineBest = bestMove && move.from === bestMove.from && move.to === bestMove.to;

            // Check for brilliant sacrifice BEFORE making the move:
            // The piece is valuable (not a pawn), moves to a square attacked by the opponent,
            // and is not simply capturing an equal-or-greater-value piece
            const pieceValue = PIECE_VALUES_REV[move.piece.toLowerCase()];
            const capturedValue = move.captured ? PIECE_VALUES_REV[move.captured.toLowerCase()] : 0;
            const oppColor = isWhiteMove ? 'b' : 'w';
            const isSacrifice = isEngineBest && 
                pieceValue > 1 && 
                pieceValue > capturedValue && 
                analysisGame._isAttacked(move.to, oppColor);

            // Make the actual move
            analysisGame._doMove(move);
            uciHistory.push(uciMove);

            // Get eval AFTER the move (from white's perspective)
            const afterResult = this.engine.getEvaluation(analysisGame, this.analysisDepth);
            const evalAfter = isWhiteMove ? -afterResult.score : afterResult.score;

            // Calculate centipawn loss (always positive = move was bad)
            // evalBefore and evalAfter are both from white's perspective
            let cpLoss;
            if (isWhiteMove) {
                cpLoss = evalBefore - evalAfter; // white wants higher eval
            } else {
                cpLoss = evalAfter - evalBefore; // black wants lower eval
            }

            // Check if position was losing and this was the only/best saving move
            const wasLosing = isWhiteMove ? evalBefore < -150 : evalBefore > 150;

            // Check for missed forced win
            const hadWin = isWhiteMove ? evalBefore > 500 : evalBefore < -500;
            const lostWin = isWhiteMove ? evalAfter < 200 : evalAfter > -200;
            const missedWin = hadWin && lostWin && cpLoss > 100;

            // Classify the move
            let classification;
            if (legalMovesCount === 1) {
                // Only one legal move — forced, not rated
                classification = CLASSIFICATIONS.FORCED;
            } else if (bookCheck.isBook && i < 20) {
                classification = CLASSIFICATIONS.BOOK;
            } else if (missedWin) {
                classification = CLASSIFICATIONS.MISSED_WIN;
            } else if (cpLoss > 200) {
                classification = CLASSIFICATIONS.BLUNDER;
            } else if (cpLoss > 75) {
                classification = CLASSIFICATIONS.MISTAKE;
            } else if (cpLoss > 25) {
                classification = CLASSIFICATIONS.INACCURACY;
            } else if (isEngineBest && isSacrifice && cpLoss <= 10) {
                classification = CLASSIFICATIONS.BRILLIANT;
            } else if (isEngineBest && wasLosing && cpLoss <= 10) {
                classification = CLASSIFICATIONS.GREAT;
            } else if (isEngineBest) {
                classification = CLASSIFICATIONS.BEST;
            } else if (cpLoss <= 25) {
                classification = CLASSIFICATIONS.GOOD;
            } else {
                classification = CLASSIFICATIONS.GOOD;
            }

            const bestMoveSan = bestMove ? this._getBestMoveSan(analysisGame, bestMove, move, i) : san;

            results.moves.push({
                moveNumber: moveNum,
                isWhite: isWhiteMove,
                san: san,
                uci: uciMove,
                classification: classification,
                cpLoss: Math.max(0, Math.round(cpLoss)),
                evalBefore: Math.round(evalBefore),
                evalAfter: Math.round(evalAfter),
                bestMove: bestMoveSan,
                isEngineBest: isEngineBest,
                bookName: bookCheck.name,
                from: move.from,
                to: move.to
            });

            // Update summaries
            const summary = isWhiteMove ? results.whiteSummary : results.blackSummary;
            summary[classification.key] = (summary[classification.key] || 0) + 1;
            // Forced moves don't count toward accuracy (player had no choice)
            if (classification.key !== 'forced') {
                summary.totalMoves++;
                summary.totalCpLoss += Math.max(0, cpLoss);
            }

            prevEval = evalAfter;

            // Yield to UI
            await new Promise(r => setTimeout(r, 0));
        }

        // Calculate accuracy: 100 - 2*Blunders - 1*Mistakes - 0.5*Inaccuracies - 0.25*Misses
        const calcAcc = (s) => {
            const raw = 100
                - 2 * (s.blunder || 0)
                - 1 * (s.mistake || 0)
                - 0.5 * (s.inaccuracy || 0)
                - 0.25 * (s.missed_win || 0);
            return Math.max(0, Math.min(100, Math.ceil(raw)));
        };
        results.whiteAccuracy = calcAcc(results.whiteSummary);
        results.blackAccuracy = calcAcc(results.blackSummary);

        this.results = results;
        return results;
    }

    _getBestMoveSan(gameAfterMove, bestMove, actualMove, moveIndex) {
        // We need to get the SAN of the best move in the position BEFORE the actual move
        // Since we already made the actual move, we need to undo, get SAN, redo
        try {
            gameAfterMove._undoMove();
            const san = gameAfterMove.moveToSan(bestMove);
            gameAfterMove._doMove(actualMove);
            return san;
        } catch (e) {
            return '...';
        }
    }

    _emptySummary() {
        return {
            brilliant: 0, great: 0, best: 0, good: 0, book: 0, forced: 0,
            inaccuracy: 0, mistake: 0, blunder: 0, missed_win: 0,
            totalMoves: 0, totalCpLoss: 0
        };
    }
}

const PIECE_VALUES_REV = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

if (typeof window !== 'undefined') {
    window.GameReview = GameReview;
    window.CLASSIFICATIONS = CLASSIFICATIONS;
}
