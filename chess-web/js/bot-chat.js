// bot-chat.js — Interactive bot companion for during-game commentary and post-game teaching
class BotChat {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.messages = [];
        this.botName = 'Coach Ferb';
    }

    clear() {
        this.messages = [];
        this._renderMessages();
    }

    addMessage(text, sender = 'bot', extra = '') {
        this.messages.push({ text, sender, extra, time: new Date() });
        this._renderMessages();
        this._scrollToBottom();
    }

    // During-game commentary
    onPlayerMove(move, game, san) {
        const pt = move.piece.toLowerCase();
        const comments = [];

        // Check/checkmate reactions
        if (game.isCheckmate()) {
            comments.push("♟️ Checkmate! What a finish! Let's review the game to see how you played.");
            this.addMessage(comments[0]);
            return;
        }
        if (game.isCheck()) {
            comments.push(this._pick(["Check! Nice pressure! ⚡", "Check! Keep the attack going!", "You've got their king on the run!"]));
        }

        // Capture reactions
        if (move.captured) {
            const capName = this._pieceName(move.captured);
            const pName = this._pieceName(move.piece);
            if (PIECE_VALUES_REV[move.captured.toLowerCase()] > PIECE_VALUES_REV[move.piece.toLowerCase()]) {
                comments.push(this._pick([`Great trade! Your ${pName} took their ${capName}! 🎯`, `Nice capture! Winning material with ${san}.`]));
            } else if (PIECE_VALUES_REV[move.captured.toLowerCase()] === PIECE_VALUES_REV[move.piece.toLowerCase()]) {
                comments.push(this._pick([`Even trade — ${pName} for ${capName}.`, `Exchange completed.`]));
            }
        }

        // Castle commentary
        if (move.flags & ChessFlags.KCASTLE || move.flags & ChessFlags.QCASTLE) {
            comments.push(this._pick(["Good idea to castle! 🏰 King safety is important.", "Castled! Your king is much safer now.", "Smart — tucking the king away early!"]));
        }

        // Promotion
        if (move.promotion) {
            comments.push("🎉 Promotion! That pawn earned it!");
        }

        // Occasional tips
        if (comments.length === 0 && Math.random() < 0.25) {
            const tips = [
                "Remember: develop your pieces early and control the center!",
                "Try to keep your pieces active and coordinated.",
                "Think about what your opponent wants to do before making your move.",
                "Rooks love open files — look for opportunities!",
                "Knights are strongest in the center of the board.",
                "Don't move the same piece twice in the opening unless necessary.",
                "Keep an eye on your king safety!",
            ];
            comments.push("💡 " + this._pick(tips));
        }

        if (comments.length > 0) {
            this.addMessage(comments.join(' '));
        }
    }

    onBotMove(move, game, san) {
        const reactions = [];
        if (move._isBook) {
            reactions.push(`📖 Playing the ${move._bookName || 'book line'}. Theory goes deep here!`);
        } else if (game.isCheck()) {
            reactions.push(this._pick(["Check! 😈 Watch out!", "I'm putting some pressure on your king!"]));
        } else if (move.captured) {
            reactions.push(this._pick([`I'll take that ${this._pieceName(move.captured)}! 😏`, `Captured your ${this._pieceName(move.captured)}.`]));
        } else if (Math.random() < 0.2) {
            reactions.push(this._pick(["Hmm, this position is interesting...", "Let me develop here.", "Building up my position.", "Your move! 🎯"]));
        }
        if (reactions.length > 0) this.addMessage(reactions[0]);
    }

    onGameEnd(result, playerColor) {
        let msg;
        if (result === '1-0' && playerColor === 'w' || result === '0-1' && playerColor === 'b') {
            msg = "🎉 Congratulations! You won! Great game! Click 'Game Review' to see how you played.";
        } else if (result === '1/2-1/2') {
            msg = "🤝 It's a draw! Well fought! Check the review to see where you could have pushed for more.";
        } else {
            msg = "I got you this time! 💪 Don't worry — check the review to learn from this game!";
        }
        this.addMessage(msg);
    }

    // Post-game review commentary
    onReviewMove(moveData) {
        const c = moveData.classification;
        let comment = '';

        switch (c.key) {
            case 'brilliant':
                comment = `🌟 Brilliant move! ${moveData.san} — a stunning sacrifice that leads to a winning position. This is the kind of move that wins games!`;
                break;
            case 'great':
                comment = `💎 Great move! ${moveData.san} was the best response in a tough position. Finding this under pressure shows real skill.`;
                break;
            case 'best':
                comment = `✅ ${moveData.san} was the engine's top choice — the absolute best move here. Perfect play!`;
                break;
            case 'good':
                comment = `👍 ${moveData.san} is a solid move. ${!moveData.isEngineBest ? `The engine slightly preferred ${moveData.bestMove}, but your move is perfectly fine (${moveData.cpLoss} cp difference).` : 'Well played!'}`;
                break;
            case 'book':
                comment = `📖 ${moveData.san} — standard opening theory${moveData.bookName ? ` (${moveData.bookName})` : ''}. Good to know your openings!`;
                break;
            case 'inaccuracy':
                comment = `⚠️ ${moveData.san} is a small inaccuracy (−${moveData.cpLoss} cp). The engine preferred ${moveData.bestMove}. This slightly weakened your position.`;
                break;
            case 'mistake':
                comment = `❌ ${moveData.san} was a mistake (−${moveData.cpLoss} cp). ${moveData.bestMove} was much better here. ${this._getMistakeTip(moveData)}`;
                break;
            case 'blunder':
                comment = `🚨 ${moveData.san} is a blunder! (−${moveData.cpLoss} cp). ${moveData.bestMove} was the right move. ${this._getBlunderTip(moveData)}`;
                break;
            case 'missed_win':
                comment = `🎯 Missed opportunity! You had a winning position but ${moveData.san} let it slip. ${moveData.bestMove} would have been decisive.`;
                break;
            case 'forced':
                comment = `${moveData.san} — forced. This was the only legal move in the position.`;
                break;
        }
        this.addMessage(comment, 'bot', c.key);
    }

    greeting() {
        this.addMessage("👋 Welcome to GrandMaster Ferb! I'm your chess coach. Pick a difficulty and let's play! I'll give you tips as we go.");
    }

    _getMistakeTip(moveData) {
        const tips = [
            "Always check for tactics before committing to a move.",
            "Consider what squares and pieces become vulnerable after this move.",
            "Try to calculate one move deeper — the best move might reveal itself.",
            "In this type of position, look for forcing moves (checks, captures, threats) first."
        ];
        return "💡 " + this._pick(tips);
    }

    _getBlunderTip(moveData) {
        const tips = [
            "Before every move, ask: 'Is anything hanging?' This simple check prevents most blunders.",
            "Take a moment to look at your opponent's threats. What do they want to play?",
            "When ahead in material, trade pieces to simplify. When behind, keep the position complex.",
            "Check all captures and checks before deciding on a quiet move."
        ];
        return "💡 " + this._pick(tips);
    }

    _pieceName(piece) {
        const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
        return names[piece.toLowerCase()] || 'piece';
    }

    _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    _renderMessages() {
        if (!this.container) return;
        this.container.innerHTML = '';
        // Only show the latest message (temporary display like chess.com coach)
        const msg = this.messages[this.messages.length - 1];
        if (!msg) return;
        const el = document.createElement('div');
        el.className = `chat-message ${msg.sender} ${msg.extra || ''}`;
        if (msg.sender === 'bot') {
            el.innerHTML = `<img src="img/ferb.png" alt="Ferb" class="chat-avatar-img"><div class="chat-bubble">${msg.text}</div>`;
        } else {
            el.innerHTML = `<div class="chat-bubble">${msg.text}</div>`;
        }
        this.container.appendChild(el);
    }

    _scrollToBottom() {
        // No-op — single message mode
    }
}

if (typeof window !== 'undefined') {
    window.BotChat = BotChat;
}
