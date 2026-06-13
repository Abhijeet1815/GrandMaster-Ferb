// app.js — Main application controller for AS Chess Online
class ChessApp {
    constructor() {
        this.game = new ChessGame();
        this.ai = new AIEngine('beginner');
        this.boardUI = null;
        this.botChat = null;
        this.review = null;
        this.playerColor = 'w';
        this.difficulty = 'beginner';
        this.mode = 'play'; // 'play' or 'review'
        this.uciHistory = [];
        this.reviewIndex = 0;
        this.reviewData = null;
        this.isThinking = false;
        this.gameStarted = false;

        // Timer state
        this.timeControl = { time: 300, increment: 0 }; // default 5+0
        this.whiteTime = 300;
        this.blackTime = 300;
        this.timerInterval = null;
        this.timerRunning = false;
        this._lastTickTime = null; // wall-clock based timer
        this.botMoveTimeout = null; // track pending bot moves
    }

    init() {
        this.boardUI = new BoardUI('board-container', this.game, (move) => this.onPlayerMove(move));
        this.botChat = new BotChat('coach-message-area');
        this.botChat.greeting();
        this._bindControls();
        this._updateMoveList();
        this._updateStatus();
        this._updateEvalBar(0);
        this._updateTimerDisplay();
    }

    _bindControls() {
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-resign').addEventListener('click', () => this.resign());
        document.getElementById('btn-flip').addEventListener('click', () => this.boardUI.flipBoard());
        document.getElementById('btn-review').addEventListener('click', () => this.startReview());
        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this._setDifficulty(this.difficulty);
        });
        document.getElementById('color-select').addEventListener('change', (e) => {
            this.playerColor = e.target.value;
        });

        // Time control buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.timeControl = {
                    time: parseInt(btn.dataset.time),
                    increment: parseInt(btn.dataset.inc)
                };
                this._updateTimerDisplay();
            });
        });

        // Review navigation
        document.getElementById('btn-review-first')?.addEventListener('click', () => this.reviewNavigate(0));
        document.getElementById('btn-review-prev')?.addEventListener('click', () => this.reviewNavigate(this.reviewIndex - 1));
        document.getElementById('btn-review-next')?.addEventListener('click', () => this.reviewNavigate(this.reviewIndex + 1));
        document.getElementById('btn-review-last')?.addEventListener('click', () => this.reviewNavigate(this.reviewData ? this.reviewData.moves.length : 0));
        document.getElementById('btn-back-to-play')?.addEventListener('click', () => this.exitReview());

        // Keyboard navigation for review
        document.addEventListener('keydown', (e) => {
            if (this.mode !== 'review' || !this.reviewData) return;
            if (e.key === 'ArrowLeft') this.reviewNavigate(this.reviewIndex - 1);
            if (e.key === 'ArrowRight') this.reviewNavigate(this.reviewIndex + 1);
            if (e.key === 'Home') this.reviewNavigate(0);
            if (e.key === 'End') this.reviewNavigate(this.reviewData.moves.length);
        });
    }

    _setDifficulty(d) {
        const settings = {
            'newbie':       { depth: 1, rand: 60, label: 'New to Chess' },
            'beginner':     { depth: 2, rand: 30, label: 'Beginner' },
            'intermediate': { depth: 4, rand: 5,  label: 'Intermediate' },
            'advanced':     { depth: 5, rand: 0,  label: 'Advanced' }
        };
        const s = settings[d] || settings.beginner;
        this.ai.maxDepth = s.depth;
        this.ai.randomness = s.rand;
        this.ai.difficulty = d;
    }

    // ===== TIMER =====
    _startTimer() {
        this._stopTimer();
        this.timerRunning = true;
        this._lastTickTime = Date.now();
        this.timerInterval = setInterval(() => {
            if (!this.timerRunning || this.game.isGameOver()) {
                this._stopTimer();
                return;
            }
            const now = Date.now();
            const elapsed = (now - this._lastTickTime) / 1000;
            this._lastTickTime = now;

            const isWhiteTurn = this.game.turn === 'w';
            if (isWhiteTurn) {
                this.whiteTime = Math.max(0, this.whiteTime - elapsed);
                if (this.whiteTime <= 0) {
                    this._stopTimer();
                    this._handleTimeout('w');
                    return;
                }
            } else {
                this.blackTime = Math.max(0, this.blackTime - elapsed);
                if (this.blackTime <= 0) {
                    this._stopTimer();
                    this._handleTimeout('b');
                    return;
                }
            }
            this._updateTimerDisplay();
        }, 100);
    }

    _stopTimer() {
        this.timerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _addIncrement(color) {
        if (this.timeControl.increment > 0) {
            if (color === 'w') this.whiteTime += this.timeControl.increment;
            else this.blackTime += this.timeControl.increment;
        }
    }

    _handleTimeout(color) {
        const loser = color === 'w' ? 'White' : 'Black';
        this.boardUI.setInteractive(false);
        this.isThinking = false;
        this._showThinking(false);
        this.botChat.addMessage(`⏰ ${loser} ran out of time! ${color === this.playerColor ? "Better luck next time!" : "You win on time! 🎉"}`);
        this._updateStatus(`${loser} flagged — ${color === 'w' ? 'Black' : 'White'} wins!`);
        document.getElementById('btn-review').classList.add('pulse');
        document.getElementById('coach-review-section')?.classList.remove('hidden');
    }

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    _updateTimerDisplay() {
        const topTimer = document.getElementById('top-timer');
        const bottomTimer = document.getElementById('bottom-timer');
        const topName = document.getElementById('top-player-name');
        const bottomName = document.getElementById('bottom-player-name');

        if (!topTimer || !bottomTimer) return;

        const playerIsWhite = this.playerColor === 'w';

        if (playerIsWhite) {
            bottomTimer.textContent = this._formatTime(this.whiteTime);
            topTimer.textContent = this._formatTime(this.blackTime);
            bottomTimer.className = 'timer white-timer' + (this.gameStarted && this.game.turn === 'w' ? ' active-timer' : '');
            topTimer.className = 'timer black-timer' + (this.gameStarted && this.game.turn === 'b' ? ' active-timer' : '');
            bottomName.textContent = 'You (White)';
            topName.textContent = 'Ferb Bot (Black)';
        } else {
            bottomTimer.textContent = this._formatTime(this.blackTime);
            topTimer.textContent = this._formatTime(this.whiteTime);
            bottomTimer.className = 'timer black-timer' + (this.gameStarted && this.game.turn === 'b' ? ' active-timer' : '');
            topTimer.className = 'timer white-timer' + (this.gameStarted && this.game.turn === 'w' ? ' active-timer' : '');
            bottomName.textContent = 'You (Black)';
            topName.textContent = 'Ferb Bot (White)';
        }
    }

    // ===== GAME FLOW =====
    newGame() {
        this._stopTimer();
        this.game = new ChessGame();
        this.uciHistory = [];
        this.mode = 'play';
        this.isThinking = false;
        this.gameStarted = true;
        this.reviewData = null;
        this.reviewIndex = 0;
        this._setDifficulty(this.difficulty);

        // Reset timers
        this.whiteTime = this.timeControl.time;
        this.blackTime = this.timeControl.time;

        this.boardUI.clearHighlights();
        this.boardUI.lastMove = null;
        this.boardUI.setPosition(this.game);
        this.boardUI.setInteractive(true);
        this.boardUI.flipped = this.playerColor === 'b';
        this.boardUI.render();

        this.botChat.clear();
        this.botChat.addMessage(`New game started! You're playing as ${this.playerColor === 'w' ? 'White' : 'Black'} against ${this._diffLabel()} bot. Time: ${this._formatTime(this.timeControl.time)}${this.timeControl.increment > 0 ? '+' + this.timeControl.increment : ''}. Good luck! ♟️`);

        this._updateMoveList();
        this._updateStatus();
        this._updateEvalBar(0);
        document.getElementById('board-overlay')?.classList.add('hidden');
        this._updateTimerDisplay();
        this._hideReviewPanel();
        document.getElementById('coach-review-section')?.classList.add('hidden');
        document.getElementById('review-summary')?.classList.add('hidden');

        // Start the clock
        this._startTimer();

        // If player is black, bot moves first
        if (this.playerColor === 'b') {
            this.boardUI.setInteractive(false);
            this.botMoveTimeout = setTimeout(() => this._botMove(), 500);
        }
    }

    onPlayerMove(move) {
        if (this.mode !== 'play' || this.isThinking || !this.gameStarted) return;
        const uci = ChessUtils.sqName(move.from) + ChessUtils.sqName(move.to) + (move.promotion ? move.promotion.toLowerCase() : '');
        this.uciHistory.push(uci);

        // Add increment for the player's color
        this._addIncrement(this.playerColor);

        this.botChat.onPlayerMove(move, this.game, this.game.sanHistory[this.game.sanHistory.length - 1]);
        this._updateMoveList();
        this._updateStatus();
        this._updateTimerDisplay();

        if (this.game.isGameOver()) {
            this._handleGameOver();
            return;
        }

        // Bot's turn
        this.isThinking = true;
        this.boardUI.setInteractive(false);
        this._showThinking(true);
        this.botMoveTimeout = setTimeout(() => this._botMove(), 300 + Math.random() * 700);
    }

    _botMove() {
        if (!this.gameStarted) return;
        // Snapshot time before synchronous AI computation
        const thinkStart = Date.now();

        const move = this.ai.getBestMove(this.game, this.uciHistory);
        if (!move) return;

        // Deduct real wall-clock time the AI spent thinking from the bot's clock
        const thinkSeconds = (Date.now() - thinkStart) / 1000;
        const botColor = this.playerColor === 'w' ? 'b' : 'w';
        if (botColor === 'w') this.whiteTime = Math.max(0, this.whiteTime - thinkSeconds);
        else this.blackTime = Math.max(0, this.blackTime - thinkSeconds);

        // Reset the tick anchor so the interval doesn't double-count
        this._lastTickTime = Date.now();

        const m = this.game.makeMoveObj(move);
        if (!m) return;

        const uci = ChessUtils.sqName(m.from) + ChessUtils.sqName(m.to) + (m.promotion ? m.promotion.toLowerCase() : '');
        this.uciHistory.push(uci);
        m._isBook = move._isBook;
        m._bookName = move._bookName;

        // Add increment for bot's color
        this._addIncrement(botColor);

        this.boardUI.lastMove = m;
        this.boardUI.render();
        this.botChat.onBotMove(m, this.game, this.game.sanHistory[this.game.sanHistory.length - 1]);
        this._updateMoveList();
        this._updateStatus();
        this._updateTimerDisplay();
        this._showThinking(false);
        this.isThinking = false;

        // Check for timeout during AI think
        if ((botColor === 'w' && this.whiteTime <= 0) || (botColor === 'b' && this.blackTime <= 0)) {
            this._handleTimeout(botColor);
            return;
        }

        if (this.game.isGameOver()) {
            this._handleGameOver();
            return;
        }

        this.boardUI.setInteractive(true);
    }

    _handleGameOver() {
        const result = this.game.getResult();
        this._stopTimer();
        this.boardUI.setInteractive(false);
        this._showThinking(false);
        this.isThinking = false;
        this.botChat.onGameEnd(result, this.playerColor);
        this._updateStatus();
        document.getElementById('btn-review').classList.add('pulse');
        document.getElementById('coach-review-section')?.classList.remove('hidden');
    }

    resign() {
        if (!this.gameStarted || this.game.isGameOver()) return;
        this._stopTimer();
        if (this.botMoveTimeout) clearTimeout(this.botMoveTimeout);
        this.botChat.addMessage("You resigned. No worries — every game is a learning opportunity! Check the review to improve. 💪");
        this.boardUI.setInteractive(false);
        this._showThinking(false);
        this.isThinking = false;
        this.gameStarted = false;
        document.getElementById('btn-review').classList.add('pulse');
        document.getElementById('coach-review-section')?.classList.remove('hidden');
        this._updateStatus('Resigned');
    }

    async startReview() {
        if (this.game.sanHistory.length < 2) {
            this.botChat.addMessage("Play at least a couple of moves before reviewing! 😄");
            return;
        }

        this._stopTimer();
        this.mode = 'review';
        this.boardUI.setInteractive(false);
        this._showReviewPanel();
        this.botChat.clear();
        this.botChat.addMessage("🔍 Analyzing your game... This may take a moment.");

        const review = new GameReview();
        const origGame = this.game.clone();

        this.reviewData = await review.analyze(origGame, (current, total, san) => {
            const pct = Math.round((current / total) * 100);
            document.getElementById('review-progress').textContent = `Analyzing move ${current}/${total} (${san})... ${pct}%`;
        });

        document.getElementById('review-progress').textContent = 'Analysis complete!';
        this._renderReviewSummary();
        this.reviewIndex = 0;
        this.reviewNavigate(0);
        this.botChat.clear();
        this.botChat.addMessage("✅ Analysis complete! Use the arrows (or ← → keys) to step through each move. I'll explain what happened.");
    }

    reviewNavigate(idx) {
        if (!this.reviewData) return;
        idx = Math.max(0, Math.min(idx, this.reviewData.moves.length));
        this.reviewIndex = idx;

        const reviewGame = new ChessGame();
        const originalMoves = this.game.history.map(h => h.move);
        this.boardUI.clearHighlights();

        for (let i = 0; i < idx; i++) {
            reviewGame._doMove(originalMoves[i]);
        }

        this.boardUI.setPosition(reviewGame);

        if (idx > 0) {
            const moveData = this.reviewData.moves[idx - 1];
            const lastOrigMove = originalMoves[idx - 1];
            this.boardUI.lastMove = lastOrigMove;
            this.boardUI.showMoveClassification(lastOrigMove.to, moveData.classification);
            this.boardUI.render();
            this._updateEvalBar(moveData.evalAfter);

            this.botChat.clear();
            this.botChat.onReviewMove(moveData);
            if (!moveData.isEngineBest && moveData.bestMove !== '...' && moveData.classification.key !== 'forced') {
                this.botChat.addMessage(`${moveData.san} — ${moveData.classification.label}. Best was ${moveData.bestMove}.`);
            }
        } else {
            this.boardUI.lastMove = null;
            this.boardUI.render();
            this._updateEvalBar(0);
            this.botChat.clear();
            this.botChat.addMessage("Starting position. Use → to step through moves.");
        }

        const counterEl = document.getElementById('review-move-counter');
        if (counterEl) counterEl.textContent = `Move ${idx} / ${this.reviewData.moves.length}`;
        this._highlightReviewMove(idx);
    }

    _renderReviewSummary() {
        const d = this.reviewData;
        const panel = document.getElementById('review-summary');
        if (!panel) return;
        panel.classList.remove('hidden');

        const cats = [
            { key: 'brilliant', label: 'Brilliant', icon: '‼️' },
            { key: 'great', label: 'Great', icon: '❕' },
            { key: 'best', label: 'Best', icon: '⭐' },
            { key: 'good', label: 'Good', icon: '✅' },
            { key: 'book', label: 'Book', icon: '📖' },
            { key: 'forced', label: 'Forced', icon: '—' },
            { key: 'inaccuracy', label: 'Inaccuracy', icon: '⚠️' },
            { key: 'mistake', label: 'Mistake', icon: '❓' },
            { key: 'missed_win', label: 'Miss', icon: '❌' },
            { key: 'blunder', label: 'Blunder', icon: '⁉️' },
        ];

        const catRows = cats.map(c => {
            const wc = d.whiteSummary[c.key] || 0;
            const bc = d.blackSummary[c.key] || 0;
            if (wc === 0 && bc === 0) return '';
            return `<div class="review-cat-row">
                <span class="cat-label">${c.label}</span>
                <span class="cat-count white-count">${wc}</span>
                <span class="cat-icon">${c.icon}</span>
                <span class="cat-count black-count">${bc}</span>
            </div>`;
        }).join('');

        panel.innerHTML = `
            <div class="review-summary-section">
                <div class="review-players-header">
                    <span></span><span>You</span><span></span><span>Bot</span>
                </div>
                <div class="review-accuracy-row">
                    <span class="acc-label">Accuracy</span>
                    <span class="acc-value white-acc">${Math.round(this.playerColor === 'w' ? d.whiteAccuracy : d.blackAccuracy)}%</span>
                    <span class="acc-value black-acc">${Math.round(this.playerColor === 'w' ? d.blackAccuracy : d.whiteAccuracy)}%</span>
                </div>
                ${catRows}
            </div>
        `;
    }

    _showReviewPanel() {
        document.getElementById('review-panel')?.classList.add('active');
        document.getElementById('play-controls')?.classList.add('hidden');
    }

    _hideReviewPanel() {
        document.getElementById('review-panel')?.classList.remove('active');
        document.getElementById('play-controls')?.classList.remove('hidden');
    }

    exitReview() {
        this.mode = 'play';
        this._hideReviewPanel();
        this.boardUI.clearHighlights();
        this.boardUI.setPosition(this.game);
        this.boardUI.lastMove = this.game.history.length > 0 ? this.game.history[this.game.history.length - 1].move : null;
        this.boardUI.render();
        this.botChat.clear();
        this.botChat.addMessage("Back to the game! Click 'New Game' to start fresh.");
    }

    _updateMoveList() {
        const el = document.getElementById('move-list');
        if (!el) return;
        el.innerHTML = '';
        const sans = this.game.sanHistory;
        for (let i = 0; i < sans.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const row = document.createElement('div');
            row.className = 'move-row';
            const wSan = this._formatSanDisplay(sans[i], true);
            const bSan = sans[i + 1] ? this._formatSanDisplay(sans[i + 1], false) : '';
            row.innerHTML = `
                <span class="move-num">${moveNum}.</span>
                <span class="move-san white-move" data-idx="${i}">${wSan}</span>
                <span class="move-san black-move" data-idx="${i+1}">${bSan}</span>
            `;
            el.appendChild(row);
        }
        // Only scroll if moves overflow the visible area
        const wrap = el.closest('.coach-move-list-wrap');
        if (wrap && wrap.scrollHeight > wrap.clientHeight) {
            wrap.scrollTop = wrap.scrollHeight;
        }
    }

    _formatSanDisplay(san, isWhite) {
        if (san.startsWith('O-O')) return san;
        const wSym = { 'N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔' };
        const bSym = { 'N':'♞','B':'♝','R':'♜','Q':'♛','K':'♚' };
        const map = isWhite ? wSym : bSym;
        const first = san[0];
        if (map[first]) return map[first] + ' ' + san.slice(1);
        return san;
    }

    _highlightReviewMove(idx) {
        document.querySelectorAll('.move-san').forEach(el => el.classList.remove('review-active'));
        if (idx > 0) {
            const target = document.querySelector(`.move-san[data-idx="${idx - 1}"]`);
            if (target) { target.classList.add('review-active'); target.scrollIntoView({ block: 'nearest' }); }
        }
    }

    _updateStatus(override) {
        const el = document.getElementById('game-status');
        if (!el) return;
        if (override) { el.textContent = override; return; }
        if (this.game.isCheckmate()) {
            el.textContent = `Checkmate! ${this.game.turn === 'w' ? 'Black' : 'White'} wins!`;
        } else if (this.game.isStalemate()) {
            el.textContent = 'Stalemate — Draw!';
        } else if (this.game.isDraw()) {
            el.textContent = 'Draw!';
        } else if (this.isThinking) {
            el.textContent = 'Bot is thinking...';
        } else {
            el.textContent = `${this.game.turn === 'w' ? 'White' : 'Black'} to move`;
        }

        const turnInd = document.getElementById('turn-indicator');
        if (turnInd) {
            if (!this.gameStarted || this.game.isGameOver()) {
                turnInd.classList.add('hidden');
            } else {
                turnInd.classList.remove('hidden');
                turnInd.textContent = this.game.turn === this.playerColor ? "Your Move" : "Ferb's Move";
            }
        }
    }

    _updateEvalBar(evalScore) {
        const bar = document.getElementById('eval-fill');
        const label = document.getElementById('eval-label');
        if (!bar || !label) return;
        const clamped = Math.max(-1000, Math.min(1000, evalScore));
        const pct = 50 + (clamped / 1000) * 50;
        bar.style.height = `${pct}%`;
        const display = Math.abs(evalScore) > 9000 ? (evalScore > 0 ? 'M' : '-M') : (evalScore / 100).toFixed(1);
        label.textContent = display;
    }

    _showThinking(show) {
        const el = document.getElementById('thinking-indicator');
        if (el) el.style.display = show ? 'flex' : 'none';
    }

    _diffLabel() {
        const labels = { newbie: 'New to Chess', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
        return labels[this.difficulty] || 'Beginner';
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChessApp();
    app.init();
    window.chessApp = app;
});
