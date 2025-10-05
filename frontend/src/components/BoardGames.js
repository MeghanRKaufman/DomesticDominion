import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// EPIC BATTLESHIP GAME 🚢
function BattleshipGame({ onGameComplete, onClose }) {
  const [gamePhase, setGamePhase] = useState('setup'); // setup, battle, victory
  const [playerBoard, setPlayerBoard] = useState(createEmptyBoard());
  const [enemyBoard, setEnemyBoard] = useState(createEmptyBoard());
  const [enemyShips, setEnemyShips] = useState([]);
  const [playerShips, setPlayerShips] = useState([]);
  const [currentShip, setCurrentShip] = useState(0);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [gameLog, setGameLog] = useState(['⚓ Admiral, prepare for naval warfare!']);
  const [playerScore, setPlayerScore] = useState(0);
  const [enemyScore, setEnemyScore] = useState(0);
  const [explosionEffect, setExplosionEffect] = useState(null);
  
  const ships = [
    { name: 'Carrier', size: 5, icon: '🛳️' },
    { name: 'Battleship', size: 4, icon: '⛴️' },
    { name: 'Cruiser', size: 3, icon: '🚢' },
    { name: 'Submarine', size: 3, icon: '🚇' },
    { name: 'Destroyer', size: 2, icon: '🛥️' }
  ];

  function createEmptyBoard() {
    return Array(10).fill(null).map(() => 
      Array(10).fill(null).map(() => ({ 
        ship: null, 
        hit: false, 
        miss: false,
        shipId: null 
      }))
    );
  }

  function placeRandomShips() {
    const board = createEmptyBoard();
    const placedShips = [];
    
    ships.forEach((ship, shipIndex) => {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const isHoriz = Math.random() < 0.5;
        const row = Math.floor(Math.random() * 10);
        const col = Math.floor(Math.random() * 10);
        
        if (canPlaceShip(board, row, col, ship.size, isHoriz)) {
          placeShip(board, row, col, ship.size, isHoriz, shipIndex);
          placedShips.push({ ...ship, id: shipIndex, positions: getShipPositions(row, col, ship.size, isHoriz) });
          placed = true;
        }
        attempts++;
      }
    });
    
    return { board, ships: placedShips };
  }

  function canPlaceShip(board, row, col, size, horizontal) {
    if (horizontal) {
      if (col + size > 10) return false;
      for (let i = 0; i < size; i++) {
        if (board[row][col + i].ship) return false;
      }
    } else {
      if (row + size > 10) return false;
      for (let i = 0; i < size; i++) {
        if (board[row + i][col].ship) return false;
      }
    }
    return true;
  }

  function placeShip(board, row, col, size, horizontal, shipId) {
    for (let i = 0; i < size; i++) {
      if (horizontal) {
        board[row][col + i] = { ...board[row][col + i], ship: true, shipId };
      } else {
        board[row + i][col] = { ...board[row + i][col], ship: true, shipId };
      }
    }
  }

  function getShipPositions(row, col, size, horizontal) {
    const positions = [];
    for (let i = 0; i < size; i++) {
      if (horizontal) {
        positions.push(`${row}-${col + i}`);
      } else {
        positions.push(`${row + i}-${col}`);
      }
    }
    return positions;
  }

  useEffect(() => {
    if (gamePhase === 'setup') {
      const enemy = placeRandomShips();
      setEnemyShips(enemy.ships);
      const newEnemyBoard = createEmptyBoard();
      enemy.ships.forEach(ship => {
        ship.positions.forEach(pos => {
          const [r, c] = pos.split('-').map(Number);
          newEnemyBoard[r][c].ship = true;
          newEnemyBoard[r][c].shipId = ship.id;
        });
      });
      setEnemyBoard(newEnemyBoard);
    }
  }, [gamePhase]);

  const handlePlayerShipPlacement = (row, col) => {
    if (gamePhase !== 'setup' || currentShip >= ships.length) return;
    
    const ship = ships[currentShip];
    if (canPlaceShip(playerBoard, row, col, ship.size, isHorizontal)) {
      const newBoard = [...playerBoard];
      placeShip(newBoard, row, col, ship.size, isHorizontal, currentShip);
      
      const newShips = [...playerShips];
      newShips.push({
        ...ship,
        id: currentShip,
        positions: getShipPositions(row, col, ship.size, isHorizontal)
      });
      
      setPlayerBoard(newBoard);
      setPlayerShips(newShips);
      setCurrentShip(currentShip + 1);
      
      if (currentShip + 1 >= ships.length) {
        setGamePhase('battle');
        addToLog('🔥 All ships deployed! Commence battle!');
      }
    }
  };

  const handleAttack = (row, col) => {
    if (!playerTurn || gamePhase !== 'battle') return;
    
    const newEnemyBoard = [...enemyBoard];
    const cell = newEnemyBoard[row][col];
    
    if (cell.hit || cell.miss) return; // Already attacked
    
    if (cell.ship) {
      // HIT!
      cell.hit = true;
      setExplosionEffect(`${row}-${col}`);
      setTimeout(() => setExplosionEffect(null), 1000);
      
      const shipHit = enemyShips.find(ship => ship.id === cell.shipId);
      const allHit = shipHit.positions.every(pos => {
        const [r, c] = pos.split('-').map(Number);
        return newEnemyBoard[r][c].hit;
      });
      
      if (allHit) {
        addToLog(`💥 SUNK! Enemy ${shipHit.name} destroyed!`);
        setPlayerScore(prev => prev + shipHit.size * 10);
        
        // Check if all ships sunk
        const allSunk = enemyShips.every(ship => 
          ship.positions.every(pos => {
            const [r, c] = pos.split('-').map(Number);
            return newEnemyBoard[r][c].hit;
          })
        );
        
        if (allSunk) {
          setGamePhase('victory');
          addToLog('🏆 VICTORY! All enemy ships destroyed!');
          setTimeout(() => onGameComplete('battleship', 100), 2000);
          return;
        }
      } else {
        addToLog(`💥 Direct hit on enemy ${shipHit.name}!`);
        setPlayerScore(prev => prev + 10);
      }
    } else {
      // MISS
      cell.miss = true;
      addToLog(`🌊 Miss at ${String.fromCharCode(65 + col)}${row + 1}`);
    }
    
    setEnemyBoard(newEnemyBoard);
    setPlayerTurn(false);
    
    // Enemy turn after delay
    setTimeout(enemyTurn, 1500);
  };

  const enemyTurn = () => {
    let attempts = 0;
    let validAttack = false;
    
    while (!validAttack && attempts < 100) {
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);
      const cell = playerBoard[row][col];
      
      if (!cell.hit && !cell.miss) {
        const newPlayerBoard = [...playerBoard];
        
        if (cell.ship) {
          // Enemy hit
          newPlayerBoard[row][col].hit = true;
          setExplosionEffect(`player-${row}-${col}`);
          setTimeout(() => setExplosionEffect(null), 1000);
          
          const shipHit = playerShips.find(ship => ship.id === cell.shipId);
          const allHit = shipHit.positions.every(pos => {
            const [r, c] = pos.split('-').map(Number);
            return newPlayerBoard[r][c].hit;
          });
          
          if (allHit) {
            addToLog(`💀 Enemy sunk your ${shipHit.name}!`);
            setEnemyScore(prev => prev + shipHit.size * 10);
            
            // Check if all player ships sunk
            const allSunk = playerShips.every(ship => 
              ship.positions.every(pos => {
                const [r, c] = pos.split('-').map(Number);
                return newPlayerBoard[r][c].hit;
              })
            );
            
            if (allSunk) {
              setGamePhase('defeat');
              addToLog('💀 DEFEAT! All your ships destroyed!');
              setTimeout(() => onGameComplete('battleship', 20), 2000);
              return;
            }
          } else {
            addToLog(`🔥 Enemy hit your ${shipHit.name}!`);
            setEnemyScore(prev => prev + 10);
          }
        } else {
          // Enemy miss
          newPlayerBoard[row][col].miss = true;
          addToLog(`🌊 Enemy missed at ${String.fromCharCode(65 + col)}${row + 1}`);
        }
        
        setPlayerBoard(newPlayerBoard);
        validAttack = true;
      }
      attempts++;
    }
    
    setPlayerTurn(true);
  };

  const addToLog = (message) => {
    setGameLog(prev => [...prev.slice(-4), message]);
  };

  const getCellClass = (cell, isEnemy, row, col) => {
    const baseClass = "w-8 h-8 border border-blue-300 cursor-pointer transition-all duration-200 flex items-center justify-center text-xs font-bold ";
    
    if (explosionEffect === `${row}-${col}` || explosionEffect === `player-${row}-${col}`) {
      return baseClass + "bg-red-500 animate-pulse scale-125 ";
    }
    
    if (cell.hit) {
      return baseClass + "bg-red-600 text-white hover:bg-red-700 ";
    }
    
    if (cell.miss) {
      return baseClass + "bg-blue-600 text-white ";
    }
    
    if (cell.ship && !isEnemy) {
      return baseClass + "bg-gray-600 text-white hover:bg-gray-700 ";
    }
    
    return baseClass + "bg-blue-100 hover:bg-blue-200 ";
  };

  const getCellContent = (cell, isEnemy, row, col) => {
    if (explosionEffect === `${row}-${col}` || explosionEffect === `player-${row}-${col}`) {
      return '💥';
    }
    
    if (cell.hit) {
      return cell.ship ? '🔥' : '💥';
    }
    
    if (cell.miss) {
      return '🌊';
    }
    
    if (cell.ship && !isEnemy) {
      const ship = playerShips.find(s => s.id === cell.shipId);
      return ship ? ship.icon : '⚓';
    }
    
    return '';
  };

  if (gamePhase === 'setup') {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">🚢 Deploy Your Fleet, Admiral!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  Placing: {ships[currentShip]?.icon} {ships[currentShip]?.name} 
                  <span className="text-sm ml-2">({ships[currentShip]?.size} squares)</span>
                </h3>
                <Button 
                  onClick={() => setIsHorizontal(!isHorizontal)}
                  variant="outline"
                  className="mt-2"
                >
                  {isHorizontal ? '↔️ Horizontal' : '↕️ Vertical'}
                </Button>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Click on the board to place ships</p>
                <p className="text-sm font-bold">{currentShip + 1} / {ships.length} ships placed</p>
              </div>
            </div>
            
            <div className="grid grid-cols-10 gap-1 max-w-md mx-auto bg-blue-50 p-4 rounded-lg">
              {playerBoard.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, false, rowIndex, colIndex)}
                    onClick={() => handlePlayerShipPlacement(rowIndex, colIndex)}
                  >
                    {getCellContent(cell, false, rowIndex, colIndex)}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">⚓ Naval Battle Command Center</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-8">
          {/* Enemy Board */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-red-600">🎯 Enemy Waters</h3>
              <p className="text-sm">Score: {playerScore} • {playerTurn ? 'Your Turn' : 'Enemy Turn'}</p>
            </div>
            
            <div className="grid grid-cols-10 gap-1 bg-red-50 p-4 rounded-lg">
              {enemyBoard.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`enemy-${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, true, rowIndex, colIndex)}
                    onClick={() => handleAttack(rowIndex, colIndex)}
                  >
                    {getCellContent(cell, true, rowIndex, colIndex)}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Player Board */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-blue-600">🛡️ Your Fleet</h3>
              <p className="text-sm">Enemy Score: {enemyScore}</p>
            </div>
            
            <div className="grid grid-cols-10 gap-1 bg-blue-50 p-4 rounded-lg">
              {playerBoard.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`player-${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, false, rowIndex, colIndex)}
                  >
                    {getCellContent(cell, false, rowIndex, colIndex)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Battle Log */}
        <div className="mt-4 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-32 overflow-y-auto">
          {gameLog.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
        
        {gamePhase === 'victory' && (
          <div className="text-center text-green-600 font-bold text-xl animate-bounce">
            🏆 VICTORY! You are the Admiral of the Seas! 🏆
          </div>
        )}
        
        {gamePhase === 'defeat' && (
          <div className="text-center text-red-600 font-bold text-xl">
            💀 Your fleet has been destroyed... Try again, Admiral! 💀
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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