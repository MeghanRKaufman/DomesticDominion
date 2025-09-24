import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';
import './App.css';

// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs as GameTabs, TabsContent as GameTabsContent, TabsList as GameTabsList, TabsTrigger as GameTabsTrigger } from './components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Room configurations with emojis and colors
const ROOMS = {
  kitchen: { 
    name: 'Kitchen', 
    emoji: '🍳', 
    color: 'bg-orange-100 border-orange-200 text-orange-800',
    hoverColor: 'hover:bg-orange-200'
  },
  bathroom: { 
    name: 'Bathroom', 
    emoji: '🛁', 
    color: 'bg-blue-100 border-blue-200 text-blue-800',
    hoverColor: 'hover:bg-blue-200'
  },
  living_room: { 
    name: 'Living Room', 
    emoji: '🛋️', 
    color: 'bg-green-100 border-green-200 text-green-800',
    hoverColor: 'hover:bg-green-200'
  },
  bedroom: { 
    name: 'Bedroom', 
    emoji: '🛏️', 
    color: 'bg-purple-100 border-purple-200 text-purple-800',
    hoverColor: 'hover:bg-purple-200'
  },
  us: { 
    name: 'US ❤️', 
    emoji: '💕', 
    color: 'bg-pink-100 border-pink-200 text-pink-800',
    hoverColor: 'hover:bg-pink-200'
  }
};

// Timer Component
function Timer({ minutes, onComplete, isActive }) {
  const [timeLeft, setTimeLeft] = useState(minutes * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isActive) {
      setTimeLeft(minutes * 60);
      setIsRunning(false);
    }
  }, [minutes, isActive]);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            setIsRunning(false);
            onComplete && onComplete();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => interval && clearInterval(interval);
  }, [isRunning, timeLeft, onComplete]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((minutes * 60 - timeLeft) / (minutes * 60)) * 100;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Button 
        size="sm" 
        variant={isRunning ? "destructive" : "default"}
        onClick={() => setIsRunning(!isRunning)}
        disabled={timeLeft === 0}
        data-testid="timer-button"
      >
        {isRunning ? 'Pause' : timeLeft === 0 ? 'Done!' : 'Start'}
      </Button>
      <div className="flex flex-col">
        <span className="font-mono">{formatTime(timeLeft)}</span>
        <Progress value={progress} className="w-20 h-1" />
      </div>
    </div>
  );
}

