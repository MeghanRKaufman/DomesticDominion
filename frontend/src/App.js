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

// New 10-Tier Talent Tree System (Domestic Dominion)
const TALENT_TREE_NODES = {
  // ===== HOUSEKEEPING HEROES (Country I: Sanctum of Stewardry) =====
  // Free Tiers 1-5
  "hh_dish_duty": {
    id: "hh_dish_duty",
    name: "Dish Duty",
    branch: "Housekeeping",
    tier: 1,
    cost: 1,
    description: "+5 pts each time you log dishwashing within 12 hrs of meal",
    effect: { type: "time_bonus", category: "dishwashing", time_window: 12, bonus: 5 },
    prerequisites: [],
    position: { x: 100, y: 50 },
    premium: false
  },
  "hh_laundry_legends": {
    id: "hh_laundry_legends",
    name: "Laundry Legends",
    branch: "Housekeeping",
    tier: 2,
    cost: 2,
    description: "+10% point bonus when laundry is folded same day",
    effect: { type: "category_multiplier", category: "laundry", condition: "same_day", multiplier: 1.1 },
    prerequisites: ["hh_dish_duty"],
    position: { x: 100, y: 120 },
    premium: false
  },
  "hh_pet_patrol": {
    id: "hh_pet_patrol",
    name: "Pet Patrol",
    branch: "Housekeeping",
    tier: 3,
    cost: 2,
    description: "Unlocks pet task tracking (feeding, litter box, walks, meds)",
    effect: { type: "unlock_category", category: "pet_tasks", tasks: ["feeding", "litter", "walks", "medication"] },
    prerequisites: ["hh_laundry_legends"],
    position: { x: 100, y: 190 },
    premium: false
  },
  "hh_vehicle_vanguard": {
    id: "hh_vehicle_vanguard",
    name: "Vehicle Vanguard",
    branch: "Housekeeping",
    tier: 4,
    cost: 2,
    description: "Unlocks car-related tasks (oil check, gas fill, cleaning)",
    effect: { type: "unlock_category", category: "vehicle_tasks", tasks: ["oil_check", "gas_fill", "car_cleaning", "maintenance"] },
    prerequisites: ["hh_pet_patrol"],
    position: { x: 100, y: 260 },
    premium: false
  },
  "hh_tag_team_clean": {
    id: "hh_tag_team_clean",
    name: "Tag Team Clean",
    branch: "Housekeeping",
    tier: 5,
    cost: 3,
    description: "Bonus for completing a chore within 2 hrs of partner's",
    effect: { type: "partner_sync_bonus", time_window: 2, bonus_multiplier: 1.2 },
    prerequisites: ["hh_vehicle_vanguard"],
    position: { x: 100, y: 330 },
    premium: false
  },
  // Premium Tiers 6-10
  "hh_efficiency_expert": {
    id: "hh_efficiency_expert",
    name: "Efficiency Expert",
    branch: "Housekeeping",
    tier: 6,
    cost: 3,
    description: "+15% base points when completing 3+ chores in a row",
    effect: { type: "streak_bonus", min_streak: 3, multiplier: 1.15 },
    prerequisites: ["hh_tag_team_clean"],
    position: { x: 100, y: 400 },
    premium: true
  },
  "hh_sanctuary_sensei": {
    id: "hh_sanctuary_sensei",
    name: "Sanctuary Sensei",
    branch: "Housekeeping",
    tier: 7,
    cost: 3,
    description: "Partner receives a calm-day bonus if all rooms logged",
    effect: { type: "partner_bonus", condition: "all_rooms_complete", bonus: "calm_day" },
    prerequisites: ["hh_efficiency_expert"],
    position: { x: 100, y: 470 },
    premium: true
  },
  "hh_green_guardian": {
    id: "hh_green_guardian",
    name: "Green Guardian",
    branch: "Housekeeping",
    tier: 8,
    cost: 4,
    description: "Track and reward eco-actions (recycling, low water use)",
    effect: { type: "unlock_category", category: "eco_tasks", bonus_multiplier: 1.25 },
    prerequisites: ["hh_sanctuary_sensei"],
    position: { x: 100, y: 540 },
    premium: true
  },
  "hh_homebound_hero": {
    id: "hh_homebound_hero",
    name: "Homebound Hero",
    branch: "Housekeeping",
    tier: 9,
    cost: 4,
    description: "Gain 2x points for weekend home reset routines",
    effect: { type: "time_multiplier", days: ["saturday", "sunday"], category: "home_reset", multiplier: 2.0 },
    prerequisites: ["hh_green_guardian"],
    position: { x: 100, y: 610 },
    premium: true
  },
  "hh_keeper_of_keep": {
    id: "hh_keeper_of_keep",
    name: "Keeper of the Keep",
    branch: "Housekeeping",
    tier: 10,
    cost: 5,
    description: "Auto-completes one daily low-value task when you reach 100% partner approval for a week",
    effect: { type: "mastery_autocomplete", condition: "100_percent_approval", duration: "week" },
    prerequisites: ["hh_homebound_hero"],
    position: { x: 100, y: 680 },
    premium: true
  },
  
  // ===== COUPLING QUESTLINE (Country II: The Heartlands of Concord) =====
  // Free Tiers 1-5
  "cq_quality_quest": {
    id: "cq_quality_quest",
    name: "Quality Quest",
    branch: "Coupling",
    tier: 1,
    cost: 1,
    description: "+10 pts for shared activities logged (dinner, show, walk)",
    effect: { type: "category_bonus", category: "shared_activities", bonus: 10 },
    prerequisites: [],
    position: { x: 300, y: 50 },
    premium: false
  },
  "cq_compliment_chain": {
    id: "cq_compliment_chain",
    name: "Compliment Chain",
    branch: "Coupling",
    tier: 2,
    cost: 2,
    description: "Consecutive days of positive notes grant streak bonus",
    effect: { type: "streak_bonus", category: "positive_notes", bonus_per_day: 2 },
    prerequisites: ["cq_quality_quest"],
    position: { x: 300, y: 120 },
    premium: false
  },
  "cq_shared_goal_setter": {
    id: "cq_shared_goal_setter",
    name: "Shared Goal Setter",
    branch: "Coupling",
    tier: 3,
    cost: 2,
    description: "Unlocks weekly 'Team Quest' board",
    effect: { type: "unlock_feature", feature: "team_quest_board", frequency: "weekly" },
    prerequisites: ["cq_compliment_chain"],
    position: { x: 300, y: 190 },
    premium: false
  },
  "cq_verification_bonus": {
    id: "cq_verification_bonus",
    name: "Verification Bonus",
    branch: "Coupling",
    tier: 4,
    cost: 2,
    description: "+5 pts for partner-verified tasks",
    effect: { type: "verification_bonus", bonus: 5 },
    prerequisites: ["cq_shared_goal_setter"],
    position: { x: 300, y: 260 },
    premium: false
  },
  "cq_take_one_for_love": {
    id: "cq_take_one_for_love",
    name: "Take One For Love",
    branch: "Coupling",
    tier: 5,
    cost: 3,
    description: "Option to take partner's task for 3x reward",
    effect: { type: "takeover_multiplier", multiplier: 3.0 },
    prerequisites: ["cq_verification_bonus"],
    position: { x: 300, y: 330 },
    premium: false
  },
  // Premium Tiers 6-10
  "cq_bond_builder": {
    id: "cq_bond_builder",
    name: "Bond Builder",
    branch: "Coupling",
    tier: 6,
    cost: 3,
    description: "+20% points if both partners complete a quest within 2 hrs",
    effect: { type: "partner_sync_bonus", time_window: 2, multiplier: 1.2 },
    prerequisites: ["cq_take_one_for_love"],
    position: { x: 300, y: 400 },
    premium: true
  },
  "cq_empathy_echo": {
    id: "cq_empathy_echo",
    name: "Empathy Echo",
    branch: "Coupling",
    tier: 7,
    cost: 3,
    description: "Each compliment written adds +1 to partner's morale meter",
    effect: { type: "partner_morale_bonus", bonus_per_compliment: 1 },
    prerequisites: ["cq_bond_builder"],
    position: { x: 300, y: 470 },
    premium: true
  },
  "cq_harmony_halo": {
    id: "cq_harmony_halo",
    name: "Harmony Halo",
    branch: "Coupling",
    tier: 8,
    cost: 4,
    description: "Negative logs are rephrased automatically into growth notes",
    effect: { type: "message_filter", filter_type: "negative_to_growth" },
    prerequisites: ["cq_empathy_echo"],
    position: { x: 300, y: 540 },
    premium: true
  },
  "cq_unity_upgrade": {
    id: "cq_unity_upgrade",
    name: "Unity Upgrade",
    branch: "Coupling",
    tier: 9,
    cost: 4,
    description: "Unlocks 'dual chores' (tasks only rewardable when done together)",
    effect: { type: "unlock_category", category: "dual_chores", requirement: "both_partners" },
    prerequisites: ["cq_harmony_halo"],
    position: { x: 300, y: 610 },
    premium: true
  },
  "cq_soul_sync": {
    id: "cq_soul_sync",
    name: "Soul Sync",
    branch: "Coupling",
    tier: 10,
    cost: 5,
    description: "Permanently doubles verification rewards if relationship satisfaction stays above 80% for a month",
    effect: { type: "mastery_verification_double", condition: "80_percent_satisfaction", duration: "month" },
    prerequisites: ["cq_unity_upgrade"],
    position: { x: 300, y: 680 },
    premium: true
  },
  
  // ===== PERSONAL GROWTH PATH (Country III: The Realm of Resonance) =====
  // Free Tiers 1-5
  "pg_routine_rookie": {
    id: "pg_routine_rookie",
    name: "Routine Rookie",
    branch: "Growth",
    tier: 1,
    cost: 1,
    description: "+5 pts for every 3-day streak of all tasks completed",
    effect: { type: "streak_bonus", streak_length: 3, bonus: 5 },
    prerequisites: [],
    position: { x: 500, y: 50 },
    premium: false
  },
  "pg_reflective_learner": {
    id: "pg_reflective_learner",
    name: "Reflective Learner",
    branch: "Growth",
    tier: 2,
    cost: 2,
    description: "Unlocks daily self-question prompts",
    effect: { type: "unlock_feature", feature: "daily_self_questions", frequency: "daily" },
    prerequisites: ["pg_routine_rookie"],
    position: { x: 500, y: 120 },
    premium: false
  },
  "pg_zen_mode": {
    id: "pg_zen_mode",
    name: "Zen Mode",
    branch: "Growth",
    tier: 3,
    cost: 2,
    description: "Choose 1 day a week to skip non-critical tasks with no penalty",
    effect: { type: "skip_allowance", frequency: "weekly", task_type: "non_critical" },
    prerequisites: ["pg_reflective_learner"],
    position: { x: 500, y: 190 },
    premium: false
  },
  "pg_mindful_mirror": {
    id: "pg_mindful_mirror",
    name: "Mindful Mirror",
    branch: "Growth",
    tier: 4,
    cost: 2,
    description: "+10 pts for self-evaluation that matches partner's rating",
    effect: { type: "partner_alignment_bonus", bonus: 10 },
    prerequisites: ["pg_zen_mode"],
    position: { x: 500, y: 260 },
    premium: false
  },
  "pg_mood_manager": {
    id: "pg_mood_manager",
    name: "Mood Manager",
    branch: "Growth",
    tier: 5,
    cost: 3,
    description: "+10% points if all logs remain positive for a week",
    effect: { type: "positivity_bonus", duration: "week", multiplier: 1.1 },
    prerequisites: ["pg_mindful_mirror"],
    position: { x: 500, y: 330 },
    premium: false
  },
  // Premium Tiers 6-10
  "pg_self_soother": {
    id: "pg_self_soother",
    name: "Self-Soother",
    branch: "Growth",
    tier: 6,
    cost: 3,
    description: "Unlocks 'calm break' feature to pause your partner's critique for 24 hrs",
    effect: { type: "pause_critiques", duration: 24, frequency: "as_needed" },
    prerequisites: ["pg_mood_manager"],
    position: { x: 500, y: 400 },
    premium: true
  },
  "pg_balance_buff": {
    id: "pg_balance_buff",
    name: "Balance Buff",
    branch: "Growth",
    tier: 7,
    cost: 3,
    description: "+10% base points on days with both self and partner quests complete",
    effect: { type: "balance_bonus", requirement: "both_quest_types", multiplier: 1.1 },
    prerequisites: ["pg_self_soother"],
    position: { x: 500, y: 470 },
    premium: true
  },
  "pg_growth_guardian": {
    id: "pg_growth_guardian",
    name: "Growth Guardian",
    branch: "Growth",
    tier: 8,
    cost: 4,
    description: "Unlocks mini-quests like journaling, meditation, or gratitude",
    effect: { type: "unlock_category", category: "mindfulness_quests", types: ["journaling", "meditation", "gratitude"] },
    prerequisites: ["pg_balance_buff"],
    position: { x: 500, y: 540 },
    premium: true
  },
  "pg_altruist_aura": {
    id: "pg_altruist_aura",
    name: "Altruist Aura",
    branch: "Growth",
    tier: 9,
    cost: 4,
    description: "2x points for doing tasks that directly benefit your partner's comfort",
    effect: { type: "altruism_multiplier", multiplier: 2.0, target: "partner_comfort" },
    prerequisites: ["pg_growth_guardian"],
    position: { x: 500, y: 610 },
    premium: true
  },
  "pg_enlightened_partner": {
    id: "pg_enlightened_partner",
    name: "Enlightened Partner",
    branch: "Growth",
    tier: 10,
    cost: 5,
    description: "Gain 1 free 'Zen Token' weekly, which lets you skip or swap a task without penalty and gift that break to your partner",
    effect: { type: "mastery_zen_token", frequency: "weekly", benefits: ["skip_task", "swap_task", "gift_partner"] },
    prerequisites: ["pg_altruist_aura"],
    position: { x: 500, y: 680 },
    premium: true
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
      title: "Welcome to Domestic Dominion! 🏰",
      content: "Transform your household tasks into epic quests for you and your partner!",
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
  const [activeTab, setActiveTab] = useState('my-chores');
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('my-chores');
  const [myDailyChores, setMyDailyChores] = useState([]);
  const [allChores, setAllChores] = useState([]);
  const [partnerChores, setPartnerChores] = useState([]);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showNESInterface, setShowNESInterface] = useState(false); // Disable NES theme by default per user request
  const [showEnhancedOnboarding, setShowEnhancedOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);
  
  // Pi Integration State
  const [messageText, setMessageText] = useState('');
  const [enhancedMessage, setEnhancedMessage] = useState('');
  const [enhancementData, setEnhancementData] = useState(null);
  const [enhancementLevel, setEnhancementLevel] = useState('moderate');
  const [preserveStyle, setPreserveStyle] = useState(true);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showPiSettings, setShowPiSettings] = useState(false);
  const [hasDailyMessage, setHasDailyMessage] = useState(false);
  
  // All Chores Sorting State
  const [sortBy, setSortBy] = useState('room');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterBy, setFilterBy] = useState('all');
  const [questCategory, setQuestCategory] = useState('domestic');
  
  // Daily Question and Pi Suggestions
  const [dailyQuestion, setDailyQuestion] = useState('');
  const [piMessageSuggestion, setPiMessageSuggestion] = useState('');

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

  // Initialize app and populate chores
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
    
    // Always generate a comprehensive chore library for the All Chores tab
    generateComprehensiveQuestLibrary();
    
    // Generate daily question and Pi suggestion
    generateDailyQuestionAndSuggestion();
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

  // Load messages when user changes
  useEffect(() => {
    if (currentUser?.coupleId) {
      loadMessages();
      checkDailyMessageStatus();
    }
  }, [currentUser]);

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${currentUser.coupleId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const checkDailyMessageStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${API}/messages/${currentUser.coupleId}/daily-status?date=${today}&user_id=${currentUser.userId}`);
      setHasDailyMessage(response.data.has_daily_message);
    } catch (error) {
      console.error('Error checking daily message status:', error);
    }
  };

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

  // Daily Questions and Pi Message Suggestions
  const generateDailyQuestionAndSuggestion = () => {
    const questions = [
      "What's one thing your partner did recently that made you smile?",
      "How can you make your partner feel more appreciated today?", 
      "What's a small way you could surprise your partner this week?",
      "What's your favorite memory with your partner from this month?",
      "How has your partner supported you recently?",
      "What's one thing you're grateful for about your living space?",
      "What household task could you turn into quality time together?",
      "What's one way you've grown as a partner recently?",
      "How can you better support your partner's goals today?",
      "What's something you love about your daily routine together?"
    ];
    
    const piSuggestions = [
      "I've been thinking about how much I appreciate having you as my teammate in keeping our home running smoothly.",
      "Thank you for being so patient with me as we work together to create the life we both want.",
      "I love how we're turning everyday tasks into opportunities to support each other.",
      "You make even the mundane household stuff feel more meaningful just by being my partner in it.",
      "I'm grateful for how we're building something beautiful together, one small task at a time.",
      "Thank you for choosing to create this life with me - it means everything.",
      "I love how we're learning to be better teammates every day.",
      "You make our home feel like the best place in the world to be.",
      "I appreciate how thoughtful you are about the little things that make our house a home.",
      "Thank you for being willing to grow and learn alongside me in this adventure we call life."
    ];
    
    setDailyQuestion(questions[Math.floor(Math.random() * questions.length)]);
    setPiMessageSuggestion(piSuggestions[Math.floor(Math.random() * piSuggestions.length)]);
  };

  // Generate comprehensive quest library with 250+ amazing tasks
  const generateComprehensiveQuestLibrary = () => {
    const comprehensiveChoreList = [
      // ===== DOMESTIC DUTIES ===== (Household management and maintenance)
      { id: 'dishes', title: '🍽️ Do the dishes', room: 'Kitchen', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'counter_wipe', title: '🧽 Wipe counters', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'trash', title: '🗑️ Take out trash', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'sweep_kitchen', title: '🧹 Sweep kitchen floor', room: 'Kitchen', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'mop_kitchen', title: '🧽 Mop kitchen floor', room: 'Kitchen', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'clean_stove', title: '🔥 Clean stovetop', room: 'Kitchen', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'clean_microwave', title: '📟 Clean microwave', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'domestic' },
      { id: 'clean_fridge', title: '❄️ Clean out refrigerator', room: 'Kitchen', points: 20, difficulty: 'HARD', category: 'domestic' },
      { id: 'organize_pantry', title: '📦 Organize pantry', room: 'Kitchen', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'vacuum_living', title: '🌪️ Vacuum living room', room: 'Living Room', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'dust_surfaces', title: '🧽 Dust surfaces', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'domestic' },
      { id: 'organize_clutter', title: '📦 Organize clutter', room: 'Living Room', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'clean_windows', title: '🪟 Clean windows', room: 'Living Room', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'vacuum_couch', title: '🛋️ Vacuum couch cushions', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'domestic' },
      { id: 'clean_toilet', title: '🚽 Clean toilet', room: 'Bathroom', points: 15, difficulty: 'HARD', category: 'domestic' },
      { id: 'clean_shower', title: '🛁 Clean shower/bathtub', room: 'Bathroom', points: 20, difficulty: 'HARD', category: 'domestic' },
      { id: 'clean_sink', title: '🚿 Clean bathroom sink', room: 'Bathroom', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'mop_bathroom', title: '🧽 Mop bathroom floor', room: 'Bathroom', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'clean_mirror', title: '🪞 Clean bathroom mirror', room: 'Bathroom', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'restock_supplies', title: '🧴 Restock bathroom supplies', room: 'Bathroom', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'make_bed', title: '🛏️ Make the bed', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'laundry', title: '👕 Do laundry', room: 'Bedroom', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'fold_clothes', title: '👔 Fold and put away clothes', room: 'Bedroom', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'vacuum_bedroom', title: '🌪️ Vacuum bedroom', room: 'Bedroom', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'organize_closet', title: '👗 Organize closet', room: 'Bedroom', points: 20, difficulty: 'HARD', category: 'domestic' },
      { id: 'change_sheets', title: '🛏️ Change bed sheets', room: 'Bedroom', points: 15, difficulty: 'MEDIUM', category: 'domestic' },
      { id: 'water_plants', title: '🪴 Water plants', room: 'Living Room', points: 5, difficulty: 'EASY', category: 'domestic' },
      { id: 'dust_electronics', title: '📺 Dust electronics', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'domestic' },
      { id: 'organize_mail', title: '📬 Organize mail/bills', room: 'Living Room', points: 10, difficulty: 'MEDIUM', category: 'domestic' },
      
      // ===== 100 US QUESTS ===== (Acts of Service & Love)
      // Acts of Service
      { id: 'us_morning_drink', title: '☕ Bring partner their morning drink', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_prep_snack', title: '🥪 Pack or prep their snack/meal', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_fold_laundry', title: '👕 Fold one piece of their laundry', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_warm_blanket', title: '🛏️ Warm their blanket or bed', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_brush_hair', title: '✨ Brush or braid their hair', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_run_bath', title: '🛁 Run a bath/shower for them', room: 'Bathroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_tidy_space', title: '🧹 Tidy their personal space', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_charge_device', title: '🔋 Plug in their phone/device', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_set_vitamins', title: '💊 Set out vitamins/meds', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_togo_drink', title: '🥤 Make to-go drink before they leave', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_warm_towel', title: '🔥 Warm up their shower towel', room: 'Bathroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_comfy_clothes', title: '👔 Lay out comfy clothes', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_refill_water', title: '💧 Refill their water glass/bottle', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_cozy_pillow', title: '🛋️ Make their pillow spot extra cozy', room: 'Living Room', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_fetch_item', title: '🏃 Grab something from another room', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_clean_glasses', title: '👓 Clean their glasses/screen', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_get_mail', title: '📬 Fetch mail/package for them', room: 'Outdoors', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_small_treat', title: '🍓 Bring them a small treat', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_help_jewelry', title: '💎 Help with jewelry/accessories', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_takeover_task', title: '🤝 Take over one task they dislike', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      
      // Affection & Comfort
      { id: 'us_5min_massage', title: '💆 Give 5-minute massage', room: 'Bedroom', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_60sec_hug', title: '🤗 Hug heart-to-heart for 60 seconds', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_forehead_kiss', title: '😘 Forehead kiss with kind words', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_rub_back', title: '🤲 Rub their back while talking', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_unexpected_kiss', title: '💋 Kiss hand/cheek unexpectedly', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_scratch_back', title: '🤚 Scratch their back for 3 minutes', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_stroke_hair', title: '✨ Stroke their hair/face gently', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_hold_hands', title: '🤝 Hold hands for 2 minutes silently', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_wrap_arms', title: '🫂 Sit behind and wrap arms around waist', room: 'Living Room', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_tuck_in', title: '🛏️ Tuck them in if lying down', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      
      // Words & Affirmations  
      { id: 'us_sweet_text', title: '📱 Send sweet text without prompting', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_voice_note', title: '🎤 Record kind voice note', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_compliment_intelligence', title: '🧠 Compliment their intelligence/humor', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_reason_love', title: '❤️ Tell specific reason you love them', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_love_note', title: '💌 Write two-sentence love note', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_whisper_compliment', title: '👂 Whisper compliment in their ear', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_proud_because', title: '🏆 Say "I\'m proud of you because..."', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_acknowledge_work', title: '💪 Acknowledge their hard work', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_public_compliment', title: '👥 Publicly compliment them', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_life_easier', title: '🌟 Tell them what makes your life easier', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      
      // Playful & Fun Acts
      { id: 'us_mini_game', title: '🎮 Offer spontaneous game/challenge', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_fun_nickname', title: '😄 Give them fun nickname for day', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_inside_joke', title: '😂 Make up silly inside joke', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_surprise_note', title: '📝 Hide surprise note to find', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_happiness_spell', title: '✨ Cast "spell of happiness"', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_draw_doodle', title: '🎨 Draw doodle representing today', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_sing_song', title: '🎵 Sing short made-up song', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_mood_gif', title: '📱 Send GIF matching their mood', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_fake_award', title: '🏅 Write funny fake award certificate', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_backrub_coupon', title: '🎫 Offer free back rub coupon', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      
      // Intention & Care
      { id: 'us_what_need', title: '🤔 Ask "What do you need right now?"', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_mental_checkin', title: '🧠 Check in about mental feelings', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_whats_on_mind', title: '💭 Ask what\'s been on their mind', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_just_listen', title: '👂 Offer to listen - no advice', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_help_decompress', title: '😌 Ask "How can I help you decompress?"', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_remind_goals', title: '🎯 Remind them of their goals', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_gentle_reassurance', title: '💪 Offer gentle reassurance', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_what_inspires', title: '✨ Tell them what inspires you about them', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_rephrase_kindly', title: '🌱 Rephrase critique constructively', room: 'Anywhere', points: 20, difficulty: 'HARD', category: 'team-building' },
      { id: 'us_genuine_apology', title: '🙏 Offer genuine apology if snappy', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      
      // Nurturing Energy
      { id: 'us_cover_blanket', title: '🛌 Cover them with blanket if sleeping', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_forehead_rest', title: '😘 Kiss forehead while they rest', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_bring_drink_work', title: '☕ Bring drink while they work', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_brush_lint', title: '👔 Brush lint off their shirt', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_play_favorite_song', title: '🎵 Play their favorite song nearby', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_warm_hands', title: '🤲 Warm their hands with yours', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_nice_environment', title: '✨ Quietly make environment nicer', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_adjust_comfort', title: '💡 Adjust lighting/volume for comfort', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_quiet_or_company', title: '🤫 Ask if they need quiet or company', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_stretch_together', title: '🤸 Offer to stretch together', room: 'Living Room', points: 15, difficulty: 'EASY', category: 'team-building' },
      
      // Deep Connection
      { id: 'us_share_past', title: '📖 Share something new from your past', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_ask_memory', title: '💭 Ask about unshared memory', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_thank_partner', title: '🙏 "Thank you for being my partner"', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_noticed_today', title: '👀 Tell them what you noticed today', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_small_detail_love', title: '💕 Share small detail you love', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_ask_dream', title: '🌟 Ask about current dream/goal', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_better_partner', title: '🤔 Ask how to be better partner today', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_shared_dream', title: '✨ Remind of shared dream/plan', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_feel_lucky', title: '🍀 Tell them you feel lucky to know them', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_thank_recent', title: '🙏 Thank for recent specific thing', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      
      // Appreciation & Encouragement
      { id: 'us_kind_comment', title: '👍 Leave kind comment on their work', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_see_trying', title: '💪 Say "I see how hard you\'re trying"', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_encourage_task', title: '🎯 Encourage before task/event', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_celebrate_finish', title: '🎉 Celebrate something they finished', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_encouraging_text_away', title: '📱 Send encouraging text when away', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_silly_joke_cheer', title: '😄 Cheer up with silly joke', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_compliment_style', title: '👗 Compliment their style', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_help_goal', title: '🎯 Offer to help with personal goal', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_thank_patience', title: '🙏 Thank them for their patience', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_compliment_kindness', title: '💝 Compliment kindness to others', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      
      // Romance & Sentiment
      { id: 'us_hold_face_love', title: '🤲 Hold face and say you love them', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_slow_dance', title: '💃 Offer to slow dance to one song', room: 'Living Room', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_trace_palm', title: '✋ Trace finger on palm while talking', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_poem_line', title: '📝 Write one line "poem" about them', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'team-building' },
      { id: 'us_heart_mirror', title: '❤️ Make heart shape on mirror/window', room: 'Bathroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_gentle_kiss_new', title: '💋 Gentle kiss somewhere new daily', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_nice_scent_pillow', title: '🌸 Leave nice scent on their pillow', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_surprise_touch', title: '🤚 Surprise touch (shoulder, arm)', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_thank_choosing', title: '💕 "Thank you for choosing me"', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      { id: 'us_favorite_part_day', title: '🌟 "You\'re my favorite part of today"', room: 'Anywhere', points: 20, difficulty: 'EASY', category: 'team-building' },
      
      // ===== 100 PERSONAL GROWTH QUESTS ===== (Self-Care & Development)
      // Mind & Mood Regulation
      { id: 'pg_quiet_breathing', title: '🧘 Sit quietly 3 min, notice breathing', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_10_deep_breaths', title: '💨 10 slow breaths before phone', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_write_emotions', title: '📝 Write down 3 emotions felt today', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_name_bothering', title: '🤔 Name what\'s bothering you (no judgment)', room: 'Anywhere', points: 10, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_fresh_air', title: '🌬️ Step outside for fresh air 1 minute', room: 'Outdoors', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_stretch_5min', title: '🤸 Stretch body for 5 minutes', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_cant_control', title: '✍️ Write one thing you can\'t control', room: 'Bedroom', points: 10, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_calming_song', title: '🎵 Listen to calming song', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_silent_2min', title: '🤫 Sit in silence 2 min after task', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_smile_mirror', title: '😊 Smile at yourself in mirror intentionally', room: 'Bathroom', points: 5, difficulty: 'EASY', category: 'self-care' },
      
      // Reflection & Awareness
      { id: 'pg_journal_2sentence', title: '📔 Write 2-sentence journal entry', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_identify_trigger', title: '⚠️ Identify one personal trigger', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_admit_mistake', title: '🙋 Admit one mistake today (to self)', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_handled_well', title: '💪 Reflect on handling something well', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_grateful_partner', title: '💕 Think grateful thought about partner', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_learning_to', title: '🌱 Write "I\'m learning to..."', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_grown_this_year', title: '📈 Think how you\'ve grown this year', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_reframe_negative', title: '🔄 Reframe negative thought to neutral', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_habit_improve', title: '🎯 List one habit to improve', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_forgive_self', title: '🤗 Say one thing you forgive yourself for', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      
      // Organization & Daily Rhythm
      { id: 'pg_make_bed_now', title: '🛏️ Make bed right now', room: 'Bedroom', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_put_away_item', title: '📦 Put one item where it belongs', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_tomorrow_todo', title: '📝 Write 3-item to-do for tomorrow', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_delete_files', title: '🗑️ Delete 3 unnecessary phone files', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_empty_trash', title: '🗑️ Empty trash or clear desk', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_5min_clean', title: '⏰ 5-min timer: clean small area', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_refill_water_now', title: '💧 Refill water bottle now', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_prep_tomorrow', title: '👔 Prep tomorrow\'s outfit/bag', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_put_away_sitting', title: '📦 Put away something sitting out for days', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_finish_tiny_thing', title: '✅ Finish one tiny postponed thing', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      
      // Emotional Growth & Accountability
      { id: 'pg_couldve_better', title: '🤔 Admit something you could\'ve done better', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_gentle_apology', title: '💌 Write gentle apology draft', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_replace_defensive', title: '🔄 Replace defensive thought with curiosity', room: 'Anywhere', points: 15, difficulty: 'HARD', category: 'self-care' },
      { id: 'pg_compliment_partner_mental', title: '💭 Mentally compliment partner despite upset', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_not_raise_voice', title: '🤫 Decide not to raise voice when feeling like it', room: 'Anywhere', points: 20, difficulty: 'HARD', category: 'self-care' },
      { id: 'pg_take_responsibility', title: '💪 Take responsibility for small annoyance', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_let_irritation_go', title: '🕊️ Let one petty irritation go on purpose', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_respond_calmly', title: '😌 Choose to respond calmly vs fast', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_kind_future_self', title: '🤗 Do one kind thing for future self', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_name_emotion_argument', title: '🎭 Name actual emotion from last argument', room: 'Anywhere', points: 15, difficulty: 'HARD', category: 'self-care' },
      
      // Confidence & Self-Worth
      { id: 'pg_write_strength', title: '💪 Write down one strength you\'re proud of', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_acknowledge_accomplishment', title: '🏆 Acknowledge personal accomplishment this week', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_doing_best', title: '🗣️ Say "I\'m doing my best" out loud', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_stand_breathe', title: '🧘 Stand tall, breathe deeply 10 seconds', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_look_kindly_mirror', title: '😊 Look at yourself kindly in mirror', room: 'Bathroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_allowed_rest', title: '😴 Tell yourself "I\'m allowed to rest"', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_set_boundary', title: '🛡️ Set one small boundary and stick to it', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_compliment_perseverance', title: '💪 Compliment your own perseverance', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_honest_affirmation', title: '✨ Write one honest affirmation', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_small_comfort', title: '🎁 Treat yourself to small comfort', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      
      // Relationship-Connected Growth
      { id: 'pg_reread_appreciation', title: '💕 Re-read partner\'s appreciation message', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_taken_granted', title: '🤔 Think what partner does you\'ve taken for granted', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_partner_helps', title: '✍️ Write "My partner helps me..."', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_notice_partner_today', title: '👀 Notice what partner did for you today', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_assume_good_intent', title: '💭 Choose to assume good intent once', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_partner_admires', title: '💫 Write what partner admires about you', room: 'Bedroom', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_communicate_better', title: '📞 Reflect on communicating better', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_made_feel_safe', title: '🛡️ Think time they made you feel safe', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_surprise_them', title: '🎁 Decide way to surprise them this week', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_mentally_thank', title: '🙏 Mentally thank them for unnoticed thing', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      
      // Wellness & Maintenance
      { id: 'pg_mindful_water', title: '💧 Drink full glass water mindfully', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_healthy_snack', title: '🍎 Eat piece of fruit/healthy snack', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_10_stretches', title: '🤸 Do 10 body stretches/light exercises', room: 'Living Room', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_feel_weather', title: '🌤️ Step outside, feel weather 1 minute', room: 'Outdoors', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_roll_shoulders', title: '🔄 Full minute rolling shoulders/neck', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_wash_mindfully', title: '🚿 Wash face/hands slowly, paying attention', room: 'Bathroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_vitamins_ontime', title: '💊 Take vitamins/meds on time', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_5min_nothing', title: '⏰ Spend 5 min doing nothing productive', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_eat_no_phone', title: '🍽️ Sit down eat without phone', room: 'Kitchen', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_water_over_soda', title: '💧 Choose water over soda once today', room: 'Kitchen', points: 10, difficulty: 'EASY', category: 'self-care' },
      
      // Growth Mindset & Learning  
      { id: 'pg_learn_fact', title: '📚 Learn one new fact today', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_educational_3min', title: '🎓 Watch/read educational 3 minutes', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_task_differently', title: '🔄 Try task slightly differently than usual', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_partner_teach', title: '👫 Ask partner to teach you something', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_want_learn', title: '📝 Write one thing you\'d like to learn', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_notice_pattern', title: '🔍 Try to notice pattern you fall into', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_comfort_zone', title: '🚀 Do one thing outside comfort zone', room: 'Anywhere', points: 20, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_research_interest', title: '🔍 Research topic that interests you', room: 'Living Room', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_why_believe', title: '🤔 Ask "Why do I believe that?"', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_motivating_quote', title: '✨ Write one motivating quote', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      
      // Calm & Grounding
      { id: 'pg_texture_10sec', title: '🤚 Focus on liked texture 10 seconds', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_ambient_sounds', title: '🎵 Listen to ambient sounds around', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_smell_pleasant', title: '👃 Smell something pleasant intentionally', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_feel_heartbeat', title: '💓 Sit/lie down, feel your heartbeat', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_look_sky', title: '☁️ Look at sky for 30 seconds', room: 'Outdoors', points: 5, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_eyes_breathe', title: '😌 Close eyes, breathe slowly 5 times', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_321_grounding', title: '👀 3 see, 2 touch, 1 hear grounding', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_muscle_tension', title: '💪 Move muscle groups to release tension', room: 'Living Room', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_comfortable_exist', title: '🧘 Sit comfortably and just exist', room: 'Anywhere', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_barefoot_floor', title: '👣 Take off shoes, feel floor', room: 'Anywhere', points: 5, difficulty: 'EASY', category: 'self-care' },
      
      // Purpose & Motivation
      { id: 'pg_goal_tomorrow', title: '🎯 Write one goal for tomorrow', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_identify_motivation', title: '🔥 Identify one thing that motivates you', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_visualize_success', title: '✨ Visualize succeeding at something small', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_step_toward_dream', title: '👣 Decide step toward dream', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_capable_growth', title: '🌱 Say "I\'m capable of growth"', room: 'Anywhere', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_what_matters_most', title: '💎 Think about what matters most', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_kind_person_want', title: '👤 Tell yourself what kind of person to be', room: 'Anywhere', points: 15, difficulty: 'MEDIUM', category: 'self-care' },
      { id: 'pg_mood_song', title: '🎵 Choose song representing current mood', room: 'Living Room', points: 10, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_lesson_today', title: '📖 Write one lesson from today', room: 'Bedroom', points: 15, difficulty: 'EASY', category: 'self-care' },
      { id: 'pg_thankful_breath', title: '🙏 End day with slow, thankful breath', room: 'Bedroom', points: 10, difficulty: 'EASY', category: 'self-care' },
      
      // ===== PET & VEHICLE TASKS (Basic ones for completion) =====
      { id: 'feed_pets', title: '🍖 Feed pets', room: 'Kitchen', points: 5, difficulty: 'EASY', category: 'pets' },
      { id: 'walk_pets', title: '🐕 Walk pets', room: 'Outdoors', points: 10, difficulty: 'MEDIUM', category: 'pets' },
      { id: 'groom_pets', title: '✂️ Groom pets', room: 'Bathroom', points: 15, difficulty: 'MEDIUM', category: 'pets' },
      { id: 'clean_pet_area', title: '🧽 Clean pet sleeping area', room: 'Living Room', points: 10, difficulty: 'MEDIUM', category: 'pets' },
      { id: 'litter_box', title: '🧹 Clean litter box', room: 'Bathroom', points: 10, difficulty: 'MEDIUM', category: 'pets' },
      { id: 'gas_fillup', title: '⛽ Fill up gas tank', room: 'Vehicle', points: 5, difficulty: 'EASY', category: 'vehicle' },
      { id: 'car_wash', title: '🚗 Wash car exterior', room: 'Vehicle', points: 15, difficulty: 'MEDIUM', category: 'vehicle' },
      { id: 'vacuum_car', title: '🌪️ Vacuum car interior', room: 'Vehicle', points: 10, difficulty: 'MEDIUM', category: 'vehicle' },
      { id: 'check_oil', title: '🛢️ Check oil levels', room: 'Vehicle', points: 5, difficulty: 'EASY', category: 'vehicle' }
    ];

    setAllChores(comprehensiveChoreList);
    console.log('📚 COMPREHENSIVE QUEST LIBRARY LOADED:', comprehensiveChoreList.length, 'total tasks!');
    console.log('🏠 Household:', comprehensiveChoreList.filter(c => c.category === 'household').length);
    console.log('💞 US Quests:', comprehensiveChoreList.filter(c => c.category === 'us').length);
    console.log('🌱 Personal Growth:', comprehensiveChoreList.filter(c => c.category === 'personal').length);
    console.log('🐾 Pet Tasks:', comprehensiveChoreList.filter(c => c.category === 'pets').length);
    console.log('🚗 Vehicle Tasks:', comprehensiveChoreList.filter(c => c.category === 'vehicle').length);
  };

  // Generate 50/50 daily quest split as requested
  const generateDailyChores = async (onboardingData, user) => {
    try {
      console.log('🎯 Generating daily 50/50 quest split...');
      
      // Get domestic quests from comprehensive library
      const domesticQuests = allChores.filter(q => q.category === 'domestic' || q.category === 'pets' || q.category === 'vehicle');
      const selfCareQuests = allChores.filter(q => q.category === 'self-care');
      const teamBuildingQuests = allChores.filter(q => q.category === 'team-building');
      
      // Select 8-10 domestic quests for 50/50 split
      const selectedDomesticQuests = domesticQuests.sort(() => 0.5 - Math.random()).slice(0, 10);
      
      // Add verification chance (15% for domestic and self-care)
      const addVerificationChance = (quest) => ({
        ...quest,
        requiresVerification: Math.random() < 0.15,
        completed: false
      });
      
      // 50/50 split of domestic quests
      const myDomesticQuests = selectedDomesticQuests.slice(0, 5).map(addVerificationChance);
      const partnerDomesticQuests = selectedDomesticQuests.slice(5, 10).map(addVerificationChance);
      
      // Add 1 self-care quest for each
      const mySelfCareQuest = selfCareQuests.sort(() => 0.5 - Math.random())[0];
      const partnerSelfCareQuest = selfCareQuests.sort(() => 0.5 - Math.random())[1];
      
      if (mySelfCareQuest) myDomesticQuests.push(addVerificationChance(mySelfCareQuest));
      if (partnerSelfCareQuest) partnerDomesticQuests.push(addVerificationChance(partnerSelfCareQuest));
      
      // Add 1 team building quest (requires both parties)
      const sharedTeamQuest = teamBuildingQuests.sort(() => 0.5 - Math.random())[0];
      if (sharedTeamQuest) {
        const teamQuest = { ...sharedTeamQuest, requiresBothPartners: true, completed: false };
        myDomesticQuests.push(teamQuest);
        partnerDomesticQuests.push(teamQuest); // Same quest for both
      }
      
      setMyDailyChores(myDomesticQuests);
      setPartnerChores(partnerDomesticQuests);
      
      console.log('✅ Daily quest assignment complete!');
      console.log('👤 My quests:', myDomesticQuests.length);
      console.log('👥 Partner quests:', partnerDomesticQuests.length);
      
    } catch (error) {
      console.error('❌ Error generating daily quests:', error);
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
      // Create enhanced couple with onboarding data including partner name
      const response = await axios.post(`${API}/couples/create-enhanced`, {
        playerName: onboardingData.playerName, // Using actual player name
        partnerName: onboardingData.partnerName,
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
      
      // Create user account with the name from onboarding including partner name
      const userResponse = await axios.post(`${API}/users`, {
        displayName: onboardingData.playerName,
        partnerName: onboardingData.partnerName,
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
      
      // Generate daily quests immediately based on onboarding
      generateDailyChores(onboardingData, userResponse.data);
      
      // Close onboarding and go straight to main app
      setShowOnboarding(false);
      
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
        {showEnhancedOnboarding ? (
          <EnhancedOnboarding 
            isOpen={showEnhancedOnboarding} 
            onComplete={handleEnhancedOnboardingComplete}
            onClose={() => setShowEnhancedOnboarding(false)}
          />
        ) : (
          // Clean Welcome Screen
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-lg w-full text-center border border-white/20 shadow-2xl">
            <div className="text-6xl mb-6">🏰</div>
            <h1 className="text-4xl font-bold text-white mb-6">Domestic Dominion</h1>
            <p className="text-gray-100 mb-4 leading-relaxed">
              🏰 Welcome to Domestic Dominion!
            </p>
            <div className="text-gray-200 mb-8 leading-relaxed text-left space-y-4">
              <p>
                Hi there, and welcome to Domestic Dominion — where your home becomes your kingdom and your everyday chores become epic quests for glory!
              </p>
              <p>
                Why just clean, cook, or organize when you can embark on an adventure together? Here, every small task helps you build your realm, earn rewards, and strengthen your bond — all while conquering the real world one quest at a time.
              </p>
              <p>
                If you're into challenges, board games, dares, have a competitive streak, and love leveling up in life, this is the perfect game for you. Domestic Dominion transforms ordinary duties into exciting duels and shared victories that make teamwork actually fun.
              </p>
              <p>
                So grab your partner, claim your quests, and start ruling your household like the champions you are.
              </p>
              <p className="font-semibold text-yellow-200">
                Your dominion awaits — let the adventure begin!
              </p>
            </div>
            
            <div className="space-y-4">
              <Button 
                onClick={() => setShowEnhancedOnboarding(true)}
                size="lg" 
                className="w-full text-xl px-8 py-4 bg-white text-purple-600 hover:bg-gray-100 font-bold shadow-2xl"
              >
                🌟 Start an Adventure
              </Button>
              
              <Button 
                onClick={() => setShowAuth(true)}
                size="lg"
                variant="outline" 
                className="w-full text-lg px-8 py-3 bg-white/20 text-white border-white hover:bg-white/30"
              >
                👑 I was invited to an adventure
              </Button>
            </div>
          </div>
        )}
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

  // Pi Integration Handler Functions
  const handleEnhanceMessage = async () => {
    if (!messageText.trim()) return;
    
    setIsEnhancing(true);
    try {
      const response = await axios.post(`${API}/pi/enhance-message`, {
        message: messageText,
        enhancement_level: enhancementLevel,
        preserve_style: preserveStyle,
        user_id: currentUser.userId
      });
      
      setEnhancedMessage(response.data.enhanced_message);
      setEnhancementData(response.data);
    } catch (error) {
      console.error('Error enhancing message:', error);
      alert('Failed to enhance message. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSendMessage = async () => {
    const messageToSend = enhancedMessage || messageText;
    if (!messageToSend.trim()) return;
    
    setIsSending(true);
    try {
      const response = await axios.post(`${API}/messages/send`, {
        content: messageToSend,
        original_content: enhancedMessage ? messageText : null,
        enhanced: !!enhancedMessage,
        empathy_score: enhancementData?.confidence_score || 0,
        sender_id: currentUser.userId,
        couple_id: currentUser.coupleId
      });
      
      // Add to local messages
      const newMessage = {
        id: response.data.id,
        content: messageToSend,
        original_content: enhancedMessage ? messageText : null,
        enhanced: !!enhancedMessage,
        empathy_score: enhancementData?.confidence_score || 0,
        sender: currentUser.userId,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [newMessage, ...prev]);
      setMessageText('');
      setEnhancedMessage('');
      setEnhancementData(null);
      setHasDailyMessage(true);
      
      setCelebrationMessage('📤 Message sent successfully!');
      setTimeout(() => setCelebrationMessage(''), 3000);
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleUseEnhanced = () => {
    setMessageText(enhancedMessage);
    setEnhancedMessage('');
    setEnhancementData(null);
  };

  // All Chores Sorting and Filtering Functions
  const getSortedAndFilteredChores = () => {
    if (!allChores || allChores.length === 0) return [];
    
    let filteredChores = [...allChores];
    
    // Apply room filter
    if (selectedRoom !== 'all') {
      filteredChores = filteredChores.filter(chore => 
        chore.room.toLowerCase().includes(selectedRoom.toLowerCase())
      );
    }
    
    // Apply category filter
    if (filterBy !== 'all') {
      filteredChores = filteredChores.filter(chore => chore.category === filterBy);
    }
    
    // Apply sorting
    filteredChores.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'room':
          comparison = a.room.localeCompare(b.room);
          break;
        case 'difficulty':
          const difficultyOrder = { 'EASY': 1, 'MEDIUM': 2, 'HARD': 3 };
          comparison = (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0);
          break;
        case 'points':
          comparison = a.points - b.points;
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return filteredChores;
  };

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
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
              <h1 className="text-2xl md:text-4xl font-bold drop-shadow-lg">🏰 Domestic Dominion</h1>
              <p className="text-purple-100 text-sm md:text-lg">Hero: {currentUser.displayName}</p>
              <p className="text-purple-200 text-sm md:text-base">
                Partner: {partner?.displayName || currentUser.partnerName || 'Awaiting Partner'}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-6">
              {/* Level Display - Compact on mobile */}
              <div className="text-center bg-white/20 rounded-lg p-2 md:p-3">
                <div className="text-lg md:text-2xl font-bold">Level {currentUser.level}</div>
                <div className="w-16 md:w-32">
                  <Progress value={levelProgress} className="h-1 md:h-2 bg-purple-300" />
                </div>
                <div className="text-xs md:text-sm opacity-90">{currentUser.points % LEVEL_UP_POINTS}/{LEVEL_UP_POINTS} XP</div>
              </div>
              
              {/* Stats - Compact on mobile */}
              <div className="text-center">
                <div className="text-xl md:text-3xl font-bold">💎 {currentUser.points}</div>
                <div className="text-xs md:text-sm">Total XP</div>
              </div>
              
              <div className="text-center">
                <div className="text-xl md:text-3xl font-bold">⭐ {currentUser.talentPoints}</div>
                <div className="text-xs md:text-sm">Talent Points</div>
              </div>
              
              <Badge className="bg-white/20 text-white text-sm md:text-lg px-2 md:px-3 py-1">
                Party: {partner?.displayName || currentUser.partnerName || 'Solo'}
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
      <div className="flex flex-col md:flex-row max-w-7xl mx-auto">
        {/* Side Navigation - Hidden on mobile, full width on mobile when shown */}
        <div className="w-full md:w-64 bg-white shadow-lg min-h-screen md:min-h-auto order-2 md:order-1">
          <div className="p-4">
            <h3 className="text-lg font-bold mb-4 text-gray-800">🗺️ Quest Areas</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('my-chores')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'my-chores' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                ⚔️ My Quest Log
              </button>
              
              <button
                onClick={() => setActiveTab('all-chores')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'all-chores' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📋 All Quests
              </button>
              
              <button
                onClick={() => setActiveTab('personal-growth')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'personal-growth' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🌱 Personal Growth
              </button>
              
              <button
                onClick={() => setActiveTab('teammate')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'teammate' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                👥 {currentUser?.partnerName ? `${currentUser.partnerName}` : 'My Ally'}
              </button>
              
              <button
                onClick={() => setActiveTab('talent-tree')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'talent-tree' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🌳 Talent Tree
              </button>
              
              <button
                onClick={() => setActiveTab('messages')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'messages' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                💬 Messages
              </button>
              
              <button
                onClick={() => setActiveTab('games')}
                className={`w-full text-left p-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'games' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                🎮 US Activities
              </button>
            </div>
          </div>

          {/* Room Filters (for all chores view) */}
          {(activeTab === 'all-chores' || activeTab === 'my-chores') && (
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
          {/* My Quest Log - Enhanced */}
          {activeTab === 'my-chores' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">⚔️ My Quest Log</h2>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-purple-600 font-medium">
                    Your personal adventure awaits!
                  </div>
                </div>
              </div>

              {currentUser ? (
                <div className="space-y-6">
                  {/* Today's Quests */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6">
                    <h3 className="text-2xl font-bold mb-4 text-blue-800">🗓️ Today's Daily Quests</h3>
                    <p className="text-blue-600 mb-4">Your assigned half of the household duties</p>
                    
                    <div className="space-y-4">
                      {myDailyChores && myDailyChores.length > 0 ? 
                        myDailyChores
                        .filter(chore => selectedRoom === 'all' || chore.room.toLowerCase().includes(selectedRoom.toLowerCase()))
                        .map((chore, index) => (
                        <div key={chore.id} className={`bg-white rounded-lg shadow-md p-5 border-l-4 transition-all hover:shadow-lg ${
                          chore.completed 
                            ? 'border-green-400 bg-green-50' 
                            : 'border-blue-400'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                chore.completed 
                                  ? 'bg-green-200 text-green-800' 
                                  : 'bg-blue-200 text-blue-800'
                              }`}>
                                {chore.completed ? '✓' : index + 1}
                              </div>
                              
                              <div>
                                <h4 className={`text-xl font-bold ${chore.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                  {chore.title}
                                </h4>
                                <div className="flex items-center space-x-3 text-sm mt-1">
                                  <span className="flex items-center space-x-1">
                                    <span>🏠</span>
                                    <span className="font-medium">{chore.room}</span>
                                  </span>
                                  <Badge className={
                                    chore.difficulty === 'EASY' ? 'bg-green-100 text-green-800 border-green-200' :
                                    chore.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    'bg-red-100 text-red-800 border-red-200'
                                  }>
                                    {chore.difficulty}
                                  </Badge>
                                  <span className="text-purple-600 font-bold flex items-center space-x-1">
                                    <span>💎</span>
                                    <span>+{chore.points} XP</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              {!chore.completed && (
                                <Button 
                                  onClick={() => {
                                    handleQuestComplete(chore.points);
                                    setMyDailyChores(prev => prev.map(c => 
                                      c.id === chore.id ? {...c, completed: true} : c
                                    ));
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white font-medium"
                                >
                                  ⚔️ Complete Quest
                                </Button>
                              )}
                              <Button 
                                variant="outline"
                                size="sm"
                                className="text-gray-600 hover:text-gray-700"
                              >
                                Skip (-50% XP)
                              </Button>
                            </div>
                          </div>
                          
                          {chore.completed && (
                            <div className="mt-3 p-3 bg-green-100 rounded-lg border border-green-200">
                              <div className="flex items-center space-x-2 text-green-800">
                                <span className="text-xl">🏆</span>
                                <span className="font-semibold">Quest completed! +{chore.points} XP earned</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )) : (
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                          <div className="text-6xl mb-4">⚔️</div>
                          <h3 className="text-xl font-bold text-yellow-800 mb-2">Quest Assignment in Progress</h3>
                          <p className="text-yellow-700 mb-4">Your daily quests are being prepared! Please wait a moment or try refreshing.</p>
                          <Button 
                            onClick={() => generateDailyChores({}, currentUser)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          >
                            🎯 Generate My Quests
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Daily Connection Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Daily Reflection - Interactive Question */}
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200 p-6">
                      <h3 className="text-xl font-bold mb-3 text-yellow-800">💭 Daily Reflection</h3>
                      <p className="text-gray-700 mb-4 italic">"{dailyQuestion}"</p>
                      <p className="text-xs text-yellow-600 mb-3">🎯 Answer thoughtfully to earn 5 XP</p>
                      
                      <textarea 
                        className="w-full p-3 border border-yellow-300 rounded-lg mb-3 text-sm"
                        rows="3"
                        placeholder="Share your honest reflection here..."
                        value={reflectionAnswer}
                        onChange={(e) => setReflectionAnswer(e.target.value)}
                      />
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (reflectionAnswer.trim()) {
                              handleQuestComplete(5);
                              setReflectionAnswer('');
                              setCelebrationMessage('💭 Daily reflection complete! +5 XP');
                              setTimeout(() => setCelebrationMessage(''), 3000);
                            }
                          }}
                          disabled={!reflectionAnswer.trim()}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white flex-1"
                        >
                          ✅ Submit Reflection (+5 XP)
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => generateDailyQuestionAndSuggestion()}
                        >
                          🔄
                        </Button>
                      </div>
                    </div>
                    
                    {/* Pi Message Suggestion */}
                    <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200 p-6">
                      <h3 className="text-xl font-bold mb-3 text-pink-800">💌 Message Your Ally</h3>
                      <div className="bg-white p-4 rounded-lg border mb-4">
                        <p className="text-gray-700 italic">"{piMessageSuggestion}"</p>
                        <p className="text-xs text-purple-600 mt-2">✨ Pi-enhanced for gentle communication</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm"
                          className="bg-pink-600 hover:bg-pink-700 text-white flex-1"
                        >
                          📤 Send to {currentUser?.partnerName || 'Partner'}
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => generateDailyQuestionAndSuggestion()}
                        >
                          🔄
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Quest Statistics */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-gray-200 p-6">
                    <h3 className="text-2xl font-bold mb-4 text-gray-800">📊 Quest Statistics</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {myDailyChores.filter(c => c.completed).length}
                        </div>
                        <div className="text-sm text-gray-600">Completed Today</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {myDailyChores.reduce((sum, c) => sum + (c.completed ? c.points : 0), 0)}
                        </div>
                        <div className="text-sm text-gray-600">XP Earned Today</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {Math.round((myDailyChores.filter(c => c.completed).length / myDailyChores.length) * 100) || 0}%
                        </div>
                        <div className="text-sm text-gray-600">Completion Rate</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-600">
                          {myDailyChores.length - myDailyChores.filter(c => c.completed).length}
                        </div>
                        <div className="text-sm text-gray-600">Remaining Quests</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">⚔️</div>
                    <h3 className="text-2xl font-bold mb-2">Generating Your Daily Quests...</h3>
                    <p className="text-gray-600 mb-4">Please wait while we assign your 50% of today's royal duties!</p>
                    <Button 
                      onClick={() => {
                        console.log('🎲 Manually generating quests...');
                        const mockOnboarding = {
                          hasPets: currentUser.hasPets || false,
                          vehicleSharing: currentUser.vehicleSharing || 'none'
                        };
                        generateDailyChores(mockOnboarding, currentUser);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      🎲 Generate My Quests
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All Quests Management - Tabbed Categories */}
          {activeTab === 'all-chores' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">📋 All Quests</h2>
                <Button 
                  onClick={() => setShowAddChore(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ Add Custom Quest
                </Button>
              </div>
              
              {allChores.length > 0 ? (
                <div className="bg-white rounded-lg shadow-lg">
                  {/* Three Category Tabs */}
                  <div className="border-b">
                    <div className="flex space-x-0">
                      <button
                        onClick={() => setQuestCategory('domestic')}
                        className={`flex-1 py-4 px-6 text-center font-medium border-b-2 transition-colors ${
                          questCategory === 'domestic'
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        🏠 Domestic Duties
                      </button>
                      <button
                        onClick={() => setQuestCategory('self-care')}
                        className={`flex-1 py-4 px-6 text-center font-medium border-b-2 transition-colors ${
                          questCategory === 'self-care'
                            ? 'border-green-500 text-green-600 bg-green-50'
                            : 'border-transparent text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        🌱 Self-Care
                      </button>
                      <button
                        onClick={() => setQuestCategory('team-building')}
                        className={`flex-1 py-4 px-6 text-center font-medium border-b-2 transition-colors ${
                          questCategory === 'team-building'
                            ? 'border-pink-500 text-pink-600 bg-pink-50'
                            : 'border-transparent text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        💕 Team Building
                      </button>
                    </div>
                  </div>
                  
                  {/* Quests List */}
                  <div className="p-6">
                    <div className="space-y-3">
                      {allChores
                        .filter(chore => chore.category === questCategory || (questCategory === 'domestic' && (chore.category === 'pets' || chore.category === 'vehicle')))
                        .map((chore, index) => (
                        <div 
                          key={chore.id} 
                          className={`border rounded-lg p-4 flex items-center justify-between transition-all hover:shadow-md ${
                            index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h5 className="font-bold text-lg">{chore.title}</h5>
                              <Badge 
                                variant="outline" 
                                className={
                                  chore.category === 'household' ? 'border-blue-200 text-blue-700' :
                                  chore.category === 'pets' ? 'border-green-200 text-green-700' :
                                  'border-orange-200 text-orange-700'
                                }
                              >
                                {chore.category === 'household' && '🏠'}
                                {chore.category === 'pets' && '🐾'}
                                {chore.category === 'vehicle' && '🚗'}
                                {chore.category}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="flex items-center space-x-1">
                                <span className="text-gray-500">Room:</span>
                                <span className="font-medium">{chore.room}</span>
                              </span>
                              
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                chore.difficulty === 'EASY' ? 'bg-green-100 text-green-800 border border-green-200' :
                                chore.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {chore.difficulty}
                              </span>
                              
                              <span className="flex items-center space-x-1 text-purple-600 font-bold">
                                <span>💎</span>
                                <span>+{chore.points} pts</span>
                              </span>
                              
                              {chore.icon && (
                                <span className="text-lg">{chore.icon}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            <Button 
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              ✏️ Edit
                            </Button>
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              ➕ Add to Quest Log
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {getSortedAndFilteredChores().length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-xl font-bold mb-2">No Quests Found</h3>
                        <p className="text-gray-600">Try adjusting your filters or add some custom quests!</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">📋</div>
                    <h3 className="text-xl font-bold mb-2">No Quests Available</h3>
                    <p className="text-gray-600">Complete onboarding to generate your personalized quest library!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personal Growth Tasks */}
          {activeTab === 'personal-growth' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">🌱 Personal Growth & Self-Care</h2>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4">Complete Personal Development Task Library</h3>
                  <p className="text-gray-600 mb-4">Focus on your wellbeing, growth, and self-improvement.</p>
                </div>
                
                <div className="space-y-6">
                  {/* Wellness & Health */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-green-600">💚 Wellness & Health</h4>
                    <div className="grid gap-3">
                      {getSortedAndFilteredChores()
                        .filter(task => task.category === 'personal' && ['meditation', 'exercise', 'drink_water', 'healthy_meal', 'skincare_routine', 'stretch'].includes(task.id))
                        .map((task, index) => (
                          <div key={task.id} className={`border rounded-lg p-4 flex items-center justify-between transition-all hover:shadow-md ${
                            index % 2 === 0 ? 'bg-green-50' : 'bg-white'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h5 className="font-bold text-lg">{task.title}</h5>
                                <Badge className={
                                  task.difficulty === 'EASY' ? 'bg-green-100 text-green-800 border-green-200' :
                                  task.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-red-100 text-red-800 border-red-200'
                                }>
                                  {task.difficulty}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1">
                                  <span className="text-gray-500">Room:</span>
                                  <span className="font-medium">{task.room}</span>
                                </span>
                                <span className="flex items-center space-x-1 text-purple-600 font-bold">
                                  <span>💎</span>
                                  <span>+{task.points} pts</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                ➕ Add to Daily
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  {/* Mental & Emotional */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-blue-600">🧠 Mental & Emotional</h4>
                    <div className="grid gap-3">
                      {getSortedAndFilteredChores()
                        .filter(task => task.category === 'personal' && ['journaling', 'read_book', 'gratitude_practice', 'learn_something', 'call_friend'].includes(task.id))
                        .map((task, index) => (
                          <div key={task.id} className={`border rounded-lg p-4 flex items-center justify-between transition-all hover:shadow-md ${
                            index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h5 className="font-bold text-lg">{task.title}</h5>
                                <Badge className={
                                  task.difficulty === 'EASY' ? 'bg-green-100 text-green-800 border-green-200' :
                                  task.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-red-100 text-red-800 border-red-200'
                                }>
                                  {task.difficulty}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1">
                                  <span className="text-gray-500">Room:</span>
                                  <span className="font-medium">{task.room}</span>
                                </span>
                                <span className="flex items-center space-x-1 text-purple-600 font-bold">
                                  <span>💎</span>
                                  <span>+{task.points} pts</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button 
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                ➕ Add to Daily
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  {/* Organization & Environment */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-purple-600">🏠 Organization & Environment</h4>
                    <div className="grid gap-3">
                      {getSortedAndFilteredChores()
                        .filter(task => task.category === 'personal' && ['declutter_space'].includes(task.id))
                        .map((task, index) => (
                          <div key={task.id} className={`border rounded-lg p-4 flex items-center justify-between transition-all hover:shadow-md ${
                            index % 2 === 0 ? 'bg-purple-50' : 'bg-white'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h5 className="font-bold text-lg">{task.title}</h5>
                                <Badge className={
                                  task.difficulty === 'EASY' ? 'bg-green-100 text-green-800 border-green-200' :
                                  task.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-red-100 text-red-800 border-red-200'
                                }>
                                  {task.difficulty}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="flex items-center space-x-1">
                                  <span className="text-gray-500">Room:</span>
                                  <span className="font-medium">{task.room}</span>
                                </span>
                                <span className="flex items-center space-x-1 text-purple-600 font-bold">
                                  <span>💎</span>
                                  <span>+{task.points} pts</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Button 
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                ➕ Add to Daily
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* My Teammate */}
          {activeTab === 'teammate' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">👥 {currentUser?.partnerName ? `${currentUser.partnerName}'s Quests` : 'My Ally'}</h2>
              </div>
              
              {partner ? (
                <div className="space-y-6">
                  {/* Partner Stats */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="text-center">
                      <div className="text-6xl mb-4">👤</div>
                      <h3 className="text-2xl font-bold mb-2">{partner.displayName}</h3>
                      <p className="text-gray-600 mb-4">Your adventure partner</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl mb-2">📊</div>
                          <h4 className="font-bold">Level {partner.level || 1}</h4>
                          <p className="text-sm text-gray-600">{partner.totalPoints || 0} total points</p>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl mb-2">🏆</div>
                          <h4 className="font-bold">Today's Progress</h4>
                          <p className="text-sm text-gray-600">{partnerChores.filter(c => c.completed).length}/{partnerChores.length} chores done</p>
                        </div>
                        
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-2xl mb-2">💎</div>
                          <h4 className="font-bold">Points Today</h4>
                          <p className="text-sm text-gray-600">{partnerChores.filter(c => c.completed).reduce((sum, c) => sum + c.points, 0)} points</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Partner's Today's Chores */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-bold mb-4">🎯 {partner.displayName}'s Quests for Today</h3>
                    
                    {partnerChores.length > 0 ? (
                      <div className="space-y-3">
                        {partnerChores.map((chore) => (
                          <div key={chore.id} className={`border rounded-lg p-4 ${chore.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  chore.completed ? 'bg-green-500 text-white' : 'bg-gray-300'
                                }`}>
                                  {chore.completed ? '✓' : '○'}
                                </div>
                                <div>
                                  <h4 className="font-bold">{chore.title}</h4>
                                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                                    <span>🏠 {chore.room}</span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      chore.difficulty === 'EASY' ? 'bg-green-100 text-green-800' :
                                      chore.difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {chore.difficulty}
                                    </span>
                                    <span className="text-purple-600 font-bold">+{chore.points} pts</span>
                                  </div>
                                </div>
                              </div>
                              
                              {!chore.completed && (
                                <button 
                                  onClick={() => {
                                    // Take over task for 3x points
                                    const takeoverPoints = chore.points * 3;
                                    handleQuestComplete(takeoverPoints);
                                    setPartnerChores(prev => prev.map(c => 
                                      c.id === chore.id ? {...c, completed: true, takenOver: true} : c
                                    ));
                                    setCelebrationMessage(`🎉 Task Takeover! You earned ${takeoverPoints} points (3x bonus) for helping your partner!`);
                                    setTimeout(() => setCelebrationMessage(''), 3000);
                                  }}
                                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-bold"
                                >
                                  Take Over (3x Points!)
                                </button>
                              )}
                              
                              {chore.takenOver && (
                                <div className="text-sm text-orange-600 font-bold">
                                  ✨ You took over this task!
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No chores assigned to {partner.displayName} today
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">👥</div>
                    <h3 className="text-xl font-bold mb-2">No Teammate Yet</h3>
                    <p className="text-gray-600">Invite your partner to join the adventure!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages - Pi Enhanced Communication */}
          {activeTab === 'messages' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">💬 Messages</h2>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1">
                  ✨ Pi Enhanced
                </Badge>
              </div>

              {/* Pi Integration Info */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-400 p-4 mb-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-purple-800">🤖 Pi AI Message Enhancement</h3>
                    <p className="text-purple-700">Your messages are enhanced for empathetic communication using Pi AI to help build stronger connections.</p>
                  </div>
                  <Button 
                    onClick={() => setShowPiSettings(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white ml-4"
                  >
                    ⚙️ Pi Settings
                  </Button>
                </div>
              </div>

              {/* Message Composer */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">✍️ Compose Message</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="message-input">Your Message</Label>
                    <textarea
                      id="message-input"
                      className="w-full p-3 border rounded-lg resize-none"
                      rows={4}
                      placeholder="Write your message here..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <Label className="text-sm">Enhancement Level</Label>
                        <select 
                          className="ml-2 p-1 border rounded"
                          value={enhancementLevel}
                          onChange={(e) => setEnhancementLevel(e.target.value)}
                        >
                          <option value="light">Light</option>
                          <option value="moderate">Moderate</option>
                          <option value="significant">Significant</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="preserve-style"
                          checked={preserveStyle}
                          onChange={(e) => setPreserveStyle(e.target.checked)}
                          className="mr-2"
                        />
                        <Label htmlFor="preserve-style" className="text-sm">Preserve my style</Label>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button
                        onClick={handleEnhanceMessage}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={!messageText.trim() || isEnhancing}
                      >
                        {isEnhancing ? '✨ Enhancing...' : '✨ Enhance with Pi'}
                      </Button>
                      
                      <Button
                        onClick={handleSendMessage}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={!messageText.trim() || isSending}
                      >
                        {isSending ? '📤 Sending...' : '📤 Send'}
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Preview */}
                  {enhancedMessage && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-2">✨ Pi Enhanced Version</h4>
                      <p className="text-gray-800 mb-3">{enhancedMessage}</p>
                      
                      {enhancementData && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-purple-600">
                              Empathy Score: {(enhancementData.confidence_score * 100).toFixed(1)}%
                            </span>
                            {enhancementData.enhancements_applied && (
                              <span className="text-purple-600">
                                Applied: {enhancementData.enhancements_applied.join(', ')}
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={handleUseEnhanced}
                            className="bg-purple-500 hover:bg-purple-600 text-white"
                          >
                            Use Enhanced Version
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Message History */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">📝 Recent Messages</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.map((message, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      message.sender === currentUser.userId 
                        ? 'border-blue-400 bg-blue-50' 
                        : 'border-green-400 bg-green-50'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`font-semibold ${
                          message.sender === currentUser.userId ? 'text-blue-800' : 'text-green-800'
                        }`}>
                          {message.sender === currentUser.userId ? 'You' : partner?.displayName || 'Partner'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-gray-800 mb-2">{message.content}</p>
                      
                      {message.enhanced && (
                        <div className="text-xs space-y-1">
                          <p className="text-purple-600">✨ Enhanced by Pi (Empathy: {(message.empathy_score * 100).toFixed(1)}%)</p>
                          {message.original_content && (
                            <details className="text-gray-500">
                              <summary className="cursor-pointer">Show original</summary>
                              <p className="mt-1 italic">{message.original_content}</p>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No messages yet. Start a conversation!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Required Message Reminder */}
              {!hasDailyMessage && (
                <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-800">📅 Daily Message Reminder</h4>
                      <p className="text-yellow-700">Don't forget to send your daily filtered message to keep your connection strong!</p>
                    </div>
                    <Badge className="bg-yellow-500 text-white">Required</Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Talent Tree */}
          {activeTab === 'talent-tree' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">🌳 Talent Tree - Domestic Dominion</h2>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Available Talent Points</div>
                    <div className="text-2xl font-bold text-blue-600">⭐ {currentUser.talentPoints}</div>
                  </div>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1">
                    Level {Math.floor(currentUser.points / LEVEL_UP_POINTS) + 1}
                  </Badge>
                </div>
              </div>
              
              {/* Premium Unlock Notice */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-800">🏆 Free Tiers 1-5 Available</h3>
                    <p className="text-yellow-700">Unlock premium tiers 6-10 with in-app purchase for advanced mastery nodes and couple bonuses!</p>
                  </div>
                  <Button className="bg-yellow-600 hover:bg-yellow-700 text-white ml-4">
                    Unlock Premium 👑
                  </Button>
                </div>
              </div>

              {/* Talent Tree Branches */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Housekeeping Heroes Branch */}
                <div className="bg-gradient-to-b from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-green-800 mb-2">🏡 Housekeeping Heroes</h3>
                    <p className="text-sm text-green-600 italic">Sanctum of Stewardry</p>
                    <p className="text-xs text-green-600 mt-1">Master your shared spaces and domestic pride</p>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.values(TALENT_TREE_NODES)
                      .filter(node => node.branch === 'Housekeeping')
                      .sort((a, b) => a.tier - b.tier)
                      .map(node => (
                        <div 
                          key={node.id}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            node.premium && node.tier > 5
                              ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300 opacity-75'
                              : currentUser.talentBuild?.[node.id]
                              ? 'bg-green-100 border-green-400 shadow-md'
                              : currentUser.talentPoints >= node.cost
                              ? 'bg-white border-green-200 hover:border-green-400 hover:shadow-md'
                              : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold text-green-800">
                                  {node.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Tier {node.tier}
                                </Badge>
                                {node.premium && (
                                  <Badge className="bg-yellow-500 text-white text-xs">👑</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{node.description}</p>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm font-semibold text-blue-600">
                                ⭐ {node.cost}
                              </div>
                              {currentUser.talentBuild?.[node.id] && (
                                <div className="text-xs text-green-600 font-semibold">✓ Unlocked</div>
                              )}
                            </div>
                          </div>
                          
                          {node.prerequisites.length > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              Requires: {node.prerequisites.map(prereq => 
                                TALENT_TREE_NODES[prereq]?.name || prereq
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Coupling Questline Branch */}
                <div className="bg-gradient-to-b from-pink-50 to-rose-50 rounded-xl border-2 border-pink-200 p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-pink-800 mb-2">💞 Coupling Questline</h3>
                    <p className="text-sm text-pink-600 italic">Heartlands of Concord</p>
                    <p className="text-xs text-pink-600 mt-1">Enhance teamwork and emotional connection</p>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.values(TALENT_TREE_NODES)
                      .filter(node => node.branch === 'Coupling')
                      .sort((a, b) => a.tier - b.tier)
                      .map(node => (
                        <div 
                          key={node.id}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            node.premium && node.tier > 5
                              ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300 opacity-75'
                              : currentUser.talentBuild?.[node.id]
                              ? 'bg-pink-100 border-pink-400 shadow-md'
                              : currentUser.talentPoints >= node.cost
                              ? 'bg-white border-pink-200 hover:border-pink-400 hover:shadow-md'
                              : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold text-pink-800">
                                  {node.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Tier {node.tier}
                                </Badge>
                                {node.premium && (
                                  <Badge className="bg-yellow-500 text-white text-xs">👑</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{node.description}</p>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm font-semibold text-blue-600">
                                ⭐ {node.cost}
                              </div>
                              {currentUser.talentBuild?.[node.id] && (
                                <div className="text-xs text-pink-600 font-semibold">✓ Unlocked</div>
                              )}
                            </div>
                          </div>
                          
                          {node.prerequisites.length > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              Requires: {node.prerequisites.map(prereq => 
                                TALENT_TREE_NODES[prereq]?.name || prereq
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Personal Growth Path Branch */}
                <div className="bg-gradient-to-b from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-purple-800 mb-2">🌱 Personal Growth Path</h3>
                    <p className="text-sm text-purple-600 italic">Realm of Resonance</p>
                    <p className="text-xs text-purple-600 mt-1">Develop inner balance and self-mastery</p>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.values(TALENT_TREE_NODES)
                      .filter(node => node.branch === 'Growth')
                      .sort((a, b) => a.tier - b.tier)
                      .map(node => (
                        <div 
                          key={node.id}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            node.premium && node.tier > 5
                              ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300 opacity-75'
                              : currentUser.talentBuild?.[node.id]
                              ? 'bg-purple-100 border-purple-400 shadow-md'
                              : currentUser.talentPoints >= node.cost
                              ? 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-md'
                              : 'bg-gray-50 border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold text-purple-800">
                                  {node.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Tier {node.tier}
                                </Badge>
                                {node.premium && (
                                  <Badge className="bg-yellow-500 text-white text-xs">👑</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{node.description}</p>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm font-semibold text-blue-600">
                                ⭐ {node.cost}
                              </div>
                              {currentUser.talentBuild?.[node.id] && (
                                <div className="text-xs text-purple-600 font-semibold">✓ Unlocked</div>
                              )}
                            </div>
                          </div>
                          
                          {node.prerequisites.length > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              Requires: {node.prerequisites.map(prereq => 
                                TALENT_TREE_NODES[prereq]?.name || prereq
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Mastery Achievement Section */}
              <div className="mt-8 bg-gradient-to-r from-gray-900 via-purple-900 to-indigo-900 rounded-xl p-6 text-white">
                <h3 className="text-2xl font-bold mb-4 text-center">🌟 Hidden Mastery Region: The Royal Constellation Chamber</h3>
                <p className="text-center text-gray-300 mb-4">
                  Unlock this sacred chamber when both rulers reach Tier 10 in any talent tree. 
                  Here you can meet, strategize, and bestow royal gifts to strengthen your dominion.
                </p>
                <div className="flex justify-center space-x-4">
                  <Badge className="bg-white/20 text-white px-4 py-2">
                    Partner Progress: 🌱 Tier {Math.max(...Object.values(TALENT_TREE_NODES).filter(n => partner?.talentBuild?.[n.id]).map(n => n.tier) || [0])}
                  </Badge>
                  <Badge className="bg-white/20 text-white px-4 py-2">
                    Your Progress: 🌱 Tier {Math.max(...Object.values(TALENT_TREE_NODES).filter(n => currentUser.talentBuild?.[n.id]).map(n => n.tier) || [0])}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* US Activities - Couple Tasks */}
          {activeTab === 'games' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">💕 US Activities & Couple Tasks</h2>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4">Complete US/Couple Task Library</h3>
                  <p className="text-gray-600 mb-4">Activities that bring you together and strengthen your partnership.</p>
                </div>
                
                <div className="space-y-6">
                  {/* Quality Time Tasks */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-pink-600">💑 Quality Time</h4>
                    <div className="grid gap-3">
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🎲 Play a board game together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Living Room</span>
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">EASY</span>
                            <span className="text-purple-600 font-bold">+10 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🍽️ Cook a meal together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Kitchen</span>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">MEDIUM</span>
                            <span className="text-purple-600 font-bold">+15 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🎬 Watch a movie/show together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Living Room</span>
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">EASY</span>
                            <span className="text-purple-600 font-bold">+5 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🚶 Take a walk together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Outdoors</span>
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">EASY</span>
                            <span className="text-purple-600 font-bold">+10 pts each</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Communication Tasks */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-blue-600">💬 Communication & Connection</h4>
                    <div className="grid gap-3">
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🤗 Daily check-in conversation</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Anywhere</span>
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">EASY</span>
                            <span className="text-purple-600 font-bold">+5 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">💌 Write appreciation notes</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Anywhere</span>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">MEDIUM</span>
                            <span className="text-purple-600 font-bold">+10 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🎯 Plan future goals together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Anywhere</span>
                            <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">HARD</span>
                            <span className="text-purple-600 font-bold">+20 pts each</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Adventure Tasks */}
                  <div>
                    <h4 className="font-bold text-lg mb-3 text-green-600">🌟 Adventures & Experiences</h4>
                    <div className="grid gap-3">
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">🎭 Try something new together</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Anywhere</span>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">MEDIUM</span>
                            <span className="text-purple-600 font-bold">+15 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">📸 Create memories (photo session)</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Anywhere</span>
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">EASY</span>
                            <span className="text-purple-600 font-bold">+5 pts each</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="font-bold">💆 Give each other massages</h5>
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span>🏠 Bedroom</span>
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">MEDIUM</span>
                            <span className="text-purple-600 font-bold">+10 pts each</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
      
      {/* Redundant kingdom join modal removed */}
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