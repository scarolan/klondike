// Klondike Solitaire Game

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const RED_SUITS = ['hearts', 'diamonds'];
const BLACK_SUITS = ['clubs', 'spades'];

// Card class
class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
        this.faceUp = false;
    }

    get color() {
        return RED_SUITS.includes(this.suit) ? 'red' : 'black';
    }

    get imagePath() {
        return `images/card-${this.suit}-${this.value}.png`;
    }

    get backImagePath() {
        return 'images/card-back1.png';
    }

    get id() {
        return `${this.suit}-${this.value}`;
    }
}

// Game state
class KlondikeGame {
    constructor() {
        this.stock = [];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableau = [[], [], [], [], [], [], []];
        this.moves = 0;

        // Drag state
        this.isDragging = false;
        this.draggedCards = [];
        this.dragSource = null;
        this.dragSourceIndex = null;
        this.dragStartCardIndex = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.dragGhost = null;

        // Hints
        this.hintsEnabled = false;

        // Auto-complete
        this.autoCompleting = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.newGame();
    }

    createDeck() {
        const deck = [];
        for (const suit of SUITS) {
            for (const value of VALUES) {
                deck.push(new Card(suit, value));
            }
        }
        return deck;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    newGame() {
        // Reset state
        this.stock = [];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableau = [[], [], [], [], [], [], []];
        this.moves = 0;
        this.autoCompleting = false;
        this.updateMovesDisplay();

        // Create and shuffle deck
        const deck = this.shuffle(this.createDeck());

        // Deal to tableau
        let cardIndex = 0;
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                const card = deck[cardIndex++];
                if (j === i) {
                    card.faceUp = true;
                }
                this.tableau[j].push(card);
            }
        }

        // Remaining cards go to stock
        while (cardIndex < deck.length) {
            this.stock.push(deck[cardIndex++]);
        }

