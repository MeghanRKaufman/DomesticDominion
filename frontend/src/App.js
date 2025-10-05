import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';
import './App.css';

// Import new components
import BoardGames from './components/BoardGames';
import VerificationSystem from './components/VerificationSystem';

// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Game Constants
const DIFFICULTY_POINTS = { EASY: 5, MEDIUM: 10, HARD: 20 };
const LEVEL_UP_POINTS = 100;

// Onboarding Component
function OnboardingModal({ isOpen, onComplete }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: "Welcome to Chore Champions! 🏆",
      content: "Transform your household chores into an epic RPG adventure for you and your partner!",
      image: "🎮"
    },
    {
      title: "Complete Quests Together 🤝",
      content: "Pick chores, verify completion with your partner, and earn XP points. Some tasks need both of you to approve!",
      image: "✅"
    },
    {
      title: "Level Up & Unlock Powers 🌟",
      content: "Spend Talent Points on a skill tree! Get chore multipliers, relationship bonuses, and unlock real-world rewards.",
      image: "🌳"
    },
    {
      title: "Play Mini-Games 🎲",
      content: "Complete challenges with bonus games like spin wheels, tap challenges, and couple trivia for extra rewards!",
      image: "🎯"
    },
    {
      title: "Grow Together 💕",
      content: "Combo bonuses when you work as a team, relationship challenges, and rewards that make your bond stronger!",
      image: "💑"
    }
  ];

  const currentStep = steps[step];

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">{currentStep.title}</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <div className="text-6xl mb-4">{currentStep.image}</div>
          <p className="text-lg text-gray-600 leading-relaxed">
            {currentStep.content}
          </p>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex space-x-1">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-3 h-3 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          
          <div className="space-x-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button 
              onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()}
            >
              {step < steps.length - 1 ? 'Next' : 'Start Playing! 🚀'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Spin Wheel Mini-Game
function SpinWheelGame({ onComplete, onClose }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  
  const rewards = [
    { label: "+5 Bonus Points", points: 5, color: "bg-green-400" },
    { label: "+10 Bonus Points", points: 10, color: "bg-blue-400" },
    { label: "+15 Bonus Points", points: 15, color: "bg-purple-400" },
    { label: "+3 Bonus Points", points: 3, color: "bg-yellow-400" },
    { label: "+8 Bonus Points", points: 8, color: "bg-red-400" },
    { label: "+12 Bonus Points", points: 12, color: "bg-pink-400" }
  ];

  const spin = () => {
    setIsSpinning(true);
    setTimeout(() => {
      const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
      setResult(randomReward);
      setIsSpinning(false);
    }, 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">🎡 Bonus Spin Wheel!</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {!result ? (
            <div>
              <div className={`w-48 h-48 mx-auto rounded-full border-8 border-gray-300 relative overflow-hidden ${isSpinning ? 'animate-spin' : ''}`}>
                {rewards.map((reward, i) => (
                  <div 
                    key={i}
                    className={`absolute w-full h-full ${reward.color} opacity-80`}
                    style={{
                      clipPath: `polygon(50% 50%, ${50 + 40 * Math.cos(2 * Math.PI * i / 6)}% ${50 + 40 * Math.sin(2 * Math.PI * i / 6)}%, ${50 + 40 * Math.cos(2 * Math.PI * (i + 1) / 6)}% ${50 + 40 * Math.sin(2 * Math.PI * (i + 1) / 6)}%)`
                    }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full border-2 border-gray-800" />
                </div>
              </div>
              
              <Button 
                className="mt-6 text-xl px-8 py-3" 
                onClick={spin} 
                disabled={isSpinning}
              >
                {isSpinning ? "Spinning... 🌟" : "SPIN! 🎯"}
              </Button>
            </div>
          ) : (
            <div className="animate-bounce">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold mb-2">You Won!</h3>
              <p className="text-xl text-green-600 font-semibold">{result.label}</p>
              <Button 
                className="mt-6" 
                onClick={() => {
                  onComplete(result.points);
                  onClose();
                }}
              >
                Collect Reward! ✨
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tap Challenge Mini-Game
function TapChallengeGame({ onComplete, onClose }) {
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isActive, setIsActive] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      const bonusPoints = Math.min(Math.floor(taps / 2), 20); // Max 20 bonus points
      setResult(bonusPoints);
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, taps]);

  const startChallenge = () => {
    setIsActive(true);
    setTaps(0);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">⚡ Tap Challenge!</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {!result ? (
            <div>
              <div className="mb-4">
                <p className="text-lg">Tap as fast as you can!</p>
                <div className="text-4xl font-bold text-blue-600">{timeLeft}s</div>
              </div>
              
              <div 
                className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold cursor-pointer active:scale-95 transition-transform"
                onClick={() => isActive && setTaps(taps + 1)}
              >
                {isActive ? taps : "TAP!"}
              </div>
              
              {!isActive && (
                <Button className="mt-4" onClick={startChallenge}>
                  Start Challenge! 🚀
                </Button>
              )}
              
              {isActive && (
                <div className="mt-4">
                  <Progress value={(10 - timeLeft) * 10} className="w-full" />
                </div>
              )}
            </div>
          ) : (
            <div className="animate-bounce">
              <div className="text-6xl mb-4">🔥</div>
              <h3 className="text-2xl font-bold mb-2">Amazing!</h3>
              <p className="text-lg">You tapped {taps} times!</p>
              <p className="text-xl text-green-600 font-semibold">+{result} Bonus Points!</p>
              <Button 
                className="mt-6" 
                onClick={() => {
                  onComplete(result);
                  onClose();
                }}
              >
                Collect Reward! ✨
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Couple Trivia Game
function CoupleTrivia({ onComplete, onClose, partnerName }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);

  const questions = [
    {
      question: "What's your partner's favorite type of music?",
      options: ["Pop", "Rock", "Jazz", "Classical"],
      correct: 0 // This would be personalized
    },
    {
      question: "What chore does your partner hate most?",
      options: ["Dishes", "Laundry", "Cleaning bathroom", "Taking out trash"],
      correct: 2
    },
    {
      question: "What's your partner's ideal date night?",
      options: ["Movie at home", "Fancy dinner", "Outdoor adventure", "Game night"],
      correct: 1
    }
  ];

  const handleAnswer = (selectedIndex) => {
    if (answered) return;
    
    setAnswered(true);
    if (selectedIndex === questions[currentQuestion].correct) {
      setScore(score + 1);
    }
    
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setAnswered(false);
      } else {
        const bonusPoints = score * 5 + (score === questions.length ? 10 : 0); // Perfect score bonus
        setResult(bonusPoints);
      }
    }, 1500);
  };

  const question = questions[currentQuestion];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">💕 Couple Trivia!</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {!result ? (
            <div>
              <div className="mb-4">
                <Badge variant="outline" className="mb-2">
                  Question {currentQuestion + 1} of {questions.length}
                </Badge>
                <h3 className="text-lg font-semibold mb-4">{question.question}</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                {question.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={answered ? (index === question.correct ? "default" : "outline") : "outline"}
                    className={answered && index === question.correct ? "bg-green-500 text-white" : ""}
                    onClick={() => handleAnswer(index)}
                    disabled={answered}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4">
                <Progress value={((currentQuestion + (answered ? 1 : 0)) / questions.length) * 100} />
              </div>
            </div>
          ) : (
            <div className="animate-bounce">
              <div className="text-6xl mb-4">🧠</div>
              <h3 className="text-2xl font-bold mb-2">Trivia Complete!</h3>
              <p className="text-lg">You scored {score} out of {questions.length}!</p>
              <p className="text-xl text-green-600 font-semibold">+{result} Bonus Points!</p>
              <Button 
                className="mt-6" 
                onClick={() => {
                  onComplete(result);
                  onClose();
                }}
              >
                Collect Reward! ✨
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Visual Talent Tree Component
function VisualTalentTree({ currentUser, onNodeUnlock }) {
  const [selectedBranch, setSelectedBranch] = useState('efficiency');
  
  const branches = {
    efficiency: {
      name: 'Efficiency',
      color: 'from-blue-400 to-blue-600',
      icon: '⚡',
      nodes: [
        { id: 'eff1', name: 'Quick Wipe', tier: 1, cost: 1, x: 50, y: 80, prereq: null },
        { id: 'eff2', name: 'Speed Demon', tier: 2, cost: 2, x: 30, y: 60, prereq: 'eff1' },
        { id: 'eff3', name: 'Multitasker', tier: 2, cost: 2, x: 70, y: 60, prereq: 'eff1' },
        { id: 'eff4', name: 'Efficiency Master', tier: 3, cost: 3, x: 50, y: 40, prereq: ['eff2', 'eff3'] },
        { id: 'eff5', name: 'Time Lord', tier: 4, cost: 4, x: 50, y: 20, prereq: 'eff4' }
      ]
    },
    couple: {
      name: 'Couple',
      color: 'from-pink-400 to-pink-600',
      icon: '💕',
      nodes: [
        { id: 'cou1', name: 'Team Player', tier: 1, cost: 1, x: 50, y: 80, prereq: null },
        { id: 'cou2', name: 'Love Boost', tier: 2, cost: 2, x: 30, y: 60, prereq: 'cou1' },
        { id: 'cou3', name: 'Date Night', tier: 2, cost: 2, x: 70, y: 60, prereq: 'cou1' },
        { id: 'cou4', name: 'Soulmate Sync', tier: 3, cost: 3, x: 50, y: 40, prereq: ['cou2', 'cou3'] },
        { id: 'cou5', name: 'Perfect Harmony', tier: 4, cost: 4, x: 50, y: 20, prereq: 'cou4' }
      ]
    },
    growth: {
      name: 'Growth',
      color: 'from-green-400 to-green-600',
      icon: '🌱',
      nodes: [
        { id: 'gro1', name: 'Self Care', tier: 1, cost: 1, x: 50, y: 80, prereq: null },
        { id: 'gro2', name: 'Mindfulness', tier: 2, cost: 2, x: 30, y: 60, prereq: 'gro1' },
        { id: 'gro3', name: 'Wellness Warrior', tier: 2, cost: 2, x: 70, y: 60, prereq: 'gro1' },
        { id: 'gro4', name: 'Zen Master', tier: 3, cost: 3, x: 50, y: 40, prereq: ['gro2', 'gro3'] },
        { id: 'gro5', name: 'Life Guru', tier: 4, cost: 4, x: 50, y: 20, prereq: 'gro4' }
      ]
    }
  };

  const branch = branches[selectedBranch];
  const unlockedNodes = currentUser.talentBuild?.nodeIds || [];

  const isNodeUnlocked = (nodeId) => unlockedNodes.includes(nodeId);
  
  const canUnlockNode = (node) => {
    if (isNodeUnlocked(node.id)) return false;
    if (currentUser.talentPoints < node.cost) return false;
    if (!node.prereq) return true;
    
    if (Array.isArray(node.prereq)) {
      return node.prereq.every(prereq => isNodeUnlocked(prereq));
    } else {
      return isNodeUnlocked(node.prereq);
    }
  };

  const handleNodeClick = (node) => {
    if (canUnlockNode(node)) {
      onNodeUnlock(node.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">🌳 Talent Tree</h2>
        <div className="flex justify-center space-x-6">
          <Badge variant="secondary" className="text-lg px-4 py-2 bg-purple-100 text-purple-800">
            ⭐ {currentUser.talentPoints} Talent Points
          </Badge>
        </div>
      </div>

      {/* Branch Selector */}
      <div className="flex justify-center space-x-4">
        {Object.entries(branches).map(([key, branchData]) => (
          <Button
            key={key}
            variant={selectedBranch === key ? "default" : "outline"}
            onClick={() => setSelectedBranch(key)}
            className="flex items-center space-x-2"
          >
            <span>{branchData.icon}</span>
            <span>{branchData.name}</span>
          </Button>
        ))}
      </div>

      {/* Talent Tree Visualization */}
      <Card className="p-6">
        <div className="relative h-96 bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg overflow-hidden">
          {/* Connection Lines */}
          <svg className="absolute inset-0 w-full h-full">
            {branch.nodes.map(node => {
              if (!node.prereq) return null;
              const prereqs = Array.isArray(node.prereq) ? node.prereq : [node.prereq];
              return prereqs.map(prereqId => {
                const prereqNode = branch.nodes.find(n => n.id === prereqId);
                if (!prereqNode) return null;
                
                return (
                  <line
                    key={`${node.id}-${prereqId}`}
                    x1={`${prereqNode.x}%`}
                    y1={`${prereqNode.y}%`}
                    x2={`${node.x}%`}
                    y2={`${node.y}%`}
                    stroke={isNodeUnlocked(prereqId) ? "#10b981" : "#d1d5db"}
                    strokeWidth="2"
                  />
                );
              });
            })}
          </svg>

          {/* Talent Nodes */}
          {branch.nodes.map(node => {
            const unlocked = isNodeUnlocked(node.id);
            const canUnlock = canUnlockNode(node);
            
            return (
              <div
                key={node.id}
                className={`absolute w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all transform -translate-x-8 -translate-y-8 ${
                  unlocked 
                    ? `bg-gradient-to-r ${branch.color} text-white shadow-lg scale-110` 
                    : canUnlock 
                    ? 'bg-white border-2 border-gray-400 hover:border-gray-600 hover:scale-105 shadow-md' 
                    : 'bg-gray-200 border-2 border-gray-300 text-gray-500'
                }`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => handleNodeClick(node)}
                title={`${node.name} - ${node.cost} TP`}
              >
                <div className="text-center">
                  <div className="text-xs font-bold leading-none">T{node.tier}</div>
                  <div className="text-xs leading-none">{node.cost}TP</div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <p><span className="font-semibold">Click</span> available nodes to unlock • <span className="font-semibold">T#</span> = Tier • <span className="font-semibold">TP</span> = Talent Points</p>
        </div>
      </Card>
    </div>
  );
}

// Enhanced Chore Quest Component
function ChoreQuest({ task, currentUser, partner, onComplete }) {
  const [verificationStep, setVerificationStep] = useState(null);
  const [showMiniGame, setShowMiniGame] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  
  const needsDualVerification = task.room === 'US' || task.difficulty === 'HARD';
  const points = DIFFICULTY_POINTS[task.difficulty];

  const handleStartQuest = () => {
    setVerificationStep('method');
  };

  const handleVerificationMethod = (method) => {
    if (method === 'photo') {
      setVerificationStep('photo');
    } else if (method === 'partner') {
      setVerificationStep('partner');
    } else if (method === 'emoji') {
      setVerificationStep('emoji');
    }
  };

  const handleCompleteQuest = async (bonusPoints = 0) => {
    try {
      // Trigger random mini-game chance (30%)
      if (Math.random() < 0.3 && !showMiniGame) {
        const games = ['spin', 'tap', 'trivia'];
        const randomGame = games[Math.floor(Math.random() * games.length)];
        setShowMiniGame(randomGame);
        return;
      }

      const totalPoints = points + bonusPoints;
      
      // API call to complete task
      await axios.post(`${API}/tasks/${task.taskId}/complete`, {
        userId: currentUser.userId,
        bonusPoints: bonusPoints,
        verificationMethod: verificationStep,
        photoUrl: photoUrl
      });

      // Celebration effect
      onComplete(totalPoints);
      setVerificationStep(null);
      
    } catch (error) {
      console.error('Error completing quest:', error);
      alert('Failed to complete quest. Please try again.');
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'from-green-400 to-green-600';
      case 'MEDIUM': return 'from-yellow-400 to-orange-500';
      case 'HARD': return 'from-red-400 to-purple-600';
    }
  };

  return (
    <Card className="mb-4 hover:shadow-lg transition-all transform hover:scale-102">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getDifficultyColor(task.difficulty)}`} />
              <h4 className="text-lg font-bold">{task.title}</h4>
              {needsDualVerification && <Badge className="bg-pink-100 text-pink-800">👫 Duo Quest</Badge>}
            </div>
            
            {task.description && (
              <p className="text-gray-600 mb-3">{task.description}</p>
            )}
            
            <div className="flex items-center space-x-4">
              <Badge className={`bg-gradient-to-r ${getDifficultyColor(task.difficulty)} text-white`}>
                💎 {points} XP
              </Badge>
              <span className="text-sm text-gray-500">🏠 {task.room}</span>
            </div>
          </div>
          
          <div className="ml-6">
            {!verificationStep ? (
              <Button 
                onClick={handleStartQuest}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6"
              >
                Start Quest! ⚔️
              </Button>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800 px-3 py-1">
                In Progress...
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      {/* Verification Modal */}
      {verificationStep && (
        <Dialog open={true} onOpenChange={() => setVerificationStep(null)}>
          <DialogContent className="sm:max-w-md text-center">
            {verificationStep === 'method' && (
              <>
                <DialogHeader>
                  <DialogTitle>How did you complete this quest? 🎯</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3 py-4">
                  <Button onClick={() => handleVerificationMethod('photo')} className="p-4">
                    📸 Take Photo Proof
                  </Button>
                  <Button onClick={() => handleVerificationMethod('emoji')} className="p-4">
                    😄 Quick Emoji Check
                  </Button>
                  {partner && (
                    <Button onClick={() => handleVerificationMethod('partner')} className="p-4">
                      👫 Partner Verification
                    </Button>
                  )}
                </div>
              </>
            )}
            
            {verificationStep === 'photo' && (
              <>
                <DialogHeader>
                  <DialogTitle>📸 Snap that proof!</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    placeholder="Upload photo or paste URL..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="mb-4"
                  />
                  <Button onClick={() => handleCompleteQuest()} className="w-full">
                    Submit Proof! ✨
                  </Button>
                </div>
              </>
            )}
            
            {verificationStep === 'emoji' && (
              <>
                <DialogHeader>
                  <DialogTitle>How do you feel about completing this? 😊</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-4 gap-3 py-4">
                  {['😊', '😎', '💪', '🔥', '⭐', '🎉', '👏', '❤️'].map(emoji => (
                    <Button 
                      key={emoji}
                      onClick={() => handleCompleteQuest(2)} // Small emoji bonus
                      className="text-3xl p-4"
                      variant="outline"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </>
            )}
            
            {verificationStep === 'partner' && (
              <>
                <DialogHeader>
                  <DialogTitle>👫 Waiting for partner verification...</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-gray-600 mb-4">
                    We've sent a notification to {partner?.name || 'your partner'} to verify this quest!
                  </p>
                  <Button onClick={() => handleCompleteQuest(5)} className="w-full">
                    Partner Verified! (+5 bonus) ✨
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Mini-Games */}
      {showMiniGame === 'spin' && (
        <SpinWheelGame 
          onComplete={(bonusPoints) => handleCompleteQuest(bonusPoints)}
          onClose={() => setShowMiniGame(null)}
        />
      )}
      {showMiniGame === 'tap' && (
        <TapChallengeGame 
          onComplete={(bonusPoints) => handleCompleteQuest(bonusPoints)}
          onClose={() => setShowMiniGame(null)}
        />
      )}
      {showMiniGame === 'trivia' && (
        <CoupleTrivia 
          onComplete={(bonusPoints) => handleCompleteQuest(bonusPoints)}
          onClose={() => setShowMiniGame(null)}
          partnerName={partner?.name}
        />
      )}
    </Card>
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
          <DialogTitle className="text-center text-2xl">
            {isLogin ? '🤝 Join Your Adventure Partner' : '🚀 Begin Your Quest'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Hero Name</Label>
            <Input 
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your heroic name"
              required
            />
          </div>
          
          {isLogin && (
            <div>
              <Label htmlFor="code">Party Code</Label>
              <Input 
                id="code"
                value={coupleCode}
                onChange={(e) => setCoupleCode(e.target.value)}
                placeholder="Enter your partner's party code"
                required
              />
            </div>
          )}
          
          <Button type="submit" className="w-full text-lg py-3" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? '🤝 Join Party' : '🚀 Start Adventure'}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Don't have a party code? Start solo adventure" : 'Have a party code? Join existing adventure'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main Game App Component
function ChoreChampionsApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [tasks, setTasks] = useState({});
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('quests');
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(
    currentUser ? `${WS_URL}/ws/${currentUser.coupleId}` : null,
    { shouldReconnect: () => true }
  );

  // Initialize app
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.userId) {
          setCurrentUser(user);
          setShowAuth(false);
          if (!hasSeenOnboarding) {
            setShowOnboarding(true);
          }
          loadGameData(user);
        } else {
          setShowAuth(true);
        }
      } catch (error) {
        setShowAuth(true);
      }
    } else {
      setShowAuth(true);
    }
  }, []);

  // Load game data
  const loadGameData = async (user) => {
    try {
      // Load tasks
      const tasksResponse = await axios.get(`${API}/couples/${user.coupleId}/tasks`);
      setTasks(tasksResponse.data);

      // Load partner info if exists
      if (user.partnerId) {
        const partnerResponse = await axios.get(`${API}/users/${user.partnerId}`);
        setPartner(partnerResponse.data);
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  };

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        if (message.type === 'quest_completed') {
          setCelebrationMessage(`🎉 ${message.userName} completed "${message.taskTitle}"! +${message.points} XP`);
          setTimeout(() => setCelebrationMessage(''), 4000);
          
          // Play sound effect
          playNotificationSound();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const playNotificationSound = () => {
    // Create the "whah-ping" celebration sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Celebratory ascending tones
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Could not play sound:', error);
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setShowAuth(false);
    setShowOnboarding(true);
    loadGameData(user);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const handleQuestComplete = async (points) => {
    setCelebrationMessage(`🎉 Quest Complete! +${points} XP gained!`);
    setTimeout(() => setCelebrationMessage(''), 3000);
    
    // Refresh user data
    if (currentUser) {
      const response = await axios.get(`${API}/users/${currentUser.userId}`);
      setCurrentUser(response.data);
      localStorage.setItem('currentUser', JSON.stringify(response.data));
    }
  };

  const handleTalentUnlock = async (nodeId) => {
    try {
      const newBuild = {
        ...currentUser.talentBuild,
        nodeIds: [...(currentUser.talentBuild?.nodeIds || []), nodeId]
      };

      await axios.post(`${API}/builds/submit`, {
        userId: currentUser.userId,
        talentBuild: newBuild
      });

      setCelebrationMessage('🌟 New talent unlocked! Power increased!');
      setTimeout(() => setCelebrationMessage(''), 3000);

      // Refresh user data
      const response = await axios.get(`${API}/users/${currentUser.userId}`);
      setCurrentUser(response.data);
      localStorage.setItem('currentUser', JSON.stringify(response.data));
      
    } catch (error) {
      console.error('Error unlocking talent:', error);
      alert('Failed to unlock talent. Try again!');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto p-8">
          <div className="animate-bounce mb-6">
            <div className="text-8xl mb-4">🏆</div>
          </div>
          <h1 className="text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Chore Champions
          </h1>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Transform your household into an epic RPG adventure! Complete quests, level up together, and unlock amazing rewards! ⚔️✨
          </p>
          <Button 
            onClick={() => setShowAuth(true)} 
            size="lg" 
            className="text-xl px-8 py-4 bg-white text-purple-600 hover:bg-gray-100 font-bold shadow-2xl"
          >
            Begin Adventure! 🚀
          </Button>
        </div>
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
        <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  const levelProgress = (currentUser.points % LEVEL_UP_POINTS / LEVEL_UP_POINTS) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Celebration Notification */}
      {celebrationMessage && (
        <div className="fixed top-4 right-4 bg-gradient-to-r from-green-400 to-blue-500 text-white p-4 rounded-lg shadow-2xl z-50 animate-bounce">
          {celebrationMessage}
        </div>
      )}

      {/* Epic Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold drop-shadow-lg">🏆 Chore Champions</h1>
              <p className="text-purple-100 text-lg">Hero: {currentUser.displayName}</p>
              {partner && <p className="text-purple-200">Party: {partner.displayName}</p>}
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Level Display */}
              <div className="text-center bg-white/20 rounded-lg p-3">
                <div className="text-2xl font-bold">Level {currentUser.level}</div>
                <div className="w-32">
                  <Progress value={levelProgress} className="h-2 bg-purple-300" />
                </div>
                <div className="text-sm opacity-90">{currentUser.points % LEVEL_UP_POINTS}/{LEVEL_UP_POINTS} XP</div>
              </div>
              
              {/* Stats */}
              <div className="text-center">
                <div className="text-3xl font-bold">💎 {currentUser.points}</div>
                <div className="text-sm">Total XP</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold">⭐ {currentUser.talentPoints}</div>
                <div className="text-sm">Talent Points</div>
              </div>
              
              <Badge className="bg-white/20 text-white text-lg px-3 py-1">
                Party: {currentUser.coupleId}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Interface */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Game Navigation */}
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto bg-white shadow-lg">
            <TabsTrigger value="quests" className="text-lg font-semibold">
              ⚔️ Quests
            </TabsTrigger>
            <TabsTrigger value="talents" className="text-lg font-semibold">
              🌳 Talents
            </TabsTrigger>
            <TabsTrigger value="rewards" className="text-lg font-semibold">
              🎁 Rewards
            </TabsTrigger>
          </TabsList>

          {/* Quests Tab */}
          <TabsContent value="quests" className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">⚔️ Available Quests</h2>
              <p className="text-gray-600 text-lg">Choose your next household adventure!</p>
            </div>

            {Object.entries(tasks).map(([room, roomTasks]) => (
              <div key={room} className="space-y-4">
                <h3 className="text-2xl font-semibold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  🏠 {room} Quests
                </h3>
                {roomTasks?.map((task) => (
                  <ChoreQuest
                    key={task.taskId}
                    task={task}
                    currentUser={currentUser}
                    partner={partner}
                    onComplete={handleQuestComplete}
                  />
                ))}
              </div>
            ))}
          </TabsContent>

          {/* Talents Tab */}
          <TabsContent value="talents">
            <VisualTalentTree 
              currentUser={currentUser} 
              onNodeUnlock={handleTalentUnlock} 
            />
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards">
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold">🎁 Rewards & Achievements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-2">🏅</div>
                    <h3 className="font-bold mb-2">Quest Master</h3>
                    <p className="text-sm text-gray-600">Complete 10 quests</p>
                    <Progress value={30} className="mt-2" />
                    <p className="text-xs mt-1">3/10 completed</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-2">💕</div>
                    <h3 className="font-bold mb-2">Perfect Partnership</h3>
                    <p className="text-sm text-gray-600">Complete 5 duo quests</p>
                    <Progress value={60} className="mt-2" />
                    <p className="text-xs mt-1">3/5 completed</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-2">🎯</div>
                    <h3 className="font-bold mb-2">Mini-Game Champion</h3>
                    <p className="text-sm text-gray-600">Win 15 mini-games</p>
                    <Progress value={40} className="mt-2" />
                    <p className="text-xs mt-1">6/15 completed</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="mt-8">
                <h3 className="text-2xl font-bold mb-4">🎉 Unlocked Rewards</h3>
                <div className="bg-gradient-to-r from-green-100 to-blue-100 p-6 rounded-lg">
                  <p className="text-lg">🎊 Date Night Suggestion: Cooking class for two!</p>
                  <p className="text-sm text-gray-600 mt-2">Unlocked by reaching Level 3 together</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Onboarding */}
      <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChoreChampionsApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;