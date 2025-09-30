import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Room configurations
const ROOMS = {
  Kitchen: { 
    name: 'Kitchen', 
    emoji: '🍳', 
    color: 'bg-orange-100 border-orange-200 text-orange-800'
  },
  Bathroom: { 
    name: 'Bathroom', 
    emoji: '🛁', 
    color: 'bg-blue-100 border-blue-200 text-blue-800'
  },
  'Living Room': { 
    name: 'Living Room', 
    emoji: '🛋️', 
    color: 'bg-green-100 border-green-200 text-green-800'
  },
  Bedroom: { 
    name: 'Bedroom', 
    emoji: '🛏️', 
    color: 'bg-purple-100 border-purple-200 text-purple-800'
  },
  US: { 
    name: 'US ❤️', 
    emoji: '💕', 
    color: 'bg-pink-100 border-pink-200 text-pink-800'
  },
  Growth: {
    name: 'Growth 💪',
    emoji: '💪',
    color: 'bg-emerald-100 border-emerald-200 text-emerald-800'
  }
};

// Talent branch colors
const TALENT_BRANCHES = {
  Efficiency: { 
    name: 'Efficiency', 
    color: 'from-blue-400 to-blue-600',
    bgColor: 'bg-blue-500',
    lightColor: 'bg-blue-100 border-blue-200'
  },
  Couple: { 
    name: 'Couple', 
    color: 'from-pink-400 to-pink-600',
    bgColor: 'bg-pink-500',
    lightColor: 'bg-pink-100 border-pink-200'
  },
  Growth: { 
    name: 'Growth', 
    color: 'from-green-400 to-green-600',
    bgColor: 'bg-green-500',
    lightColor: 'bg-green-100 border-green-200'
  }
};

// Timer Component for US tasks
function Timer({ minutes, onComplete, isActive = true }) {
  const [timeLeft, setTimeLeft] = useState(minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isActive) {
      setTimeLeft(minutes * 60);
      setIsRunning(false);
      setIsCompleted(false);
    }
  }, [minutes, isActive]);

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
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
        variant={isRunning ? "destructive" : isCompleted ? "default" : "outline"}
        onClick={() => !isCompleted && setIsRunning(!isRunning)}
        disabled={isCompleted}
        className={isCompleted ? 'bg-green-500 text-white' : ''}
      >
        {isCompleted ? '✓ Done' : isRunning ? 'Pause' : 'Start'}
      </Button>
      <div className="flex flex-col">
        <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
        <Progress value={progress} className="w-20 h-2" />
      </div>
      {isCompleted && (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Timer Complete! 🎉
        </Badge>
      )}
    </div>
  );
}

