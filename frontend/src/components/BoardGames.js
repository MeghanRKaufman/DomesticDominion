import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Chess Game Component
function ChessGame({ onGameComplete, onClose }) {
  const [board, setBoard] = useState(initializeChessBoard());
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameStatus, setGameStatus] = useState('playing');
  const [moveHistory, setMoveHistory] = useState([]);

  function initializeChessBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Set up pieces (simplified)
    const pieces = {
      'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
      'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    };
    
    // Black pieces
    board[0] = ['r','n','b','q','k','b','n','r'];
    board[1] = ['p','p','p','p','p','p','p','p'];
    
    // White pieces  
    board[6] = ['P','P','P','P','P','P','P','P'];
    board[7] = ['R','N','B','Q','K','B','N','R'];
    
    return board.map(row => row.map(piece => piece ? pieces[piece] : null));
  }

  const handleSquareClick = (row, col) => {
    if (selectedSquare) {
      // Make move
      const newBoard = [...board];
      const [fromRow, fromCol] = selectedSquare;
      
      newBoard[row][col] = newBoard[fromRow][fromCol];
      newBoard[fromRow][fromCol] = null;
      
      setBoard(newBoard);
      setSelectedSquare(null);
      setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
      setMoveHistory([...moveHistory, `${String.fromCharCode(97 + fromCol)}${8 - fromRow} to ${String.fromCharCode(97 + col)}${8 - row}`]);
      
      // Simple game end after 10 moves for demo
      if (moveHistory.length >= 10) {
        setGameStatus('finished');
      }
    } else {
      // Select piece
      if (board[row][col]) {
        setSelectedSquare([row, col]);
      }
    }
  };

  const forfeitGame = () => {
    setGameStatus('finished');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">♔ Chess Battle ♛</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          {gameStatus === 'playing' ? (
            <>
              <Badge className="text-lg px-4 py-2">
                {currentPlayer === 'white' ? '♔ White' : '♛ Black'}'s Turn
              </Badge>
              
              <div className="grid grid-cols-8 gap-1 p-4 bg-amber-100 rounded-lg">
                {board.map((row, rowIndex) =>
                  row.map((piece, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-12 h-12 flex items-center justify-center text-2xl cursor-pointer
                        ${(rowIndex + colIndex) % 2 === 0 ? 'bg-amber-200' : 'bg-amber-700'}
                        ${selectedSquare && selectedSquare[0] === rowIndex && selectedSquare[1] === colIndex ? 'ring-4 ring-blue-400' : ''}
                        hover:opacity-80`}
                      onClick={() => handleSquareClick(rowIndex, colIndex)}
                    >
                      {piece}
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex space-x-4">
                <Button onClick={forfeitGame} variant="outline">
                  Forfeit Game
                </Button>
                <Button onClick={() => setGameStatus('finished')}>
                  Declare Draw
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl">🏆</div>
              <h3 className="text-2xl font-bold">Game Complete!</h3>
              <p>Great chess battle! Both players earn points for playing.</p>
              <Button onClick={() => onGameComplete('chess', 20)}>
                Collect 20 XP! ✨
              </Button>
            </div>
          )}
          
          {moveHistory.length > 0 && (
            <div className="text-sm text-gray-600 max-h-20 overflow-y-auto">
              Moves: {moveHistory.join(', ')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Battleship Game Component
function BattleshipGame({ onGameComplete, onClose }) {
  const [playerBoard, setPlayerBoard] = useState(initializeBoard());
  const [opponentBoard, setOpponentBoard] = useState(initializeBoard());
  const [gamePhase, setGamePhase] = useState('setup'); // setup, playing, finished
  const [currentPlayer, setCurrentPlayer] = useState('player');
  const [ships, setShips] = useState({ player: [], opponent: [] });
  const [hits, setHits] = useState({ player: [], opponent: [] });

  function initializeBoard() {
    return Array(8).fill(null).map(() => Array(8).fill('water'));
  }

  const placeRandomShips = (board) => {
    const newBoard = [...board];
    const shipSizes = [3, 3, 2, 2, 1]; // Different ship sizes
    
    shipSizes.forEach(size => {
      let placed = false;
      while (!placed) {
        const isHorizontal = Math.random() > 0.5;
        const startRow = Math.floor(Math.random() * 8);
        const startCol = Math.floor(Math.random() * 8);
        
        if (canPlaceShip(newBoard, startRow, startCol, size, isHorizontal)) {
          for (let i = 0; i < size; i++) {
            if (isHorizontal) {
              newBoard[startRow][startCol + i] = 'ship';
            } else {
              newBoard[startRow + i][startCol] = 'ship';
            }
          }
          placed = true;
        }
      }
    });
    
    return newBoard;
  };

  const canPlaceShip = (board, row, col, size, isHorizontal) => {
    for (let i = 0; i < size; i++) {
      const checkRow = isHorizontal ? row : row + i;
      const checkCol = isHorizontal ? col + i : col;
      
      if (checkRow >= 8 || checkCol >= 8 || board[checkRow][checkCol] !== 'water') {
        return false;
      }
    }
    return true;
  };

  const handleSetupComplete = () => {
    const playerBoardWithShips = placeRandomShips(playerBoard);
    const opponentBoardWithShips = placeRandomShips(opponentBoard);
    
    setPlayerBoard(playerBoardWithShips);
    setOpponentBoard(opponentBoardWithShips);
    setGamePhase('playing');
  };

  const handleAttack = (row, col) => {
    if (gamePhase !== 'playing' || currentPlayer !== 'player') return;
    
    const newOpponentBoard = [...opponentBoard];
    const newHits = { ...hits };
    
    if (newOpponentBoard[row][col] === 'ship') {
      newOpponentBoard[row][col] = 'hit';
      newHits.player.push([row, col]);
      alert('🎯 Direct Hit!');
    } else if (newOpponentBoard[row][col] === 'water') {
      newOpponentBoard[row][col] = 'miss';
      alert('🌊 Splash! You missed.');
    } else {
      return; // Already attacked this square
    }
    
    setOpponentBoard(newOpponentBoard);
    setHits(newHits);
    
    // Check for win condition (simplified)
    if (newHits.player.length >= 10) {
      setGamePhase('finished');
    } else {
      setCurrentPlayer('opponent');
      // Simulate opponent turn
      setTimeout(() => {
        const availableSpots = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (playerBoard[r][c] === 'water' || playerBoard[r][c] === 'ship') {
              availableSpots.push([r, c]);
            }
          }
        }
        
        if (availableSpots.length > 0) {
          const [attackRow, attackCol] = availableSpots[Math.floor(Math.random() * availableSpots.length)];
          const newPlayerBoard = [...playerBoard];
          
          if (newPlayerBoard[attackRow][attackCol] === 'ship') {
            newPlayerBoard[attackRow][attackCol] = 'hit';
          } else {
            newPlayerBoard[attackRow][attackCol] = 'miss';
          }
          
          setPlayerBoard(newPlayerBoard);
        }
        
        setCurrentPlayer('player');
      }, 1000);
    }
  };

  const getCellDisplay = (cell, isPlayerBoard = false) => {
    switch (cell) {
      case 'water': return '🌊';
      case 'ship': return isPlayerBoard ? '🚢' : '🌊'; // Hide opponent ships
      case 'hit': return '💥';
      case 'miss': return '❌';
      default: return '🌊';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">🚢 Battleship Battle ⚓</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {gamePhase === 'setup' && (
            <div className="text-center space-y-4">
              <p className="text-lg">⚓ Deploy your fleet, Admiral!</p>
              <Button onClick={handleSetupComplete} size="lg">
                🚢 Auto-Deploy Ships & Start Battle!
              </Button>
            </div>
          )}
          
          {gamePhase === 'playing' && (
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <h3 className="text-lg font-bold mb-2">🏴‍☠️ Your Fleet</h3>
                <div className="grid grid-cols-8 gap-1 p-2 bg-blue-100 rounded">
                  {playerBoard.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <div
                        key={`player-${rowIndex}-${colIndex}`}
                        className="w-8 h-8 flex items-center justify-center text-sm bg-blue-200 rounded"
                      >
                        {getCellDisplay(cell, true)}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-bold mb-2">🎯 Enemy Waters</h3>
                <div className="grid grid-cols-8 gap-1 p-2 bg-red-100 rounded">
                  {opponentBoard.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <div
                        key={`opponent-${rowIndex}-${colIndex}`}
                        className="w-8 h-8 flex items-center justify-center text-sm bg-red-200 rounded cursor-pointer hover:bg-red-300"
                        onClick={() => handleAttack(rowIndex, colIndex)}
                      >
                        {getCellDisplay(cell, false)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {gamePhase === 'finished' && (
            <div className="text-center space-y-4">
              <div className="text-6xl">⚓</div>
              <h3 className="text-2xl font-bold">Battle Complete!</h3>
              <p>Excellent naval warfare! Both admirals earn victory points.</p>
              <Button onClick={() => onGameComplete('battleship', 25)}>
                Collect 25 XP! ⚓
              </Button>
            </div>
          )}
          
          {gamePhase === 'playing' && (
            <div className="text-center">
              <Badge className="text-lg px-4 py-2">
                {currentPlayer === 'player' ? '🎯 Your Turn - Fire!' : '⏳ Opponent Attacking...'}
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Card Game Component (Go Fish)
function GoFishGame({ onGameComplete, onClose }) {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerBooks, setPlayerBooks] = useState([]);
  const [opponentBooks, setOpponentBooks] = useState([]);
  const [deck, setDeck] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('player');
  const [gameMessage, setGameMessage] = useState('');
  const [gameStarted, setGameStarted] = useState(false);

  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];

  const initializeGame = () => {
    // Create deck
    const newDeck = [];
    ranks.forEach(rank => {
      suits.forEach(suit => {
        newDeck.push({ rank, suit });
      });
    });
    
    // Shuffle deck
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    
    // Deal hands
    const playerCards = newDeck.slice(0, 7);
    const opponentCards = newDeck.slice(7, 14);
    const remainingDeck = newDeck.slice(14);
    
    setPlayerHand(playerCards);
    setOpponentHand(opponentCards);
    setDeck(remainingDeck);
    setGameStarted(true);
    setGameMessage('Ask your opponent for cards!');
  };

  const askForCards = (rank) => {
    const opponentCardsWithRank = opponentHand.filter(card => card.rank === rank);
    
    if (opponentCardsWithRank.length > 0) {
      // Opponent has cards
      const newPlayerHand = [...playerHand, ...opponentCardsWithRank];
      const newOpponentHand = opponentHand.filter(card => card.rank !== rank);
      
      setPlayerHand(newPlayerHand);
      setOpponentHand(newOpponentHand);
      setGameMessage(`Great! You got ${opponentCardsWithRank.length} ${rank}s!`);
      
      checkForBooks(newPlayerHand, 'player');
    } else {
      // Go Fish!
      setGameMessage('Go Fish! Draw a card.');
      if (deck.length > 0) {
        const drawnCard = deck[0];
        setPlayerHand([...playerHand, drawnCard]);
        setDeck(deck.slice(1));
      }
      setCurrentPlayer('opponent');
      
      // Simulate opponent turn
      setTimeout(() => {
        simulateOpponentTurn();
      }, 1500);
    }
  };

  const simulateOpponentTurn = () => {
    if (playerHand.length === 0) return;
    
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    const playerCardsWithRank = playerHand.filter(card => card.rank === randomRank);
    
    if (playerCardsWithRank.length > 0) {
      const newOpponentHand = [...opponentHand, ...playerCardsWithRank];
      const newPlayerHand = playerHand.filter(card => card.rank !== randomRank);
      
      setOpponentHand(newOpponentHand);
      setPlayerHand(newPlayerHand);
      setGameMessage(`Opponent took your ${randomRank}s!`);
      
      checkForBooks(newOpponentHand, 'opponent');
    } else {
      setGameMessage('You said "Go Fish!" Opponent draws a card.');
      if (deck.length > 0) {
        setOpponentHand([...opponentHand, deck[0]]);
        setDeck(deck.slice(1));
      }
    }
    
    setCurrentPlayer('player');
  };

  const checkForBooks = (hand, player) => {
    const rankCounts = {};
    hand.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    });
    
    const newBooks = [];
    Object.keys(rankCounts).forEach(rank => {
      if (rankCounts[rank] === 4) {
        newBooks.push(rank);
      }
    });
    
    if (newBooks.length > 0) {
      if (player === 'player') {
        setPlayerBooks([...playerBooks, ...newBooks]);
      } else {
        setOpponentBooks([...opponentBooks, ...newBooks]);
      }
    }
  };

  const getUniqueRanks = (hand) => {
    const ranks = new Set(hand.map(card => card.rank));
    return Array.from(ranks);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">🐟 Go Fish! 🎣</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {!gameStarted ? (
            <div className="text-center space-y-4">
              <p className="text-lg">🎣 Ready to fish for cards?</p>
              <Button onClick={initializeGame} size="lg">
                🐟 Deal the Cards!
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <Badge className="text-lg px-4 py-2 mb-4">
                  {currentPlayer === 'player' ? '🎣 Your Turn' : '⏳ Opponent\'s Turn'}
                </Badge>
                {gameMessage && (
                  <p className="text-center text-lg font-semibold text-blue-600">{gameMessage}</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <h3 className="font-bold mb-2">📚 Your Books: {playerBooks.length}</h3>
                  <div className="flex flex-wrap gap-1 justify-center mb-4">
                    {playerBooks.map((book, i) => (
                      <Badge key={i} className="bg-green-100 text-green-800">{book}</Badge>
                    ))}
                  </div>
                  
                  <h3 className="font-bold mb-2">🃏 Your Hand ({playerHand.length})</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {playerHand.map((card, i) => (
                      <div key={i} className="bg-white border rounded p-1 text-sm">
                        {card.rank}{card.suit}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-center">
                  <h3 className="font-bold mb-2">📚 Opponent Books: {opponentBooks.length}</h3>
                  <div className="flex flex-wrap gap-1 justify-center mb-4">
                    {opponentBooks.map((book, i) => (
                      <Badge key={i} className="bg-red-100 text-red-800">{book}</Badge>
                    ))}
                  </div>
                  
                  <h3 className="font-bold mb-2">🃏 Opponent Hand ({opponentHand.length})</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {opponentHand.map((_, i) => (
                      <div key={i} className="bg-blue-500 border rounded p-1 text-sm w-8 h-10 text-white text-center">
                        🃏
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {currentPlayer === 'player' && playerHand.length > 0 && (
                <div className="text-center">
                  <h4 className="font-semibold mb-2">Ask for cards:</h4>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {getUniqueRanks(playerHand).map(rank => (
                      <Button
                        key={rank}
                        onClick={() => askForCards(rank)}
                        variant="outline"
                        size="sm"
                      >
                        Ask for {rank}s
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {(playerBooks.length + opponentBooks.length >= 6 || deck.length === 0) && (
                <div className="text-center space-y-4">
                  <div className="text-6xl">🏆</div>
                  <h3 className="text-2xl font-bold">Game Over!</h3>
                  <p>
                    {playerBooks.length > opponentBooks.length ? 'You won!' : 
                     opponentBooks.length > playerBooks.length ? 'Opponent won!' : 'It\'s a tie!'}
                  </p>
                  <Button onClick={() => onGameComplete('gofish', 15)}>
                    Collect 15 XP! 🐟
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Speed Card Game
function SpeedGame({ onGameComplete, onClose }) {
  const [playerPile, setPlayerPile] = useState([]);
  const [opponentPile, setOpponentPile] = useState([]);
  const [centerPiles, setCenterPiles] = useState([null, null]);
  const [playerHand, setPlayerHand] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  const initializeSpeedGame = () => {
    const deck = [];
    for (let i = 1; i <= 13; i++) {
      for (let j = 0; j < 4; j++) {
        deck.push(i);
      }
    }
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    const playerCards = deck.slice(0, 20);
    const opponentCards = deck.slice(20, 40);
    
    setPlayerPile(playerCards.slice(5));
    setOpponentPile(opponentCards.slice(5));
    setPlayerHand(playerCards.slice(0, 5));
    setCenterPiles([6, 7]); // Starting center cards
    setGameStarted(true);
  };

  useEffect(() => {
    if (gameStarted && !gameEnded && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setGameEnded(true);
    }
  }, [gameStarted, gameEnded, timeLeft]);

  const canPlayCard = (cardValue, pileIndex) => {
    const centerCard = centerPiles[pileIndex];
    return Math.abs(cardValue - centerCard) === 1 || 
           (cardValue === 1 && centerCard === 13) || 
           (cardValue === 13 && centerCard === 1);
  };

  const playCard = (cardIndex, pileIndex) => {
    const card = playerHand[cardIndex];
    if (!canPlayCard(card, pileIndex)) return;
    
    const newCenterPiles = [...centerPiles];
    newCenterPiles[pileIndex] = card;
    setCenterPiles(newCenterPiles);
    
    const newHand = playerHand.filter((_, i) => i !== cardIndex);
    
    // Draw new card if available
    if (playerPile.length > 0) {
      newHand.push(playerPile[0]);
      setPlayerPile(playerPile.slice(1));
    }
    
    setPlayerHand(newHand);
    
    // Check win condition
    if (newHand.length === 0 && playerPile.length === 0) {
      setGameEnded(true);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">⚡ Speed! ⚡</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {!gameStarted ? (
            <div className="text-center space-y-4">
              <p className="text-lg">⚡ Ready for lightning-fast card action?</p>
              <Button onClick={initializeSpeedGame} size="lg">
                ⚡ Start Speed Game!
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <Badge className="text-xl px-4 py-2 bg-red-100 text-red-800">
                  ⏰ {timeLeft}s remaining
                </Badge>
              </div>
              
              <div className="text-center">
                <h3 className="mb-4">🎯 Center Piles - Play ±1</h3>
                <div className="flex justify-center space-x-4 mb-6">
                  {centerPiles.map((pile, i) => (
                    <div key={i} className="w-20 h-28 bg-green-200 border-2 border-green-400 rounded flex items-center justify-center text-2xl font-bold">
                      {pile}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="mb-4">🃏 Your Hand - Click to Play!</h3>
                <div className="flex justify-center space-x-2">
                  {playerHand.map((card, i) => (
                    <div
                      key={i}
                      className="w-16 h-24 bg-white border-2 border-blue-400 rounded flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-blue-100"
                      onClick={() => {
                        // Try to play on either center pile
                        if (canPlayCard(card, 0)) {
                          playCard(i, 0);
                        } else if (canPlayCard(card, 1)) {
                          playCard(i, 1);
                        }
                      }}
                    >
                      {card}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">Cards left in pile: {playerPile.length}</p>
              </div>
              
              {gameEnded && (
                <div className="text-center space-y-4">
                  <div className="text-6xl">⚡</div>
                  <h3 className="text-2xl font-bold">Speed Round Complete!</h3>
                  <p>Lightning reflexes! You've earned speed bonus points.</p>
                  <Button onClick={() => onGameComplete('speed', 30)}>
                    Collect 30 XP! ⚡
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Board Games Component
function BoardGames({ onGameComplete, onClose }) {
  const [selectedGame, setSelectedGame] = useState(null);

  const games = [
    { 
      id: 'chess', 
      name: 'Chess', 
      emoji: '♔', 
      description: 'Strategic board game of kings and queens',
      xp: 20,
      time: '15-30 min'
    },
    { 
      id: 'battleship', 
      name: 'Battleship', 
      emoji: '⚓', 
      description: 'Naval warfare and strategy',
      xp: 25,
      time: '10-15 min'
    },
    { 
      id: 'gofish', 
      name: 'Go Fish', 
      emoji: '🐟', 
      description: 'Classic card fishing game',
      xp: 15,
      time: '5-10 min'
    },
    { 
      id: 'speed', 
      name: 'Speed', 
      emoji: '⚡', 
      description: 'Fast-paced card action',
      xp: 30,
      time: '3-5 min'
    }
  ];

  const handleGameSelect = (gameId) => {
    setSelectedGame(gameId);
  };

  const handleGameComplete = (gameType, xp) => {
    setSelectedGame(null);
    onGameComplete(gameType, xp);
  };

  return (
    <>
      {!selectedGame ? (
        <Dialog open={true} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl text-center">🎲 Couple Game Night 🎯</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-center text-lg text-gray-600">
                Choose a game to play together and earn XP!
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {games.map(game => (
                  <Card 
                    key={game.id} 
                    className="cursor-pointer hover:shadow-lg transition-all transform hover:scale-105"
                    onClick={() => handleGameSelect(game.id)}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="text-4xl mb-2">{game.emoji}</div>
                      <h3 className="text-xl font-bold mb-2">{game.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{game.description}</p>
                      <div className="flex justify-center space-x-4 text-sm">
                        <Badge className="bg-green-100 text-green-800">
                          +{game.xp} XP
                        </Badge>
                        <Badge variant="outline">
                          {game.time}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="text-center mt-6">
                <Button onClick={onClose} variant="outline">
                  Maybe Later
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <>
          {selectedGame === 'chess' && (
            <ChessGame 
              onGameComplete={handleGameComplete} 
              onClose={() => setSelectedGame(null)} 
            />
          )}
          {selectedGame === 'battleship' && (
            <BattleshipGame 
              onGameComplete={handleGameComplete} 
              onClose={() => setSelectedGame(null)} 
            />
          )}
          {selectedGame === 'gofish' && (
            <GoFishGame 
              onGameComplete={handleGameComplete} 
              onClose={() => setSelectedGame(null)} 
            />
          )}
          {selectedGame === 'speed' && (
            <SpeedGame 
              onGameComplete={handleGameComplete} 
              onClose={() => setSelectedGame(null)} 
            />
          )}
        </>
      )}
    </>
  );
}

export default BoardGames;