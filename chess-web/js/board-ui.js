// board-ui.js — Premium chessboard rendering with drag-and-drop
const PIECE_UNICODE = {
    K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

class BoardUI {
    constructor(containerId, game, onMoveCallback) {
        this.container = document.getElementById(containerId);
        this.game = game;
        this.onMove = onMoveCallback;
        this.flipped = false;
        this.selectedSquare = -1;
        this.legalMoves = [];
        this.interactive = true;
        this.lastMove = null;
        this.highlights = {};
        this.moveClassifications = {};
        this._dragPiece = null;
        this._dragOriginSq = -1;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        const boardEl = document.createElement('div');
        boardEl.className = 'chess-board';
        boardEl.id = 'chess-board-grid';

        for (let displayRow = 0; displayRow < 8; displayRow++) {
            for (let displayCol = 0; displayCol < 8; displayCol++) {
                const r = this.flipped ? displayRow : 7 - displayRow;
                const f = this.flipped ? 7 - displayCol : displayCol;
                const s = r * 8 + f;
                const isLight = (r + f) % 2 === 1;

                const sqEl = document.createElement('div');
                sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
                sqEl.dataset.square = s;

                // Coordinate labels
                if (displayCol === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord rank-coord';
                    rankLabel.textContent = r + 1;
                    sqEl.appendChild(rankLabel);
                }
                if (displayRow === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord file-coord';
                    fileLabel.textContent = 'abcdefgh'[f];
                    sqEl.appendChild(fileLabel);
                }

                // Highlights
                if (this.lastMove && (s === this.lastMove.from || s === this.lastMove.to)) {
                    sqEl.classList.add('last-move');
                }
                if (this.highlights[s]) sqEl.classList.add(this.highlights[s]);

                // Check highlight
                const piece = this.game.pieceAt(s);
                if (piece && piece.toLowerCase() === 'k' && ChessUtils.pieceColor(piece) === this.game.turn && this.game.isCheck()) {
                    sqEl.classList.add('in-check');
                }

                // Piece
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece ${ChessUtils.isWhite(piece) ? 'white-piece' : 'black-piece'}`;
                    pieceEl.textContent = PIECE_UNICODE[piece];
                    pieceEl.draggable = this.interactive;
                    pieceEl.dataset.square = s;

                    pieceEl.addEventListener('dragstart', (e) => this._onDragStart(e, s));
                    pieceEl.addEventListener('mousedown', (e) => this._onClick(e, s));
                    sqEl.appendChild(pieceEl);
                }

                // Legal move dots
                if (this.selectedSquare >= 0) {
                    const isLegal = this.legalMoves.some(m => m.to === s);
                    if (isLegal) {
                        const dot = document.createElement('div');
                        dot.className = piece ? 'capture-hint' : 'move-hint';
                        sqEl.appendChild(dot);
                    }
                }

                // Move classification marker
                if (this.moveClassifications[s]) {
                    const badge = document.createElement('div');
                    badge.className = `move-badge ${this.moveClassifications[s].class}`;
                    badge.textContent = this.moveClassifications[s].symbol;
                    sqEl.appendChild(badge);
                }

                sqEl.addEventListener('dragover', (e) => e.preventDefault());
                sqEl.addEventListener('drop', (e) => this._onDrop(e, s));
                sqEl.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('piece')) this._onSquareClick(s);
                });

                boardEl.appendChild(sqEl);
            }
        }
        this.container.appendChild(boardEl);
    }

    _onClick(e, s) {
        if (!this.interactive) return;
        e.stopPropagation();
        const piece = this.game.pieceAt(s);
        if (piece && ChessUtils.pieceColor(piece) === this.game.turn) {
            if (this.selectedSquare === s) {
                this.selectedSquare = -1;
                this.legalMoves = [];
            } else {
                this.selectedSquare = s;
                this.legalMoves = this.game.generateLegalMoves().filter(m => m.from === s);
            }
            this.render();
        } else if (this.selectedSquare >= 0) {
            this._tryMove(this.selectedSquare, s);
        }
    }

    _onSquareClick(s) {
        if (!this.interactive || this.selectedSquare < 0) return;
        this._tryMove(this.selectedSquare, s);
    }

    _onDragStart(e, s) {
        if (!this.interactive) { e.preventDefault(); return; }
        const piece = this.game.pieceAt(s);
        if (!piece || ChessUtils.pieceColor(piece) !== this.game.turn) { e.preventDefault(); return; }
        this._dragOriginSq = s;
        this.selectedSquare = s;
        this.legalMoves = this.game.generateLegalMoves().filter(m => m.from === s);
        e.dataTransfer.effectAllowed = 'move';
        // Use a transparent image to hide default drag ghost
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
        e.dataTransfer.setDragImage(img, 0, 0);
        this.render();
    }

    _onDrop(e, s) {
        e.preventDefault();
        if (this._dragOriginSq >= 0) {
            this._tryMove(this._dragOriginSq, s);
            this._dragOriginSq = -1;
        }
    }

    _tryMove(from, to) {
        const moves = this.game.generateLegalMoves().filter(m => m.from === from && m.to === to);
        if (moves.length === 0) {
            this.selectedSquare = -1;
            this.legalMoves = [];
            this.render();
            return;
        }

        // Check if promotion
        if (moves[0].flags & ChessFlags.PROMOTION) {
            this._showPromotionDialog(from, to, moves);
            return;
        }

        const m = this.game.makeMove(from, to);
        if (m) {
            this.lastMove = m;
            this.selectedSquare = -1;
            this.legalMoves = [];
            this.render();
            if (this.onMove) this.onMove(m);
        }
    }

    _showPromotionDialog(from, to, moves) {
        const overlay = document.createElement('div');
        overlay.className = 'promotion-overlay';
        const dialog = document.createElement('div');
        dialog.className = 'promotion-dialog';
        const isWhite = this.game.turn === 'w';
        const pieces = isWhite ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
        for (const pp of pieces) {
            const btn = document.createElement('button');
            btn.className = 'promotion-btn';
            btn.textContent = PIECE_UNICODE[pp];
            btn.onclick = () => {
                overlay.remove();
                const m = this.game.makeMove(from, to, pp);
                if (m) {
                    this.lastMove = m;
                    this.selectedSquare = -1;
                    this.legalMoves = [];
                    this.render();
                    if (this.onMove) this.onMove(m);
                }
            };
            dialog.appendChild(btn);
        }
        overlay.appendChild(dialog);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        this.container.appendChild(overlay);
    }

    setPosition(game) {
        this.game = game;
        this.selectedSquare = -1;
        this.legalMoves = [];
        this.render();
    }

    flipBoard() {
        this.flipped = !this.flipped;
        this.render();
    }

    setInteractive(val) {
        this.interactive = val;
    }

    showMoveClassification(toSq, classification) {
        this.moveClassifications[toSq] = classification;
        this.render();
    }

    clearClassifications() {
        this.moveClassifications = {};
    }

    highlightSquare(s, cls) {
        this.highlights[s] = cls;
    }

    clearHighlights() {
        this.highlights = {};
        this.moveClassifications = {};
    }

    setLastMove(m) {
        this.lastMove = m;
    }
}

if (typeof window !== 'undefined') {
    window.BoardUI = BoardUI;
    window.PIECE_UNICODE = PIECE_UNICODE;
}
