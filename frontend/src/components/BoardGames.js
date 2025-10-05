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

// EPIC CHESS GAME ♔
function ChessGame({ onGameComplete, onClose }) {
  const [board, setBoard] = useState(initializeChessBoard());
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameStatus, setGameStatus] = useState('playing');
  const [moveHistory, setMoveHistory] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [gameTime, setGameTime] = useState({ white: 600, black: 600 }); // 10 minutes each
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [checkStatus, setCheckStatus] = useState(null);

  const pieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
  };

  function initializeChessBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Black pieces
    board[0] = ['r','n','b','q','k','b','n','r'];
    board[1] = ['p','p','p','p','p','p','p','p'];
    
    // White pieces  
    board[6] = ['P','P','P','P','P','P','P','P'];
    board[7] = ['R','N','B','Q','K','B','N','R'];
    
    return board;
  }

  // Timer effect
  useEffect(() => {
    if (!isTimerActive || gameStatus !== 'playing') return;
    
    const timer = setInterval(() => {
      setGameTime(prev => {
        const newTime = { ...prev };
        newTime[currentPlayer]--;
        
        if (newTime[currentPlayer] <= 0) {
          setGameStatus('timeout');
          onGameComplete('chess', currentPlayer === 'white' ? 0 : 150);
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentPlayer, isTimerActive, gameStatus]);

  const isValidMove = (fromRow, fromCol, toRow, toCol) => {
    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];
    const isWhite = piece === piece.toUpperCase();
    
    // Can't capture own piece
    if (targetPiece && getPieceColor(piece) === getPieceColor(targetPiece)) {
      return false;
    }
    
    // Basic move validation for each piece type
    const pieceType = piece.toLowerCase();
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    switch (pieceType) {
      case 'p': // Pawn
        const direction = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        
        if (colDiff === 0) { // Forward move
          if (targetPiece) return false; // Can't capture forward
          if (toRow === fromRow + direction) return true; // One square
          if (fromRow === startRow && toRow === fromRow + 2 * direction) return true; // Two squares from start
        } else if (colDiff === 1 && toRow === fromRow + direction && targetPiece) {
          return true; // Diagonal capture
        }
        return false;
        
      case 'r': // Rook
        return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);
        
      case 'n': // Knight
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
        
      case 'b': // Bishop
        return rowDiff === colDiff && isPathClear(fromRow, fromCol, toRow, toCol);
        
      case 'q': // Queen
        return ((rowDiff === 0 || colDiff === 0) || (rowDiff === colDiff)) && isPathClear(fromRow, fromCol, toRow, toCol);
        
      case 'k': // King
        return rowDiff <= 1 && colDiff <= 1;
        
      default:
        return false;
    }
  };

  const isPathClear = (fromRow, fromCol, toRow, toCol) => {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol]) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  };

  const handleSquareClick = (row, col) => {
    const piece = board[row][col];
    
    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const fromPiece = board[fromRow][fromCol];
      
      // Check if it's the correct player's turn
      if (getPieceColor(fromPiece) !== currentPlayer) {
        setSelectedSquare(null);
        return;
      }
      
      if (isValidMove(fromRow, fromCol, row, col)) {
        // Valid move
        const newBoard = [...board];
        const capturedPiece = newBoard[row][col];
        
        // Handle captures
        if (capturedPiece) {
          setCapturedPieces(prev => ({
            ...prev,
            [currentPlayer]: [...prev[currentPlayer], capturedPiece]
          }));
          
          // Check for king capture (game over)
          if (capturedPiece.toLowerCase() === 'k') {
            setGameStatus('won');
            onGameComplete('chess', currentPlayer === 'white' ? 150 : 75);
            return;
          }
        }
        
        newBoard[row][col] = newBoard[fromRow][fromCol];
        newBoard[fromRow][fromCol] = null;
        
        setBoard(newBoard);
        setMoveHistory(prev => [...prev, { from: [fromRow, fromCol], to: [row, col], piece: fromPiece, captured: capturedPiece }]);
        setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
        setSelectedSquare(null);
      } else {
        // Invalid move, deselect or select new piece
        if (piece && getPieceColor(piece) === currentPlayer) {
          setSelectedSquare([row, col]);
        } else {
          setSelectedSquare(null);
        }
      }
    } else if (piece && getPieceColor(piece) === currentPlayer) {
      // Select piece
      setSelectedSquare([row, col]);
    }
  };

  const getPieceColor = (piece) => {
    return piece === piece.toUpperCase() ? 'white' : 'black';
  };

  const getSquareColor = (row, col) => {
    const isLight = (row + col) % 2 === 0;
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    
    if (isSelected) return 'bg-yellow-400 ring-2 ring-yellow-600';
    return isLight ? 'bg-amber-100' : 'bg-amber-600';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-3xl text-center">♔ Royal Chess Battle ♚</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-6">
          {/* Captured White Pieces */}
          <div className="space-y-2">
            <h3 className="font-bold text-center">♔ White Captured</h3>
            <div className="flex flex-wrap gap-1 justify-center bg-gray-100 p-2 rounded min-h-[60px]">
              {capturedPieces.black.map((piece, i) => (
                <span key={i} className="text-xl">{pieces[piece]}</span>
              ))}
            </div>
            
            <div className={`text-center p-2 rounded ${currentPlayer === 'white' ? 'bg-blue-200 ring-2 ring-blue-500' : 'bg-gray-100'}`}>
              <div className="font-bold">White</div>
              <div className={`text-xl ${gameTime.white < 60 ? 'text-red-600 animate-pulse' : ''}`}>
                ⏱️ {formatTime(gameTime.white)}
              </div>
            </div>
          </div>
          
          {/* Chess Board */}
          <div className="flex flex-col items-center space-y-4">
            <div className="grid grid-cols-8 gap-0 border-4 border-amber-800 bg-amber-900 shadow-2xl">
              {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-12 h-12 ${getSquareColor(rowIndex, colIndex)} flex items-center justify-center text-3xl cursor-pointer hover:opacity-80 transition-all duration-200 relative`}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                  >
                    {piece ? pieces[piece] : ''}
                    
                    {/* Coordinate labels */}
                    {colIndex === 0 && (
                      <div className="absolute left-1 top-1 text-xs font-bold text-amber-800">
                        {8 - rowIndex}
                      </div>
                    )}
                    {rowIndex === 7 && (
                      <div className="absolute right-1 bottom-1 text-xs font-bold text-amber-800">
                        {String.fromCharCode(97 + colIndex)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {gameStatus === 'won' && (
              <div className="text-center text-green-600 font-bold text-xl animate-bounce">
                🏆 Checkmate! {currentPlayer === 'black' ? 'White' : 'Black'} Wins! 🏆
              </div>
            )}
            
            {gameStatus === 'timeout' && (
              <div className="text-center text-red-600 font-bold text-xl">
                ⏰ Time's Up! {currentPlayer === 'white' ? 'Black' : 'White'} Wins! ⏰
              </div>
            )}
            
            <div className="text-sm text-gray-600 text-center">
              Click a piece to select • Click destination to move<br/>
              Current Turn: <span className="font-bold">{currentPlayer === 'white' ? '♔ White' : '♚ Black'}</span>
            </div>
          </div>
          
          {/* Captured Black Pieces */}
          <div className="space-y-2">
            <h3 className="font-bold text-center">♚ Black Captured</h3>
            <div className="flex flex-wrap gap-1 justify-center bg-gray-800 p-2 rounded min-h-[60px]">
              {capturedPieces.white.map((piece, i) => (
                <span key={i} className="text-xl">{pieces[piece]}</span>
              ))}
            </div>
            
            <div className={`text-center p-2 rounded ${currentPlayer === 'black' ? 'bg-red-200 ring-2 ring-red-500' : 'bg-gray-100'}`}>
              <div className="font-bold">Black</div>
              <div className={`text-xl ${gameTime.black < 60 ? 'text-red-600 animate-pulse' : ''}`}>
                ⏱️ {formatTime(gameTime.black)}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// EPIC BACKGAMMON GAME 🎲
function BackgammonGame({ onGameComplete, onClose }) {
  const [board, setBoard] = useState(initializeBackgammonBoard());
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [dice, setDice] = useState([0, 0]);
  const [movesLeft, setMovesLeft] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [gamePhase, setGamePhase] = useState('roll'); // roll, move, finished
  const [score, setScore] = useState({ white: 0, black: 0 });
  const [bearOff, setBearOff] = useState({ white: [], black: [] });
  const [bar, setBar] = useState({ white: 0, black: 0 });
  const [gameLog, setGameLog] = useState(['🎲 Welcome to Backgammon! Roll to begin your turn.']);

  function initializeBackgammonBoard() {
    const board = Array(24).fill(null).map(() => ({ pieces: 0, color: null }));
    
    // Initialize starting position
    board[0] = { pieces: 2, color: 'black' };   // Point 1
    board[4] = { pieces: 5, color: 'white' };   // Point 5
    board[6] = { pieces: 3, color: 'white' };   // Point 7
    board[11] = { pieces: 5, color: 'black' };  // Point 12
    board[12] = { pieces: 5, color: 'white' };  // Point 13
    board[16] = { pieces: 3, color: 'black' };  // Point 17
    board[18] = { pieces: 5, color: 'black' };  // Point 19
    board[23] = { pieces: 2, color: 'white' };  // Point 24
    
    return board;
  }

  const rollDice = () => {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    setDice([die1, die2]);
    
    // Determine available moves
    const moves = die1 === die2 ? [die1, die1, die1, die1] : [die1, die2];
    setMovesLeft(moves);
    setGamePhase('move');
    
    addToLog(`🎲 ${currentPlayer.toUpperCase()} rolled ${die1}, ${die2}${die1 === die2 ? ' (Doubles!)' : ''}`);
  };

  const canMakeMove = (fromPoint, toPoint, moveDistance) => {
    // Check if piece can move from fromPoint by moveDistance
    if (fromPoint < 0 || fromPoint >= 24) return false;
    
    const fromSpot = board[fromPoint];
    if (!fromSpot.pieces || fromSpot.color !== currentPlayer) return false;
    
    // Check if trying to bear off
    if ((currentPlayer === 'white' && toPoint >= 24) || (currentPlayer === 'black' && toPoint < 0)) {
      // Can only bear off if all pieces are in home board
      const homeBoard = currentPlayer === 'white' ? 
        board.slice(18, 24).every(spot => !spot.pieces || spot.color === 'white') :
        board.slice(0, 6).every(spot => !spot.pieces || spot.color === 'black');
      
      if (!homeBoard) return false;
      
      // Must use exact number unless higher point is empty
      if (currentPlayer === 'white' && toPoint > 24) {
        const higherPoints = board.slice(fromPoint + 1, 24).some(spot => spot.pieces && spot.color === 'white');
        return !higherPoints;
      }
      if (currentPlayer === 'black' && toPoint < -1) {
        const higherPoints = board.slice(0, fromPoint).some(spot => spot.pieces && spot.color === 'black');
        return !higherPoints;
      }
      
      return true;
    }
    
    if (toPoint < 0 || toPoint >= 24) return false;
    
    const toSpot = board[toPoint];
    
    // Can't move to point occupied by opponent with 2+ pieces (blocked)
    if (toSpot.pieces >= 2 && toSpot.color !== currentPlayer) return false;
    
    return true;
  };

  const makeMove = (fromPoint, moveDistance) => {
    const direction = currentPlayer === 'white' ? 1 : -1;
    const toPoint = fromPoint + (moveDistance * direction);
    
    if (!canMakeMove(fromPoint, toPoint, moveDistance)) return false;
    
    const newBoard = [...board];
    const newBearOff = { ...bearOff };
    
    // Remove piece from source
    newBoard[fromPoint].pieces--;
    if (newBoard[fromPoint].pieces === 0) {
      newBoard[fromPoint].color = null;
    }
    
    // Handle bearing off
    if ((currentPlayer === 'white' && toPoint >= 24) || (currentPlayer === 'black' && toPoint < 0)) {
      newBearOff[currentPlayer].push('●');
      setBearOff(newBearOff);
      
      // Check for win
      if (newBearOff[currentPlayer].length === 15) {
        setGamePhase('finished');
        addToLog(`🏆 ${currentPlayer.toUpperCase()} WINS by bearing off all pieces!`);
        onGameComplete('backgammon', currentPlayer === 'white' ? 200 : 100);
        return true;
      }
    } else {
      // Normal move
      const targetSpot = newBoard[toPoint];
      
      // Hit opponent's blot (single piece)
      if (targetSpot.pieces === 1 && targetSpot.color !== currentPlayer) {
        setBar(prev => ({ ...prev, [targetSpot.color]: prev[targetSpot.color] + 1 }));
        addToLog(`💥 ${currentPlayer.toUpperCase()} hits ${targetSpot.color} blot!`);
        newBoard[toPoint] = { pieces: 1, color: currentPlayer };
      } else {
        // Normal move to empty or own point
        if (targetSpot.color === currentPlayer || !targetSpot.pieces) {
          newBoard[toPoint] = { 
            pieces: targetSpot.pieces + 1, 
            color: currentPlayer 
          };
        }
      }
    }
    
    setBoard(newBoard);
    
    // Remove used move
    const newMovesLeft = [...movesLeft];
    const moveIndex = newMovesLeft.indexOf(moveDistance);
    if (moveIndex > -1) {
      newMovesLeft.splice(moveIndex, 1);
      setMovesLeft(newMovesLeft);
    }
    
    // Check if turn is over
    if (newMovesLeft.length === 0) {
      endTurn();
    }
    
    addToLog(`📍 Moved from point ${fromPoint + 1} to ${toPoint >= 24 || toPoint < 0 ? 'off' : toPoint + 1}`);
    
    return true;
  };

  const handlePointClick = (pointIndex) => {
    if (gamePhase !== 'move') return;
    
    if (selectedPoint === null) {
      // Select a point with player's pieces
      const point = board[pointIndex];
      if (point.pieces > 0 && point.color === currentPlayer) {
        setSelectedPoint(pointIndex);
      }
    } else {
      // Try to move to this point
      const distance = Math.abs(pointIndex - selectedPoint);
      
      if (movesLeft.includes(distance)) {
        if (makeMove(selectedPoint, distance)) {
          setSelectedPoint(null);
        }
      } else {
        // Select different piece
        const point = board[pointIndex];
        if (point.pieces > 0 && point.color === currentPlayer) {
          setSelectedPoint(pointIndex);
        } else {
          setSelectedPoint(null);
        }
      }
    }
  };

  const endTurn = () => {
    setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
    setGamePhase('roll');
    setSelectedPoint(null);
    setMovesLeft([]);
  };

  const addToLog = (message) => {
    setGameLog(prev => [...prev.slice(-3), message]);
  };

  const getPointDisplay = (point, pointIndex) => {
    if (!point.pieces) return [];
    
    const pieces = [];
    const maxVisible = 5;
    const totalPieces = point.pieces;
    
    for (let i = 0; i < Math.min(totalPieces, maxVisible); i++) {
      pieces.push(
        <div
          key={i}
          className={`w-6 h-6 rounded-full border-2 border-gray-700 flex items-center justify-center text-xs font-bold
            ${point.color === 'white' ? 'bg-white text-black' : 'bg-gray-800 text-white'}
            ${selectedPoint === pointIndex ? 'ring-2 ring-yellow-400' : ''}
            transition-all duration-200`}
        >
          {i === maxVisible - 1 && totalPieces > maxVisible ? `+${totalPieces - maxVisible + 1}` : '●'}
        </div>
      );
    }
    
    return pieces;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-3xl text-center">🎲 Royal Backgammon Tournament 🎲</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Game Status */}
          <div className="flex justify-between items-center bg-gradient-to-r from-amber-100 to-amber-200 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <Badge className={`text-lg px-4 py-2 ${currentPlayer === 'white' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                {currentPlayer === 'white' ? '⚪ White' : '⚫ Black'}'s Turn
              </Badge>
              
              <div className="flex space-x-2">
                <div className="text-lg">🎲 {dice[0]} • {dice[1]}</div>
                {movesLeft.length > 0 && (
                  <div className="text-sm bg-blue-100 px-2 py-1 rounded">
                    Moves left: {movesLeft.join(', ')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-4">
              {gamePhase === 'roll' && (
                <Button onClick={rollDice} className="bg-green-500 hover:bg-green-600">
                  🎲 Roll Dice
                </Button>
              )}
              
              {gamePhase === 'move' && movesLeft.length > 0 && (
                <Button onClick={endTurn} variant="outline">
                  End Turn
                </Button>
              )}
            </div>
          </div>
          
          {/* Backgammon Board */}
          <div className="bg-amber-800 p-6 rounded-lg shadow-2xl">
            {/* Top Half (Points 13-24) */}
            <div className="grid grid-cols-12 gap-2 mb-4">
              {board.slice(12, 24).map((point, index) => {
                const pointIndex = index + 12;
                const pieces = getPointDisplay(point, pointIndex);
                
                return (
                  <div
                    key={pointIndex}
                    className={`h-32 border-2 border-amber-600 cursor-pointer transition-all duration-200 flex flex-col items-center justify-end p-1
                      ${selectedPoint === pointIndex ? 'bg-yellow-200 ring-2 ring-yellow-500' : 'bg-amber-100 hover:bg-amber-200'}`}
                    onClick={() => handlePointClick(pointIndex)}
                  >
                    <div className="text-xs font-bold text-amber-800 mb-1">
                      {pointIndex + 1}
                    </div>
                    <div className="flex flex-col space-y-1">
                      {pieces}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Middle Bar Area */}
            <div className="flex justify-between items-center bg-amber-900 p-4 rounded my-4">
              <div className="text-center">
                <div className="text-white font-bold">Bar</div>
                <div className="flex space-x-1 mt-2">
                  {Array(bar.white).fill(null).map((_, i) => (
                    <div key={i} className="w-6 h-6 bg-white rounded-full border-2 border-gray-700"></div>
                  ))}
                  {Array(bar.black).fill(null).map((_, i) => (
                    <div key={i} className="w-6 h-6 bg-gray-800 rounded-full border-2 border-gray-300"></div>
                  ))}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-white font-bold">Bear Off</div>
                <div className="flex space-x-4 mt-2">
                  <div className="text-center">
                    <div className="text-white text-sm">White: {bearOff.white.length}/15</div>
                    <div className="flex flex-wrap max-w-[100px]">
                      {bearOff.white.slice(0, 15).map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-white rounded-full m-0.5"></div>
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-sm">Black: {bearOff.black.length}/15</div>
                    <div className="flex flex-wrap max-w-[100px]">
                      {bearOff.black.slice(0, 15).map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-gray-800 rounded-full m-0.5"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom Half (Points 1-12) */}
            <div className="grid grid-cols-12 gap-2">
              {board.slice(0, 12).reverse().map((point, index) => {
                const pointIndex = 11 - index;
                const pieces = getPointDisplay(point, pointIndex);
                
                return (
                  <div
                    key={pointIndex}
                    className={`h-32 border-2 border-amber-600 cursor-pointer transition-all duration-200 flex flex-col items-center justify-start p-1
                      ${selectedPoint === pointIndex ? 'bg-yellow-200 ring-2 ring-yellow-500' : 'bg-amber-100 hover:bg-amber-200'}`}
                    onClick={() => handlePointClick(pointIndex)}
                  >
                    <div className="text-xs font-bold text-amber-800 mb-1">
                      {pointIndex + 1}
                    </div>
                    <div className="flex flex-col space-y-1">
                      {pieces}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Game Log */}
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-24 overflow-y-auto">
            {gameLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
          
          {gamePhase === 'finished' && (
            <div className="text-center text-green-600 font-bold text-2xl animate-bounce">
              🏆 Game Complete! 🏆
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
      id: 'battleship', 
      name: 'Naval Battleship', 
      emoji: '🚢', 
      description: 'Epic fleet combat with explosions and strategy!',
      xp: 100,
      time: '10-15 min'
    },
    { 
      id: 'chess', 
      name: 'Royal Chess', 
      emoji: '♔', 
      description: 'Legendary battle of kings with timer pressure!',
      xp: 150,
      time: '15-30 min'
    },
    { 
      id: 'backgammon', 
      name: 'Backgammon Tournament', 
      emoji: '🎲', 
      description: 'Ancient dice game of skill, luck, and tactics!',
      xp: 200,
      time: '20-40 min'
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