from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timedelta
from enum import Enum
import json
import asyncio
import random
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Gamified Chore & Relationship App", version="3.0.0")
api_router = APIRouter(prefix="/api")

# Enhanced Game Constants (New NES-themed specification)
GAME_CONSTANTS = {
    "POINTS": {
        "EASY": 5,    # Minor daily tasks (brush teeth, feed pet, water plants)
        "MEDIUM": 10, # Standard chores (make bed, vacuum, cook, dishes, tidy, walk dog)
        "HARD": 20    # Heavy or specialty tasks (deep clean, car repair, grocery trip, food pantry visit)
    },
    "LEVELING": {
        "POINTS_PER_LEVEL": 100,
        "LEVELS_PER_TALENT_POINT": 5,
        "TALENT_POINTS_PER_5_LEVELS": 1.5
    },
    "VERIFICATION": {
        "PARTNER_VERIFIES_BONUS": 5,  # Partner verifies → +5 pts to performer
        "BOTH_VERIFY_BONUS": 5,       # Both verify → +5 pts each (shared success bonus)
        "RANDOM_CHECK_PROBABILITY": 0.1  # 10% chance of random verification request
    },
    "TASK_TAKEOVER": {
        "MULTIPLIER": 3,  # One partner can "Take Over" a listed task (offering 3× the points)
        "COOLDOWN_HOURS": 24
    },
    "QUEST_CATEGORIES": {
        "DAILY": ["laundry", "dishes", "tidying", "walks", "pet_feeding"],
        "WEEKLY": ["food_pantry", "grocery_trips", "car_maintenance", "deep_cleans"],
        "SPECIAL": ["vet_appointments", "oil_changes", "holidays"]
    },
    "PET_TASKS": {
        "FEED_PETS": 5,
        "WALK_PETS": 10,
        "GROOM_PETS": 10,
        "VET_VISITS": 20,
        "CLEAN_LITTER": 10
    },
    "VEHICLE_TASKS": {
        "CHECK_FLUIDS": 10,
        "CLEAN_CAR": 10,
        "FILL_GAS": 5,
        "REPAIR_MAINTENANCE": 20,
        "WASH_EXTERIOR": 10
    },
    "COUPLE_QUESTIONS": {
        "ANSWER_POINTS": 5,
        "MATCH_BONUS": 10,
        "DAILY_LIMIT": 1
    },
    "SOUNDS": {
        "TASK_COMPLETE": "retro_ding",
        "LEVEL_UP": "ascending_melody", 
        "TASK_MISSED": "dramatic_dun_dun_dun",
        "MESSAGE_SENT": "soft_8bit_chime"
    },
    "UI_THEME": "NES_PIXEL_ART"
}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, couple_id: str):
        await websocket.accept()
        self.active_connections[couple_id] = websocket

    def disconnect(self, couple_id: str):
        if couple_id in self.active_connections:
            del self.active_connections[couple_id]

    async def send_to_couple(self, couple_id: str, message: dict):
        if couple_id in self.active_connections:
            try:
                await self.active_connections[couple_id].send_text(json.dumps(message))
            except:
                self.disconnect(couple_id)

manager = ConnectionManager()

# Enums
class RoomType(str, Enum):
    KITCHEN = "Kitchen"
    BATHROOM = "Bathroom"
    LIVING_ROOM = "Living Room"
    BEDROOM = "Bedroom"
    US = "US"

class TalentBranch(str, Enum):
    EFFICIENCY = "Efficiency"
    COUPLE = "Couple"
    GROWTH = "Growth"

