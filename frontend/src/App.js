import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import axios from 'axios';
import './App.css';

// Import new components
import BoardGames from './components/BoardGames';
import VerificationSystem from './components/VerificationSystem';
import NESGameInterface from './components/NESGameInterface';
import EnhancedOnboarding from './components/EnhancedOnboarding';

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
const LEVELS_PER_TALENT_POINT = 5;
const POINTS_PER_LEVEL = 100;
const MAX_CHORE_SHIFT_PER_PLAYER = 0.07;
const MAX_NET_CHORE_SHIFT = 0.07;
const VERIFICATION_WINDOW = 30; // minutes
const VERIFY_PROB = 0.10; // 10% random verification

// Comprehensive Talent Tree Nodes (as per spec)
const TALENT_TREE_NODES = {
  // ===== EFFICIENCY BRANCH =====
  eff_qw1: {
    id: "eff_qw1",
    name: "Quick Wipe",
    branch: "Efficiency",
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "room:Kitchen",
    value: 1,
    description: "+1 point on EASY kitchen tasks",
    prereqs: [],
    position: { x: 100, y: 50 }
  },
  eff_lh1: {
    id: "eff_lh1", 
    name: "Laundry Hand",
    branch: "Efficiency",
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "taskTag:laundry",
    value: 2,
    description: "+2 points when starting or finishing laundry",
    prereqs: [],
    position: { x: 200, y: 50 }
  },
  eff_ds2: {
    id: "eff_ds2",
    name: "Dishes Speed", 
    branch: "Efficiency",
    tier: 2,
    cost: 2,
    type: "multiplier",
    scope: "taskTag:KitchenDishSession",
    value: 0.10,
    description: "+10% points for each completed dish session",
    prereqs: ["eff_qw1"],
    position: { x: 100, y: 150 }
  },
  eff_tm2: {
    id: "eff_tm2",
    name: "Trash Master",
    branch: "Efficiency", 
    tier: 2,
    cost: 2,
    type: "chore_shift",
    scope: "taskId:kit_take_trash",
    value: -0.02,
    description: "-2% chance of getting trash duty",
    prereqs: ["eff_qw1"],
    position: { x: 200, y: 150 }
  },
  eff_vh3: {
    id: "eff_vh3",
    name: "Vacuum Hero",
    branch: "Efficiency",
    tier: 3, 
    cost: 3,
    type: "point_bonus",
    scope: "taskTag:vacuum",
    value: 5,
    description: "+5 points for vacuum tasks",
    prereqs: ["eff_ds2"],
    position: { x: 100, y: 250 }
  },
  eff_td3: {
    id: "eff_td3",
    name: "Toilet Tactician",
    branch: "Efficiency",
    tier: 3,
    cost: 3,
    type: "chore_shift", 
    scope: "taskId:bath_toilet_scrub",
    value: -0.05,
    description: "-5% chance of toilet scrubbing (redistributed to other bathroom chores)",
    prereqs: ["eff_tm2"],
    position: { x: 200, y: 250 }
  },
  eff_edge_cap: {
    id: "eff_edge_cap",
    name: "Housekeeper's Edge",
    branch: "Efficiency",
    tier: 4,
    cost: 4,
    type: "multiplier",
    scope: "global",
    value: 0.10,
    description: "CAPSTONE: +10% points on ALL chores",
    prereqs: ["eff_vh3", "eff_td3"], // any two tier3
    position: { x: 150, y: 350 }
  },

  // ===== COUPLE/US BRANCH =====
  cou_hug1: {
    id: "cou_hug1",
    name: "Hug Timer", 
    branch: "Couple",
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "taskId:us_hug",
    value: 2,
    description: "+2 points for hugs (stacked with base)",
    prereqs: [],
    position: { x: 400, y: 50 }
  },
  cou_mass1: {
    id: "cou_mass1",
    name: "Massage Points",
    branch: "Couple", 
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "taskTag:massage",
    value: 3,
    description: "+3 points per massage completion",
    prereqs: [],
    position: { x: 500, y: 50 }
  },
  cou_grat2: {
    id: "cou_grat2", 
    name: "Gratitude Shoutout",
    branch: "Couple",
    tier: 2,
    cost: 2,
    type: "point_bonus",
    scope: "taskTag:gratitude", 
    value: 1,
    description: "+1 point for partner-verified compliments",
    prereqs: ["cou_hug1"],
    position: { x: 400, y: 150 }
  },
  cou_team2: {
    id: "cou_team2",
    name: "Team Boost",
    branch: "Couple",
    tier: 2,
    cost: 2,
    type: "multiplier",
    scope: "timeWindow:1hour",
    value: 2.0,
    description: "2x points if both users complete chores in same hour",
    prereqs: ["cou_mass1"],
    position: { x: 500, y: 150 }
  },
  cou_double3: {
    id: "cou_double3",
    name: "Double Us",
    branch: "Couple",
    tier: 3,
    cost: 3,
    type: "consumable",
    scope: "daily",
    value: "double_us",
    description: "Once/day: Double points for US tasks when activated",
    prereqs: ["cou_team2"],
    position: { x: 500, y: 250 }
  },
  cou_rom3: {
    id: "cou_rom3",
    name: "Romance Perk",
    branch: "Couple", 
    tier: 3,
    cost: 3,
    type: "chore_shift",
    scope: "room:Bedroom",
    value: -0.03,
    description: "After date-night: -3% bedroom chore odds for rest of day (1/day)",
    prereqs: ["cou_grat2"],
    position: { x: 400, y: 250 }
  },
  cou_soul_cap: {
    id: "cou_soul_cap",
    name: "Soulmate Bonus",
    branch: "Couple",
    tier: 4,
    cost: 4,
    type: "multiplier",
    scope: "global",
    value: 0.20,
    description: "CAPSTONE: US tasks give +20% to ALL points earned that day",
    prereqs: ["cou_double3", "cou_rom3"],
    position: { x: 450, y: 350 }
  },

  // ===== GROWTH BRANCH =====
  gr_hyd1: {
    id: "gr_hyd1",
    name: "Hydration Harmony",
    branch: "Growth",
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "taskTag:water",
    value: 1,
    description: "+1 point per verified glass (partner or smart bottle)",
    prereqs: [],
    position: { x: 700, y: 50 }
  },
  gr_step1: {
    id: "gr_step1", 
    name: "Step Sync",
    branch: "Growth",
    tier: 1,
    cost: 1,
    type: "point_bonus",
    scope: "taskTag:walk",
    value: 5,
    description: "+5 points per tracked 1-mile walk (GPS confirmed)",
    prereqs: [],
    position: { x: 800, y: 50 }
  },
  gr_str2: {
    id: "gr_str2",
    name: "Stretch It Out",
    branch: "Growth",
    tier: 2,
    cost: 2,
    type: "point_bonus",
    scope: "taskTag:stretch",
    value: 2,
    description: "+2 points per 5-min stretch session",
    prereqs: ["gr_hyd1"],
    position: { x: 700, y: 150 }
  },
  gr_mind2: {
    id: "gr_mind2",
    name: "Mind Check-in", 
    branch: "Growth",
    tier: 2,
    cost: 2,
    type: "point_bonus",
    scope: "taskTag:journal",
    value: 2,
    description: "+2 points per partner-verified journal/mood entry",
    prereqs: ["gr_step1"],
    position: { x: 800, y: 150 }
  },
  gr_cons3: {
    id: "gr_cons3",
    name: "Consistency Buff",
    branch: "Growth",
    tier: 3,
    cost: 3,
    type: "multiplier",
    scope: "streak:7days",
    value: 0.10,
    description: "+10% points for next week if 7-day streak achieved",
    prereqs: ["gr_str2"],
    position: { x: 700, y: 250 }
  },
  gr_early3: {
    id: "gr_early3",
    name: "Early Bird",
    branch: "Growth",
    tier: 3, 
    cost: 3,
    type: "point_bonus",
    scope: "time:before10am",
    value: 5,
    description: "+5 points when completing first task before 10AM",
    prereqs: ["gr_mind2"],
    position: { x: 800, y: 250 }
  },
  gr_well_cap: {
    id: "gr_well_cap",
    name: "Wellness Overflow",
    branch: "Growth",
    tier: 4,
    cost: 4,
    type: "chance_convert",
    scope: "global",
    value: 0.10,
    description: "CAPSTONE: 10% chance growth points convert to couple points",
    prereqs: ["gr_cons3", "gr_early3"],
    position: { x: 750, y: 350 }
  }
};

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
  Games: {
    name: 'Games 🎲',
    emoji: '🎲',
    color: 'bg-yellow-100 border-yellow-200 text-yellow-800'
  },
  Growth: {
    name: 'Growth 💪',
    emoji: '💪',
    color: 'bg-emerald-100 border-emerald-200 text-emerald-800'
  }
};

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
      title: "Daily Quest System ⏰",
      content: "Every day at midnight, tasks are split 50/50 between you and your partner. Complete your assigned quests before the daily reset to maintain your streak!",
      image: "📅"
    },
    {
      title: "Smart Assignment Algorithm 🧠",
      content: "Tasks are assigned based on your talent tree investments and random bonuses. Specialize in certain rooms or difficulties to influence your daily quests!",
      image: "⚖️"
    },
    {
      title: "Complete Quests Together 🤝",
      content: "Tasks can be completed instantly, but partners can contest completion and request photo verification. Fibbers get penalized!",
      image: "✅"
    },
    {
      title: "Level Up & Unlock Powers 🌟",
      content: "Spend Talent Points on skill trees! Get chore odds changes, bonus points, room specializations, and relationship perks.",
      image: "🌳"
    },
    {
      title: "Built-In Games 🎲",
      content: "Play Battleship, Chess, Backgammon, and Gin Rummy directly in the app! These count as relationship tasks and give bonus XP.",
      image: "🎯"
    },
    {
      title: "Grow Together 💕",
      content: "Combo bonuses when you work as a team, daily game requirements for your relationship, and rewards that strengthen your bond!",
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

// Enhanced Visual Talent Tree Component with Comprehensive Nodes
function VisualTalentTree({ currentUser, onNodeUnlock }) {
  const [selectedBranch, setSelectedBranch] = useState('Efficiency');
  const [selectedNode, setSelectedNode] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const branches = ['Efficiency', 'Couple', 'Growth'];
  
  const unlockedNodes = currentUser.talentBuild?.nodeIds || [];
  const availableTalentPoints = currentUser.talentPoints || 0;

  const getBranchNodes = (branch) => {
    return Object.values(TALENT_TREE_NODES).filter(node => node.branch === branch);
  };

  const isNodeUnlocked = (nodeId) => unlockedNodes.includes(nodeId);
  
  const arePrereqsMet = (node) => {
    if (node.prereqs.length === 0) return true;
    
    // For capstones, need ANY two tier 3 nodes in same branch
    if (node.tier === 4) {
      const tier3NodesInBranch = Object.values(TALENT_TREE_NODES)
        .filter(n => n.branch === node.branch && n.tier === 3);
      const unlockedTier3 = tier3NodesInBranch.filter(n => isNodeUnlocked(n.id));
      return unlockedTier3.length >= 2;
    }
    
    // Regular prereqs - need ALL prereqs unlocked
    return node.prereqs.every(prereqId => isNodeUnlocked(prereqId));
  };
  
  const canUnlockNode = (node) => {
    return availableTalentPoints >= node.cost && 
           !isNodeUnlocked(node.id) && 
           arePrereqsMet(node);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (canUnlockNode(node)) {
      setShowConfirmModal(true);
    }
  };

  const confirmUnlock = () => {
    if (selectedNode) {
      onNodeUnlock(selectedNode.id);
      setShowConfirmModal(false);
      setSelectedNode(null);
    }
  };

  const getNodeColor = (node) => {
    const unlocked = isNodeUnlocked(node.id);
    const canUnlock = canUnlockNode(node);
    const prereqsMet = arePrereqsMet(node);
    
    if (unlocked) {
      return 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 shadow-green-500/50 shadow-lg';
    }
    if (canUnlock) {
      return 'bg-gradient-to-r from-blue-600 to-purple-600 border-blue-400 hover:scale-105 shadow-blue-500/50 shadow-lg';
    }
    if (!prereqsMet) {
      return 'bg-gray-800 border-gray-600 opacity-30';
    }
    return 'bg-gray-600 border-gray-500 opacity-60';
  };

  const getTierIcon = (tier) => {
    const icons = { 1: '🥉', 2: '🥈', 3: '🥇', 4: '👑' };
    return icons[tier] || '⭐';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'point_bonus': '💎',
      'multiplier': '⚡',
      'chore_shift': '🎯',
      'consumable': '🔮',
      'chance_convert': '🎲'
    };
    return icons[type] || '✨';
  };

  return (
    <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-2xl">
      <div className="grid grid-cols-4 gap-8 h-96">
        {/* Branch Selector */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-center mb-6">🌳 Talent Branches</h3>
          {branches.map((branch) => (
            <button
              key={branch}
              onClick={() => setSelectedBranch(branch)}
              className={`w-full p-4 rounded-lg font-semibold transition-all duration-300 ${
                selectedBranch === branch
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg scale-105'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {branch === 'Efficiency' && '⚡'} 
              {branch === 'Couple' && '💕'} 
              {branch === 'Growth' && '🌱'} 
              {branch}
            </button>
          ))}
          
          <div className="mt-8 p-4 bg-black/30 rounded-lg">
            <h4 className="font-bold text-lg mb-2">💎 Talent Points</h4>
            <div className="text-3xl font-bold text-yellow-400">{availableTalentPoints}</div>
            <p className="text-sm opacity-75">Available to spend</p>
          </div>
          
          <div className="mt-4 p-3 bg-black/20 rounded-lg text-xs">
            <h5 className="font-bold mb-2">🎯 Legend</h5>
            <div className="space-y-1">
              <div>🥉🥈🥇👑 Tiers 1-4</div>
              <div>💎 Point Bonus</div>
              <div>⚡ Multiplier</div>
              <div>🎯 Chore Shift</div>
              <div>🔮 Consumable</div>
            </div>
          </div>
        </div>

        {/* Talent Nodes */}
        <div className="col-span-3 overflow-y-auto max-h-96">
          <h3 className="text-2xl font-bold mb-6 text-center sticky top-0 bg-gradient-to-r from-purple-900 to-blue-900 py-2 rounded-lg">
            {selectedBranch === 'Efficiency' && '⚡ Efficiency Mastery'} 
            {selectedBranch === 'Couple' && '💕 Relationship Bonding'} 
            {selectedBranch === 'Growth' && '🌱 Personal Evolution'} 
          </h3>
          
          <div className="space-y-4">
            {getBranchNodes(selectedBranch)
              .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
              .map((node) => {
                const unlocked = isNodeUnlocked(node.id);
                const canUnlock = canUnlockNode(node);
                const prereqsMet = arePrereqsMet(node);
                
                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${getNodeColor(node)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-2xl">{getTierIcon(node.tier)}</span>
                          <h4 className="text-lg font-bold">
                            {unlocked && '✅ '}{node.name}
                          </h4>
                          <span className="text-lg">{getTypeIcon(node.type)}</span>
                        </div>
                        
                        <p className="text-sm opacity-90 mb-2">{node.description}</p>
                        
                        <div className="flex items-center space-x-3">
                          <span className="bg-black/30 px-2 py-1 rounded text-xs">
                            Tier {node.tier}
                          </span>
                          <span className="bg-yellow-500/20 px-2 py-1 rounded text-xs">
                            💎 {node.cost} TP
                          </span>
                          {node.prereqs.length > 0 && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              prereqsMet ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
                            }`}>
                              Prereqs: {prereqsMet ? '✅' : '❌'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-3xl">
                        {unlocked ? '🌟' : canUnlock ? '✨' : prereqsMet ? '🔒' : '⛔'}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Node Details Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-2xl max-w-lg mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4 flex items-center space-x-2">
              <span>{getTierIcon(selectedNode.tier)}</span>
              <span>{selectedNode.name}</span>
              <span>{getTypeIcon(selectedNode.type)}</span>
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="font-medium">{selectedNode.description}</p>
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Effect:</strong> {selectedNode.scope} • Value: {selectedNode.value}
                </div>
              </div>
              
              {selectedNode.prereqs.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h5 className="font-bold text-sm mb-1">Prerequisites:</h5>
                  <div className="text-sm">
                    {selectedNode.prereqs.map(prereqId => {
                      const prereqNode = TALENT_TREE_NODES[prereqId];
                      const isUnlocked = isNodeUnlocked(prereqId);
                      return (
                        <div key={prereqId} className={`flex items-center space-x-1 ${isUnlocked ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{isUnlocked ? '✅' : '❌'}</span>
                          <span>{prereqNode?.name || prereqId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center p-4 bg-gray-100 rounded-lg">
                <span>Cost:</span>
                <span className="font-bold text-lg">💎 {selectedNode.cost} Talent Points</span>
              </div>
              
              <div className="flex space-x-3">
                {canUnlockNode(selectedNode) && (
                  <Button 
                    onClick={confirmUnlock}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    🌟 Unlock Now!
                  </Button>
                )}
                <Button 
                  onClick={() => setSelectedNode(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Checkbox Chore List with Verification UX
function CheckboxChoreList({ tasks, currentUser, partner, onComplete, isToday = false, showEdit = false }) {
  const [completingTask, setCompletingTask] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [verificationRequests, setVerificationRequests] = useState([]);
  
  const todaysTasks = isToday ? tasks.filter(task => task.assignedTo === currentUser.userId) : tasks;
  
  const handleTaskComplete = (task) => {
    setSelectedTask(task);
    setCompletingTask(task.taskId);
    
    // Immediate point award (unless verification required)
    if (!task.requirePartnerVerification) {
      const basePoints = getBasePoints(task.difficulty);
      onComplete(task, basePoints);
      
      // Send partner notification for verification
      if (partner) {
        sendVerificationNotification(task);
      }
      
      // Random verification check (10% chance)
      if (Math.random() < 0.10) {
        triggerRandomVerificationCheck(task);
      }
    } else {
      // Requires partner verification before points
      setShowVerificationModal(true);
    }
    
    setCompletingTask(null);
  };
  
  const getBasePoints = (difficulty) => {
    const POINTS = { EASY: 5, MEDIUM: 10, HARD: 20 };
    return POINTS[difficulty] || 5;
  };
  
  const sendVerificationNotification = (task) => {
    // Create verification request
    const request = {
      id: `verify_${Date.now()}`,
      taskId: task.taskId,
      taskTitle: task.title,
      completedBy: currentUser.displayName,
      completedAt: new Date(),
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    };
    
    setVerificationRequests(prev => [...prev, request]);
    
    // In real app, this would send push notification to partner
    console.log(`📱 Notification to ${partner?.displayName}: "${currentUser.displayName} completed: ${task.title}. Verify?"`);
  };
  
  const triggerRandomVerificationCheck = (task) => {
    console.log(`🎲 Random verification check triggered for: ${task.title}`);
    // Auto-request proof from both users
    setShowVerificationModal(true);
  };
  
  const handleVerificationResponse = (request, action) => {
    setVerificationRequests(prev => 
      prev.map(req => 
        req.id === request.id 
          ? { ...req, status: action, respondedAt: new Date() }
          : req
      )
    );
    
    switch (action) {
      case 'verify':
        // Award any verification bonuses
        console.log(`✅ ${partner?.displayName} verified: ${request.taskTitle}`);
        break;
      case 'request_proof':
        // Prompt original completer for photo/GPS proof
        console.log(`📸 ${partner?.displayName} requested proof for: ${request.taskTitle}`);
        break;
      case 'decline':
        // Points remain but marked unverified
        console.log(`❌ ${partner?.displayName} declined: ${request.taskTitle} (points kept, unverified)`);
        break;
    }
  };
  
  const getTaskStatus = (task) => {
    // Check if task has pending/completed verification
    const request = verificationRequests.find(req => req.taskId === task.taskId);
    if (!request) return 'available';
    
    if (request.status === 'pending' && new Date() < new Date(request.expiresAt)) {
      return 'pending_verification';
    }
    if (request.status === 'verify') return 'verified';
    if (request.status === 'decline') return 'unverified';
    if (request.status === 'request_proof') return 'proof_requested';
    
    return 'verified_by_timeout'; // Auto-verified after 30 mins
  };
  
  if (!todaysTasks || todaysTasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">✨</div>
        <p>{isToday ? "No chores assigned for today!" : "No chores in this room yet."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Verification Requests (Partner View) */}
      {verificationRequests.filter(req => req.status === 'pending' && new Date() < new Date(req.expiresAt)).length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg">🔔 Verification Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationRequests
              .filter(req => req.status === 'pending' && new Date() < new Date(req.expiresAt))
              .map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <p className="font-medium">{request.completedBy} completed: "{request.taskTitle}"</p>
                    <p className="text-sm text-gray-600">
                      Expires in {Math.ceil((new Date(request.expiresAt) - new Date()) / 60000)} minutes
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleVerificationResponse(request, 'verify')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      ✅ Verify
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleVerificationResponse(request, 'request_proof')}
                    >
                      📸 Request Proof
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleVerificationResponse(request, 'decline')}
                    >
                      ❌ Decline
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
      
      {/* Task List */}
      <div className="space-y-3">
        {todaysTasks.map((task, index) => {
          const status = getTaskStatus(task);
          const isCompleted = ['verified', 'unverified', 'verified_by_timeout'].includes(status);
          const isPending = status === 'pending_verification';
          
          return (
            <div 
              key={task.taskId || index} 
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                isCompleted ? 'bg-green-50 border border-green-200' :
                isPending ? 'bg-yellow-50 border border-yellow-200' :
                'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  disabled={isCompleted || completingTask === task.taskId}
                  className="w-5 h-5 text-blue-600 rounded"
                  onChange={() => handleTaskComplete(task)}
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                      {task.title}
                    </h4>
                    {/* Status indicators */}
                    {status === 'verified' && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Verified</span>}
                    {status === 'unverified' && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">⚠️ Unverified</span>}
                    {status === 'pending_verification' && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">⏳ Pending</span>}
                    {status === 'proof_requested' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">📸 Proof Requested</span>}
                  </div>
                  
                  {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{task.room}</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {task.difficulty} • {getBasePoints(task.difficulty)} pts
                    </span>
                    {task.requirePartnerVerification && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">👫 Partner Required</span>
                    )}
                  </div>
                </div>
              </div>
              
              {showEdit && (
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">Edit</Button>
                  <Button size="sm" variant="outline">Delete</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Verification Modal */}
      {showVerificationModal && selectedTask && (
        <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verification Required</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>"{selectedTask.title}" requires partner verification before points are awarded.</p>
              <div className="flex space-x-3">
                <Button 
                  onClick={() => {
                    sendVerificationNotification(selectedTask);
                    setShowVerificationModal(false);
                  }}
                  className="flex-1"
                >
                  📤 Notify Partner
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowVerificationModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Couple Games Interface Component
function CoupleGamesInterface({ currentUser, partner, onGameComplete }) {
  const games = [
    { name: "Battleship", emoji: "🚢", description: "Classic naval strategy game" },
    { name: "Chess", emoji: "♟️", description: "The ultimate strategy game" },
    { name: "Backgammon", emoji: "🎲", description: "Ancient board game of skill and luck" },
    { name: "Gin Rummy", emoji: "🃏", description: "Popular card matching game" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {games.map((game) => (
        <Card key={game.name} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">{game.emoji}</div>
            <h3 className="text-xl font-bold mb-2">{game.name}</h3>
            <p className="text-gray-600 mb-4">{game.description}</p>
            <Button 
              onClick={() => onGameComplete({
                taskId: `game_${game.name.toLowerCase().replace(/\s+/g, '_')}`,
                title: game.name,
                room: 'Games',
                difficulty: 'MEDIUM',
                tags: ['game', 'relationship']
              }, 15)}
              className="w-full"
            >
              Play Game
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Chore Management Component
function ChoreManagement({ tasks, setTasks, currentUser }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">📋 Chore Management</h3>
        <p className="text-gray-600 mb-4">Manage your household chores, assign them to rooms, and set difficulty levels.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-2">📝</div>
              <h4 className="font-bold">Add Chores</h4>
              <p className="text-sm text-gray-600">Create new chores</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-2">⚖️</div>
              <h4 className="font-bold">Balance Load</h4>
              <p className="text-sm text-gray-600">Distribute fairly</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-bold">View Stats</h4>
              <p className="text-sm text-gray-600">Track completion</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Enhanced Quest Component with Games and Verification
function ChoreQuest({ task, currentUser, partner, onComplete }) {
  const [showVerification, setShowVerification] = useState(false);
  const [showBoardGame, setShowBoardGame] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(null);
  const [verificationStep, setVerificationStep] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  
  const points = DIFFICULTY_POINTS[task.difficulty];
  
  // Check if this task needs dual verification (partner approval)
  // US room tasks always need partner verification, others are optional but can be contested
  const needsDualVerification = task.room === 'US' || task.requiresVerification;

  const handleStartQuest = () => {
    // Check if this is a game quest
    if (task.room === 'Games') {
      setShowBoardGame(true);
      return;
    }
    
    // For regular quests, show verification system
    setVerificationStep('method');
  };

  const handleVerificationMethod = (method) => {
    setVerificationStep(method);
  };

  const handleCompleteQuest = (bonusPoints = 0) => {
    handleVerificationComplete({ bonusPoints, photoUrl });
  };

  const handleVerificationComplete = async (verificationData) => {
    try {
      // Trigger random mini-game chance (20%) for non-game quests
      if (Math.random() < 0.2 && !showMiniGame && task.room !== 'Games') {
        const games = ['spin', 'tap', 'trivia'];
        const randomGame = games[Math.floor(Math.random() * games.length)];
        setShowMiniGame(randomGame);
        return;
      }

      const totalPoints = points + (verificationData.bonusPoints || 0);
      
      // API call to complete task
      await axios.post(`${API}/tasks/${task.taskId}/complete`, {
        userId: currentUser.userId,
        bonusPoints: verificationData.bonusPoints || 0,
        verificationData: verificationData
      });

      // Celebration effect
      onComplete(task, verificationData.bonusPoints || 0);
      setShowVerification(false);
      setVerificationStep(null);
      
    } catch (error) {
      console.error('Error completing quest:', error);
      alert('Failed to complete quest. Please try again.');
    }
  };

  const handleGameComplete = async (gameType, gamePoints) => {
    try {
      const totalPoints = points + gamePoints;
      
      // API call to complete game task
      await axios.post(`${API}/tasks/${task.taskId}/complete`, {
        userId: currentUser.userId,
        bonusPoints: gamePoints,
        gameType: gameType,
        gameCompleted: true
      });

      // Celebration effect
      onComplete(task, gamePoints);
      setShowBoardGame(false);
      
    } catch (error) {
      console.error('Error completing game quest:', error);
      alert('Failed to complete game quest. Please try again.');
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

      {/* Verification System */}
      {showVerification && (
        <VerificationSystem
          quest={task}
          currentUser={currentUser}
          partner={partner}
          onVerificationComplete={handleVerificationComplete}
          onClose={() => setShowVerification(false)}
        />
      )}

      {/* Board Games */}
      {showBoardGame && (
        <BoardGames
          onGameComplete={handleGameComplete}
          onClose={() => setShowBoardGame(false)}
        />
      )}

      {/* Mini-Games */}
      {showMiniGame === 'spin' && (
        <SpinWheelGame 
          onComplete={(bonusPoints) => handleVerificationComplete({ bonusPoints, quickGame: true })}
          onClose={() => setShowMiniGame(null)}
        />
      )}
      {showMiniGame === 'tap' && (
        <TapChallengeGame 
          onComplete={(bonusPoints) => handleVerificationComplete({ bonusPoints, quickGame: true })}
          onClose={() => setShowMiniGame(null)}
        />
      )}
      {showMiniGame === 'trivia' && (
        <CoupleTrivia 
          onComplete={(bonusPoints) => handleVerificationComplete({ bonusPoints, quickGame: true })}
          onClose={() => setShowMiniGame(null)}
          partnerName={partner?.displayName}
        />
      )}
    </Card>
  );
}

// Epic Adventure Modal Component
function EpicAdventureModal({ isOpen, onClose, onSuccess, onEnhancedOnboarding }) {
  const [mode, setMode] = useState('choose'); // 'choose', 'create', 'join', 'preview'
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const handleCreateAdventure = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create couple invitation
      const response = await axios.post(`${API}/couples/create`, {
        creatorName: name
      });
      
      setInvitation(response.data);
      setMode('invitation-created');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.detail || 'Failed to create adventure'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAdventure = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Join existing couple
      const response = await axios.post(`${API}/couples/join`, {
        partnerName: name,
        inviteCode: inviteCode
      });
      
      // Create user account
      const userResponse = await axios.post(`${API}/users`, {
        displayName: name,
        coupleCode: inviteCode
      });
      
      localStorage.setItem('currentUser', JSON.stringify(userResponse.data));
      onSuccess(userResponse.data);
      onClose();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.detail || 'Failed to join adventure'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewInvite = async () => {
    if (!inviteCode) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/couples/${inviteCode}/preview`);
      setPreviewData(response.data);
      setMode('preview');
    } catch (error) {
      alert('Invalid invitation code');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteMessage = () => {
    if (invitation) {
      navigator.clipboard.writeText(invitation.message);
      alert('🎉 Epic invitation copied! Share it via text or email!');
    }
  };

  const handleStartMyAdventure = async () => {
    setLoading(true);
    
    try {
      // Create user account as the adventure creator
      const userResponse = await axios.post(`${API}/users`, {
        displayName: name,
        coupleCode: invitation.inviteCode
      });
      
      localStorage.setItem('currentUser', JSON.stringify(userResponse.data));
      onSuccess(userResponse.data);
      onClose();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.detail || 'Failed to start adventure'));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-3xl">⚔️ Choose Your Path</DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            <div className="text-6xl">🏰</div>
            <p className="text-lg text-gray-600">
              Will you forge a new legend or join an existing adventure?
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={onEnhancedOnboarding}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white text-lg py-4"
              >
                🌟 Create Adventure
              </Button>
              
              <Button 
                onClick={() => setMode('join')} 
                className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white text-lg py-4"
              >
                🤝 Join Adventure Party
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // OLD CREATE MODE REMOVED - Only enhanced onboarding now

  // OLD INVITATION-CREATED MODE REMOVED - Enhanced onboarding handles this now

  if (mode === 'join') {
    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">🤝 Join the Adventure</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🗡️</div>
              <p className="text-gray-600">Enter your details to join your partner's epic quest!</p>
            </div>
            
            <div>
              <Label htmlFor="joinName">🏷️ Your Hero Name</Label>
              <Input 
                id="joinName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your legendary name"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="code">🔮 Adventure Code</Label>
              <div className="flex space-x-2">
                <Input 
                  id="code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invitation code"
                  required
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePreviewInvite}
                  disabled={!inviteCode || loading}
                >
                  👁️ Preview
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={handleJoinAdventure} 
              className="w-full text-lg py-3 bg-gradient-to-r from-green-500 to-teal-600" 
              disabled={loading || !name || !inviteCode}
            >
              {loading ? '🔮 Joining...' : '🚀 Accept the Challenge!'}
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full"
              onClick={() => setMode('choose')}
            >
              ← Back to Path Selection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === 'preview') {
    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">👁️ Adventure Preview</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🏰</div>
              <h3 className="text-lg font-bold text-purple-600">{previewData?.adventureTheme}</h3>
            </div>
            
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-4 rounded-lg">
              <p className="text-sm">
                <strong>🧙‍♂️ Adventure Leader:</strong> {previewData?.creatorName}
              </p>
              <p className="text-sm mt-2">
                <strong>🎯 Quest:</strong> {previewData?.questPhrase}
              </p>
              <p className="text-sm mt-2">
                <strong>📊 Status:</strong> {previewData?.isAvailable ? '✅ Ready for Partner' : '❌ Adventure Full'}
              </p>
            </div>
            
            {previewData?.isAvailable ? (
              <Button 
                onClick={() => setMode('join')} 
                className="w-full bg-gradient-to-r from-green-500 to-teal-600"
              >
                🤝 Join This Adventure!
              </Button>
            ) : (
              <div className="text-center text-red-600 font-semibold">
                This adventure already has two heroes!
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setMode('join')}
            >
              ← Try Different Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

// Main Game App Component
function ChoreChampionsApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [tasks, setTasks] = useState({});
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [showAddChore, setShowAddChore] = useState(false);
  const [showNESInterface, setShowNESInterface] = useState(false); // Disable NES theme by default per user request
  const [showEnhancedOnboarding, setShowEnhancedOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);

  // Load user from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setCurrentUser(userData);
        console.log('✅ Loaded user from localStorage:', userData.displayName);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

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
      // Load only tasks assigned to this user for today
      const today = new Date().toISOString().split('T')[0];
      const myTasksResponse = await axios.get(`${API}/couples/${user.coupleId}/my-tasks/${user.userId}?date=${today}`);
      setTasks(myTasksResponse.data);

      // Load partner info if exists
      if (user.partnerId) {
        const partnerResponse = await axios.get(`${API}/users/${user.partnerId}`);
        setPartner(partnerResponse.data);
      }
    } catch (error) {
      console.error('Error loading game data:', error);
      // Fallback to all tasks if assignment system fails
      try {
        const tasksResponse = await axios.get(`${API}/couples/${user.coupleId}/tasks`);
        setTasks(tasksResponse.data);
      } catch (fallbackError) {
        console.error('Error loading fallback tasks:', fallbackError);
      }
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

  const handleEnhancedOnboardingComplete = async (onboardingData) => {
    setLoading(true);
    
    try {
      // Create enhanced couple with onboarding data
      const response = await axios.post(`${API}/couples/create-enhanced`, {
        playerName: onboardingData.kingdomName, // Using kingdom name as the adventure identifier
        householdSetup: {
          hasPets: onboardingData.hasPets,
          petTypes: onboardingData.petTypes,
          hasVehicle: onboardingData.hasVehicle,
          vehicleSharing: onboardingData.vehicleSharing,
          livingSituation: onboardingData.livingSituation,
          householdSize: onboardingData.householdSize,
          hasChildren: onboardingData.hasChildren,
          hasElderly: onboardingData.hasElderly,
          hasSpecialNeeds: onboardingData.hasSpecialNeeds,
          specialNeedsDetails: onboardingData.specialNeedsDetails
        },
        preferences: {
          difficulty: onboardingData.difficultyPreference,
          notifications: onboardingData.notificationPreferences
        }
      });
      
      // We need to get the player's actual name for the user account
      // For now, we'll prompt them or use kingdom name
      const playerName = prompt('What\'s your name for the game?') || onboardingData.kingdomName;
      
      // Create user account
      const userResponse = await axios.post(`${API}/users`, {
        displayName: playerName,
        coupleCode: response.data.inviteCode
      });
      
      localStorage.setItem('currentUser', JSON.stringify(userResponse.data));
      setCurrentUser(userResponse.data);
      setShowEnhancedOnboarding(false);
      
      // Success! User is now logged in and should see the main game
      console.log('🎉 Adventure created successfully!', userResponse.data);
      console.log('🎯 User state updated, should show main game now');
      
      // Load game data for the new user
      await loadGameData(userResponse.data);
      
    } catch (error) {
      console.error('Error creating enhanced adventure:', error);
      alert('Error creating adventure: ' + (error.response?.data?.detail || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const calculateTaskPoints = (task, bonusPoints = 0) => {
    // Step 1: Base points from task difficulty
    let totalPoints = DIFFICULTY_POINTS[task.difficulty] || 5;
    
    // Step 2: Apply point_bonus nodes (direct point additions)
    const unlockedNodes = currentUser.talentBuild?.nodeIds || [];
    let pointBonuses = 0;
    
    unlockedNodes.forEach(nodeId => {
      const node = TALENT_TREE_NODES[nodeId];
      if (!node || node.type !== 'point_bonus') return;
      
      // Check if this node applies to current task
      if (node.scope.startsWith('room:') && node.scope.split(':')[1] === task.room) {
        // Room-specific bonus (e.g., "room:Kitchen")
        if (node.id === 'eff_qw1' && task.difficulty === 'EASY') {
          // Quick Wipe: +1 point on EASY kitchen tasks
          pointBonuses += node.value;
        } else {
          pointBonuses += node.value;
        }
      } else if (node.scope.startsWith('taskTag:')) {
        // Task tag bonus (e.g., "taskTag:laundry")
        const tag = node.scope.split(':')[1];
        if (task.tags && task.tags.includes(tag)) {
          pointBonuses += node.value;
        }
      } else if (node.scope.startsWith('taskId:') && node.scope.split(':')[1] === task.taskId) {
        // Specific task bonus (e.g., "taskId:us_hug")
        pointBonuses += node.value;
      } else if (node.scope.startsWith('time:before10am')) {
        // Early Bird bonus: +5 points if completed before 10AM
        const now = new Date();
        if (now.getHours() < 10) {
          pointBonuses += node.value;
        }
      }
    });
    
    // Step 3: Add point bonuses and external bonus points
    totalPoints += pointBonuses + bonusPoints;
    
    // Step 4: Apply multipliers
    let multiplier = 1.0;
    
    unlockedNodes.forEach(nodeId => {
      const node = TALENT_TREE_NODES[nodeId];
      if (!node || node.type !== 'multiplier') return;
      
      if (node.scope === 'global') {
        // Global multipliers (like Housekeeper's Edge capstone)
        multiplier *= (1 + node.value);
      } else if (node.scope.startsWith('taskTag:') && task.tags) {
        // Tag-specific multipliers
        const tag = node.scope.split(':')[1];
        if (task.tags.includes(tag)) {
          multiplier *= (1 + node.value);
        }
      }
    });
    
    // Step 5: Apply multipliers and round
    totalPoints = Math.round(totalPoints * multiplier);
    
    // Step 6: Apply Housekeeper's Edge final +10% if active (done in step 4)
    // This is already included in the global multiplier logic above
    
    return {
      basePoints: DIFFICULTY_POINTS[task.difficulty] || 5,
      bonusPoints: pointBonuses + bonusPoints,
      multiplier: multiplier,
      totalPoints: totalPoints,
      breakdown: {
        base: DIFFICULTY_POINTS[task.difficulty] || 5,
        talentBonuses: pointBonuses,
        externalBonuses: bonusPoints,
        multiplierApplied: multiplier !== 1.0 ? `×${multiplier.toFixed(2)}` : null
      }
    };
  };

  const handleQuestComplete = async (task, bonusPoints = 0) => {
    try {
      // Calculate points with talent tree effects
      const pointsCalc = calculateTaskPoints(task, bonusPoints);
      
      const response = await axios.post(`${API}/tasks/${task.taskId}/complete`, {
        userId: currentUser.userId,
        bonusPoints: pointsCalc.totalPoints - pointsCalc.basePoints,
        verificationData: { 
          method: 'manual', 
          timestamp: new Date().toISOString(),
          pointsBreakdown: pointsCalc.breakdown
        }
      });

      // Update user data
      if (currentUser) {
        const userResponse = await axios.get(`${API}/users/${currentUser.userId}`);
        setCurrentUser(userResponse.data);
        localStorage.setItem('currentUser', JSON.stringify(userResponse.data));
      }
      
      // Show detailed celebration with breakdown
      const breakdown = pointsCalc.breakdown;
      let message = `🎉 +${pointsCalc.totalPoints} XP!`;
      
      if (breakdown.talentBonuses > 0) {
        message += ` (${breakdown.base} base + ${breakdown.talentBonuses} talent bonuses`;
        if (breakdown.externalBonuses > 0) message += ` + ${breakdown.externalBonuses} verification`;
        if (breakdown.multiplierApplied) message += ` ${breakdown.multiplierApplied}`;
        message += ')';
      }
      
      setCelebrationMessage(message);
      setTimeout(() => setCelebrationMessage(''), 4000);

    } catch (error) {
      console.error('Error completing quest:', error);
      alert('Error completing quest. Please try again!');
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
            onClick={() => {
              console.log('🚀 DIRECT TO ENHANCED ONBOARDING!');
              setShowEnhancedOnboarding(true);
            }} 
            size="lg" 
            className="text-xl px-8 py-4 bg-white text-purple-600 hover:bg-gray-100 font-bold shadow-2xl"
          >
            Begin Adventure! 🚀
          </Button>
        </div>
        <EpicAdventureModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)} 
          onSuccess={handleAuthSuccess}
          onEnhancedOnboarding={() => {
            console.log('🚀 ENHANCED ONBOARDING CLICKED!');
            console.log('Current states - Auth:', showAuth, 'Enhanced:', showEnhancedOnboarding);
            setShowAuth(false);
            setTimeout(() => {
              console.log('⏰ Setting enhanced onboarding to TRUE');
              setShowEnhancedOnboarding(true);
              console.log('✅ Enhanced onboarding state set to true');
            }, 100);
          }}
        />
        <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  const levelProgress = (currentUser.points % LEVEL_UP_POINTS / LEVEL_UP_POINTS) * 100;

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('hasSeenOnboarding');
    setCurrentUser(null);
    setPartner(null);
    setTasks({});
    setShowAuth(true);
  };

  // Get couple data for NES interface
  const getCoupleData = () => {
    if (currentUser && partner) {
      return {
        coupleId: currentUser.coupleId,
        creatorName: currentUser.displayName,
        partnerName: partner.displayName,
        isActive: true
      };
    }
    return {
      coupleId: currentUser?.coupleId,
      creatorName: currentUser?.displayName,
      partnerName: 'Partner',
      isActive: false
    };
  };

  // Show NES Interface if enabled
  if (showNESInterface && currentUser) {
    return (
      <div>
        {/* Celebration Notification */}
        {celebrationMessage && (
          <div className="fixed top-4 right-4 bg-gradient-to-r from-green-400 to-blue-500 text-white p-4 rounded-lg shadow-2xl z-50 animate-bounce">
            {celebrationMessage}
          </div>
        )}
        
        {/* Toggle UI Button */}
        <button 
          onClick={() => setShowNESInterface(false)}
          className="fixed top-4 left-4 z-50 bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700"
        >
          Switch to Classic UI
        </button>

        <NESGameInterface 
          user={currentUser}
          couple={getCoupleData()}
          onLogout={handleLogout}
        />
      </div>
    );
  }

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
              
              <Button 
                onClick={() => setShowNESInterface(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2"
              >
                🎮 NES Mode
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Clean Interface */}
      <div className="flex max-w-7xl mx-auto">
        {/* Side Navigation */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">📋 Navigation</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('today')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'today' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📅 Today's Chores
              </button>
              
              <button
                onClick={() => setActiveTab('all')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'all' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🏠 All Chores
              </button>
              
              <button
                onClick={() => setActiveTab('games')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'games' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🎮 Couple Games
              </button>
              
              <button
                onClick={() => setActiveTab('talents')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'talents' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🌳 Talent Tree
              </button>
              
              <button
                onClick={() => setActiveTab('manage')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'manage' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                ⚙️ Manage Chores
              </button>
            </div>
          </div>

          {/* Room Filters (for all chores view) */}
          {(activeTab === 'all' || activeTab === 'today') && (
            <div className="p-4 border-t">
              <h4 className="text-sm font-bold mb-3 text-gray-600 uppercase">🏠 Rooms</h4>
              <div className="space-y-1">
                {Object.entries(ROOMS).map(([roomKey, room]) => (
                  <button
                    key={roomKey}
                    onClick={() => setSelectedRoom(roomKey)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      selectedRoom === roomKey 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {room.emoji} {room.name}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedRoom('all')}
                  className={`w-full text-left p-2 rounded text-sm transition-colors ${
                    selectedRoom === 'all' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📋 All Rooms
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {/* Today's Chores */}
          {activeTab === 'today' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">📅 Today's Assigned Chores</h2>
                <div className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <CheckboxChoreList 
                  tasks={selectedRoom === 'all' ? Object.values(tasks).flat() : (tasks[selectedRoom] || [])}
                  currentUser={currentUser}
                  partner={partner}
                  onComplete={handleQuestComplete}
                  isToday={true}
                />
              </div>
            </div>
          )}

          {/* All Chores Management */}
          {activeTab === 'all' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">🏠 All Household Chores</h2>
                <Button 
                  onClick={() => setShowAddChore(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ Add Custom Chore
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <CheckboxChoreList 
                  tasks={selectedRoom === 'all' ? Object.values(tasks).flat() : (tasks[selectedRoom] || [])}
                  currentUser={currentUser}
                  partner={partner}
                  onComplete={handleQuestComplete}
                  showEdit={true}
                />
              </div>
            </div>
          )}

          {/* Couple Games */}
          {activeTab === 'games' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">🎮 Couple Games</h2>
              <CoupleGamesInterface 
                currentUser={currentUser}
                partner={partner}
                onGameComplete={handleQuestComplete}
              />
            </div>
          )}

          {/* Talent Tree */}
          {activeTab === 'talents' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">🌳 Talent Tree</h2>
              <VisualTalentTree 
                currentUser={currentUser} 
                onNodeUnlock={handleTalentUnlock} 
              />
            </div>
          )}

          {/* Manage Chores */}
          {activeTab === 'manage' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">⚙️ Manage Chores</h2>
              <ChoreManagement 
                tasks={tasks}
                setTasks={setTasks}
                currentUser={currentUser}
              />
            </div>
          )}
        </div>
      </div>

      {/* Onboarding */}
      <OnboardingModal isOpen={showOnboarding} onComplete={handleOnboardingComplete} />
      
      {/* Enhanced Onboarding */}
      <EnhancedOnboarding 
        isOpen={showEnhancedOnboarding} 
        onComplete={handleEnhancedOnboardingComplete}
        onClose={() => setShowEnhancedOnboarding(false)}
      />
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