// Task Item Component
function TaskItem({ task, odds, onComplete, currentUser }) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  
  const userOdds = odds ? Math.round((odds[currentUser?.userId] || 0.5) * 100) : 50;
  
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HARD': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleComplete = async () => {
    if (task.timerMinutes && !timerCompleted) {
      alert('Please complete the timer first! ⏰');
      return;
    }

    setIsCompleting(true);
    try {
      const response = await axios.post(`${API}/tasks/${task.taskId}/complete`, {
        userId: currentUser.userId
      });
      
      alert(`🎉 Task completed! +${response.data.totalPoints} points (${response.data.basePoints} base + ${response.data.bonusPoints} bonus)`);
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="font-semibold">{task.title}</h4>
              <Badge className={getDifficultyColor(task.difficulty)}>
                {task.difficulty} - {task.basePoints}pts
              </Badge>
              <Badge variant="outline">
                {userOdds}% chance
              </Badge>
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
            )}
            
            {task.timerMinutes && (
              <div className="mb-3">
                <Timer 
                  minutes={task.timerMinutes} 
                  onComplete={() => setTimerCompleted(true)}
                />
              </div>
            )}
          </div>
          
          <div className="ml-4">
            <Button 
              onClick={handleComplete} 
              disabled={isCompleting || (task.timerMinutes && !timerCompleted)}
              className="min-w-[100px]"
            >
              {isCompleting ? 'Completing...' : 'Complete ✓'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Talent Node Component
function TalentNode({ node, isUnlocked, canUnlock, onUnlock, userTalentPoints }) {
  const branch = TALENT_BRANCHES[node.branch];
  
  const getNodeState = () => {
    if (isUnlocked) return 'unlocked';
    if (canUnlock && userTalentPoints >= node.costTalentPoints) return 'available';
    return 'locked';
  };

  const nodeState = getNodeState();
  
  const getNodeStyle = () => {
    switch (nodeState) {
      case 'unlocked':
        return `${branch.bgColor} text-white border-2 border-gray-300 shadow-lg`;
      case 'available':
        return `${branch.lightColor} hover:shadow-md cursor-pointer border-2 border-gray-400`;
      case 'locked':
        return 'bg-gray-100 text-gray-400 border-2 border-gray-200';
    }
  };

  return (
    <div className="flex flex-col items-center mb-6">
      <div 
        className={`w-24 h-24 rounded-full flex flex-col items-center justify-center text-xs p-3 transition-all ${getNodeStyle()}`}
        onClick={nodeState === 'available' ? onUnlock : undefined}
      >
        <div className="font-bold text-center leading-tight mb-1">
          {node.title}
        </div>
        <div className="text-xs opacity-75">
          Tier {node.tier}
        </div>
      </div>
      
      <div className="text-center mt-2 max-w-32">
        <div className="text-xs text-gray-600 mb-1">
          Cost: {node.costTalentPoints} TP
        </div>
        <div className="text-xs text-gray-500 leading-tight">
          {node.description}
        </div>
        
        {nodeState === 'available' && (
          <Button 
            size="sm" 
            className="mt-2" 
            onClick={onUnlock}
            disabled={userTalentPoints < node.costTalentPoints}
          >
            Unlock
          </Button>
        )}
      </div>
    </div>
  );
}

// Talent Tree Component
function TalentTree({ currentUser, onUpdate }) {
  const [talentNodes, setTalentNodes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTalentNodes();
  }, []);

  const loadTalentNodes = async () => {
    try {
      const response = await axios.get(`${API}/talent-nodes`);
      setTalentNodes(response.data.nodes);
    } catch (error) {
      console.error('Error loading talent nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const unlockNode = async (nodeId) => {
    try {
      // Add node to user's build
      const currentBuild = currentUser.talentBuild || { nodeIds: [] };
      const newBuild = {
        ...currentBuild,
        nodeIds: [...(currentBuild.nodeIds || []), nodeId]
      };

      await axios.post(`${API}/builds/submit`, {
        userId: currentUser.userId,
        talentBuild: newBuild
      });

      alert(`🌟 Talent "${talentNodes[nodeId].title}" unlocked!`);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error unlocking talent:', error);
      alert(error.response?.data?.detail || 'Failed to unlock talent');
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading talent tree...</div>;
  }

  // Group nodes by branch and tier
  const groupedNodes = {};
  Object.values(talentNodes).forEach(node => {
    if (!groupedNodes[node.branch]) {
      groupedNodes[node.branch] = {};
    }
    if (!groupedNodes[node.branch][node.tier]) {
      groupedNodes[node.branch][node.tier] = [];
    }
    groupedNodes[node.branch][node.tier].push(node);
  });

  const unlockedNodes = currentUser.talentBuild?.nodeIds || [];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Talent Tree 🌳</h2>
        <div className="flex justify-center space-x-6">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Available: {currentUser.talentPoints} TP
          </Badge>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Level: {currentUser.level}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {Object.entries(TALENT_BRANCHES).map(([branchKey, branch]) => (
          <div key={branchKey} className="text-center">
            <div className={`p-4 rounded-lg ${branch.lightColor} mb-6`}>
              <h3 className="text-xl font-bold mb-2">{branch.name}</h3>
              <div className="text-sm text-gray-600">
                Unlocked: {unlockedNodes.filter(id => talentNodes[id]?.branch === branchKey).length}
              </div>
            </div>
            
            <div className="space-y-6">
              {[1, 2, 3, 4].map(tier => (
                <div key={tier} className="flex justify-center">
                  <div className="flex flex-wrap justify-center gap-4">
                    {groupedNodes[branchKey]?.[tier]?.map(node => {
                      const isUnlocked = unlockedNodes.includes(node.nodeId);
                      
                      // Check if prerequisites are met
                      const canUnlock = !isUnlocked;
                      
                      return (
                        <TalentNode
                          key={node.nodeId}
                          node={node}
                          isUnlocked={isUnlocked}
                          canUnlock={canUnlock}
                          userTalentPoints={currentUser.talentPoints}
                          onUnlock={() => unlockNode(node.nodeId)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Auth Modal Component
function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(false);
  const [name, setName] = useState('');
  const [coupleCode, setCoupleCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/users`, {
        displayName: name,
        coupleCode: isLogin ? coupleCode : undefined
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isLogin ? '🤝 Join Your Partner' : '🚀 Start Your Journey'}
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
              />
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? '🤝 Join Partner' : '🚀 Start Journey'}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Don't have a code? Start new journey" : 'Have a couple code? Join here'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main App Component
function GameApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState({});
  const [dailyOdds, setDailyOdds] = useState({});
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [activeRoom, setActiveRoom] = useState('Kitchen');

  // WebSocket connection
  const { lastMessage } = useWebSocket(
    currentUser ? `${WS_URL}/ws/${currentUser.coupleId}` : null,
    {
      shouldReconnect: () => true,
    }
  );

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      refreshUserData(user.userId);
    } else {
      setShowAuth(true);
    }
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (currentUser && currentUser.userId) {
      loadTasks();
      loadDailyOdds();
    }
  }, [currentUser]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        if (message.type === 'task_completed') {
          playNotificationSound();
          
          // Show notification
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50';
          notification.innerHTML = `🎉 ${message.userName} completed "${message.taskTitle}"! (+${message.points} points)`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 4000);
          
          if (currentUser) {
            refreshUserData(currentUser.userId);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, currentUser]);

  const playNotificationSound = () => {
    try {
      // Create the "whah-ping" sound effect
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // First tone (whah)
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      
      oscillator1.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(330, audioContext.currentTime + 0.2);
      gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator1.start();
      oscillator1.stop(audioContext.currentTime + 0.3);
      
      // Second tone (ping)
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.setValueAtTime(660, audioContext.currentTime);
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.2);
      }, 300);
    } catch (error) {
      console.log('Could not play sound:', error);
    }
  };

  const refreshUserData = async (userId) => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API}/users/${userId}`);
      setCurrentUser(response.data);
      localStorage.setItem('currentUser', JSON.stringify(response.data));
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const loadTasks = async () => {
    if (!currentUser?.coupleId) return;
    try {
      const response = await axios.get(`${API}/couples/${currentUser.coupleId}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks({});
    }
  };

  const loadDailyOdds = async () => {
    if (!currentUser?.coupleId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${API}/couples/${currentUser.coupleId}/odds/${today}`);
      setDailyOdds(response.data.taskOdds || {});
    } catch (error) {
      console.error('Error loading daily odds:', error);
      setDailyOdds({});
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setShowAuth(false);
  };

  const handleTaskComplete = () => {
    if (currentUser) {
      refreshUserData(currentUser.userId);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Chore Champions
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Level up your relationship through gamified chores, talent trees, and teamwork! 🏆
          </p>
          <Button onClick={() => setShowAuth(true)} size="lg" className="text-lg px-8 py-3">
            Start Playing 🚀
          </Button>
        </div>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const levelProgress = currentUser.points % 100; // Progress within current level

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Chore Champions 🏆
              </h1>
              <p className="text-gray-600">Welcome back, {currentUser.displayName}!</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">Level {currentUser.level}</div>
                <Progress value={levelProgress} className="w-32 h-3" />
                <div className="text-sm text-gray-500">{levelProgress}/100</div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-blue-100 text-blue-800">
                💎 {currentUser.points} pts
              </Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-purple-100 text-purple-800">
                ⭐ {currentUser.talentPoints} TP
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                Code: {currentUser.coupleId}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Main Navigation */}
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="tasks" className="text-lg">
              🏠 Tasks & Chores
            </TabsTrigger>
            <TabsTrigger value="talents" className="text-lg">
              🌳 Talent Tree
            </TabsTrigger>
          </TabsList>

          {/* Tasks Content */}
          <TabsContent value="tasks" className="space-y-6">
            <Tabs value={activeRoom} onValueChange={setActiveRoom}>
              <TabsList className="grid grid-cols-6 w-full">
                {Object.entries(ROOMS).map(([roomKey, room]) => (
                  <TabsTrigger 
                    key={roomKey} 
                    value={roomKey} 
                    className={`${room.color} font-medium`}
                  >
                    <span className="mr-2">{room.emoji}</span>
                    {room.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(ROOMS).map(([roomKey, roomData]) => (
                <TabsContent key={roomKey} value={roomKey} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">
                      {roomData.emoji} {roomData.name}
                    </h2>
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {tasks[roomKey]?.length || 0} tasks
                    </Badge>
                  </div>

                  <div className="grid gap-4">
                    {tasks[roomKey]?.map((task) => (
                      <TaskItem
                        key={task.taskId}
                        task={task}
                        odds={dailyOdds[task.taskId]}
                        currentUser={currentUser}
                        onComplete={handleTaskComplete}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          {/* Talent Tree Content */}
          <TabsContent value="talents">
            <TalentTree 
              currentUser={currentUser} 
              onUpdate={() => refreshUserData(currentUser.userId)} 
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
          <Route path="/" element={<GameApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;