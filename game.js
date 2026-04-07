const PIECES = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

const PIECE_NAMES = {
    K: 'Akainu', Q: 'Kizaru', R: 'Marine Ship', B: 'Vicealmirante', N: 'Capitán', P: 'Soldado',
    k: 'Luffy', q: 'Shanks', r: 'Thousand Sunny', b: 'Zoro', n: 'Sanji', p: 'Pirata'
};

const INITIAL_BOARD = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

class ChessGame {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = INITIAL_BOARD.map(row => [...row]);
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.lastMove = null;
        this.castlingRights = { K: true, Q: true, k: true, q: true };
        this.enPassantTarget = null;
        this.gameOver = false;
    }

    isWhite(piece) { return piece && piece === piece.toUpperCase(); }
    isBlack(piece) { return piece && piece === piece.toLowerCase(); }
    pieceColor(piece) { return piece ? (this.isWhite(piece) ? 'white' : 'black') : null; }

    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    findKing(color) {
        const king = color === 'white' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === king) return [r, c];
            }
        }
        return null;
    }

    isUnderAttack(r, c, byColor) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece || this.pieceColor(piece) !== byColor) continue;
                const moves = this.getRawMoves(row, col, true);
                if (moves.some(([mr, mc]) => mr === r && mc === c)) return true;
            }
        }
        return false;
    }

    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        const opponent = color === 'white' ? 'black' : 'white';
        return this.isUnderAttack(kingPos[0], kingPos[1], opponent);
    }

    getRawMoves(r, c, attackOnly = false) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const color = this.pieceColor(piece);
        const moves = [];
        const type = piece.toUpperCase();
        const dir = color === 'white' ? -1 : 1;

        const addIfValid = (nr, nc, captureOnly = false, moveOnly = false) => {
            if (!this.inBounds(nr, nc)) return false;
            const target = this.board[nr][nc];
            if (target && this.pieceColor(target) === color) return false;
            if (moveOnly && target) return false;
            if (captureOnly && !target) return false;
            moves.push([nr, nc]);
            return !target;
        };

        const addSliding = (directions) => {
            for (const [dr, dc] of directions) {
                for (let i = 1; i < 8; i++) {
                    if (!addIfValid(r + dr * i, c + dc * i)) break;
                }
            }
        };

        switch (type) {
            case 'P':
                if (!attackOnly) {
                    if (this.inBounds(r + dir, c) && !this.board[r + dir][c]) {
                        moves.push([r + dir, c]);
                        const startRow = color === 'white' ? 6 : 1;
                        if (r === startRow && !this.board[r + 2 * dir][c]) {
                            moves.push([r + 2 * dir, c]);
                        }
                    }
                }
                for (const dc of [-1, 1]) {
                    const nr = r + dir, nc = c + dc;
                    if (this.inBounds(nr, nc)) {
                        if (attackOnly) {
                            moves.push([nr, nc]);
                        } else if (this.board[nr][nc] && this.pieceColor(this.board[nr][nc]) !== color) {
                            moves.push([nr, nc]);
                        } else if (this.enPassantTarget && this.enPassantTarget[0] === nr && this.enPassantTarget[1] === nc) {
                            moves.push([nr, nc]);
                        }
                    }
                }
                break;
            case 'N':
                for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                    addIfValid(r + dr, c + dc);
                }
                break;
            case 'B':
                addSliding([[-1,-1],[-1,1],[1,-1],[1,1]]);
                break;
            case 'R':
                addSliding([[-1,0],[1,0],[0,-1],[0,1]]);
                break;
            case 'Q':
                addSliding([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
                break;
            case 'K':
                for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                    addIfValid(r + dr, c + dc);
                }
                if (!attackOnly) {
                    const row = color === 'white' ? 7 : 0;
                    const kSide = color === 'white' ? 'K' : 'k';
                    const qSide = color === 'white' ? 'Q' : 'q';
                    if (this.castlingRights[kSide] && r === row && c === 4) {
                        if (!this.board[row][5] && !this.board[row][6] && this.board[row][7] &&
                            this.board[row][7].toUpperCase() === 'R' && this.pieceColor(this.board[row][7]) === color) {
                            const opponent = color === 'white' ? 'black' : 'white';
                            if (!this.isUnderAttack(row, 4, opponent) && 
                                !this.isUnderAttack(row, 5, opponent) && 
                                !this.isUnderAttack(row, 6, opponent)) {
                                moves.push([row, 6]);
                            }
                        }
                    }
                    if (this.castlingRights[qSide] && r === row && c === 4) {
                        if (!this.board[row][3] && !this.board[row][2] && !this.board[row][1] && this.board[row][0] &&
                            this.board[row][0].toUpperCase() === 'R' && this.pieceColor(this.board[row][0]) === color) {
                            const opponent = color === 'white' ? 'black' : 'white';
                            if (!this.isUnderAttack(row, 4, opponent) && 
                                !this.isUnderAttack(row, 3, opponent) && 
                                !this.isUnderAttack(row, 2, opponent)) {
                                moves.push([row, 2]);
                            }
                        }
                    }
                }
                break;
        }
        return moves;
    }

    getLegalMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const color = this.pieceColor(piece);
        const rawMoves = this.getRawMoves(r, c);
        const legalMoves = [];

        for (const [nr, nc] of rawMoves) {
            const savedBoard = this.board.map(row => [...row]);
            const savedEnPassant = this.enPassantTarget;

            if (piece.toUpperCase() === 'P' && this.enPassantTarget && 
                nr === this.enPassantTarget[0] && nc === this.enPassantTarget[1]) {
                this.board[r][nc] = null;
            }

            this.board[nr][nc] = piece;
            this.board[r][c] = null;

            if (!this.isInCheck(color)) {
                legalMoves.push([nr, nc]);
            }

            this.board = savedBoard;
            this.enPassantTarget = savedEnPassant;
        }

        return legalMoves;
    }

    hasAnyLegalMoves(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && this.pieceColor(piece) === color) {
                    if (this.getLegalMoves(r, c).length > 0) return true;
                }
            }
        }
        return false;
    }

    makeMove(fromR, fromC, toR, toC) {
        const piece = this.board[fromR][fromC];
        const captured = this.board[toR][toC];
        const color = this.pieceColor(piece);

        this.moveHistory.push({
            from: [fromR, fromC],
            to: [toR, toC],
            piece,
            captured,
            castlingRights: { ...this.castlingRights },
            enPassantTarget: this.enPassantTarget,
            enPassantCapture: false,
            castling: false
        });

        if (captured) {
            if (color === 'white') this.capturedBlack.push(captured);
            else this.capturedWhite.push(captured);
        }

        if (piece.toUpperCase() === 'P' && this.enPassantTarget && 
            toR === this.enPassantTarget[0] && toC === this.enPassantTarget[1]) {
            const epPiece = this.board[fromR][toC];
            if (epPiece) {
                if (color === 'white') this.capturedBlack.push(epPiece);
                else this.capturedWhite.push(epPiece);
            }
            this.board[fromR][toC] = null;
            this.moveHistory[this.moveHistory.length - 1].enPassantCapture = true;
        }

        if (piece.toUpperCase() === 'K' && Math.abs(toC - fromC) === 2) {
            if (toC === 6) {
                this.board[fromR][5] = this.board[fromR][7];
                this.board[fromR][7] = null;
            } else if (toC === 2) {
                this.board[fromR][3] = this.board[fromR][0];
                this.board[fromR][0] = null;
            }
            this.moveHistory[this.moveHistory.length - 1].castling = true;
        }

        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = null;

        if (piece.toUpperCase() === 'P' && (toR === 0 || toR === 7)) {
            this.board[toR][toC] = color === 'white' ? 'Q' : 'q';
        }

        if (piece === 'K') { this.castlingRights.K = false; this.castlingRights.Q = false; }
        if (piece === 'k') { this.castlingRights.k = false; this.castlingRights.q = false; }
        if (piece === 'R' && fromR === 7 && fromC === 7) this.castlingRights.K = false;
        if (piece === 'R' && fromR === 7 && fromC === 0) this.castlingRights.Q = false;
        if (piece === 'r' && fromR === 0 && fromC === 7) this.castlingRights.k = false;
        if (piece === 'r' && fromR === 0 && fromC === 0) this.castlingRights.q = false;

        if (piece.toUpperCase() === 'P' && Math.abs(toR - fromR) === 2) {
            this.enPassantTarget = [(fromR + toR) / 2, fromC];
        } else {
            this.enPassantTarget = null;
        }

        this.lastMove = { from: [fromR, fromC], to: [toR, toC] };
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.selectedSquare = null;
        this.validMoves = [];
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;
        const move = this.moveHistory.pop();

        this.board[move.from[0]][move.from[1]] = move.piece;
        this.board[move.to[0]][move.to[1]] = move.captured;

        if (move.enPassantCapture) {
            const capturedPawnColor = this.pieceColor(move.piece) === 'white' ? 'p' : 'P';
            this.board[move.from[0]][move.to[1]] = capturedPawnColor;
            this.board[move.to[0]][move.to[1]] = null;
            if (this.pieceColor(move.piece) === 'white') this.capturedBlack.pop();
            else this.capturedWhite.pop();
        }

        if (move.castling) {
            const row = move.from[0];
            if (move.to[1] === 6) {
                this.board[row][7] = this.board[row][5];
                this.board[row][5] = null;
            } else if (move.to[1] === 2) {
                this.board[row][0] = this.board[row][3];
                this.board[row][3] = null;
            }
        }

        if (move.captured) {
            if (this.pieceColor(move.piece) === 'white') this.capturedBlack.pop();
            else this.capturedWhite.pop();
        }

        this.castlingRights = move.castlingRights;
        this.enPassantTarget = move.enPassantTarget;
        this.currentPlayer = this.pieceColor(move.piece);
        this.selectedSquare = null;
        this.validMoves = [];

        if (this.moveHistory.length > 0) {
            const prev = this.moveHistory[this.moveHistory.length - 1];
            this.lastMove = { from: prev.from, to: prev.to };
        } else {
            this.lastMove = null;
        }

        this.gameOver = false;
    }

    checkGameState() {
        const inCheck = this.isInCheck(this.currentPlayer);
        const hasLegalMoves = this.hasAnyLegalMoves(this.currentPlayer);

        if (!hasLegalMoves) {
            this.gameOver = true;
            if (inCheck) {
                const winner = this.currentPlayer === 'white' ? 'Piratas' : 'Marina';
                return { status: 'checkmate', winner: this.currentPlayer === 'white' ? 'black' : 'white', message: `¡Jaque Mate! Gana la ${winner} 🏴‍☠️` };
            } else {
                return { status: 'stalemate', winner: null, message: '¡Tablas por ahogado! 🤝' };
            }
        }

        if (inCheck) {
            return { status: 'check', winner: null, message: `¡Jaque! Turno de la ${this.currentPlayer === 'white' ? 'Marina' : 'Piratas'} ⚠️` };
        }

        return { status: 'playing', winner: null, message: `Turno de la ${this.currentPlayer === 'white' ? 'Marina' : 'Piratas'}` };
    }

    getHint() {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && this.pieceColor(piece) === this.currentPlayer) {
                    const legal = this.getLegalMoves(r, c);
                    for (const [nr, nc] of legal) {
                        let score = 0;
                        const captured = this.board[nr][nc];
                        if (captured) {
                            const values = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0, p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
                            score += values[captured] * 10;
                        }
                        score += Math.random() * 2;
                        if (piece.toUpperCase() === 'P' && (nr === 0 || nr === 7)) score += 80;
                        moves.push({ from: [r, c], to: [nr, nc], score });
                    }
                }
            }
        }
        if (moves.length === 0) return null;
        moves.sort((a, b) => b.score - a.score);
        return moves[0];
    }
}

