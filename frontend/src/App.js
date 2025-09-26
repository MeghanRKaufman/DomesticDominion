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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Room configurations with new styling
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

// Chore size points
const CHORE_POINTS = {
  small: 5,
  medium: 10,
  big: 20
};

// Talent tree branch colors
const TALENT_BRANCHES = {
  efficiency: { name: 'Efficiency', color: 'bg-blue-500', lightColor: 'bg-blue-100' },
  couple: { name: 'Couple', color: 'bg-pink-500', lightColor: 'bg-pink-100' },
  growth: { name: 'Growth', color: 'bg-green-500', lightColor: 'bg-green-100' }
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
function ChoreItem({ chore, onComplete, isCompleted = false }) {
  const [isChecked, setIsChecked] = useState(isCompleted);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  const points = CHORE_POINTS[chore.size] || 10;

  const handleComplete = async () => {
    setIsChecked(true);
    try {
      const response = await axios.post(`${API}/chores/${chore.id}/complete`, {
        user_id: currentUser.id
      });
      
      if (onComplete) {
        onComplete(response.data);
      }
    } catch (error) {
      console.error('Error completing chore:', error);
      setIsChecked(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border transition-all ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox 
            checked={isChecked} 
            onCheckedChange={handleComplete}
            disabled={isCompleted}
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
              isActive={!isCompleted}
              onComplete={() => console.log('Timer completed!')}
            />
          )}
          <Badge variant="outline" className={`${chore.size === 'big' ? 'bg-red-100' : chore.size === 'medium' ? 'bg-yellow-100' : 'bg-green-100'}`}>
            +{points}pts
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Health Activity Component
function HealthActivityItem({ activity, onComplete }) {
  const [value, setValue] = useState(activity.target_value || 1);
  const [isCompleting, setIsCompleting] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const response = await axios.post(`${API}/health-activities/${activity.id}/complete`, {
        user_id: currentUser.id,
        value: value
      });
      
      if (onComplete) {
        onComplete(response.data);
      }
    } catch (error) {
      console.error('Error completing health activity:', error);
      alert(error.response?.data?.detail || 'Failed to complete activity');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-white border-gray-200 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{activity.name}</h4>
          <p className="text-sm text-gray-600">{activity.description}</p>
          {activity.target_value && (
            <p className="text-xs text-gray-500">Target: {activity.target_value} {activity.unit}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {activity.target_value && (
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              min="1"
            />
          )}
          <Button 
            size="sm" 
            onClick={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? 'Completing...' : 'Complete'}
          </Button>
          <Badge variant="outline" className="bg-green-100">
            +{activity.points}pts
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Talent Tree Node Component
function TalentNode({ node, isUnlocked, canUnlock, onUnlock }) {
  const branch = TALENT_BRANCHES[node.branch];
  
  return (
    <div className="flex flex-col items-center mb-4">
      <div 
        className={`w-20 h-20 rounded-full flex flex-col items-center justify-center text-xs p-2 border-2 cursor-pointer transition-all ${
          isUnlocked 
            ? `${branch.color} text-white border-gray-300` 
            : canUnlock 
            ? `${branch.lightColor} border-gray-400 hover:border-gray-600` 
            : 'bg-gray-100 border-gray-200 text-gray-400'
        }`}
        onClick={canUnlock ? onUnlock : undefined}
      >
        <div className="font-semibold text-center leading-tight">
          {node.name}
        </div>
      </div>
      {canUnlock && !isUnlocked && (
        <Button size="sm" className="mt-2" onClick={onUnlock}>
          Unlock
        </Button>
      )}
    </div>
  );
}

// Talent Tree Component
function TalentTree({ currentUser, onUpdate }) {
  const [talentTree, setTalentTree] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTalentTree();
  }, [currentUser]);

  const loadTalentTree = async () => {
    try {
      const response = await axios.get(`${API}/users/${currentUser.id}/talent-tree`);
      setTalentTree(response.data);
    } catch (error) {
      console.error('Error loading talent tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const unlockNode = async (nodeId) => {
    try {
      await axios.post(`${API}/users/${currentUser.id}/talent-tree/unlock`, {
        user_id: currentUser.id,
        node_id: nodeId
      });
      
      // Refresh talent tree and user data
      loadTalentTree();
      onUpdate && onUpdate();
    } catch (error) {
      console.error('Error unlocking node:', error);
      alert(error.response?.data?.detail || 'Failed to unlock talent');
    }
  };

  if (loading || !talentTree) {
    return <div className="text-center p-8">Loading talent tree...</div>;
  }

  // Group nodes by branch and tier
  const groupedNodes = {};
  talentTree.available_nodes.forEach(node => {
    if (!groupedNodes[node.branch]) {
      groupedNodes[node.branch] = {};
    }
    if (!groupedNodes[node.branch][node.tier]) {
      groupedNodes[node.branch][node.tier] = [];
    }
    groupedNodes[node.branch][node.tier].push(node);
  });

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Talent Tree 🌳</h2>
        <p className="text-gray-600">Available Talent Points: {currentUser.available_talent_points}</p>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {Object.entries(TALENT_BRANCHES).map(([branchKey, branch]) => (
          <div key={branchKey} className="text-center">
            <h3 className={`text-lg font-semibold mb-4 p-2 rounded ${branch.lightColor}`}>
              {branch.name}
            </h3>
            
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map(tier => (
                groupedNodes[branchKey]?.[tier]?.map(node => {
                  const isUnlocked = talentTree.unlocked_nodes.includes(node.id);
                  const canUnlock = !isUnlocked && 
                    currentUser.available_talent_points >= node.cost &&
                    node.prerequisites.every(prereq => talentTree.unlocked_nodes.includes(prereq));
                  
                  return (
                    <TalentNode
                      key={node.id}
                      node={node}
                      isUnlocked={isUnlocked}
                      canUnlock={canUnlock}
                      onUnlock={() => unlockNode(node.id)}
                    />
                  );
                })
              ))}
            </div>
          </div>
        ))}
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
            {isLogin ? 'Join Your Partner' : 'Start Your Lifestyle Journey'} 💪
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
            {loading ? 'Loading...' : isLogin ? 'Join Partner' : 'Start Journey'}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
            data-testid="auth-toggle-btn"
          >
            {isLogin ? "Don't have a code? Start new journey" : 'Already have a couple code? Join here'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main App Component
function LifestyleApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chores, setChores] = useState({});
  const [healthActivities, setHealthActivities] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('chores');
  const [activeRoom, setActiveRoom] = useState('kitchen');

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
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      refreshUserData(user.id);
    } else {
      setShowAuth(true);
    }
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (currentUser) {
      loadChores();
      loadHealthActivities();
    }
  }, [currentUser]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        if (message.type === 'chore_completed') {
          playNotificationSound();
          alert(`🎉 ${message.user_name} completed ${message.chore_name}! (+${message.points} points)`);
          if (currentUser) {
            refreshUserData(currentUser.id);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, currentUser]);

  const playNotificationSound = () => {
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

  const refreshUserData = async (userId) => {
    try {
      const response = await axios.get(`${API}/users/${userId}`);
      setCurrentUser(response.data);
      localStorage.setItem('currentUser', JSON.stringify(response.data));
    } catch (error) {
      console.error('Error refreshing user data:', error);
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

  const loadHealthActivities = async () => {
    try {
      const response = await axios.get(`${API}/health-activities`);
      setHealthActivities(response.data);
    } catch (error) {
      console.error('Error loading health activities:', error);
    }
  };

  const handleChoreComplete = (result) => {
    alert(`🎉 Chore completed! +${result.total_points} points (${result.points_earned} base + ${result.bonus_points} bonus)`);
    refreshUserData(currentUser.id);
  };

  const handleHealthComplete = (result) => {
    alert(`💪 Health goal achieved! +${result.total_points} points (${result.points_earned} base + ${result.bonus_points} bonus)`);
    refreshUserData(currentUser.id);
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setShowAuth(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Lifestyle Champions 🏆</h1>
          <p className="text-lg text-gray-600 mb-6">Gamify your life, one habit at a time!</p>
          <Button onClick={() => setShowAuth(true)} size="lg" data-testid="get-started-btn">
            Get Started 🚀
          </Button>
        </div>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const levelProgress = (currentUser.level_progress / currentUser.level_progress_needed) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lifestyle Champions 🏆</h1>
              <p className="text-sm text-gray-600">Welcome back, {currentUser.name}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold">Level {currentUser.current_level}</div>
                <Progress value={levelProgress} className="w-24 h-2" />
                <div className="text-xs text-gray-500">{currentUser.level_progress}/{currentUser.level_progress_needed}</div>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="points-badge">
                {currentUser.total_points} pts 💎
              </Badge>
              <Badge variant="outline" data-testid="talent-points-badge">
                {currentUser.available_talent_points} talent pts ⭐
              </Badge>
              <Badge variant="outline" data-testid="couple-code-badge">
                Code: {currentUser.couple_id}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Main Tabs */}
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="chores" data-testid="chores-tab">
              🏠 Chores
            </TabsTrigger>
            <TabsTrigger value="health" data-testid="health-tab">
              💪 Health
            </TabsTrigger>
            <TabsTrigger value="talents" data-testid="talents-tab">
              🌳 Talents
            </TabsTrigger>
          </TabsList>

          {/* Chores Content */}
          <TabsContent value="chores" className="space-y-4">
            <Tabs value={activeRoom} onValueChange={setActiveRoom}>
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

              {Object.entries(ROOMS).map(([roomKey, roomData]) => (
                <TabsContent key={roomKey} value={roomKey} className="space-y-4">
                  <h2 className="text-xl font-semibold">
                    {roomData.emoji} {roomData.name} Chores
                  </h2>

                  <div className="space-y-3" data-testid={`room-content-${roomKey}`}>
                    {chores[roomKey]?.map((chore) => (
                      <ChoreItem
                        key={chore.id}
                        chore={chore}
                        onComplete={handleChoreComplete}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          {/* Health Content */}
          <TabsContent value="health" className="space-y-4">
            <h2 className="text-xl font-semibold">💪 Personal Health & Wellness</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {healthActivities.map((activity) => (
                <HealthActivityItem
                  key={activity.id}
                  activity={activity}
                  onComplete={handleHealthComplete}
                />
              ))}
            </div>
          </TabsContent>

          {/* Talent Tree Content */}
          <TabsContent value="talents">
            <TalentTree 
              currentUser={currentUser} 
              onUpdate={() => refreshUserData(currentUser.id)} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LifestyleApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;