import React, { useState, useEffect, useCallback } from 'react';

const SUITS = ['♠', '♥', '♣', '♦'];
const COLORS = { '♠': 'black', '♥': 'red', '♣': 'black', '♦': 'red' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export default function Solitaire() {
    const [gameState, setGameState] = useState({
        stock: [],
        waste: [],
        foundations: { '♠': [], '♥': [], '♣': [], '♦': [] },
        tableau: [[], [], [], [], [], [], []]
    });
    const [draggedData, setDraggedData] = useState(null);
    const [score, setScore] = useState(0);

    // --- Game Logic ---

    const shuffle = (array) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    };

    const initGame = useCallback(() => {
        const deck = [];
        SUITS.forEach(suit => {
            RANKS.forEach((rank, index) => {
                deck.push({
                    suit,
                    rank,
                    value: index + 1,
                    id: `${rank}${suit}`,
                    faceUp: false,
                    color: COLORS[suit]
                });
            });
        });

        const shuffled = shuffle([...deck]);
        const newTableau = [[], [], [], [], [], [], []];

        // Deal Tableau
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                const card = shuffled.pop();
                if (j === i) card.faceUp = true;
                newTableau[i].push(card);
            }
        }

        setGameState({
            stock: shuffled,
            waste: [],
            foundations: { '♠': [], '♥': [], '♣': [], '♦': [] },
            tableau: newTableau
        });
        setScore(0);
    }, []);

    useEffect(() => {
        initGame();
    }, [initGame]);

    // --- Interaction Handlers ---

    const handleStockClick = () => {
        if (gameState.stock.length === 0) {
            // Recycle waste to stock
            const newStock = [...gameState.waste].reverse().map(c => ({ ...c, faceUp: false }));
            setGameState(prev => ({ ...prev, stock: newStock, waste: [] }));
        } else {
            // Draw card
            const newStock = [...gameState.stock];
            const card = newStock.pop();
            card.faceUp = true;
            setGameState(prev => ({
                ...prev,
                stock: newStock,
                waste: [...prev.waste, card]
            }));
        }
    };

    const handleDragStart = (e, card, source, index = null) => {
        // Only allow dragging face-up cards
        if (!card.faceUp) {
            e.preventDefault();
            return;
        }

        // Defer state update to prevent drag cancellation by immediate re-render
        // This is a crucial fix for React DnD issues in some browsers
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'card' })); // required for firefox

        setTimeout(() => {
            setDraggedData({ card, source, index });
        }, 0);
    };

    const handleDrop = (e, targetLocation, targetIndex = null) => {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling

        if (!draggedData) return;

        const { card, source, index: sourceIndex } = draggedData;

        // ... rest of logic ...
        let success = false;

        // Logic for Dropping
        if (targetLocation === 'foundation') {
            // Can only drop single cards on foundation
            if (source === 'tableau' && sourceIndex !== gameState.tableau[draggedData.colIndex].length - 1) return;

            // Check rules: Same suit, Ascending order (A -> K)
            const foundationPile = gameState.foundations[card.suit];
            const topCard = foundationPile.length > 0 ? foundationPile[foundationPile.length - 1] : null;

            // Strict suit check for explicit drops
            if (targetIndex !== card.suit) return;

            const nextValue = topCard ? topCard.value + 1 : 1;
            if (card.value === nextValue) {
                success = true;
                moveCardToFoundation(card, source, draggedData.colIndex);
            }
        }
        else if (targetLocation === 'tableau') {
            // targetIndex is the column index
            const targetColumn = gameState.tableau[targetIndex];
            const topCard = targetColumn.length > 0 ? targetColumn[targetColumn.length - 1] : null;

            // Rules: Alternating Color, Descending Order (K -> A)
            // Empty column takes King
            if (!topCard) {
                if (card.value === 13) { // King
                    success = true;
                    moveCardsToTableau(source, draggedData.colIndex, sourceIndex, targetIndex);
                }
            } else {
                if (card.color !== topCard.color && card.value === topCard.value - 1) {
                    success = true;
                    moveCardsToTableau(source, draggedData.colIndex, sourceIndex, targetIndex);
                }
            }
        }

        setDraggedData(null);
    };

    // ... move functions ...

    // ... move function implementations needed ...
    // Since I'm replacing a huge chunk, verify moveCardToFoundation and moveCardsToTableau are intact or provided.
    // The previous chunk logic was correct, let's just replace the handlers.

    // RE-INSTATE move functions because replace_file_content replaces the whole block
    const moveCardToFoundation = (card, source, colIndex) => {
        setGameState(prev => {
            const newState = { ...prev };
            if (source === 'waste') {
                newState.waste.pop();
            } else if (source === 'tableau') {
                newState.tableau[colIndex].pop();
                const colLen = newState.tableau[colIndex].length;
                if (colLen > 0) newState.tableau[colIndex][colLen - 1].faceUp = true;
            }
            newState.foundations[card.suit].push(card);
            setScore(s => s + 10);
            return newState;
        });
    };

    const moveCardsToTableau = (source, sourceColIndex, sourceCardIndex, targetColIndex) => {
        setGameState(prev => {
            const newState = { ...prev };
            let cardsToMove = [];

            if (source === 'waste') {
                cardsToMove = [newState.waste.pop()];
            } else if (source === 'tableau') {
                cardsToMove = newState.tableau[sourceColIndex].splice(sourceCardIndex);
                const colLen = newState.tableau[sourceColIndex].length;
                if (colLen > 0) newState.tableau[sourceColIndex][colLen - 1].faceUp = true;
            }

            newState.tableau[targetColIndex] = [...newState.tableau[targetColIndex], ...cardsToMove];
            if (source === 'waste') setScore(s => s + 5);
            return newState;
        });
    };

    const handleDoubleClick = (card, source, colIndex) => {
        const foundationPile = gameState.foundations[card.suit];
        const topCard = foundationPile.length > 0 ? foundationPile[foundationPile.length - 1] : null;
        const nextValue = topCard ? topCard.value + 1 : 1;

        if (card.value === nextValue) {
            moveCardToFoundation(card, source, colIndex);
        }
    };


    // --- Render Components ---

    const Card = ({ card, source, index, colIndex, isTop }) => {
        const isDragSource = draggedData && draggedData.card === card;

        const handleCardDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Only allow drop if we are the top card of a tableau pile
            if (source === 'tableau' && !isTop) return;

            if (source === 'tableau') {
                handleDrop(e, 'tableau', colIndex);
            } else if (source === 'foundation') {
                handleDrop(e, 'foundation', card.suit);
            }
        };

        return (
            <div
                draggable={card.faceUp}
                onDragStart={(e) => handleDragStart(e, card, source, index)}
                onDragEnd={() => setDraggedData(null)} // Cleanup
                onDragOver={(e) => {
                    e.preventDefault(); // Essential for allowing drop
                    e.stopPropagation(); // Don't let parent column handle it differently if we are a valid target
                }}
                onDrop={handleCardDrop}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (card.faceUp) handleDoubleClick(card, source, colIndex);
                }}
                className={`
                    w-12 h-16 rounded border border-gray-400 select-none relative
                    ${card.faceUp ? 'bg-white' : 'bg-blue-800'}
                    ${isDragSource ? 'opacity-0' : 'opacity-100'} 
                    font-bold flex flex-col justify-between p-1
                `}
                style={{
                    boxShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    color: card.color,
                    cursor: card.faceUp ? 'grab' : 'default',
                    // Pattern for back of card
                    backgroundImage: !card.faceUp ? `
                        repeating-linear-gradient(45deg, #000080 0, #000080 2px, #0000a0 2px, #0000a0 4px)
                    ` : 'none'
                }}
            >
                {card.faceUp && (
                    <>
                        <div className="text-xs leading-none">{card.rank}{card.suit}</div>
                        <div className="flex-1 flex items-center justify-center text-xl">
                            {['J', 'Q', 'K'].includes(card.rank) ? (
                                <div className="text-xs border border-gray-300 p-[1px]">🤴</div> // Placeholder graphic
                            ) : card.suit}
                        </div>
                        <div className="text-xs leading-none text-right transform rotate-180">{card.rank}{card.suit}</div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#008000] p-4 h-full flex flex-col overflow-hidden select-none font-sans min-h-[400px]">
            {/* Top Bar: Stock, Waste, Foundations */}
            <div className="flex justify-between mb-8">
                <div className="flex gap-4">
                    {/* Stock */}
                    <div
                        onClick={handleStockClick}
                        className="w-12 h-16 rounded border-2 border-green-900 bg-green-700 flex items-center justify-center cursor-pointer relative"
                    >
                        {gameState.stock.length > 0 ? (
                            <div className="w-full h-full rounded bg-blue-800 border-2 border-white" style={{
                                backgroundImage: `repeating-linear-gradient(45deg, #000080 0, #000080 2px, #0000a0 2px, #0000a0 4px)`
                            }}>
                                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">
                                    Refresh
                                </div>
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-green-800"></div>
                        )}
                    </div>

                    {/* Waste */}
                    <div className="w-12 h-16 relative">
                        {gameState.waste.length > 0 && (
                            <Card
                                card={gameState.waste[gameState.waste.length - 1]}
                                source="waste"
                                isTop={true}
                            />
                        )}
                    </div>
                </div>

                {/* Score */}
                <div className="text-white font-mono font-bold bg-black/20 px-2 rounded self-center">
                    Score: {score}
                </div>

                {/* Foundations */}
                <div className="flex gap-2">
                    {SUITS.map(suit => (
                        <div
                            key={suit}
                            className="w-12 h-16 rounded border-2 border-green-900 bg-green-700 flex items-center justify-center text-green-900 text-2xl font-bold opacity-50 relative"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, 'foundation', suit)}
                        >
                            {suit}
                            {gameState.foundations[suit].length > 0 && (
                                <div className="absolute inset-0">
                                    <Card
                                        card={gameState.foundations[suit][gameState.foundations[suit].length - 1]}
                                        source="foundation"
                                        isTop={true}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tableau */}
            <div className="flex-1 flex justify-between px-2">
                {gameState.tableau.map((pile, colIndex) => (
                    <div
                        key={colIndex}
                        className="w-12 h-full relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, 'tableau', colIndex)}
                    >
                        {/* Placeholder for empty column */}
                        <div className="w-12 h-16 rounded border border-green-900/30 absolute top-0 left-0"></div>

                        {/* Cards Stack */}
                        {pile.map((card, cardIndex) => (
                            card ? (
                                <div
                                    key={card.id}
                                    className="absolute left-0"
                                    style={{ top: `${cardIndex * 15}px`, zIndex: cardIndex }}
                                >
                                    <Card
                                        card={card}
                                        source="tableau"
                                        colIndex={colIndex}
                                        index={cardIndex}
                                        isTop={cardIndex === pile.length - 1}
                                    />
                                </div>
                            ) : null
                        ))}
                    </div>
                ))}
            </div>

            <div className="text-white/50 text-[10px] text-center mt-2">
                Double-click to auto-move to foundation
            </div>
        </div>
    );
}