class ChessUI {
    constructor() {
        this.game = new ChessGame();
        this.boardEl = document.getElementById('board');
        this.statusEl = document.getElementById('status');
        this.modalEl = document.getElementById('modal');
        this.hintSquare = null;
        this.init();
    }

    init() {
        this.createBoard();
        this.createLabels();
        this.bindEvents();
        this.render();
    }

    createBoard() {
        this.boardEl.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = r;
                square.dataset.col = c;
                this.boardEl.appendChild(square);
            }
        }
    }

    createLabels() {
        const rankLabels = document.getElementById('rank-labels');
        const fileLabels = document.getElementById('file-labels');
        rankLabels.innerHTML = '';
        fileLabels.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const rank = document.createElement('div');
            rank.className = 'rank-label';
            rank.textContent = 8 - i;
            rankLabels.appendChild(rank);
        }

        for (let i = 0; i < 8; i++) {
            const file = document.createElement('div');
            file.className = 'file-label';
            file.textContent = String.fromCharCode(97 + i);
            fileLabels.appendChild(file);
        }
    }

    bindEvents() {
        this.boardEl.addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (!square) return;
            this.handleSquareClick(parseInt(square.dataset.row), parseInt(square.dataset.col));
        });

        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        document.getElementById('modal-btn').addEventListener('click', () => {
            this.modalEl.classList.add('hidden');
            this.newGame();
        });
    }

    handleSquareClick(r, c) {
        if (this.game.gameOver) return;

        const piece = this.game.board[r][c];

        if (this.game.selectedSquare) {
            const [sr, sc] = this.game.selectedSquare;
            const isValid = this.game.validMoves.some(([mr, mc]) => mr === r && mc === c);

            if (isValid) {
                this.game.makeMove(sr, sc, r, c);
                this.clearHint();
                this.render();
                this.checkGameState();
                return;
            }

            if (piece && this.game.pieceColor(piece) === this.game.currentPlayer) {
                this.selectSquare(r, c);
                this.render();
                return;
            }

            this.game.selectedSquare = null;
            this.game.validMoves = [];
            this.render();
            return;
        }

        if (piece && this.game.pieceColor(piece) === this.game.currentPlayer) {
            this.selectSquare(r, c);
            this.render();
        }
    }

    selectSquare(r, c) {
        this.game.selectedSquare = [r, c];
        this.game.validMoves = this.game.getLegalMoves(r, c);
    }

    render() {
        const squares = this.boardEl.querySelectorAll('.square');
        squares.forEach(sq => {
            const r = parseInt(sq.dataset.row);
            const c = parseInt(sq.dataset.col);
            const piece = this.game.board[r][c];

            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;

            if (this.game.lastMove) {
                if ((r === this.game.lastMove.from[0] && c === this.game.lastMove.from[1]) ||
                    (r === this.game.lastMove.to[0] && c === this.game.lastMove.to[1])) {
                    sq.classList.add('last-move');
                }
            }

            if (this.game.selectedSquare && this.game.selectedSquare[0] === r && this.game.selectedSquare[1] === c) {
                sq.classList.add('selected');
            }

            if (this.game.validMoves.some(([mr, mc]) => mr === r && mc === c)) {
                if (piece) {
                    sq.classList.add('valid-capture');
                } else {
                    sq.classList.add('valid-move');
                }
            }

            if (this.hintSquare && 
                ((this.hintSquare.from[0] === r && this.hintSquare.from[1] === c) ||
                 (this.hintSquare.to[0] === r && this.hintSquare.to[1] === c))) {
                sq.classList.add('hint');
            }

            const kingPos = this.game.findKing(this.game.currentPlayer);
            if (kingPos && r === kingPos[0] && c === kingPos[1] && this.game.isInCheck(this.game.currentPlayer)) {
                sq.classList.add('check');
            }

            sq.innerHTML = '';
            if (piece) {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'piece';
                pieceEl.textContent = PIECES[piece];
                sq.appendChild(pieceEl);
            }
        });

        this.updatePlayerInfo();
    }

    updatePlayerInfo() {
        const whiteInfo = document.getElementById('white-info');
        const blackInfo = document.getElementById('black-info');

        whiteInfo.classList.toggle('active-player', this.game.currentPlayer === 'white');
        blackInfo.classList.toggle('active-player', this.game.currentPlayer === 'black');

        const pieceOrder = { q: 0, Q: 0, r: 1, R: 1, b: 2, B: 2, n: 3, N: 3, p: 4, P: 4 };
        
        const whiteCaptured = document.getElementById('white-captured');
        const blackCaptured = document.getElementById('black-captured');
        
        whiteCaptured.textContent = this.game.capturedWhite
            .sort((a, b) => pieceOrder[a] - pieceOrder[b])
            .map(p => PIECES[p])
            .join(' ');
        
        blackCaptured.textContent = this.game.capturedBlack
            .sort((a, b) => pieceOrder[a] - pieceOrder[b])
            .map(p => PIECES[p])
            .join(' ');
    }

    checkGameState() {
        const state = this.game.checkGameState();
        this.statusEl.textContent = state.message;

        if (state.status === 'checkmate' || state.status === 'stalemate') {
            setTimeout(() => {
                const icon = state.status === 'checkmate' ? '🏆' : '🤝';
                const title = state.status === 'checkmate' ? '¡Victoria!' : '¡Tablas!';
                let message, bounty;
                if (state.status === 'checkmate') {
                    if (state.winner === 'white') {
                        message = '¡La Marina domina los mares!';
                        bounty = 'RECOMPENSA: ¡JUSTICIA ABSOLUTA! ⚖️';
                    } else {
                        message = '¡Los Piratas conquistan el Grand Line!';
                        bounty = 'RECOMPENSA: ¡REY DE LOS PIRATAS! 👑';
                    }
                } else {
                    message = '¡La batalla termina en empate!';
                    bounty = 'RECOMPENSA: NINGUNA... POR AHORA';
                }
                document.getElementById('modal-icon').textContent = icon;
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-message').textContent = message;
                document.getElementById('bounty-text').textContent = bounty;
                this.modalEl.classList.remove('hidden');
            }, 500);
        }
    }

    newGame() {
        this.game.reset();
        this.clearHint();
        this.modalEl.classList.add('hidden');
        this.render();
        this.statusEl.textContent = 'Turno de la Marina';
    }

    undo() {
        if (this.game.moveHistory.length === 0) return;
        this.game.undoMove();
        this.clearHint();
        this.render();
        const state = this.game.checkGameState();
        this.statusEl.textContent = state.message;
    }

    showHint() {
        this.clearHint();
        const hint = this.game.getHint();
        if (hint) {
            this.hintSquare = hint;
            this.render();
            setTimeout(() => this.clearHint(), 3000);
        }
    }

    clearHint() {
        this.hintSquare = null;
        this.render();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChessUI();
});