        this.render();
        this.hideWinModal();
    }

    setupEventListeners() {
        // New game button
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('play-again-btn').addEventListener('click', () => this.newGame());

        // Hint toggle button
        document.getElementById('hint-btn').addEventListener('click', () => this.toggleHints());

        // Stock pile click
        document.getElementById('stock').addEventListener('click', (e) => {
            // Only handle click if not dragging
            if (!this.isDragging) {
                this.drawFromStock();
            }
        });

        // Setup drag and drop
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Double click to auto-move to foundation
        document.querySelector('.game-board').addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    }

    handleMouseDown(e) {
        // Don't allow dragging during auto-complete
        if (this.autoCompleting) return;

        const cardEl = e.target.closest('.card');
        if (!cardEl || cardEl.classList.contains('face-down')) return;

        const pile = cardEl.closest('.pile');
        if (!pile) return;

        // Don't start drag on stock pile
        if (pile.id === 'stock') return;

        // Find the source pile and card
        const location = this.findCardLocation(cardEl);
        if (!location) return;

        const { pileType, pileIndex, cardIndex } = location;

        // Determine which cards to drag
        let cards = [];
        if (pileType === 'tableau') {
            cards = this.tableau[pileIndex].slice(cardIndex);
        } else if (pileType === 'waste' && cardIndex === this.waste.length - 1) {
            cards = [this.waste[cardIndex]];
        } else if (pileType === 'foundation' && cardIndex === this.foundations[pileIndex].length - 1) {
            cards = [this.foundations[pileIndex][cardIndex]];
        } else {
            return;
        }

        // All cards must be face up
        if (!cards.every(c => c.faceUp)) return;

        // Start dragging
        this.isDragging = true;
        this.draggedCards = cards;
        this.dragSource = pileType;
        this.dragSourceIndex = pileIndex;
        this.dragStartCardIndex = cardIndex;

        // Calculate offset
        const rect = cardEl.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;

        // Create drag ghost
        this.createDragGhost(cards, e.clientX, e.clientY);

        // Hide original cards
        this.hideSourceCards(pileType, pileIndex, cardIndex);

        // Highlight valid targets
        this.highlightValidTargets();

        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragGhost) return;

        this.dragGhost.style.left = `${e.clientX - this.dragOffsetX}px`;
        this.dragGhost.style.top = `${e.clientY - this.dragOffsetY}px`;
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;

        // Clear highlights
        this.clearHighlights();

        // Find drop target
        const dropTarget = this.findDropTarget(e.clientX, e.clientY);

        let moveSuccessful = false;
        if (dropTarget && this.isValidMove(this.draggedCards[0], dropTarget.type, dropTarget.index)) {
            this.executeMove(dropTarget.type, dropTarget.index);
            moveSuccessful = true;
        }

        // Clean up drag ghost
        if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
        }

        // If move wasn't successful, re-render to restore cards
        if (!moveSuccessful) {
            this.render();
        }

        // Reset drag state
        this.isDragging = false;
        this.draggedCards = [];
        this.dragSource = null;
        this.dragSourceIndex = null;
        this.dragStartCardIndex = null;
    }

    createDragGhost(cards, x, y) {
        // Remove existing ghost
        if (this.dragGhost) {
            this.dragGhost.remove();
        }

        this.dragGhost = document.createElement('div');
        this.dragGhost.className = 'drag-ghost';
        this.dragGhost.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            left: ${x - this.dragOffsetX}px;
            top: ${y - this.dragOffsetY}px;
        `;

        cards.forEach((card, i) => {
            const cardEl = this.createCardElement(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${i * 25}px`;
            cardEl.style.left = '0';
            cardEl.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
            this.dragGhost.appendChild(cardEl);
        });

        document.body.appendChild(this.dragGhost);
    }

    hideSourceCards(pileType, pileIndex, startIndex) {
        let pile;
        if (pileType === 'tableau') {
            pile = document.getElementById(`tableau-${pileIndex}`);
        } else if (pileType === 'waste') {
            pile = document.getElementById('waste');
        } else if (pileType === 'foundation') {
            pile = document.getElementById(`foundation-${pileIndex}`);
        }

        if (!pile) return;

        const cards = pile.querySelectorAll('.card');
        cards.forEach((card, i) => {
            if (i >= startIndex) {
                card.style.visibility = 'hidden';
            }
        });
    }

    findCardLocation(cardEl) {
        const suit = cardEl.dataset.suit;
        const value = parseInt(cardEl.dataset.value);

        // Check waste
        for (let i = 0; i < this.waste.length; i++) {
            if (this.waste[i].suit === suit && this.waste[i].value === value) {
                return { pileType: 'waste', pileIndex: 0, cardIndex: i };
            }
        }

        // Check tableau
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < this.tableau[i].length; j++) {
                if (this.tableau[i][j].suit === suit && this.tableau[i][j].value === value) {
                    return { pileType: 'tableau', pileIndex: i, cardIndex: j };
                }
            }
        }

        // Check foundations
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < this.foundations[i].length; j++) {
                if (this.foundations[i][j].suit === suit && this.foundations[i][j].value === value) {
                    return { pileType: 'foundation', pileIndex: i, cardIndex: j };
                }
            }
        }

        return null;
    }

    findDropTarget(x, y) {
        // Hide ghost for detection
        if (this.dragGhost) {
            this.dragGhost.style.display = 'none';
        }

        const element = document.elementFromPoint(x, y);

        if (this.dragGhost) {
            this.dragGhost.style.display = '';
        }

        if (!element) return null;

        // Check if dropped on a card
        const cardEl = element.closest('.card');
        if (cardEl) {
            const pile = cardEl.closest('.pile');
            if (pile) {
                if (pile.classList.contains('tableau-pile')) {
                    const index = parseInt(pile.id.split('-')[1]);
                    return { type: 'tableau', index };
                }
                if (pile.classList.contains('foundation')) {
                    const index = parseInt(pile.id.split('-')[1]);
                    return { type: 'foundation', index };
                }
            }
        }

        // Check if dropped on empty pile
        const pile = element.closest('.pile');
        if (pile) {
            if (pile.classList.contains('tableau-pile')) {
                const index = parseInt(pile.id.split('-')[1]);
                return { type: 'tableau', index };
            }
            if (pile.classList.contains('foundation')) {
                const index = parseInt(pile.id.split('-')[1]);
                return { type: 'foundation', index };
            }
        }

        return null;
    }

    isValidMove(card, targetType, targetIndex) {
        // Can't move to same location
        if (targetType === this.dragSource && targetIndex === this.dragSourceIndex) {
            return false;
        }

        if (targetType === 'foundation') {
            // Can only move single cards to foundation
            if (this.draggedCards.length > 1) return false;

            const foundation = this.foundations[targetIndex];

            if (foundation.length === 0) {
                // Only Aces can start a foundation
                return card.value === 1;
            } else {
                const topCard = foundation[foundation.length - 1];
                // Must be same suit and next value
                return card.suit === topCard.suit && card.value === topCard.value + 1;
            }
        }

        if (targetType === 'tableau') {
            const tableau = this.tableau[targetIndex];

            if (tableau.length === 0) {
                // Only Kings can be placed on empty tableau
                return card.value === 13;
            } else {
                const topCard = tableau[tableau.length - 1];
                // Must be opposite color and one less value
                return card.color !== topCard.color && card.value === topCard.value - 1;
            }
        }

        return false;
    }

    executeMove(targetType, targetIndex) {
        // Remove cards from source
        if (this.dragSource === 'waste') {
            this.waste.pop();
        } else if (this.dragSource === 'tableau') {
            const removeCount = this.draggedCards.length;
            this.tableau[this.dragSourceIndex].splice(-removeCount);

            // Flip the new top card if needed
            const pile = this.tableau[this.dragSourceIndex];
            if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                pile[pile.length - 1].faceUp = true;
            }
        } else if (this.dragSource === 'foundation') {
            this.foundations[this.dragSourceIndex].pop();
        }

        // Add cards to target
        if (targetType === 'foundation') {
            this.foundations[targetIndex].push(...this.draggedCards);
        } else if (targetType === 'tableau') {
            this.tableau[targetIndex].push(...this.draggedCards);
        }

        this.moves++;
        this.updateMovesDisplay();
        this.render();
        this.checkWin();
        this.tryAutoComplete();
    }

    drawFromStock() {
        if (this.stock.length === 0) {
            // Reset stock from waste
            while (this.waste.length > 0) {
                const card = this.waste.pop();
                card.faceUp = false;
                this.stock.push(card);
            }
        } else {
            // Draw one card
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);
            this.moves++;
            this.updateMovesDisplay();
        }
        this.render();
    }

    handleDoubleClick(e) {
        const cardEl = e.target.closest('.card');
        if (!cardEl || cardEl.classList.contains('face-down')) return;

        const location = this.findCardLocation(cardEl);
        if (!location) return;

        const { pileType, pileIndex, cardIndex } = location;

        let card;
        let isTopCard = false;

        if (pileType === 'waste') {
            isTopCard = cardIndex === this.waste.length - 1;
            card = this.waste[cardIndex];
        } else if (pileType === 'tableau') {
            isTopCard = cardIndex === this.tableau[pileIndex].length - 1;
            card = this.tableau[pileIndex][cardIndex];
        } else {
            return;
        }

        if (!isTopCard) return;

        // Try to auto-move to foundation
        for (let i = 0; i < 4; i++) {
            this.draggedCards = [card];
            this.dragSource = pileType;
            this.dragSourceIndex = pileIndex;

            if (this.isValidMove(card, 'foundation', i)) {
                this.executeMove('foundation', i);
                this.draggedCards = [];
                this.dragSource = null;
                this.dragSourceIndex = null;
                return;
            }
        }

        this.draggedCards = [];
        this.dragSource = null;
        this.dragSourceIndex = null;
    }

    toggleHints() {
        this.hintsEnabled = !this.hintsEnabled;
        const btn = document.getElementById('hint-btn');
        btn.textContent = `Hints: ${this.hintsEnabled ? 'On' : 'Off'}`;
        btn.classList.toggle('active', this.hintsEnabled);
    }

    highlightValidTargets() {
        if (!this.hintsEnabled) return;
        if (this.draggedCards.length === 0) return;

        const card = this.draggedCards[0];

        // Check foundations (only for single cards)
        if (this.draggedCards.length === 1) {
            for (let i = 0; i < 4; i++) {
                if (this.isValidMove(card, 'foundation', i)) {
                    document.getElementById(`foundation-${i}`).classList.add('highlight');
                }
            }
        }

        // Check tableau piles
        for (let i = 0; i < 7; i++) {
            if (this.isValidMove(card, 'tableau', i)) {
                document.getElementById(`tableau-${i}`).classList.add('highlight');
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    }

    updateMovesDisplay() {
        document.getElementById('moves').textContent = this.moves;
    }

    checkWin() {
        const totalInFoundations = this.foundations.reduce((sum, f) => sum + f.length, 0);
        if (totalInFoundations === 52) {
            this.showWinModal();
        }
    }

    canAutoComplete() {
        // Can auto-complete if stock and waste are empty and all tableau cards are face-up
        if (this.stock.length > 0 || this.waste.length > 0) {
            return false;
        }

        for (const pile of this.tableau) {
            for (const card of pile) {
                if (!card.faceUp) {
                    return false;
                }
            }
        }

        // Also need at least one card not in foundations
        const totalInFoundations = this.foundations.reduce((sum, f) => sum + f.length, 0);
        return totalInFoundations < 52;
    }

    tryAutoComplete() {
        if (this.autoCompleting) return;

        if (this.canAutoComplete()) {
            this.autoCompleting = true;
            this.runAutoComplete();
        }
    }

    runAutoComplete() {
        // Find a card that can be moved to a foundation
        let moved = false;

        // Check waste first
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            const foundationIndex = this.findValidFoundation(card);
            if (foundationIndex !== -1) {
                this.animateCardToFoundation(card, 'waste', 0, foundationIndex, () => {
                    this.waste.pop();
                    this.foundations[foundationIndex].push(card);
                    this.moves++;
                    this.updateMovesDisplay();
                    this.render();
                    this.checkWin();
                    if (!this.checkWin()) {
                        setTimeout(() => this.runAutoComplete(), 100);
                    }
                });
                return;
            }
        }

        // Check tableau piles
        for (let i = 0; i < 7; i++) {
            const pile = this.tableau[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                const foundationIndex = this.findValidFoundation(card);
                if (foundationIndex !== -1) {
                    this.animateCardToFoundation(card, 'tableau', i, foundationIndex, () => {
                        pile.pop();
                        this.foundations[foundationIndex].push(card);
                        this.moves++;
                        this.updateMovesDisplay();
                        this.render();
                        if (!this.checkWinSilent()) {
                            setTimeout(() => this.runAutoComplete(), 100);
                        } else {
                            this.autoCompleting = false;
                            this.showWinModal();
                        }
                    });
                    return;
                }
            }
        }

        // No more moves possible
        this.autoCompleting = false;
    }

    findValidFoundation(card) {
        for (let i = 0; i < 4; i++) {
            const foundation = this.foundations[i];
            if (foundation.length === 0) {
                if (card.value === 1) {
                    return i;
                }
            } else {
                const topCard = foundation[foundation.length - 1];
                if (card.suit === topCard.suit && card.value === topCard.value + 1) {
                    return i;
                }
            }
        }
        return -1;
    }

    animateCardToFoundation(card, sourceType, sourceIndex, foundationIndex, callback) {
        // Get source position
        let sourceEl;
        if (sourceType === 'waste') {
            sourceEl = document.querySelector('#waste .card');
        } else {
            const pile = document.getElementById(`tableau-${sourceIndex}`);
            const cards = pile.querySelectorAll('.card');
            sourceEl = cards[cards.length - 1];
        }

        const targetEl = document.getElementById(`foundation-${foundationIndex}`);

        if (!sourceEl || !targetEl) {
            callback();
            return;
        }

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // Create flying card
        const flyingCard = this.createCardElement(card);
        flyingCard.style.position = 'fixed';
        flyingCard.style.left = `${sourceRect.left}px`;
        flyingCard.style.top = `${sourceRect.top}px`;
        flyingCard.style.zIndex = '10000';
        flyingCard.style.transition = 'all 0.3s ease-out';
        flyingCard.style.pointerEvents = 'none';
        document.body.appendChild(flyingCard);

        // Hide source card
        sourceEl.style.visibility = 'hidden';

        // Trigger animation
        requestAnimationFrame(() => {
            flyingCard.style.left = `${targetRect.left}px`;
            flyingCard.style.top = `${targetRect.top}px`;
        });

        // Clean up after animation
        setTimeout(() => {
            flyingCard.remove();
            callback();
        }, 300);
    }

    checkWinSilent() {
        const totalInFoundations = this.foundations.reduce((sum, f) => sum + f.length, 0);
        return totalInFoundations === 52;
    }

    showWinModal() {
        document.getElementById('final-moves').textContent = this.moves;
        document.getElementById('win-modal').classList.remove('hidden');
    }

    hideWinModal() {
        document.getElementById('win-modal').classList.add('hidden');
    }

    createCardElement(card) {
        const element = document.createElement('div');
        element.className = 'card';
        element.dataset.suit = card.suit;
        element.dataset.value = card.value;

        const img = document.createElement('img');
        img.src = card.faceUp ? card.imagePath : card.backImagePath;
        img.alt = card.faceUp ? `${card.value} of ${card.suit}` : 'Card back';
        img.draggable = false;

        element.appendChild(img);
        element.classList.toggle('face-up', card.faceUp);
        element.classList.toggle('face-down', !card.faceUp);

        return element;
    }

    render() {
        this.renderStock();
        this.renderWaste();
        this.renderFoundations();
        this.renderTableau();
    }

    renderStock() {
        const stockPile = document.getElementById('stock');
        stockPile.innerHTML = '';

        if (this.stock.length > 0) {
            stockPile.classList.remove('empty');
            const topCard = this.stock[this.stock.length - 1];
            const element = this.createCardElement(topCard);
            element.style.position = 'absolute';
            element.style.top = '0';
            element.style.left = '0';
            stockPile.appendChild(element);
        } else {
            stockPile.classList.add('empty');
        }
    }

    renderWaste() {
        const wastePile = document.getElementById('waste');
        wastePile.innerHTML = '';

        if (this.waste.length > 0) {
            const topCard = this.waste[this.waste.length - 1];
            const element = this.createCardElement(topCard);
            element.style.position = 'absolute';
            element.style.top = '0';
            element.style.left = '0';
            wastePile.appendChild(element);
        }
    }

    renderFoundations() {
        for (let i = 0; i < 4; i++) {
            const foundationPile = document.getElementById(`foundation-${i}`);
            foundationPile.innerHTML = '';

            if (this.foundations[i].length > 0) {
                const topCard = this.foundations[i][this.foundations[i].length - 1];
                const element = this.createCardElement(topCard);
                element.style.position = 'absolute';
                element.style.top = '0';
                element.style.left = '0';
                foundationPile.appendChild(element);
            }
        }
    }

    renderTableau() {
        for (let i = 0; i < 7; i++) {
            const tableauPile = document.getElementById(`tableau-${i}`);
            tableauPile.innerHTML = '';

            const cards = this.tableau[i];
            cards.forEach((card, j) => {
                const element = this.createCardElement(card);
                const offset = j * 25;
                element.style.position = 'absolute';
                element.style.top = `${offset}px`;
                element.style.left = '0';
                element.style.zIndex = j;
                tableauPile.appendChild(element);
            });

            // Adjust pile height
            if (cards.length > 0) {
                tableauPile.style.height = `${126 + (cards.length - 1) * 25}px`;
            } else {
                tableauPile.style.height = '126px';
            }
        }
    }
}

// Start the game
const game = new KlondikeGame();
