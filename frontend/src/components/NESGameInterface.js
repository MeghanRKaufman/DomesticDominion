import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NESGameInterface = ({ user, couple, onLogout }) => {
  const [activeTab, setActiveTab] = useState('daily-quests');
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(user?.points || 0);
  const [userLevel, setUserLevel] = useState(user?.level || 1);
  const [talentPoints, setTalentPoints] = useState(0);
  const [coupleQuestion, setCoupleQuestion] = useState(null);
  
  // Calculate level and talent points
  useEffect(() => {
    if (userPoints) {
      const level = Math.floor(userPoints / 100) + 1;
      const talents = Math.floor((level - 1) / 5) * 1.5;
      setUserLevel(level);
      setTalentPoints(talents);
    }
  }, [userPoints]);

  // Load enhanced tasks
  useEffect(() => {
    loadEnhancedTasks();
    loadDailyCoupleQuestion();
  }, []);

  const loadEnhancedTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/enhanced-tasks/${couple?.coupleId}`);
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error loading enhanced tasks:', error);
      // Fallback to default tasks
      setTasks([
        { taskId: 'make_bed', title: '🛏️ Make the bed', difficulty: 'EASY', basePoints: 5, icon: '🛏️', category: 'household' },
        { taskId: 'wash_dishes', title: '🍽️ Wash dishes', difficulty: 'MEDIUM', basePoints: 10, icon: '🍽️', category: 'household' },
        { taskId: 'vacuum', title: '🧹 Vacuum living room', difficulty: 'MEDIUM', basePoints: 10, icon: '🧹', category: 'household' },
        { taskId: 'grocery', title: '🛒 Grocery shopping', difficulty: 'HARD', basePoints: 20, icon: '🛒', category: 'household' },
        { taskId: 'walk_dog', title: '🐕 Walk the dog', difficulty: 'MEDIUM', basePoints: 10, icon: '🐕', category: 'pet' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyCoupleQuestion = async () => {
    try {
      if (couple?.coupleId) {
        const response = await axios.get(`${API}/couple-questions/${couple.coupleId}`);
        setCoupleQuestion(response.data.question);
      }
    } catch (error) {
      console.error('Error loading couple question:', error);
    }
  };

  const handleTaskComplete = async (taskId) => {
    try {
      // Play completion sound (simulated)
      console.log('🔊 Task completion sound: DING!');
      
      // Optimistically update UI
      setCompletedTasks(prev => new Set([...prev, taskId]));
      
      // Find task to get points
      const task = tasks.find(t => t.taskId === taskId);
      if (task) {
        const pointsEarned = task.basePoints;
        setUserPoints(prev => prev + pointsEarned);
        
        // Show point animation (can be enhanced with actual animations)
        console.log(`+${pointsEarned} XP earned!`);
      }
      
      // Call backend to complete task
      const response = await axios.post(`${API}/tasks/${taskId}/complete`, {
        userId: user.userId,
        notes: 'Completed via NES interface'
      });
      
      console.log('Task completed:', response.data);
      
    } catch (error) {
      console.error('Error completing task:', error);
      // Revert optimistic update
      setCompletedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getDifficultyClass = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'nes-difficulty-easy';
      case 'MEDIUM': return 'nes-difficulty-medium'; 
      case 'HARD': return 'nes-difficulty-hard';
      default: return 'nes-difficulty-medium';
    }
  };

  const getXPProgress = () => {
    const currentLevelXP = (userLevel - 1) * 100;
    const nextLevelXP = userLevel * 100;
    const progress = ((userPoints - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const renderDailyQuests = () => (
    <div className="nes-quest-board">
      <div className="nes-quest-title">═══ TODAY'S ADVENTURE ═══</div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="nes-shimmer">Loading quests...</div>
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.taskId} className="nes-quest-item">
            <div 
              className={`nes-quest-checkbox ${completedTasks.has(task.taskId) ? 'completed' : ''}`}
              onClick={() => !completedTasks.has(task.taskId) && handleTaskComplete(task.taskId)}
            />
            <div className="nes-quest-text">
              <span className="mr-2">{task.icon}</span>
              {task.title} <span className={getDifficultyClass(task.difficulty)}>({task.difficulty})</span>
            </div>
            <div className="nes-quest-points">+{task.basePoints} XP</div>
          </div>
        ))
      )}
    </div>
  );

  const renderTalentTree = () => (
    <div className="nes-talent-preview nes-border">
      <div className="nes-talent-points">TALENT POINTS: {Math.floor(talentPoints)} AVAILABLE</div>
      <div className="nes-talent-branches">
        <div className="nes-talent-branch">
          <div className="nes-branch-icon">⚡</div>
          <div className="nes-branch-name">EFFICIENCY</div>
          <div style={{fontSize: '6px', marginTop: '4px', color: '#ccc'}}>
            Household mastery
          </div>
        </div>
        <div className="nes-talent-branch">
          <div className="nes-branch-icon">💕</div>
          <div className="nes-branch-name">COUPLE</div>
          <div style={{fontSize: '6px', marginTop: '4px', color: '#ccc'}}>
            Partnership synergy
          </div>
        </div>
        <div className="nes-talent-branch">
          <div className="nes-branch-icon">🌱</div>
          <div className="nes-branch-name">GROWTH</div>
          <div style={{fontSize: '6px', marginTop: '4px', color: '#ccc'}}>
            Personal development
          </div>
        </div>
      </div>
    </div>
  );

  const renderCoupleGames = () => (
    <div className="nes-quest-board">
      <div className="nes-quest-title">═══ MULTIPLAYER ARENA ═══</div>
      <div className="space-y-4">
        <div className="nes-quest-item">
          <div className="nes-quest-text">
            🚢 Battleship <span className="nes-difficulty-medium">(TACTICAL)</span>
          </div>
          <button className="nes-button primary" style={{fontSize: '6px'}}>
            CHALLENGE
          </button>
        </div>
        <div className="nes-quest-item">
          <div className="nes-quest-text">
            ♔ Chess <span className="nes-difficulty-hard">(STRATEGIC)</span>
          </div>
          <button className="nes-button primary" style={{fontSize: '6px'}}>
            CHALLENGE
          </button>
        </div>
        <div className="nes-quest-item">
          <div className="nes-quest-text">
            🎲 Backgammon <span className="nes-difficulty-medium">(LUCK)</span>
          </div>
          <button className="nes-button primary" style={{fontSize: '6px'}}>
            CHALLENGE
          </button>
        </div>
        <div className="nes-quest-item">
          <div className="nes-quest-text">
            🃏 Gin Rummy <span className="nes-difficulty-easy">(CASUAL)</span>
          </div>
          <button className="nes-button primary" style={{fontSize: '6px'}}>
            CHALLENGE
          </button>
        </div>
      </div>
    </div>
  );

  const renderCoupleQuestions = () => (
    <div className="nes-quest-board">
      <div className="nes-quest-title">═══ DAILY COUPLE BONUS ═══</div>
      {coupleQuestion ? (
        <div className="space-y-4 text-center">
          <div style={{fontSize: '8px', lineHeight: '1.4', padding: '8px'}}>
            "{coupleQuestion.question}"
          </div>
          <div className="space-y-2">
            <button className="nes-button success w-full" style={{fontSize: '7px'}}>
              ANSWER QUESTION (+5 XP)
            </button>
            <div style={{fontSize: '6px', color: '#FFD700'}}>
              Match your partner's answer for +10 bonus XP!
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4" style={{fontSize: '8px'}}>
          Today's question coming soon...
        </div>
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="nes-quest-board">
      <div className="nes-quest-title">═══ ADVENTURE LOG ═══</div>
      <div className="space-y-3">
        <div className="nes-quest-item">
          <div className="nes-quest-text" style={{fontSize: '7px'}}>
            📝 Leave a message for your partner
          </div>
          <button className="nes-button" style={{fontSize: '6px'}}>
            WRITE
          </button>
        </div>
        <div style={{fontSize: '6px', color: '#ccc', padding: '8px'}}>
          Recent messages will appear here...
        </div>
      </div>
    </div>
  );

  if (loading && tasks.length === 0) {
    return (
      <div className="nes-theme nes-game-container">
        <div className="text-center py-20">
          <div className="nes-shimmer text-lg">Loading adventure...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="nes-theme nes-game-container">
      {/* Sound indicator */}
      <div className="nes-sound-icon">🔊</div>
      
      {/* Header with XP */}
      <div className="nes-header nes-border">
        <div className="nes-player-info">
          <div className="nes-pixel-avatar">👤</div>
          <div className="nes-xp-container">
            <div className="nes-level-text">LEVEL {userLevel} ADVENTURER</div>
            <div className="nes-xp-bar">
              <div 
                className="nes-xp-fill" 
                style={{width: `${getXPProgress()}%`}}
              />
            </div>
            <div style={{fontSize: '6px', marginTop: '2px'}}>
              {userPoints} / {userLevel * 100} XP
            </div>
          </div>
          <div className="nes-quest-points" style={{fontSize: '10px'}}>⭐ {userPoints}</div>
        </div>
      </div>

      {/* Couple Status */}
      <div className="nes-couple-status">
        <div className="nes-partner-card">
          <div className="nes-partner-name">{user?.displayName || 'PLAYER 1'}</div>
          <div className="nes-partner-level">LVL {userLevel}</div>
        </div>
        <div className="nes-partner-card">
          <div className="nes-partner-name">{couple?.partnerName || 'PLAYER 2'}</div>
          <div className="nes-partner-level">LVL {userLevel}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="nes-nav-tabs">
        <button 
          className={`nes-nav-tab ${activeTab === 'daily-quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily-quests')}
        >
          DAILY QUESTS
        </button>
        <button 
          className={`nes-nav-tab ${activeTab === 'all-quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('all-quests')}
        >
          ALL QUESTS
        </button>
        <button 
          className={`nes-nav-tab ${activeTab === 'talent-tree' ? 'active' : ''}`}
          onClick={() => setActiveTab('talent-tree')}
        >
          TALENT TREE
        </button>
        <button 
          className={`nes-nav-tab ${activeTab === 'couple-games' ? 'active' : ''}`}
          onClick={() => setActiveTab('couple-games')}
        >
          COUPLE GAMES
        </button>
        <button 
          className={`nes-nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          LOGS
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'daily-quests' && renderDailyQuests()}
      {activeTab === 'all-quests' && renderDailyQuests()} {/* Same for now */}
      {activeTab === 'talent-tree' && renderTalentTree()}
      {activeTab === 'couple-games' && renderCoupleGames()}
      {activeTab === 'logs' && renderLogs()}

      {/* Couple Questions Section */}
      {activeTab === 'daily-quests' && renderCoupleQuestions()}

      {/* Action Buttons */}
      <div style={{display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px'}}>
        <button className="nes-button success">COMPLETE QUEST</button>
        <button className="nes-button primary">VIEW PARTNER</button>
        <button className="nes-button" onClick={onLogout}>EXIT GAME</button>
      </div>
    </div>
  );
};

export default NESGameInterface;