// chess-engine.js — Complete chess rules engine
const FLAGS = { NORMAL: 0, CAPTURE: 1, EP: 2, KCASTLE: 4, QCASTLE: 8, PROMOTION: 16, DOUBLE_PUSH: 32 };
const PIECE_TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

function sq(r, f) { return r * 8 + f; }
function rank(s) { return s >> 3; }
function file(s) { return s & 7; }
function sqName(s) { return 'abcdefgh'[file(s)] + (rank(s) + 1); }
function nameToSq(n) { return n ? ('abcdefgh'.indexOf(n[0]) + (parseInt(n[1]) - 1) * 8) : -1; }
function isWhite(p) { return p && p === p.toUpperCase(); }
function isBlack(p) { return p && p === p.toLowerCase(); }
function pieceColor(p) { return p ? (isWhite(p) ? 'w' : 'b') : null; }
function pieceType(p) { return p ? p.toLowerCase() : null; }

const KNIGHT_OFFSETS = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING_OFFSETS = [-9, -8, -7, -1, 1, 7, 8, 9];
const BISHOP_DIRS = [-9, -7, 7, 9];
const ROOK_DIRS = [-8, -1, 1, 8];
const QUEEN_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];

class ChessGame {
    constructor(fen) {
        this.board = new Array(64).fill(null);
        this.turn = 'w';
        this.castling = { K: true, Q: true, k: true, q: true };
        this.epSquare = -1;
        this.halfmoves = 0;
        this.fullmoves = 1;
        this.history = [];
        this.sanHistory = [];
        this.fenHistory = [];
        if (fen) this.loadFen(fen);
        else this.reset();
    }

    reset() {
        this.loadFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }

    clone() {
        const g = new ChessGame();
        g.board = [...this.board];
        g.turn = this.turn;
        g.castling = { ...this.castling };
        g.epSquare = this.epSquare;
        g.halfmoves = this.halfmoves;
        g.fullmoves = this.fullmoves;
        g.history = this.history.map(h => ({ ...h, castling: { ...h.castling } }));
        g.sanHistory = [...this.sanHistory];
        g.fenHistory = [...this.fenHistory];
        return g;
    }

    loadFen(fen) {
        const parts = fen.trim().split(/\s+/);
        this.board.fill(null);
        const rows = parts[0].split('/');
        for (let r = 7; r >= 0; r--) {
            let f = 0;
            for (const ch of rows[7 - r]) {
                if (ch >= '1' && ch <= '8') f += parseInt(ch);
                else { this.board[sq(r, f)] = ch; f++; }
            }
        }
        this.turn = parts[1] || 'w';
        const c = parts[2] || '-';
        this.castling = { K: c.includes('K'), Q: c.includes('Q'), k: c.includes('k'), q: c.includes('q') };
        this.epSquare = parts[3] === '-' ? -1 : nameToSq(parts[3]);
        this.halfmoves = parseInt(parts[4]) || 0;
        this.fullmoves = parseInt(parts[5]) || 1;
        this.fenHistory = [this.toFen().split(' ').slice(0, 4).join(' ')];
    }