// Chore Item Component
function ChoreItem({ chore, assignment, percentage, onComplete, isCompleted }) {
  const [isChecked, setIsChecked] = useState(isCompleted);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  const isMyChore = assignment === currentUser.id;
  const myPercentage = percentage?.[currentUser.id] || 50;

  const handleComplete = async () => {
    if (!isMyChore) return;
    
    setIsChecked(true);
    try {
      await axios.post(`${API}/chores/${chore.id}/complete`, {
        chore_id: chore.id,
        user_id: currentUser.id,
        completed: true
      });
      onComplete && onComplete();
    } catch (error) {
      console.error('Error completing chore:', error);
      setIsChecked(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox 
            checked={isChecked} 
            onCheckedChange={handleComplete}
            disabled={!isMyChore || isCompleted}
            data-testid={`chore-checkbox-${chore.id}`}
          />
          <div>
            <p className={`font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
              {chore.name}
            </p>
            {chore.description && (
              <p className="text-sm text-gray-600">{chore.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {chore.timer_minutes && (
            <Timer 
              minutes={chore.timer_minutes} 
              isActive={isMyChore && !isCompleted}
              onComplete={() => console.log('Timer completed!')}
            />
          )}
          <Badge variant={isMyChore ? "default" : "secondary"}>
            {myPercentage.toFixed(0)}%
          </Badge>
          <Badge variant="outline">
            +{chore.points}pts
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Login/Signup Component  
function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [coupleCode, setCoupleCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/users`, {
        name,
        couple_code: isLogin ? coupleCode : undefined
      });
      
      localStorage.setItem('currentUser', JSON.stringify(response.data));
      onSuccess(response.data);
      onClose();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.detail || 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="auth-modal">
        <DialogHeader>
          <DialogTitle>
            {isLogin ? 'Join Your Partner' : 'Start Your Couple Journey'} 💕
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input 
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              data-testid="name-input"
            />
          </div>
          
          {isLogin && (
            <div>
              <Label htmlFor="code">Couple Code</Label>
              <Input 
                id="code"
                value={coupleCode}
                onChange={(e) => setCoupleCode(e.target.value)}
                placeholder="Enter your partner's couple code"
                required
                data-testid="couple-code-input"
              />
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={loading} data-testid="auth-submit-btn">
            {loading ? 'Loading...' : isLogin ? 'Join Partner' : 'Create Couple'}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
            data-testid="auth-toggle-btn"
          >
            {isLogin ? "Don't have a code? Start new couple" : 'Already have a couple code? Join here'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Mini Games Component
function MiniGames({ currentUser }) {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);

  const gameTypes = [
    { id: 'chess', name: 'Chess', emoji: '♟️', description: 'Strategic board game' },
    { id: 'backgammon', name: 'Backgammon', emoji: '🎲', description: 'Classic dice game' },
    { id: 'battleship', name: 'Battleship', emoji: '🚢', description: 'Naval strategy game' }
  ];

  const startGame = async (gameType) => {
    try {
      const response = await axios.post(`${API}/games`, {
        game_type: gameType,
        opponent_id: currentUser.partner_id
      });
      
      setGames(prev => [...prev, response.data]);
      setSelectedGame(response.data);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Mini Games 🎮</h2>
        <p className="text-gray-600">Play games to earn bonus points!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gameTypes.map((game) => (
          <Card key={game.id} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`game-card-${game.id}`}>
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-2">{game.emoji}</div>
              <h3 className="font-semibold mb-1">{game.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{game.description}</p>
              <Button onClick={() => startGame(game.id)} size="sm" data-testid={`start-${game.id}-btn`}>
                Start Game
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {selectedGame && (
        <Card>
          <CardHeader>
            <CardTitle>Game in Progress: {selectedGame.game_type}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-lg">Game interface will be implemented here</p>
              <p className="text-sm text-gray-600 mt-2">For now, enjoy the chore gamification! 🎯</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main App Component
function GameApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chores, setChores] = useState({});
  const [assignments, setAssignments] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [activeRoom, setActiveRoom] = useState('kitchen');
  const [completedChores, setCompletedChores] = useState([]);

  // WebSocket connection
  const { lastMessage } = useWebSocket(
    currentUser ? `${WS_URL}/ws/${currentUser.couple_id}` : null,
    {
      shouldReconnect: () => true,
    }
  );

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      setShowAuth(true);
    }
  }, []);

  // Load chores and assignments when user is set
  useEffect(() => {
    if (currentUser) {
      loadChores();
      loadTodaysAssignments();
    }
  }, [currentUser]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        if (message.type === 'chore_completed') {
          // Play notification sound and update UI
          playNotificationSound();
          loadTodaysAssignments(); // Refresh assignments
          
          // Show notification
          alert(`🎉 ${message.user_name} completed a chore! (+${message.points} points)`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const playNotificationSound = () => {
    // Create audio context for "whah-ping" sound effect
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Could not play sound:', error);
    }
  };

  const loadChores = async () => {
    try {
      const response = await axios.get(`${API}/couples/${currentUser.couple_id}/chores`);
      setChores(response.data);
    } catch (error) {
      console.error('Error loading chores:', error);
    }
  };

  const loadTodaysAssignments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${API}/couples/${currentUser.couple_id}/assignments/${today}`);
      setAssignments(response.data);
      setCompletedChores(response.data.completed_chores || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setShowAuth(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Chore Champions 🏆</h1>
          <p className="text-lg text-gray-600 mb-6">Gamify your relationship, one chore at a time!</p>
          <Button onClick={() => setShowAuth(true)} size="lg" data-testid="get-started-btn">
            Get Started 💕
          </Button>
        </div>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chore Champions 🏆</h1>
              <p className="text-sm text-gray-600">Welcome back, {currentUser.name}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="points-badge">
                {currentUser.points} pts 💎
              </Badge>
              <Badge variant="outline" data-testid="couple-code-badge">
                Code: {currentUser.couple_id}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeRoom} onValueChange={setActiveRoom} className="space-y-6">
          {/* Room Tabs */}
          <TabsList className="grid grid-cols-5 w-full">
            {Object.entries(ROOMS).map(([key, room]) => (
              <TabsTrigger 
                key={key} 
                value={key} 
                className={`${room.color} ${room.hoverColor}`}
                data-testid={`room-tab-${key}`}
              >
                <span className="mr-1">{room.emoji}</span>
                {room.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Room Content */}
          {Object.entries(ROOMS).map(([roomKey, roomData]) => (
            <TabsContent key={roomKey} value={roomKey} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {roomData.emoji} {roomData.name} Chores
                </h2>
                {assignments && (
                  <Badge variant="outline">
                    {chores[roomKey]?.filter(chore => 
                      assignments.assignments[chore.id] === currentUser.id
                    ).length || 0} assigned to you
                  </Badge>
                )}
              </div>

              <div className="space-y-3" data-testid={`room-content-${roomKey}`}>
                {chores[roomKey]?.map((chore) => (
                  <ChoreItem
                    key={chore.id}
                    chore={chore}
                    assignment={assignments?.assignments[chore.id]}
                    percentage={assignments?.percentages[chore.id]}
                    isCompleted={completedChores.includes(chore.id)}
                    onComplete={loadTodaysAssignments}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Mini Games Section */}
        <div className="mt-8">
          <MiniGames currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GameApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;