class TaskDifficulty(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

class QuestType(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY" 
    SPECIAL = "SPECIAL"

# Comprehensive 3-Tier Talent Tree System
TALENT_TREE_NODES = {
    # ===== PERSONAL GROWTH TREE =====
    # Tier 1
    "pg_early_riser": {
        "id": "pg_early_riser",
        "name": "Early Riser",
        "branch": "Growth",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts for first task of the day",
        "effect": {"type": "first_task_bonus", "value": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 50}
    },
    "pg_mindful_moments": {
        "id": "pg_mindful_moments", 
        "name": "Mindful Moments",
        "branch": "Growth",
        "tier": 1,
        "cost": 1,
        "description": "+5% point boost on self-care quests",
        "effect": {"type": "category_multiplier", "category": "self_care", "multiplier": 1.05},
        "prerequisites": [],
        "position": {"x": 100, "y": 100}
    },
    "pg_momentum_builder": {
        "id": "pg_momentum_builder",
        "name": "Momentum Builder", 
        "branch": "Growth",
        "tier": 1,
        "cost": 1,
        "description": "+10 pts when 3 personal tasks are done consecutively",
        "effect": {"type": "streak_bonus", "streak_count": 3, "bonus": 10},
        "prerequisites": [],
        "position": {"x": 100, "y": 150}
    },
    
    # Tier 2
    "pg_zen_master": {
        "id": "pg_zen_master",
        "name": "Zen Master",
        "branch": "Growth", 
        "tier": 2,
        "cost": 2,
        "description": "Choose 1 'Rest Day' weekly (2 skipped tasks without penalty)",
        "effect": {"type": "rest_day", "weekly_skips": 2},
        "prerequisites": ["pg_mindful_moments"],
        "position": {"x": 200, "y": 100}
    },
    "pg_focus_flow": {
        "id": "pg_focus_flow",
        "name": "Focus Flow",
        "branch": "Growth",
        "tier": 2, 
        "cost": 2,
        "description": "+10% XP gain if all personal tasks completed before 2 PM",
        "effect": {"type": "time_bonus", "cutoff": "14:00", "multiplier": 1.1},
        "prerequisites": ["pg_early_riser"],
        "position": {"x": 200, "y": 50}
    },
    "pg_reflective_mind": {
        "id": "pg_reflective_mind",
        "name": "Reflective Mind",
        "branch": "Growth",
        "tier": 2,
        "cost": 2,
        "description": "+5 pts per completed daily log entry",
        "effect": {"type": "log_bonus", "points": 5},
        "prerequisites": ["pg_momentum_builder"],
        "position": {"x": 200, "y": 150}
    },
    
    # Tier 3
    "pg_serenity_surge": {
        "id": "pg_serenity_surge", 
        "name": "Serenity Surge",
        "branch": "Growth",
        "tier": 3,
        "cost": 3,
        "description": "Doubles all 'Personal Growth' points for 1 day per week (cooldown: 7 days)",
        "effect": {"type": "weekly_double", "category": "personal", "cooldown_days": 7},
        "prerequisites": ["pg_zen_master", "pg_focus_flow"],
        "position": {"x": 300, "y": 75}
    },
    "pg_self_actualized": {
        "id": "pg_self_actualized",
        "name": "Self-Actualized",
        "branch": "Growth",
        "tier": 3,
        "cost": 3,
        "description": "Unlocks 'Personal Milestone' Quests (write goals, reward 20 pts each)",
        "effect": {"type": "unlock_quests", "quest_type": "personal_milestones", "points": 20},
        "prerequisites": ["pg_reflective_mind"],
        "position": {"x": 300, "y": 150}
    },

    # ===== "US" COUPLE TREE =====
    # Tier 1
    "us_appreciation_bonus": {
        "id": "us_appreciation_bonus",
        "name": "Appreciation Bonus",
        "branch": "Couple",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts for any partner-verified task",
        "effect": {"type": "verification_bonus", "points": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 50}
    },
    "us_unity_bonus": {
        "id": "us_unity_bonus",
        "name": "Unity Bonus", 
        "branch": "Couple",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts each when both complete shared quests",
        "effect": {"type": "shared_quest_bonus", "points": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 100}
    },
    "us_affirmation_flow": {
        "id": "us_affirmation_flow",
        "name": "Affirmation Flow",
        "branch": "Couple",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts for leaving positive feedback notes",
        "effect": {"type": "feedback_bonus", "points": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 150}
    },
    
    # Tier 2
    "us_team_efficiency": {
        "id": "us_team_efficiency",
        "name": "Team Efficiency",
        "branch": "Couple",
        "tier": 2,
        "cost": 2,
        "description": "Double points for joint tasks (meals, laundry, etc.)",
        "effect": {"type": "joint_task_multiplier", "multiplier": 2.0},
        "prerequisites": ["us_unity_bonus"],
        "position": {"x": 200, "y": 100}
    },
    "us_empathic_bond": {
        "id": "us_empathic_bond",
        "name": "Empathic Bond",
        "branch": "Couple", 
        "tier": 2,
        "cost": 2,
        "description": "+5 pts each for matching Couple Question answers",
        "effect": {"type": "couple_quiz_bonus", "points": 5},
        "prerequisites": ["us_appreciation_bonus"],
        "position": {"x": 200, "y": 50}
    },
    "us_helping_hand": {
        "id": "us_helping_hand",
        "name": "Helping Hand",
        "branch": "Couple",
        "tier": 2,
        "cost": 2,
        "description": "+10 pts bonus when taking over your partner's task",
        "effect": {"type": "takeover_bonus", "points": 10},
        "prerequisites": ["us_affirmation_flow"],
        "position": {"x": 200, "y": 150}
    },
    
    # Tier 3
    "us_shared_harmony": {
        "id": "us_shared_harmony",
        "name": "Shared Harmony",
        "branch": "Couple",
        "tier": 3,
        "cost": 3,
        "description": "+10% XP boost when total combined daily XP > 200",
        "effect": {"type": "combined_xp_bonus", "threshold": 200, "multiplier": 1.1},
        "prerequisites": ["us_team_efficiency", "us_empathic_bond"],
        "position": {"x": 300, "y": 75}
    },
    "us_power_couple": {
        "id": "us_power_couple",
        "name": "Power Couple",
        "branch": "Couple",
        "tier": 3,
        "cost": 3,
        "description": "Unlocks joint 'Milestone Quests' (e.g., 'Clean every room in one day')",
        "effect": {"type": "unlock_quests", "quest_type": "power_couple", "points": 50},
        "prerequisites": ["us_team_efficiency"],
        "position": {"x": 300, "y": 100}
    },
    "us_heart_sync": {
        "id": "us_heart_sync",
        "name": "Heart Sync",
        "branch": "Couple",
        "tier": 3,
        "cost": 3,
        "description": "All 'US' category tasks yield +15% points for 24 hrs after a correct couple quiz answer",
        "effect": {"type": "category_time_bonus", "category": "US", "multiplier": 1.15, "duration_hours": 24},
        "prerequisites": ["us_helping_hand"],
        "position": {"x": 300, "y": 150}
    },

    # ===== HOUSEHOLD TREE =====
    # Tier 1
    "hh_domestic_dynamo": {
        "id": "hh_domestic_dynamo",
        "name": "Domestic Dynamo",
        "branch": "Efficiency",
        "tier": 1,
        "cost": 1,
        "description": "+5% points on all cleaning tasks",
        "effect": {"type": "category_multiplier", "category": "cleaning", "multiplier": 1.05},
        "prerequisites": [],
        "position": {"x": 100, "y": 50}
    },
    "hh_pet_whisperer": {
        "id": "hh_pet_whisperer",
        "name": "Pet Whisperer",
        "branch": "Efficiency",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts on any pet-related task",
        "effect": {"type": "category_bonus", "category": "pets", "points": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 100}
    },
    "hh_gearhead": {
        "id": "hh_gearhead", 
        "name": "Gearhead",
        "branch": "Efficiency",
        "tier": 1,
        "cost": 1,
        "description": "+10 pts on all vehicle tasks",
        "effect": {"type": "category_bonus", "category": "vehicle", "points": 10},
        "prerequisites": [],
        "position": {"x": 100, "y": 150}
    },
    
    # Tier 2
    "hh_sanctuary_bonus": {
        "id": "hh_sanctuary_bonus",
        "name": "Sanctuary Bonus", 
        "branch": "Efficiency",
        "tier": 2,
        "cost": 2,
        "description": "+10 pts daily if all rooms completed that week",
        "effect": {"type": "weekly_completion_bonus", "points": 10},
        "prerequisites": ["hh_domestic_dynamo"],
        "position": {"x": 200, "y": 50}
    },
    "hh_house_manager": {
        "id": "hh_house_manager",
        "name": "House Manager",
        "branch": "Efficiency",
        "tier": 2,
        "cost": 2,
        "description": "Reduces cooldown on 'Take Over' offers (from 48h → 24h)",
        "effect": {"type": "takeover_cooldown", "reduction_hours": 24},
        "prerequisites": ["hh_pet_whisperer"],
        "position": {"x": 200, "y": 100}
    },
    "hh_efficient_operator": {
        "id": "hh_efficient_operator",
        "name": "Efficient Operator",
        "branch": "Efficiency",
        "tier": 2,
        "cost": 2,
        "description": "+5 pts per multi-room clean streak (3+ rooms in one day)",
        "effect": {"type": "room_streak_bonus", "min_rooms": 3, "points": 5},
        "prerequisites": ["hh_gearhead"],
        "position": {"x": 200, "y": 150}
    },
    
    # Tier 3
    "hh_clean_freak_mode": {
        "id": "hh_clean_freak_mode",
        "name": "Clean Freak Mode",
        "branch": "Efficiency",
        "tier": 3,
        "cost": 3,
        "description": "Doubles all household points for one 24-hour 'Blitz Day' (user-activated once weekly)",
        "effect": {"type": "weekly_double", "category": "household", "cooldown_days": 7, "user_activated": True},
        "prerequisites": ["hh_sanctuary_bonus", "hh_house_manager"],
        "position": {"x": 300, "y": 75}
    },
    "hh_balanced_habitat": {
        "id": "hh_balanced_habitat",
        "name": "Balanced Habitat", 
        "branch": "Efficiency",
        "tier": 3,
        "cost": 3,
        "description": "If both players complete 3+ home tasks in a day, +20 bonus each",
        "effect": {"type": "couple_daily_bonus", "min_tasks": 3, "category": "home", "points": 20},
        "prerequisites": ["hh_house_manager"],
        "position": {"x": 300, "y": 100}
    },
    "hh_maintenance_master": {
        "id": "hh_maintenance_master",
        "name": "Maintenance Master",
        "branch": "Efficiency", 
        "tier": 3,
        "cost": 3,
        "description": "+10 pts whenever a vehicle or repair-related quest is completed",
        "effect": {"type": "category_bonus", "category": "maintenance", "points": 10},
        "prerequisites": ["hh_efficient_operator"],
        "position": {"x": 300, "y": 150}
    }
}

# Predefined Quest Templates (NES-themed)
DEFAULT_QUEST_TEMPLATES = {
    # DAILY QUESTS - Standard household tasks
    "daily": [
        {"title": "🛏️ Make the bed", "room": "Bedroom", "points": 5, "difficulty": "EASY", "category": "household", "icon": "🛏️"},
        {"title": "🍽️ Wash dishes", "room": "Kitchen", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🍽️"},
        {"title": "🧹 Vacuum living room", "room": "Living Room", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🧹"},
        {"title": "🧺 Do laundry", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🧺"},
        {"title": "🍳 Cook breakfast", "room": "Kitchen", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🍳"},
        {"title": "🚿 Clean bathroom", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🚿"},
        {"title": "🗑️ Take out trash", "room": "Kitchen", "points": 5, "difficulty": "EASY", "category": "household", "icon": "🗑️"},
        {"title": "💧 Water plants", "room": "Living Room", "points": 5, "difficulty": "EASY", "category": "household", "icon": "💧"},
        {"title": "🦷 Brush teeth", "room": "Bathroom", "points": 5, "difficulty": "EASY", "category": "personal", "icon": "🦷"},
    ],
    
    # WEEKLY QUESTS - Bigger household projects
    "weekly": [
        {"title": "🏪 Grocery shopping", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🏪"},
        {"title": "🧽 Deep clean kitchen", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🧽"},
        {"title": "🍲 Food pantry visit", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🍲"},
        {"title": "🧼 Deep clean bathroom", "room": "Bathroom", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🧼"},
        {"title": "🛋️ Organize living room", "room": "Living Room", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🛋️"},
        {"title": "👕 Organize closet", "room": "Bedroom", "points": 20, "difficulty": "HARD", "category": "household", "icon": "👕"},
    ],
    
    # PET TASKS
    "pet": [
        {"title": "🍖 Feed pets", "room": "Kitchen", "points": 5, "difficulty": "EASY", "category": "pet", "icon": "🍖"},
        {"title": "🐕 Walk pets", "room": "US", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🐕"},
        {"title": "🛁 Groom or bathe pets", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🛁"},
        {"title": "🏥 Vet visits", "room": "US", "points": 20, "difficulty": "HARD", "category": "pet", "icon": "🏥"},
        {"title": "🧹 Clean litter box", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🧹"},
    ],
    
    # VEHICLE TASKS
    "vehicle": [
        {"title": "🛢️ Check oil / fluids", "room": "US", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🛢️"},
        {"title": "🧽 Clean or vacuum car", "room": "US", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🧽"},
        {"title": "⛽ Fill gas", "room": "US", "points": 5, "difficulty": "EASY", "category": "vehicle", "icon": "⛽"},
        {"title": "🔧 Repair or maintenance", "room": "US", "points": 20, "difficulty": "HARD", "category": "vehicle", "icon": "🔧"},
        {"title": "🚗 Wash exterior", "room": "US", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🚗"},
    ],
    
    # SPECIAL QUESTS - Event-based or irregular
    "special": [
        {"title": "🎄 Holiday decorating", "room": "Living Room", "points": 20, "difficulty": "HARD", "category": "special", "icon": "🎄"},
        {"title": "🛠️ Fix household item", "room": "US", "points": 20, "difficulty": "HARD", "category": "special", "icon": "🛠️"},
        {"title": "💊 Schedule appointments", "room": "US", "points": 10, "difficulty": "MEDIUM", "category": "special", "icon": "💊"},
        {"title": "📦 Organize storage", "room": "US", "points": 20, "difficulty": "HARD", "category": "special", "icon": "📦"},
    ]
}

# Couple Question Templates for Daily Bonus Round
COUPLE_QUESTION_TEMPLATES = [
    {"question": "What's your partner's favorite childhood memory?", "category": "memories"},
    {"question": "Which movie could they watch on repeat?", "category": "entertainment"},
    {"question": "What's their go-to comfort food?", "category": "food"},
    {"question": "What word would they use to describe love?", "category": "emotions"},
    {"question": "What's their biggest dream destination?", "category": "travel"}, 
    {"question": "What superpower would they choose?", "category": "fun"},
    {"question": "What's their favorite way to relax?", "category": "lifestyle"},
    {"question": "What makes them laugh the most?", "category": "humor"},
    {"question": "What's their proudest achievement?", "category": "accomplishments"},
    {"question": "What's their ideal weekend activity?", "category": "leisure"}
]

# Models
class User(BaseModel):
    userId: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}")
    displayName: str
    coupleId: str
    partnerId: Optional[str] = None
    points: int = 0
    level: int = 1
    talentPoints: int = 0
    talentBuild: Dict[str, Any] = Field(default_factory=dict)
    dailyActions: Dict[str, Any] = Field(default_factory=dict)
    couplePoints: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(BaseModel):
    taskId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room: str
    title: str
    basePoints: int
    difficulty: TaskDifficulty
    category: str = "household"  # household, pet, vehicle, personal, couple, special
    quest_type: QuestType = QuestType.DAILY
    linkGroupId: Optional[str] = None
    recurrence: str = "daily"
    assignedOnlyTo: Optional[str] = None
    timerMinutes: Optional[int] = None
    description: Optional[str] = None
    icon: str = "📋"  # NES-style emoji icon
    can_takeover: bool = True
    requires_verification: bool = False

class TalentNode(BaseModel):
    nodeId: str
    branch: TalentBranch
    tier: int
    costTalentPoints: int
    title: str
    description: str
    effect: Dict[str, Any]

class TaskCompletion(BaseModel):
    completionId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    taskId: str
    coupleId: str
    pointsEarned: int
    bonusPoints: int = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    verifiedBy: Optional[str] = None

class DailyOdds(BaseModel):
    date: str
    coupleId: str
    taskOdds: Dict[str, Dict[str, float]]  # taskId -> {userId: probability}
    computed_at: datetime = Field(default_factory=datetime.utcnow)

class Couple(BaseModel):
    coupleId: str = Field(default_factory=lambda: f"couple_{uuid.uuid4().hex[:8]}")
    inviteCode: str = Field(default_factory=lambda: f"{uuid.uuid4().hex[:6].upper()}")
    creatorId: str
    creatorName: str
    partnerId: Optional[str] = None
    partnerName: Optional[str] = None
    isActive: bool = False
    adventureTheme: str = Field(default_factory=lambda: random.choice([
        "Legendary Heroes of the Household Realm",
        "Champions of the Domestic Kingdom", 
        "Guardians of the Sacred Dwelling",
        "Masters of the Enchanted Estate",
        "Keepers of the Mystical Manor"
    ]))
    questPhrase: str = Field(default_factory=lambda: random.choice([
        "unite our powers to conquer the chaos and restore harmony",
        "embark on epic quests that will forge our legend",
        "join forces to unlock treasures beyond imagination",
        "combine our skills to achieve domestic dominion",
        "adventure together into realms of order and prosperity"
    ]))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    joined_at: Optional[datetime] = None

class CoupleInvitation(BaseModel):
    inviteCode: str
    message: str
    theme: str
    questPhrase: str
    creatorName: str
    expiresAt: datetime

# Request Models
class CreateUserRequest(BaseModel):
    displayName: str
    coupleCode: Optional[str] = None

class CreateCoupleRequest(BaseModel):
    creatorName: str

class JoinCoupleRequest(BaseModel):
    partnerName: str
    inviteCode: str

class CompleteTaskRequest(BaseModel):
    userId: str
    notes: Optional[str] = None
    photo: Optional[str] = None

class SubmitTalentBuildRequest(BaseModel):
    userId: str
    talentBuild: Dict[str, Any]

class VerifyTaskRequest(BaseModel):
    completionId: str
    verifierId: str

# New Enhanced Models for NES System
class CoupleQuestion(BaseModel):
    questionId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupleId: str
    question: str
    category: str
    date: str  # YYYY-MM-DD format
    player1_answer: Optional[str] = None
    player1_guess: Optional[str] = None
    player2_answer: Optional[str] = None
    player2_guess: Optional[str] = None
    points_awarded: int = 0
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TaskTakeover(BaseModel):
    takeoverId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupleId: str
    taskId: str
    originalAssignee: str
    takingOverUser: str
    multipliedPoints: int  # 3x original points
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False

class DailyLog(BaseModel):
    logId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupleId: str
    userId: str
    partnerId: str
    message: str
    filtered_message: Optional[str] = None  # AI-filtered version (when implemented)
    date: str  # YYYY-MM-DD format
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class VerificationRequest(BaseModel):
    verificationId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupleId: str
    completionId: str
    taskId: str
    userId: str  # person who completed the task
    partnerId: str  # person who needs to verify
    status: str = "pending"  # pending, verified, declined, proof_requested
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Request Models for New Features
class TakeoverTaskRequest(BaseModel):
    userId: str
    taskId: str

class SubmitCoupleAnswerRequest(BaseModel):
    userId: str
    questionId: str
    answer: str
    guess: str

class SubmitDailyLogRequest(BaseModel):
    userId: str
    partnerId: str
    message: str

class RespondVerificationRequest(BaseModel):
    verificationId: str
    response: str  # "verify", "decline", "request_proof"

# Talent Tree Node Definitions (exact from specification)
TALENT_TREE_NODES = {
    # EFFICIENCY BRANCH
    "eff_qw1": {
        "nodeId": "eff_qw1",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Quick Wipe",
        "description": "+1 point on all EASY chores",
        "effect": {"type": "point_bonus", "scope": "difficulty", "target": "EASY", "bonus": 1}
    },
    "eff_lh1": {
        "nodeId": "eff_lh1",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Laundry Hand",
        "description": "+2 points when starting/finishing a laundry load",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "laundry", "bonus": 2}
    },
    "eff_tm2": {
        "nodeId": "eff_tm2",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Trash Master",
        "description": "Reduce player's odds of trash takeout chore by -2%",
        "effect": {"type": "chore_shift", "scope": "task_keyword", "target": "trash", "delta": -0.02}
    },
    "eff_ds2": {
        "nodeId": "eff_ds2",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Dishes Speed",
        "description": "+3 points for finishing kitchen session",
        "effect": {"type": "point_bonus", "scope": "room_completion", "target": "Kitchen", "bonus": 3}
    },
    "eff_td3": {
        "nodeId": "eff_td3",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Toilet Dodge",
        "description": "Reduce player's odds of toilet scrub by -5%",
        "effect": {"type": "chore_shift", "scope": "task_keyword", "target": "toilet", "delta": -0.05}
    },
    "eff_vh3": {
        "nodeId": "eff_vh3",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Vacuum Hero",
        "description": "+5 pts for vacuuming",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "vacuum", "bonus": 5}
    },
    "eff_edge_cap": {
        "nodeId": "eff_edge_cap",
        "branch": TalentBranch.EFFICIENCY,
        "tier": 4,
        "costTalentPoints": 4,
        "title": "Housekeeper's Edge",
        "description": "+10% multiplier to points on all chores",
        "effect": {"type": "multiplier", "scope": "all_chores", "multiplier": 1.10}
    },
    
    # COUPLE BRANCH
    "cou_hug1": {
        "nodeId": "cou_hug1",
        "branch": TalentBranch.COUPLE,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Hug Timer",
        "description": "US hug gives +2 pts (12 total)",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "hug", "bonus": 2}
    },
    "cou_mass1": {
        "nodeId": "cou_mass1",
        "branch": TalentBranch.COUPLE,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Massage Points",
        "description": "+3 points per massage",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "massage", "bonus": 3}
    },
    "cou_team2": {
        "nodeId": "cou_team2",
        "branch": TalentBranch.COUPLE,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Team Boost",
        "description": "If both complete tasks in the same hour, double points for that hour",
        "effect": {"type": "conditional_multiplier", "scope": "hourly_sync", "multiplier": 2.0}
    },
    "cou_grat2": {
        "nodeId": "cou_grat2",
        "branch": TalentBranch.COUPLE,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Gratitude Shout",
        "description": "+1 point for partner-verified compliment",
        "effect": {"type": "point_bonus", "scope": "verification", "bonus": 1}
    },
    "cou_rom3": {
        "nodeId": "cou_rom3",
        "branch": TalentBranch.COUPLE,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Romance Perk",
        "description": "After a date-night task, next chore odds are shifted favorably by -3%",
        "effect": {"type": "conditional_chore_shift", "scope": "post_date", "delta": -0.03}
    },
    "cou_double3": {
        "nodeId": "cou_double3",
        "branch": TalentBranch.COUPLE,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Double Us",
        "description": "Once per day, US tasks yield double points",
        "effect": {"type": "daily_multiplier", "scope": "us_tasks", "multiplier": 2.0}
    },
    "cou_soul_cap": {
        "nodeId": "cou_soul_cap",
        "branch": TalentBranch.COUPLE,
        "tier": 4,
        "costTalentPoints": 4,
        "title": "Soulmate Bonus",
        "description": "Daily US tasks give +20% to all points earned that day",
        "effect": {"type": "daily_multiplier", "scope": "all_after_us", "multiplier": 1.20}
    },
    
    # GROWTH BRANCH
    "gr_hyd1": {
        "nodeId": "gr_hyd1",
        "branch": TalentBranch.GROWTH,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Hydration Harmony",
        "description": "+1 point per verified glass",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "water", "bonus": 1}
    },
    "gr_step1": {
        "nodeId": "gr_step1",
        "branch": TalentBranch.GROWTH,
        "tier": 1,
        "costTalentPoints": 1,
        "title": "Step Sync",
        "description": "+5 points per 1-mile tracked walk",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "walk", "bonus": 5}
    },
    "gr_str2": {
        "nodeId": "gr_str2",
        "branch": TalentBranch.GROWTH,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Stretch It Out",
        "description": "+2 pts per 5-min session",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "stretch", "bonus": 2}
    },
    "gr_mind2": {
        "nodeId": "gr_mind2",
        "branch": TalentBranch.GROWTH,
        "tier": 2,
        "costTalentPoints": 2,
        "title": "Mind Check",
        "description": "+2 pts per journal entry verified by partner",
        "effect": {"type": "point_bonus", "scope": "task_keyword", "target": "journal", "bonus": 2}
    },
    "gr_cons3": {
        "nodeId": "gr_cons3",
        "branch": TalentBranch.GROWTH,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Consistency Buff",
        "description": "+10% points if 7-day streak on selected growth habit",
        "effect": {"type": "streak_multiplier", "scope": "growth_habits", "multiplier": 1.10, "streak_days": 7}
    },
    "gr_early3": {
        "nodeId": "gr_early3",
        "branch": TalentBranch.GROWTH,
        "tier": 3,
        "costTalentPoints": 3,
        "title": "Early Bird",
        "description": "+5 points when first task completed before 10AM",
        "effect": {"type": "time_bonus", "scope": "first_task", "time_before": "10:00", "bonus": 5}
    },
    "gr_well_cap": {
        "nodeId": "gr_well_cap",
        "branch": TalentBranch.GROWTH,
        "tier": 4,
        "costTalentPoints": 4,
        "title": "Wellness Overflow",
        "description": "+10% chance personal growth points convert to couple points",
        "effect": {"type": "conversion_chance", "scope": "growth_to_couple", "chance": 0.10}
    }
}

# Sample Task List (following specification)
DEFAULT_TASKS = [
    # Kitchen Quests
    {"taskId": "kit_clear_counters", "room": "Kitchen", "title": "Clear counters", "basePoints": 5, "difficulty": TaskDifficulty.EASY, "description": "Wipe and organize kitchen countertops"},
    {"taskId": "kit_dishes", "room": "Kitchen", "title": "Wash dishes / load dishwasher", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM, "linkGroupId": "kitchen_chain"},
    {"taskId": "kit_take_trash", "room": "Kitchen", "title": "Take out trash", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM},
    {"taskId": "kit_cook_meal", "room": "Kitchen", "title": "Cook dinner", "basePoints": 20, "difficulty": TaskDifficulty.HARD, "linkGroupId": "kitchen_chain"},
    
    # Bathroom Quests
    {"taskId": "bath_sink_mirror", "room": "Bathroom", "title": "Wipe sink & mirror", "basePoints": 5, "difficulty": TaskDifficulty.EASY},
    {"taskId": "bath_toilet_scrub", "room": "Bathroom", "title": "Scrub toilet", "basePoints": 20, "difficulty": TaskDifficulty.HARD},
    {"taskId": "bath_shower_clean", "room": "Bathroom", "title": "Clean shower/tub", "basePoints": 20, "difficulty": TaskDifficulty.HARD},
    
    # Living Room Quests
    {"taskId": "lounge_vacuum", "room": "Living Room", "title": "Vacuum carpet/rugs", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM},
    {"taskId": "lounge_dust", "room": "Living Room", "title": "Dust furniture", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM},
    
    # Bedroom Quests
    {"taskId": "bed_make_bed", "room": "Bedroom", "title": "Make bed / change sheets", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM},
    {"taskId": "bed_laundry", "room": "Bedroom", "title": "Start/finish laundry", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM},
    
    # US (Couple) Quests
    {"taskId": "us_hug", "room": "US", "title": "Heart-to-heart hug", "basePoints": 10, "difficulty": TaskDifficulty.EASY, "timerMinutes": 2},
    {"taskId": "us_massage_partner", "room": "US", "title": "Give partner massage", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM, "timerMinutes": 5},
    {"taskId": "us_conversation", "room": "US", "title": "Quality conversation", "basePoints": 15, "difficulty": TaskDifficulty.MEDIUM, "timerMinutes": 15},
    {"taskId": "us_date_planning", "room": "US", "title": "Plan a date together", "basePoints": 20, "difficulty": TaskDifficulty.HARD},
    
    # Games (Couple Quests)
    {"taskId": "game_chess", "room": "Games", "title": "Play Chess together", "basePoints": 20, "difficulty": TaskDifficulty.MEDIUM, "description": "Strategic board game battle"},
    {"taskId": "game_battleship", "room": "Games", "title": "Play Battleship", "basePoints": 25, "difficulty": TaskDifficulty.MEDIUM, "description": "Naval warfare strategy game"},
    {"taskId": "game_gofish", "room": "Games", "title": "Play Go Fish", "basePoints": 15, "difficulty": TaskDifficulty.EASY, "description": "Classic card fishing game"},
    {"taskId": "game_speed", "room": "Games", "title": "Play Speed", "basePoints": 30, "difficulty": TaskDifficulty.HARD, "description": "Fast-paced card action"},
    {"taskId": "game_war", "room": "Games", "title": "Play War", "basePoints": 18, "difficulty": TaskDifficulty.EASY, "description": "Battle of the cards"},
    {"taskId": "game_backgammon", "room": "Games", "title": "Play Backgammon", "basePoints": 22, "difficulty": TaskDifficulty.MEDIUM, "description": "Ancient strategy and luck"},
    
    # Growth (Personal) Quests
    {"taskId": "growth_water", "room": "Growth", "title": "Drink 8 glasses of water", "basePoints": 5, "difficulty": TaskDifficulty.EASY, "description": "Stay hydrated throughout the day"},
    {"taskId": "growth_walk", "room": "Growth", "title": "Take a 1-mile walk", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM, "description": "Get your steps in"},
    {"taskId": "growth_stretch", "room": "Growth", "title": "5-minute stretch session", "basePoints": 8, "difficulty": TaskDifficulty.EASY, "description": "Flexibility and wellness"},
    {"taskId": "growth_journal", "room": "Growth", "title": "Write in journal", "basePoints": 10, "difficulty": TaskDifficulty.MEDIUM, "description": "Reflect on your day"},
    {"taskId": "growth_meditation", "room": "Growth", "title": "10-minute meditation", "basePoints": 15, "difficulty": TaskDifficulty.MEDIUM, "description": "Mindfulness practice"},
    {"taskId": "growth_exercise", "room": "Growth", "title": "30-minute exercise", "basePoints": 20, "difficulty": TaskDifficulty.HARD, "description": "Get your heart pumping"}
]

# Helper Functions
def calculate_level(points: int) -> tuple:
    """Calculate level and talent points from total points (Enhanced NES system)"""
    level = math.floor(points / GAME_CONSTANTS["LEVELING"]["POINTS_PER_LEVEL"]) + 1
    # New system: Every 5 levels unlocks 1.5 Talent Points
    talent_points_earned = math.floor((level - 1) / GAME_CONSTANTS["LEVELING"]["LEVELS_PER_TALENT_POINT"]) * GAME_CONSTANTS["LEVELING"]["TALENT_POINTS_PER_5_LEVELS"]
    return level, talent_points_earned

def calculate_enhanced_task_points(task: Dict, user_talents: Dict, completion_time: datetime, is_first_task: bool = False, consecutive_tasks: int = 0) -> Dict:
    """
    Enhanced 6-step point calculation process:
    1. Base points (5/10/20 based on difficulty)
    2. Talent bonuses (flat additions)  
    3. Talent multipliers (percentage increases)
    4. Early bird bonus (if applicable)
    5. Housekeeper's Edge (if applicable) 
    6. Chore shift calculations (assignment probability adjustments)
    """
    result = {
        "base_points": 0,
        "talent_bonuses": 0,
        "talent_multipliers": 1.0,
        "early_bird_bonus": 0,
        "housekeeper_edge": 0,
        "total_points": 0,
        "breakdown": []
    }
    
    # Step 1: Base Points
    difficulty = task.get("difficulty", "EASY")
    result["base_points"] = GAME_CONSTANTS["POINTS"][difficulty]
    result["breakdown"].append(f"Base {difficulty}: {result['base_points']} pts")
    
    # Step 2: Talent Bonuses (flat additions)
    if user_talents and user_talents.get("nodeIds"):
        for node_id in user_talents["nodeIds"]:
            if node_id not in TALENT_TREE_NODES:
                continue
                
            node = TALENT_TREE_NODES[node_id]
            effect = node["effect"]
            
            # Check if talent applies to this task
            if applies_to_task(effect, task):
                if effect["type"] == "category_bonus" and task.get("category") == effect.get("category"):
                    bonus = effect.get("points", 0)
                    result["talent_bonuses"] += bonus
                    result["breakdown"].append(f"{node['name']}: +{bonus} pts")
                    
                elif effect["type"] == "first_task_bonus" and is_first_task:
                    bonus = effect.get("value", 0)
                    result["talent_bonuses"] += bonus
                    result["breakdown"].append(f"{node['name']} (First Task): +{bonus} pts")
                    
                elif effect["type"] == "streak_bonus" and consecutive_tasks >= effect.get("streak_count", 0):
                    bonus = effect.get("bonus", 0)
                    result["talent_bonuses"] += bonus
                    result["breakdown"].append(f"{node['name']} (Streak): +{bonus} pts")
    
    # Step 3: Talent Multipliers  
    if user_talents and user_talents.get("nodeIds"):
        for node_id in user_talents["nodeIds"]:
            if node_id not in TALENT_TREE_NODES:
                continue
                
            node = TALENT_TREE_NODES[node_id]
            effect = node["effect"]
            
            if applies_to_task(effect, task):
                if effect["type"] == "category_multiplier" and task.get("category") == effect.get("category"):
                    multiplier = effect.get("multiplier", 1.0)
                    result["talent_multipliers"] *= multiplier
                    result["breakdown"].append(f"{node['name']}: x{multiplier}")
                    
                elif effect["type"] == "joint_task_multiplier" and task.get("can_be_joint", False):
                    multiplier = effect.get("multiplier", 1.0)
                    result["talent_multipliers"] *= multiplier 
                    result["breakdown"].append(f"{node['name']} (Joint): x{multiplier}")
    
    # Step 4: Early Bird Bonus (completed before 2 PM)
    if completion_time.hour < 14:
        early_bird_talents = [node_id for node_id in user_talents.get("nodeIds", []) 
                             if node_id in TALENT_TREE_NODES and 
                             TALENT_TREE_NODES[node_id]["effect"].get("type") == "time_bonus"]
        if early_bird_talents:
            result["early_bird_bonus"] = int((result["base_points"] + result["talent_bonuses"]) * 0.1)
            result["breakdown"].append(f"Early Bird: +{result['early_bird_bonus']} pts")
    
    # Step 5: Housekeeper's Edge (if user has cleaning specialization)
    cleaning_bonuses = [node_id for node_id in user_talents.get("nodeIds", []) 
                       if node_id in TALENT_TREE_NODES and 
                       task.get("category") == "cleaning" and
                       "cleaning" in TALENT_TREE_NODES[node_id]["effect"].get("category", "")]
    if cleaning_bonuses and task.get("category") == "household":
        result["housekeeper_edge"] = 2
        result["breakdown"].append(f"Housekeeper's Edge: +{result['housekeeper_edge']} pts")
    
    # Step 6: Calculate Final Total
    base_with_bonuses = result["base_points"] + result["talent_bonuses"]
    multiplied_total = base_with_bonuses * result["talent_multipliers"] 
    result["total_points"] = int(multiplied_total + result["early_bird_bonus"] + result["housekeeper_edge"])
    
    return result

def applies_to_task(effect: Dict, task: Dict) -> bool:
    """Check if a talent effect applies to a specific task"""
    if effect.get("category") and task.get("category") != effect["category"]:
        return False
    if effect.get("room") and task.get("room") != effect["room"]:
        return False
    if effect.get("difficulty") and task.get("difficulty") != effect["difficulty"]:
        return False
    return True

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value between min and max"""
    return max(min_val, min(value, max_val))

def sum_talent_effects(talent_build: Dict, task: Dict, effect_type: str) -> float:
    """Sum all talent effects of a specific type for a task"""
    total = 0.0
    
    if not talent_build.get("nodeIds"):
        return total
        
    for node_id in talent_build["nodeIds"]:
        if node_id not in TALENT_TREE_NODES:
            continue
            
        node = TALENT_TREE_NODES[node_id]
        effect = node["effect"]
        
        if effect["type"] != effect_type:
            continue
            
        # Check if effect applies to this task
        applies = False
        
        if effect["scope"] == "all_chores":
            applies = True
        elif effect["scope"] == "difficulty" and task["difficulty"] == effect["target"]:
            applies = True
        elif effect["scope"] == "task_keyword" and effect["target"].lower() in task["title"].lower():
            applies = True
        elif effect["scope"] == "room" and task["room"] == effect["target"]:
            applies = True
            
        if applies:
            if effect_type == "chore_shift":
                total += effect.get("delta", 0)
            elif effect_type == "point_bonus":
                total += effect.get("bonus", 0)
    
    return total

def compute_daily_odds(couple_id: str, date: str, user1_talents: Dict = None, user2_talents: Dict = None) -> Dict[str, Dict[str, float]]:
    """Advanced 50/50 task assignment algorithm with talent tree modifications"""
    tasks = DEFAULT_TASKS
    task_odds = {}
    
    # Initialize base 50/50 odds
    base_odds = {task["taskId"]: {"user1": 0.5, "user2": 0.5} for task in tasks}
    
    # Apply talent tree modifications
    if user1_talents or user2_talents:
        task_odds = apply_talent_modifications(base_odds, tasks, user1_talents or {}, user2_talents or {})
    else:
        task_odds = base_odds
    
    # Apply room balancing (ensure both partners get tasks from each room)
    task_odds = apply_room_balancing(task_odds, tasks)
    
    # Apply random bonus chances (1-3% modifications)
    task_odds = apply_random_bonuses(task_odds, date)
    
    return task_odds

def apply_talent_modifications(odds: Dict, tasks: List, user1_talents: Dict, user2_talents: Dict) -> Dict:
    """Apply talent tree effects to task assignment odds"""
    modified_odds = odds.copy()
    
    for task in tasks:
        task_id = task["taskId"]
        room = task["room"]
        difficulty = task["difficulty"]
        title = task["title"].lower()
        
        # User 1 talent effects
        user1_modifier = 0
        
        # Kitchen specialization - "Wet hands don't scare me"
        if user1_talents.get("kitchen_specialist") and room == "Kitchen":
            user1_modifier += 0.15  # 15% more likely to get kitchen tasks
            
        # Difficulty preferences
        if user1_talents.get("easy_task_avoider") and difficulty == "EASY":
            user1_modifier -= 0.10
        elif user1_talents.get("hard_task_seeker") and difficulty == "HARD":
            user1_modifier += 0.10
            
        # Specific task preferences
        if user1_talents.get("trash_master") and "trash" in title:
            user1_modifier -= 0.20  # Less likely to get trash tasks
        elif user1_talents.get("laundry_hand") and "laundry" in title:
            user1_modifier += 0.15
            
        # User 2 talent effects (mirror logic)
        user2_modifier = 0
        
        if user2_talents.get("kitchen_specialist") and room == "Kitchen":
            user2_modifier += 0.15
            
        if user2_talents.get("easy_task_avoider") and difficulty == "EASY":
            user2_modifier -= 0.10
        elif user2_talents.get("hard_task_seeker") and difficulty == "HARD":
            user2_modifier += 0.10
            
        if user2_talents.get("trash_master") and "trash" in title:
            user2_modifier -= 0.20
        elif user2_talents.get("laundry_hand") and "laundry" in title:
            user2_modifier += 0.15
        
        # Apply modifications while maintaining balance
        user1_odds = max(0.1, min(0.9, 0.5 + user1_modifier))
        user2_odds = 1.0 - user1_odds
        
        modified_odds[task_id] = {
            "user1": user1_odds,
            "user2": user2_odds
        }
    
    return modified_odds

def apply_room_balancing(odds: Dict, tasks: List) -> Dict:
    """Ensure both partners get tasks from each room (room redistribution rule)"""
    # Group tasks by room
    rooms = {}
    for task in tasks:
        room = task["room"]
        if room not in rooms:
            rooms[room] = []
        rooms[room].append(task["taskId"])
    
    # For each room, ensure neither partner gets more than 70% of tasks
    balanced_odds = odds.copy()
    
    for room, task_ids in rooms.items():
        if len(task_ids) < 2:  # Skip rooms with only 1 task
            continue
            
        # Calculate current distribution
        user1_total = sum(odds[task_id]["user1"] for task_id in task_ids)
        user2_total = sum(odds[task_id]["user2"] for task_id in task_ids)
        
        # If distribution is too skewed, rebalance
        max_allowed = len(task_ids) * 0.7
        
        if user1_total > max_allowed:
            # Reduce user1's odds in this room
            excess = user1_total - max_allowed
            for task_id in task_ids:
                reduction = (excess / len(task_ids))
                balanced_odds[task_id]["user1"] = max(0.1, odds[task_id]["user1"] - reduction)
                balanced_odds[task_id]["user2"] = 1.0 - balanced_odds[task_id]["user1"]
                
        elif user2_total > max_allowed:
            # Reduce user2's odds in this room
            excess = user2_total - max_allowed
            for task_id in task_ids:
                reduction = (excess / len(task_ids))
                balanced_odds[task_id]["user2"] = max(0.1, odds[task_id]["user2"] - reduction)
                balanced_odds[task_id]["user1"] = 1.0 - balanced_odds[task_id]["user2"]
    
    return balanced_odds

def apply_random_bonuses(odds: Dict, date: str) -> Dict:
    """Apply 1-3% random bonus chances based on date seed"""
    # Use date as seed for consistent daily randomness
    random.seed(date)
    
    modified_odds = odds.copy()
    
    for task_id in odds.keys():
        # 20% chance of getting a random bonus
        if random.random() < 0.2:
            # Random bonus between 1-3%
            bonus = random.uniform(0.01, 0.03)
            
            # Randomly apply to user1 or user2
            if random.random() < 0.5:
                # Boost user1
                new_user1_odds = min(0.9, modified_odds[task_id]["user1"] + bonus)
                modified_odds[task_id]["user1"] = new_user1_odds
                modified_odds[task_id]["user2"] = 1.0 - new_user1_odds
            else:
                # Boost user2
                new_user2_odds = min(0.9, modified_odds[task_id]["user2"] + bonus)
                modified_odds[task_id]["user2"] = new_user2_odds
                modified_odds[task_id]["user1"] = 1.0 - new_user2_odds
    
    return modified_odds

def generate_daily_assignments(couple_id: str, date: str = None) -> Dict[str, str]:
    """Generate actual task assignments for the day using computed odds"""
    if not date:
        date = datetime.utcnow().strftime('%Y-%m-%d')
    
    # Get couple users to fetch their talent builds
    # For now, use empty talent builds - will be enhanced when talent system is complete
    user1_talents = {}
    user2_talents = {}
    
    # Compute odds
    odds = compute_daily_odds(couple_id, date, user1_talents, user2_talents)
    
    # Generate assignments using weighted random selection
    assignments = {}
    random.seed(f"{couple_id}_{date}")  # Consistent seed for same day
    
    for task_id, task_odds in odds.items():
        if random.random() < task_odds["user1"]:
            assignments[task_id] = "user1"
        else:
            assignments[task_id] = "user2"
    
    return assignments

# API Routes

@api_router.post("/couples/create", response_model=CoupleInvitation)
async def create_couple_invitation(request: CreateCoupleRequest):
    """Create a new couple and generate epic adventure invitation"""
    # Create couple record
    couple = Couple(
        creatorId=f"temp_{uuid.uuid4().hex[:8]}",  # Will be updated when creator creates user
        creatorName=request.creatorName
    )
    
    await db.couples.insert_one(couple.dict())
    
    # Generate epic invitation message
    invitation_messages = [
        f"🗡️ **SUMMONS TO ADVENTURE** 🛡️\n\n"
        f"Greetings, Noble {request.creatorName} seeks a legendary partner!\n\n"
        f"You have been chosen to join the {couple.adventureTheme} and {couple.questPhrase}!\n\n"
        f"✨ **What awaits you:**\n"
        f"• Epic household quests with XP rewards\n"
        f"• Legendary talent trees to unlock\n"
        f"• Mini-games and challenges\n" 
        f"• Glory, honor, and domestic prosperity!\n\n"
        f"🏰 **Join Code:** {couple.inviteCode}\n\n"
        f"Will you accept this call to adventure? 🌟",
        
        f"⚔️ **LEGENDARY INVITATION** 🏆\n\n"
        f"Hark! {request.creatorName} has issued a challenge!\n\n"
        f"Join the {couple.adventureTheme} and together we shall {couple.questPhrase}!\n\n"
        f"🎮 **Your destiny includes:**\n"
        f"• Transforming chores into epic quests\n"
        f"• Earning XP, levels, and talent points\n"
        f"• Cooperative mini-games and rewards\n"
        f"• Building the ultimate household kingdom!\n\n"
        f"🔮 **Adventure Code:** {couple.inviteCode}\n\n"
        f"Answer the call, brave adventurer! 🌟"
    ]
    
    invitation = CoupleInvitation(
        inviteCode=couple.inviteCode,
        message=random.choice(invitation_messages),
        theme=couple.adventureTheme,
        questPhrase=couple.questPhrase,
        creatorName=request.creatorName,
        expiresAt=datetime.utcnow() + timedelta(days=7)
    )
    
    return invitation

@api_router.post("/couples/join", response_model=dict)
async def join_couple_adventure(request: JoinCoupleRequest):
    """Join an existing couple using invitation code"""
    # Find couple by invite code
    couple = await db.couples.find_one({"inviteCode": request.inviteCode})
    if not couple:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    if couple["partnerId"]:
        raise HTTPException(status_code=400, detail="This adventure already has two heroes!")
    
    # Update couple with partner info
    await db.couples.update_one(
        {"inviteCode": request.inviteCode},
        {
            "$set": {
                "partnerName": request.partnerName,
                "joined_at": datetime.utcnow(),
                "isActive": True
            }
        }
    )
    
    return {
        "message": f"🎉 Welcome to the adventure, {request.partnerName}! You have joined {couple['creatorName']} in the {couple['adventureTheme']}!",
        "coupleId": couple["coupleId"],
        "adventureTheme": couple["adventureTheme"]
    }

@api_router.get("/couples/{invite_code}/preview")
async def preview_couple_invitation(invite_code: str):
    """Preview couple invitation details"""
    couple = await db.couples.find_one({"inviteCode": invite_code})
    if not couple:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    return {
        "creatorName": couple["creatorName"],
        "adventureTheme": couple["adventureTheme"],
        "questPhrase": couple["questPhrase"],
        "isAvailable": couple["partnerId"] is None
    }

@api_router.post("/users", response_model=User)
async def create_user(request: CreateUserRequest):
    """Create a new user and link to couple"""
    if request.coupleCode:
        # Find couple by invite code
        couple = await db.couples.find_one({"inviteCode": request.coupleCode})
        if not couple:
            raise HTTPException(status_code=404, detail="Invalid invitation code")
        
        # Check if there's already a user for this couple (creator)
        existing_user = await db.users.find_one({"coupleId": couple["coupleId"]})
        
        if not existing_user:
            # This is the creator joining their own couple
            creator_user = User(
                displayName=request.displayName,
                coupleId=couple["coupleId"]
            )
            
            # Update couple with creator ID
            await db.couples.update_one(
                {"coupleId": couple["coupleId"]},
                {"$set": {"creatorId": creator_user.userId}}
            )
            
            # Initialize default tasks for this couple
            for task_data in DEFAULT_TASKS:
                task = Task(**task_data)
                await db.tasks.insert_one(task.dict())
            
            # Initialize talent tree nodes for this couple
            for node_id, node_data in TALENT_TREE_NODES.items():
                node = TalentNode(**node_data)
                await db.talent_nodes.insert_one(node.dict())
            
            await db.users.insert_one(creator_user.dict())
            return creator_user
            
        elif couple["partnerId"] is None:
            # This is the partner joining
            partner_user = User(
                displayName=request.displayName,
                coupleId=couple["coupleId"],
                partnerId=existing_user["userId"]
            )
            
            # Update couple with partner ID
            await db.couples.update_one(
                {"inviteCode": request.coupleCode},
                {"$set": {"partnerId": partner_user.userId, "isActive": True, "joined_at": datetime.utcnow()}}
            )
            
            # Update creator user with partner info
            await db.users.update_one(
                {"userId": existing_user["userId"]},
                {"$set": {"partnerId": partner_user.userId}}
            )
            
            await db.users.insert_one(partner_user.dict())
            return partner_user
        else:
            raise HTTPException(status_code=400, detail="This adventure already has two heroes!")
    else:
        # Create new user without couple (they need to create/join a couple first)
        raise HTTPException(status_code=400, detail="Must join an adventure! Use couple invitation system.")

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user with calculated level and talent points"""
    user = await db.users.find_one({"userId": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pop('_id', None)
    
    # Calculate current level and available talent points
    level, talent_points_earned = calculate_level(user.get("points", 0))
    talent_points_used = len(user.get("talentBuild", {}).get("nodeIds", []))
    available_talent_points = talent_points_earned - talent_points_used
    
    user["level"] = level
    user["talentPoints"] = available_talent_points
    user["talentPointsTotal"] = talent_points_earned
    
    return user

@api_router.get("/couples/{couple_id}/tasks")
async def get_tasks(couple_id: str):
    """Get all tasks for a couple, organized by room"""
    tasks_cursor = db.tasks.find({})
    tasks = []
    async for task in tasks_cursor:
        task.pop('_id', None)
        tasks.append(task)
    
    # Organize by room
    organized_tasks = {}
    for task in tasks:
        room = task["room"]
        if room not in organized_tasks:
            organized_tasks[room] = []
        organized_tasks[room].append(task)
    
    return organized_tasks

@api_router.get("/couples/{couple_id}/odds/{date}")
async def get_daily_odds(couple_id: str, date: str):
    """Get or compute daily task assignment odds"""
    odds = await db.daily_odds.find_one({"coupleId": couple_id, "date": date})
    if not odds:
        # Compute new odds
        task_odds = compute_daily_odds(couple_id, date)
        new_odds = DailyOdds(
            date=date,
            coupleId=couple_id,
            taskOdds=task_odds
        )
        await db.daily_odds.insert_one(new_odds.dict())
        return new_odds.dict()
    
    odds.pop('_id', None)
    return odds

@api_router.get("/couples/{couple_id}/assignments/{date}")
async def get_daily_assignments(couple_id: str, date: str):
    """Get daily task assignments for a couple"""
    # Check if assignments already exist for this date
    existing = await db.daily_assignments.find_one({
        "coupleId": couple_id,
        "date": date
    })
    
    if existing:
        existing.pop('_id', None)
        return existing
    
    # Generate new assignments
    assignments = generate_daily_assignments(couple_id, date)
    
    # Store in database
    assignment_doc = {
        "coupleId": couple_id,
        "date": date,
        "assignments": assignments,
        "created_at": datetime.utcnow()
    }
    
    await db.daily_assignments.insert_one(assignment_doc)
    
    return assignment_doc

@api_router.get("/couples/{couple_id}/my-tasks/{user_id}")
async def get_my_daily_tasks(couple_id: str, user_id: str, date: str = None):
    """Get only the tasks assigned to a specific user for today"""
    if not date:
        date = datetime.utcnow().strftime('%Y-%m-%d')
    
    # Get daily assignments
    assignments = await get_daily_assignments(couple_id, date)
    user_assignments = assignments.get("assignments", {})
    
    # Get all tasks
    tasks = await db.tasks.find().to_list(1000)
    # Remove ObjectId fields for JSON serialization
    for task in tasks:
        task.pop('_id', None)
    tasks_by_id = {task["taskId"]: task for task in tasks}
    
    # Get couple users to determine which user is "user1" or "user2"
    users = await db.users.find({"coupleId": couple_id}).to_list(2)
    user_key = "user1" if users[0]["userId"] == user_id else "user2"
    
    # Filter tasks assigned to this user
    my_tasks = {}
    for task_id, assigned_to in user_assignments.items():
        if assigned_to == user_key and task_id in tasks_by_id:
            task = tasks_by_id[task_id]
            room = task["room"]
            if room not in my_tasks:
                my_tasks[room] = []
            my_tasks[room].append(task)
    
    return my_tasks

@api_router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: CompleteTaskRequest):
    """Complete a task and award points with bonuses"""
    user = await db.users.find_one({"userId": request.userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    task = await db.tasks.find_one({"taskId": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Calculate base points
    base_points = task["basePoints"]
    
    # Calculate bonus points from talent tree
    talent_build = user.get("talentBuild", {})
    bonus_points = sum_talent_effects(talent_build, task, "point_bonus")
    
    # Check for initiative bonus
    today = datetime.now().strftime("%Y-%m-%d")
    daily_completions = await db.task_completions.find({
        "coupleId": user["coupleId"],
        "timestamp": {"$gte": datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)}
    }).to_list(1000)
    
    if len(daily_completions) == 0:
        # First task of the day bonus - using early bird bonus logic
        bonus_points += 5  # Initiative bonus for first task
    
    total_points = base_points + int(bonus_points)
    
    # Update user points
    new_total = user["points"] + total_points
    level, _ = calculate_level(new_total)
    
    await db.users.update_one(
        {"userId": request.userId},
        {"$set": {"points": new_total, "level": level}}
    )
    
    # Record completion
    completion = TaskCompletion(
        userId=request.userId,
        taskId=task_id,
        coupleId=user["coupleId"],
        pointsEarned=base_points,
        bonusPoints=int(bonus_points)
    )
    await db.task_completions.insert_one(completion.dict())
    
    # Send real-time update to partner
    await manager.send_to_couple(user["coupleId"], {
        "type": "task_completed",
        "userName": user["displayName"],
        "taskTitle": task["title"],
        "points": total_points,
        "sound": GAME_CONSTANTS["SOUNDS"]["TASK_DONE"]
    })
    
    return {
        "message": "Task completed!",
        "basePoints": base_points,
        "bonusPoints": int(bonus_points),
        "totalPoints": total_points,
        "newTotal": new_total,
        "newLevel": level
    }

@api_router.post("/builds/submit")
async def submit_talent_build(request: SubmitTalentBuildRequest):
    """Submit talent tree build for a user"""
    user = await db.users.find_one({"userId": request.userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate talent points available
    _, talent_points_earned = calculate_level(user["points"])
    talent_points_used = len(request.talentBuild.get("nodeIds", []))
    
    # Calculate total cost
    total_cost = 0
    for node_id in request.talentBuild.get("nodeIds", []):
        if node_id in TALENT_TREE_NODES:
            total_cost += TALENT_TREE_NODES[node_id]["costTalentPoints"]
    
    if total_cost > talent_points_earned:
        raise HTTPException(status_code=400, detail="Not enough talent points")
    
    # Update user's talent build
    await db.users.update_one(
        {"userId": request.userId},
        {"$set": {"talentBuild": request.talentBuild}}
    )
    
    return {"message": "Talent build submitted successfully"}

@api_router.get("/talent-nodes")
async def get_talent_nodes():
    """Get all talent tree nodes"""
    # Convert dict to list of nodes
    nodes_list = []
    for node_id, node_data in TALENT_TREE_NODES.items():
        node_data_copy = node_data.copy()
        if "id" not in node_data_copy and "nodeId" not in node_data_copy:
            node_data_copy["id"] = node_id
        nodes_list.append(node_data_copy)
    return nodes_list

@api_router.get("/game-constants")
async def get_game_constants():
    """Get game constants for frontend"""
    return GAME_CONSTANTS

# ===== NEW NES-THEMED ENDPOINTS =====

@api_router.get("/quest-templates")
async def get_quest_templates():
    """Get all predefined quest templates"""
    return DEFAULT_QUEST_TEMPLATES

@api_router.post("/tasks/{task_id}/takeover")
async def takeover_task(task_id: str, request: TakeoverTaskRequest):
    """Allow one partner to take over another's task for 3x points"""
    # Find the task
    task = await db.tasks.find_one({"taskId": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Find user and verify they're in a couple
    user = await db.users.find_one({"userId": request.userId})
    if not user or not user.get("coupleId"):
        raise HTTPException(status_code=404, detail="User not found or not in couple")
    
    # Check if task can be taken over
    if not task.get("can_takeover", True):
        raise HTTPException(status_code=400, detail="This task cannot be taken over")
    
    # Check for existing takeover
    existing_takeover = await db.takeovers.find_one({
        "taskId": task_id, 
        "coupleId": user["coupleId"],
        "completed": False
    })
    if existing_takeover:
        raise HTTPException(status_code=400, detail="Task already taken over")
    
    # Calculate 3x points
    base_points = task.get("basePoints", GAME_CONSTANTS["POINTS"][task["difficulty"]])
    multiplied_points = base_points * GAME_CONSTANTS["TASK_TAKEOVER"]["MULTIPLIER"]
    
    # Create takeover record
    takeover = TaskTakeover(
        coupleId=user["coupleId"],
        taskId=task_id,
        originalAssignee=task.get("assignedOnlyTo", ""),
        takingOverUser=request.userId,
        multipliedPoints=multiplied_points
    )
    
    await db.takeovers.insert_one(takeover.dict())
    
    # Notify partner via WebSocket
    await manager.send_to_couple(user["coupleId"], {
        "type": "task_takeover",
        "message": f"{user['displayName']} took over task: {task['title']} (+{multiplied_points} pts)",
        "taskId": task_id,
        "takeoverUser": user["displayName"]
    })
    
    return {
        "message": "Task taken over successfully",
        "multipliedPoints": multiplied_points,
        "takeover": takeover.dict()
    }

@api_router.get("/couple-questions/{couple_id}")
async def get_daily_couple_question(couple_id: str):
    """Get today's couple question for the couple"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Check if couple already has a question for today
    existing_question = await db.couple_questions.find_one({
        "coupleId": couple_id,
        "date": today
    })
    
    if existing_question:
        return {"question": existing_question}
    
    # Create new daily question
    import random
    question_template = random.choice(COUPLE_QUESTION_TEMPLATES)
    
    new_question = CoupleQuestion(
        coupleId=couple_id,
        question=question_template["question"],
        category=question_template["category"],
        date=today
    )
    
    await db.couple_questions.insert_one(new_question.dict())
    return {"question": new_question.dict()}

@api_router.post("/couple-questions/{question_id}/answer")
async def submit_couple_answer(question_id: str, request: SubmitCoupleAnswerRequest):
    """Submit answer and guess for couple question"""
    question = await db.couple_questions.find_one({"questionId": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    user = await db.users.find_one({"userId": request.userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine if this is player 1 or 2 based on couple setup
    couple = await db.couples.find_one({"coupleId": user["coupleId"]})
    is_player1 = user["userId"] == couple["creatorId"]
    
    # Update the question with user's answer and guess
    update_data = {}
    if is_player1:
        update_data["player1_answer"] = request.answer
        update_data["player1_guess"] = request.guess
    else:
        update_data["player2_answer"] = request.answer  
        update_data["player2_guess"] = request.guess
    
    await db.couple_questions.update_one(
        {"questionId": question_id},
        {"$set": update_data}
    )
    
    # Check if both partners have answered
    updated_question = await db.couple_questions.find_one({"questionId": question_id})
    if (updated_question.get("player1_answer") and updated_question.get("player2_answer") and 
        updated_question.get("player1_guess") and updated_question.get("player2_guess")):
        
        # Calculate points
        points_awarded = GAME_CONSTANTS["COUPLE_QUESTIONS"]["ANSWER_POINTS"] * 2  # Both answered
        
        # Check for matches
        p1_match = updated_question["player1_guess"].lower() == updated_question["player2_answer"].lower()
        p2_match = updated_question["player2_guess"].lower() == updated_question["player1_answer"].lower()
        
        if p1_match:
            points_awarded += GAME_CONSTANTS["COUPLE_QUESTIONS"]["MATCH_BONUS"]
        if p2_match:
            points_awarded += GAME_CONSTANTS["COUPLE_QUESTIONS"]["MATCH_BONUS"]
        
        # Award points to both users
        await db.users.update_one(
            {"userId": couple["creatorId"]}, 
            {"$inc": {"points": points_awarded // 2}}
        )
        
        if couple.get("partnerId"):
            await db.users.update_one(
                {"userId": couple["partnerId"]}, 
                {"$inc": {"points": points_awarded // 2}}
            )
        
        # Mark question as completed
        await db.couple_questions.update_one(
            {"questionId": question_id},
            {"$set": {"completed": True, "points_awarded": points_awarded}}
        )
        
        # Notify via WebSocket
        await manager.send_to_couple(user["coupleId"], {
            "type": "couple_question_complete",
            "points": points_awarded,
            "matches": {"player1": p1_match, "player2": p2_match}
        })
    
    return {"message": "Answer submitted successfully"}

@api_router.post("/daily-logs")
async def submit_daily_log(request: SubmitDailyLogRequest):
    """Submit daily observation/message about partner"""
    user = await db.users.find_one({"userId": request.userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Create log entry
    log = DailyLog(
        coupleId=user["coupleId"],
        userId=request.userId,
        partnerId=request.partnerId,
        message=request.message,
        date=today
        # Note: AI tone filtering to be implemented later
    )
    
    await db.daily_logs.insert_one(log.dict())
    
    # Award points for reflective mind talent if user has it
    if user.get("talentBuild", {}).get("nodeIds") and "pg_reflective_mind" in user["talentBuild"]["nodeIds"]:
        bonus_points = 5
        await db.users.update_one(
            {"userId": request.userId},
            {"$inc": {"points": bonus_points}}
        )
        
        # Notify user
        await manager.send_to_couple(user["coupleId"], {
            "type": "reflective_bonus",
            "points": bonus_points,
            "message": f"Reflective Mind bonus: +{bonus_points} pts"
        })
    
    return {"message": "Daily log submitted successfully", "log": log.dict()}

@api_router.post("/verification/{completion_id}/respond")  
async def respond_to_verification(completion_id: str, request: RespondVerificationRequest):
    """Respond to a verification request (verify, decline, request_proof)"""
    verification = await db.verification_requests.find_one({"verificationId": request.verificationId})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification request not found")
    
    # Check if verification has expired
    if datetime.utcnow() > verification["expires_at"]:
        raise HTTPException(status_code=400, detail="Verification request has expired")
    
    completion = await db.task_completions.find_one({"completionId": completion_id})
    if not completion:
        raise HTTPException(status_code=404, detail="Task completion not found")
    
    # Update verification status
    await db.verification_requests.update_one(
        {"verificationId": request.verificationId},
        {"$set": {"status": request.response}}
    )
    
    if request.response == "verify":
        # Award verification bonus points
        bonus = GAME_CONSTANTS["VERIFICATION"]["PARTNER_VERIFIES_BONUS"]
        await db.users.update_one(
            {"userId": completion["userId"]},
            {"$inc": {"points": bonus}}
        )
        
        # Mark completion as verified
        await db.task_completions.update_one(
            {"completionId": completion_id},
            {"$set": {"verifiedBy": verification["partnerId"]}}
        )
        
        # Notify via WebSocket
        await manager.send_to_couple(completion["coupleId"], {
            "type": "verification_complete",
            "message": f"Task verified! +{bonus} bonus points awarded",
            "points": bonus
        })
    
    return {"message": f"Verification {request.response} successfully"}

@api_router.get("/enhanced-tasks/{couple_id}")
async def get_enhanced_tasks_for_couple(couple_id: str, date: Optional[str] = None):
    """Get enhanced task list with categories, icons, and NES theming"""
    if not date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get couple's preferences and talent builds
    couple = await db.couples.find_one({"coupleId": couple_id})
    if not couple:
        raise HTTPException(status_code=404, detail="Couple not found")
    
    # Build task list from templates
    daily_tasks = []
    
    # Add household tasks
    for task_template in DEFAULT_QUEST_TEMPLATES["daily"]:
        task = {
            "taskId": f"daily_{task_template['title'].lower().replace(' ', '_').replace('🏠', '').replace('🍽️', '').replace('🧹', '').strip()}",
            "title": task_template["title"],
            "room": task_template["room"],
            "basePoints": task_template["points"],
            "difficulty": task_template["difficulty"],
            "category": task_template["category"],
            "quest_type": "DAILY",
            "icon": task_template["icon"],
            "can_takeover": True,
            "requires_verification": False
        }
        daily_tasks.append(task)
    
    # Add pet tasks if couple has pets (this would be determined by couple settings)
    # For now, we'll add some pet tasks by default
    for task_template in DEFAULT_QUEST_TEMPLATES["pet"][:2]:  # Add first 2 pet tasks
        task = {
            "taskId": f"pet_{task_template['title'].lower().replace(' ', '_').replace('🍖', '').replace('🐕', '').strip()}",
            "title": task_template["title"],
            "room": task_template["room"],
            "basePoints": task_template["points"],
            "difficulty": task_template["difficulty"],
            "category": task_template["category"],
            "quest_type": "DAILY",
            "icon": task_template["icon"],
            "can_takeover": True,
            "requires_verification": False
        }
        daily_tasks.append(task)
    
    # Add vehicle tasks
    for task_template in DEFAULT_QUEST_TEMPLATES["vehicle"][:1]:  # Add first vehicle task
        task = {
            "taskId": f"vehicle_{task_template['title'].lower().replace(' ', '_').replace('⛽', '').replace('🛢️', '').strip()}",
            "title": task_template["title"],
            "room": task_template["room"],
            "basePoints": task_template["points"],
            "difficulty": task_template["difficulty"],
            "category": task_template["category"], 
            "quest_type": "DAILY",
            "icon": task_template["icon"],
            "can_takeover": True,
            "requires_verification": False
        }
        daily_tasks.append(task)
    
    return {
        "tasks": daily_tasks,
        "quest_categories": GAME_CONSTANTS["QUEST_CATEGORIES"],
        "theme": "NES_PIXEL_ART",
        "date": date
    }

# WebSocket endpoint
@app.websocket("/ws/{couple_id}")
async def websocket_endpoint(websocket: WebSocket, couple_id: str):
    await manager.connect(websocket, couple_id)
    try:
        while True:
            data = await websocket.receive_text()
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(couple_id)

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()