    toFen() {
        let fen = '';
        for (let r = 7; r >= 0; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const p = this.board[sq(r, f)];
                if (!p) empty++;
                else { if (empty) { fen += empty; empty = 0; } fen += p; }
            }
            if (empty) fen += empty;
            if (r > 0) fen += '/';
        }
        let c = '';
        if (this.castling.K) c += 'K'; if (this.castling.Q) c += 'Q';
        if (this.castling.k) c += 'k'; if (this.castling.q) c += 'q';
        if (!c) c = '-';
        const ep = this.epSquare >= 0 ? sqName(this.epSquare) : '-';
        return `${fen} ${this.turn} ${c} ${ep} ${this.halfmoves} ${this.fullmoves}`;
    }

    pieceAt(s) { return this.board[s]; }

    _isOwnPiece(p) { return p && pieceColor(p) === this.turn; }
    _isEnemyPiece(p) { return p && pieceColor(p) !== this.turn; }

    _generatePseudoMoves() {
        const moves = [];
        const color = this.turn;
        const isW = color === 'w';

        for (let s = 0; s < 64; s++) {
            const p = this.board[s];
            if (!p || pieceColor(p) !== color) continue;
            const pt = p.toLowerCase();

            if (pt === 'p') {
                const dir = isW ? 8 : -8;
                const startRank = isW ? 1 : 6;
                const promoRank = isW ? 7 : 0;
                // Forward
                const fwd = s + dir;
                if (fwd >= 0 && fwd < 64 && !this.board[fwd]) {
                    if (rank(fwd) === promoRank) {
                        for (const pr of ['q', 'r', 'b', 'n']) {
                            moves.push({ from: s, to: fwd, piece: p, captured: null, flags: FLAGS.PROMOTION, promotion: isW ? pr.toUpperCase() : pr });
                        }
                    } else {
                        moves.push({ from: s, to: fwd, piece: p, captured: null, flags: rank(s) === startRank ? FLAGS.NORMAL : FLAGS.NORMAL, promotion: null });
                        // Double push
                        if (rank(s) === startRank) {
                            const dbl = s + dir * 2;
                            if (!this.board[dbl]) {
                                moves.push({ from: s, to: dbl, piece: p, captured: null, flags: FLAGS.DOUBLE_PUSH, promotion: null });
                            }
                        }
                    }
                }
                // Captures
                for (const cd of [dir - 1, dir + 1]) {
                    const target = s + cd;
                    if (target < 0 || target >= 64 || Math.abs(file(target) - file(s)) !== 1) continue;
                    if (this.board[target] && pieceColor(this.board[target]) !== color) {
                        if (rank(target) === promoRank) {
                            for (const pr of ['q', 'r', 'b', 'n']) {
                                moves.push({ from: s, to: target, piece: p, captured: this.board[target], flags: FLAGS.CAPTURE | FLAGS.PROMOTION, promotion: isW ? pr.toUpperCase() : pr });
                            }
                        } else {
                            moves.push({ from: s, to: target, piece: p, captured: this.board[target], flags: FLAGS.CAPTURE, promotion: null });
                        }
                    }
                    // En passant
                    if (target === this.epSquare) {
                        const capturedPawn = isW ? 'p' : 'P';
                        moves.push({ from: s, to: target, piece: p, captured: capturedPawn, flags: FLAGS.EP | FLAGS.CAPTURE, promotion: null });
                    }
                }
            } else if (pt === 'n') {
                for (const off of KNIGHT_OFFSETS) {
                    const t = s + off;
                    if (t < 0 || t >= 64) continue;
                    const fd = Math.abs(file(t) - file(s));
                    if (fd !== 1 && fd !== 2) continue;
                    const tp = this.board[t];
                    if (tp && pieceColor(tp) === color) continue;
                    moves.push({ from: s, to: t, piece: p, captured: tp, flags: tp ? FLAGS.CAPTURE : FLAGS.NORMAL, promotion: null });
                }
            } else if (pt === 'k') {
                for (const off of KING_OFFSETS) {
                    const t = s + off;
                    if (t < 0 || t >= 64 || Math.abs(file(t) - file(s)) > 1) continue;
                    const tp = this.board[t];
                    if (tp && pieceColor(tp) === color) continue;
                    moves.push({ from: s, to: t, piece: p, captured: tp, flags: tp ? FLAGS.CAPTURE : FLAGS.NORMAL, promotion: null });
                }
                // Castling
                if (isW && s === 4) {
                    if (this.castling.K && !this.board[5] && !this.board[6] && this.board[7] === 'R') {
                        if (!this._isAttacked(4, 'b') && !this._isAttacked(5, 'b') && !this._isAttacked(6, 'b'))
                            moves.push({ from: 4, to: 6, piece: 'K', captured: null, flags: FLAGS.KCASTLE, promotion: null });
                    }
                    if (this.castling.Q && !this.board[3] && !this.board[2] && !this.board[1] && this.board[0] === 'R') {
                        if (!this._isAttacked(4, 'b') && !this._isAttacked(3, 'b') && !this._isAttacked(2, 'b'))
                            moves.push({ from: 4, to: 2, piece: 'K', captured: null, flags: FLAGS.QCASTLE, promotion: null });
                    }
                } else if (!isW && s === 60) {
                    if (this.castling.k && !this.board[61] && !this.board[62] && this.board[63] === 'r') {
                        if (!this._isAttacked(60, 'w') && !this._isAttacked(61, 'w') && !this._isAttacked(62, 'w'))
                            moves.push({ from: 60, to: 62, piece: 'k', captured: null, flags: FLAGS.KCASTLE, promotion: null });
                    }
                    if (this.castling.q && !this.board[59] && !this.board[58] && !this.board[57] && this.board[56] === 'r') {
                        if (!this._isAttacked(60, 'w') && !this._isAttacked(59, 'w') && !this._isAttacked(58, 'w'))
                            moves.push({ from: 60, to: 58, piece: 'k', captured: null, flags: FLAGS.QCASTLE, promotion: null });
                    }
                }
            } else {
                const dirs = pt === 'b' ? BISHOP_DIRS : pt === 'r' ? ROOK_DIRS : QUEEN_DIRS;
                for (const d of dirs) {
                    let cur = s;
                    for (let step = 0; step < 7; step++) {
                        const next = cur + d;
                        if (next < 0 || next >= 64 || Math.abs(file(next) - file(cur)) > 1) break;
                        const tp = this.board[next];
                        if (tp && pieceColor(tp) === color) break;
                        moves.push({ from: s, to: next, piece: p, captured: tp, flags: tp ? FLAGS.CAPTURE : FLAGS.NORMAL, promotion: null });
                        if (tp) break;
                        cur = next;
                    }
                }
            }
        }
        return moves;
    }

    _isAttacked(s, byColor) {
        const isW = byColor === 'w';
        // Pawns
        const pawnDir = isW ? -8 : 8;
        for (const cd of [pawnDir - 1, pawnDir + 1]) {
            const t = s + cd;
            if (t >= 0 && t < 64 && Math.abs(file(t) - file(s)) === 1) {
                const p = this.board[t];
                if (p === (isW ? 'P' : 'p')) return true;
            }
        }
        // Knights
        for (const off of KNIGHT_OFFSETS) {
            const t = s + off;
            if (t >= 0 && t < 64) {
                const fd = Math.abs(file(t) - file(s));
                if (fd === 1 || fd === 2) {
                    if (this.board[t] === (isW ? 'N' : 'n')) return true;
                }
            }
        }
        // King
        for (const off of KING_OFFSETS) {
            const t = s + off;
            if (t >= 0 && t < 64 && Math.abs(file(t) - file(s)) <= 1) {
                if (this.board[t] === (isW ? 'K' : 'k')) return true;
            }
        }
        // Sliding: bishop/queen diagonals
        for (const d of BISHOP_DIRS) {
            let cur = s;
            for (let step = 0; step < 7; step++) {
                const next = cur + d;
                if (next < 0 || next >= 64 || Math.abs(file(next) - file(cur)) > 1) break;
                const p = this.board[next];
                if (p) {
                    if (p === (isW ? 'B' : 'b') || p === (isW ? 'Q' : 'q')) return true;
                    break;
                }
                cur = next;
            }
        }
        // Sliding: rook/queen straights
        for (const d of ROOK_DIRS) {
            let cur = s;
            for (let step = 0; step < 7; step++) {
                const next = cur + d;
                if (next < 0 || next >= 64 || Math.abs(file(next) - file(cur)) > 1) break;
                const p = this.board[next];
                if (p) {
                    if (p === (isW ? 'R' : 'r') || p === (isW ? 'Q' : 'q')) return true;
                    break;
                }
                cur = next;
            }
        }
        return false;
    }

    _findKing(color) {
        const k = color === 'w' ? 'K' : 'k';
        for (let i = 0; i < 64; i++) if (this.board[i] === k) return i;
        return -1;
    }

    isCheck() {
        const kSq = this._findKing(this.turn);
        return kSq >= 0 && this._isAttacked(kSq, this.turn === 'w' ? 'b' : 'w');
    }

    generateLegalMoves() {
        const pseudo = this._generatePseudoMoves();
        const legal = [];
        for (const m of pseudo) {
            this._doMove(m);
            const kSq = this._findKing(this.turn === 'w' ? 'b' : 'w');
            if (kSq >= 0 && !this._isAttacked(kSq, this.turn)) {
                legal.push(m);
            }
            this._undoMove(m);
        }
        return legal;
    }

    _doMove(m) {
        const undo = {
            move: m,
            castling: { ...this.castling },
            epSquare: this.epSquare,
            halfmoves: this.halfmoves,
            board: [...this.board]
        };
        this.history.push(undo);

        this.board[m.to] = m.piece;
        this.board[m.from] = null;

        // En passant capture
        if (m.flags & FLAGS.EP) {
            const capSq = this.turn === 'w' ? m.to - 8 : m.to + 8;
            this.board[capSq] = null;
        }
        // Castling — move rook
        if (m.flags & FLAGS.KCASTLE) {
            if (m.from === 4) { this.board[5] = 'R'; this.board[7] = null; }
            else { this.board[61] = 'r'; this.board[63] = null; }
        }
        if (m.flags & FLAGS.QCASTLE) {
            if (m.from === 4) { this.board[3] = 'R'; this.board[0] = null; }
            else { this.board[59] = 'r'; this.board[56] = null; }
        }
        // Promotion
        if (m.flags & FLAGS.PROMOTION) {
            this.board[m.to] = m.promotion;
        }
        // Update castling rights
        if (m.piece === 'K') { this.castling.K = false; this.castling.Q = false; }
        if (m.piece === 'k') { this.castling.k = false; this.castling.q = false; }
        if (m.from === 0 || m.to === 0) this.castling.Q = false;
        if (m.from === 7 || m.to === 7) this.castling.K = false;
        if (m.from === 56 || m.to === 56) this.castling.q = false;
        if (m.from === 63 || m.to === 63) this.castling.k = false;

        // Update en passant square
        this.epSquare = (m.flags & FLAGS.DOUBLE_PUSH) ? (m.from + m.to) / 2 : -1;

        // Halfmove clock
        if (m.piece.toLowerCase() === 'p' || m.captured) this.halfmoves = 0;
        else this.halfmoves++;

        if (this.turn === 'b') this.fullmoves++;
        this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    _undoMove() {
        const undo = this.history.pop();
        if (!undo) return;
        this.board = undo.board;
        this.castling = undo.castling;
        this.epSquare = undo.epSquare;
        this.halfmoves = undo.halfmoves;
        this.turn = this.turn === 'w' ? 'b' : 'w';
        if (this.turn === 'b') this.fullmoves--;
    }

    makeMove(from, to, promotion) {
        const moves = this.generateLegalMoves();
        const m = moves.find(mv => mv.from === from && mv.to === to &&
            (!promotion || mv.promotion?.toLowerCase() === promotion.toLowerCase()));
        if (!m) return null;

        const san = this.moveToSan(m);
        this._doMove(m);
        this.sanHistory.push(san);
        this.fenHistory.push(this.toFen().split(' ').slice(0, 4).join(' '));

        // Update SAN with check/mate symbols
        if (this.isCheckmate()) {
            this.sanHistory[this.sanHistory.length - 1] += '#';
        } else if (this.isCheck()) {
            this.sanHistory[this.sanHistory.length - 1] += '+';
        }
        return m;
    }

    makeMoveObj(m) {
        return this.makeMove(m.from, m.to, m.promotion);
    }

    undoMove() {
        if (this.history.length === 0) return false;
        this._undoMove();
        this.sanHistory.pop();
        this.fenHistory.pop();
        return true;
    }

    moveToSan(m) {
        if (m.flags & FLAGS.KCASTLE) return 'O-O';
        if (m.flags & FLAGS.QCASTLE) return 'O-O-O';

        let san = '';
        const pt = m.piece.toLowerCase();
        if (pt !== 'p') {
            san += m.piece.toUpperCase();
            // Disambiguation
            const others = this.generateLegalMoves().filter(mv =>
                mv.piece === m.piece && mv.to === m.to && mv.from !== m.from);
            if (others.length > 0) {
                const sameFile = others.some(mv => file(mv.from) === file(m.from));
                const sameRank = others.some(mv => rank(mv.from) === rank(m.from));
                if (!sameFile) san += 'abcdefgh'[file(m.from)];
                else if (!sameRank) san += (rank(m.from) + 1);
                else san += sqName(m.from);
            }
        } else if (m.captured) {
            san += 'abcdefgh'[file(m.from)];
        }
        if (m.captured) san += 'x';
        san += sqName(m.to);
        if (m.promotion) san += '=' + m.promotion.toUpperCase();
        return san;
    }

    isCheckmate() {
        return this.isCheck() && this.generateLegalMoves().length === 0;
    }

    isStalemate() {
        return !this.isCheck() && this.generateLegalMoves().length === 0;
    }

    isDraw() {
        if (this.halfmoves >= 100) return true; // 50-move rule
        if (this.isStalemate()) return true;
        if (this._isInsufficientMaterial()) return true;
        if (this._isThreefoldRepetition()) return true;
        return false;
    }

    _isInsufficientMaterial() {
        const pieces = this.board.filter(p => p);
        if (pieces.length === 2) return true; // K vs K
        if (pieces.length === 3) {
            const nonKing = pieces.find(p => p.toLowerCase() !== 'k');
            if (nonKing && (nonKing.toLowerCase() === 'b' || nonKing.toLowerCase() === 'n')) return true;
        }
        if (pieces.length === 4) {
            const bishops = pieces.filter(p => p.toLowerCase() === 'b');
            if (bishops.length === 2) {
                const bSqs = [];
                for (let i = 0; i < 64; i++) if (this.board[i]?.toLowerCase() === 'b') bSqs.push(i);
                if (bSqs.length === 2 && pieceColor(this.board[bSqs[0]]) !== pieceColor(this.board[bSqs[1]])) {
                    if ((rank(bSqs[0]) + file(bSqs[0])) % 2 === (rank(bSqs[1]) + file(bSqs[1])) % 2) return true;
                }
            }
        }
        return false;
    }

    _isThreefoldRepetition() {
        const current = this.fenHistory[this.fenHistory.length - 1];
        let count = 0;
        for (const f of this.fenHistory) { if (f === current) count++; }
        return count >= 3;
    }

    isGameOver() {
        return this.isCheckmate() || this.isDraw();
    }

    getResult() {
        if (this.isCheckmate()) return this.turn === 'w' ? '0-1' : '1-0';
        if (this.isDraw()) return '1/2-1/2';
        return '*';
    }

    getGamePhase() {
        const phaseValues = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
        let phase = 0;
        for (const p of this.board) { if (p) phase += phaseValues[p.toLowerCase()] || 0; }
        return Math.min(phase, 24);
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ChessGame = ChessGame;
    window.ChessFlags = FLAGS;
    window.ChessUtils = { sq, rank, file, sqName, nameToSq, isWhite, isBlack, pieceColor, pieceType };
}
