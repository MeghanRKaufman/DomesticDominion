from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, time
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
app = FastAPI(title="Gamified Lifestyle App", version="2.0.0")
api_router = APIRouter(prefix="/api")

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
    KITCHEN = "kitchen"
    BATHROOM = "bathroom"
    LIVING_ROOM = "living_room"
    BEDROOM = "bedroom"
    US = "us"

class ChoreSize(str, Enum):
    SMALL = "small"    # 5 points
    MEDIUM = "medium"  # 10 points
    BIG = "big"        # 20 points

class HealthActivityType(str, Enum):
    WALK = "walk"
    MEDITATION = "meditation"
    HYDRATION = "hydration"
    EXERCISE = "exercise"
    STRETCHING = "stretching"
    SLEEP_QUALITY = "sleep_quality"
    MINDFULNESS = "mindfulness"

class TalentBranch(str, Enum):
    EFFICIENCY = "efficiency"  # Blue - Chore bonuses
    COUPLE = "couple"          # Pink - Relationship bonuses  
    GROWTH = "growth"          # Green - Health/wellness bonuses

class GameType(str, Enum):
    CHESS = "chess"
    BACKGAMMON = "backgammon"
    BATTLESHIP = "battleship"

# Leveling system following the user's curve
LEVEL_REQUIREMENTS = {
    1: 0, 2: 100, 3: 200, 4: 350, 5: 500, 6: 700, 7: 900, 8: 1100, 9: 1350, 10: 1600,
    11: 1850, 12: 2100, 13: 2400, 14: 2700, 15: 3000, 16: 3350, 17: 3700, 18: 4050, 
    19: 4450, 20: 4850, 21: 5250, 22: 5700, 23: 6150, 24: 6600, 25: 7100
}

def calculate_level(total_points: int) -> tuple:
    """Calculate current level and progress to next level"""
    current_level = 1
    for level, required_points in LEVEL_REQUIREMENTS.items():
        if total_points >= required_points:
            current_level = level
        else:
            break
    
    next_level = min(current_level + 1, 25)
    current_req = LEVEL_REQUIREMENTS.get(current_level, 0)
    next_req = LEVEL_REQUIREMENTS.get(next_level, LEVEL_REQUIREMENTS[25])
    progress = total_points - current_req
    needed = next_req - current_req
    
    return current_level, progress, needed

def calculate_talent_points(level: int) -> int:
    """Calculate talent points earned based on level"""
    # Talent points awarded every 3-5 levels roughly
    talent_levels = [5, 8, 11, 15, 18, 22, 25]
    return sum(1 for tl in talent_levels if level >= tl)

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    couple_id: str
    partner_id: Optional[str] = None
    total_points: int = 0
    current_level: int = 1
    available_talent_points: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CoupleSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    couple_id: str
    end_of_day_time: str = "23:59"
    timezone: str = "UTC"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Chore(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room: RoomType
    name: str
    description: Optional[str] = None
    size: ChoreSize
    timer_minutes: Optional[int] = None
    is_default: bool = True
    couple_id: Optional[str] = None

    @property
    def points(self) -> int:
        return {"small": 5, "medium": 10, "big": 20}[self.size]

class HealthActivity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: HealthActivityType
    name: str
    description: str
    points: int
    target_value: Optional[int] = None  # e.g., 10000 steps, 20 minutes meditation
    unit: Optional[str] = None          # e.g., "steps", "minutes"

class TalentTreeNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch: TalentBranch
    tier: int  # 1-7 (corresponding to rows in talent tree)
    description: str
    effect: str  # e.g., "+2 points for laundry chores"
    cost: int = 1  # Talent points required
    prerequisites: List[str] = []  # Required node IDs

class UserTalentTree(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    unlocked_nodes: List[str] = []  # List of talent node IDs

class ChoreCompletion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    chore_id: str
    points_earned: int
    bonus_points: int = 0
    completed_at: datetime = Field(default_factory=datetime.utcnow)

class HealthActivityCompletion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    activity_id: str
    value: int  # e.g., steps taken, minutes meditated
    points_earned: int
    bonus_points: int = 0
    completed_at: datetime = Field(default_factory=datetime.utcnow)

class DailyAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    couple_id: str
    date: str
    assignments: Dict[str, str]  # chore_id: user_id
    percentages: Dict[str, Dict[str, float]]
    completed_chores: List[str] = []
    user_points: Dict[str, int] = {}

class Game(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    couple_id: str
    game_type: GameType
    player1_id: str
    player2_id: str
    game_state: Dict[str, Any] = {}
    winner_id: Optional[str] = None
    points_awarded: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

# Request Models
class CreateUserRequest(BaseModel):
    name: str
    couple_code: Optional[str] = None

class CompleteChoreRequest(BaseModel):
    user_id: str

class CompleteHealthActivityRequest(BaseModel):
    user_id: str
    value: int  # e.g., 8000 steps, 15 minutes meditation

class UnlockTalentNodeRequest(BaseModel):
    user_id: str
    node_id: str

class CreateGameRequest(BaseModel):
    game_type: GameType
    opponent_id: str

# Default chores with new point system
DEFAULT_CHORES = {
    RoomType.KITCHEN: [
        {"name": "Wipe counters", "size": ChoreSize.SMALL, "description": "Clean kitchen countertops"},
        {"name": "Load dishwasher", "size": ChoreSize.SMALL, "description": "Load dirty dishes"},
        {"name": "Wash dishes", "size": ChoreSize.MEDIUM, "description": "Hand wash dishes"},
        {"name": "Clean stovetop", "size": ChoreSize.MEDIUM, "description": "Deep clean stove"},
        {"name": "Take out trash", "size": ChoreSize.MEDIUM, "description": "Empty all trash bins"},
        {"name": "Deep clean kitchen", "size": ChoreSize.BIG, "description": "Full kitchen deep clean"}
    ],
    RoomType.BATHROOM: [
        {"name": "Wipe sink", "size": ChoreSize.SMALL, "description": "Quick sink cleanup"},
        {"name": "Clean mirror", "size": ChoreSize.SMALL, "description": "Clean bathroom mirror"},
        {"name": "Clean toilet", "size": ChoreSize.MEDIUM, "description": "Scrub toilet thoroughly"},
        {"name": "Mop floor", "size": ChoreSize.MEDIUM, "description": "Mop bathroom floor"},
        {"name": "Clean shower/tub", "size": ChoreSize.BIG, "description": "Deep clean shower"},
        {"name": "Full bathroom deep clean", "size": ChoreSize.BIG, "description": "Complete bathroom overhaul"}
    ],
    RoomType.LIVING_ROOM: [
        {"name": "Organize items", "size": ChoreSize.SMALL, "description": "Put things back in place"},
        {"name": "Dust surfaces", "size": ChoreSize.SMALL, "description": "Dust furniture and electronics"},
        {"name": "Vacuum/sweep", "size": ChoreSize.MEDIUM, "description": "Vacuum or sweep floors"},
        {"name": "Deep vacuum", "size": ChoreSize.BIG, "description": "Move furniture and deep vacuum"}
    ],
    RoomType.BEDROOM: [
        {"name": "Make bed", "size": ChoreSize.SMALL, "description": "Make the bed neatly"},
        {"name": "Put clothes away", "size": ChoreSize.SMALL, "description": "Organize clothes"},
        {"name": "Vacuum bedroom", "size": ChoreSize.MEDIUM, "description": "Vacuum bedroom floor"},
        {"name": "Organize closet", "size": ChoreSize.BIG, "description": "Complete closet organization"}
    ],
    RoomType.US: [
        {"name": "2-minute hug", "timer_minutes": 2, "size": ChoreSize.SMALL, "description": "Heart-to-heart embrace"},
        {"name": "5-minute massage", "timer_minutes": 5, "size": ChoreSize.MEDIUM, "description": "Relaxing partner massage"},
        {"name": "Quality conversation", "timer_minutes": 15, "size": ChoreSize.MEDIUM, "description": "Deep meaningful talk"},
        {"name": "Date planning", "size": ChoreSize.BIG, "description": "Plan special date together"}
    ]
}

# Default health activities
DEFAULT_HEALTH_ACTIVITIES = [
    {"type": HealthActivityType.WALK, "name": "Daily Walk", "description": "Take 8000+ steps", "points": 10, "target_value": 8000, "unit": "steps"},
    {"type": HealthActivityType.MEDITATION, "name": "Meditation", "description": "Mindful meditation session", "points": 15, "target_value": 10, "unit": "minutes"},
    {"type": HealthActivityType.HYDRATION, "name": "Hydration Goal", "description": "Drink 8 glasses of water", "points": 5, "target_value": 8, "unit": "glasses"},
    {"type": HealthActivityType.EXERCISE, "name": "Exercise Session", "description": "30+ minutes of exercise", "points": 20, "target_value": 30, "unit": "minutes"},
    {"type": HealthActivityType.STRETCHING, "name": "Stretching", "description": "Full body stretch routine", "points": 8, "target_value": 10, "unit": "minutes"},
    {"type": HealthActivityType.SLEEP_QUALITY, "name": "Quality Sleep", "description": "7+ hours of good sleep", "points": 15, "target_value": 7, "unit": "hours"},
    {"type": HealthActivityType.MINDFULNESS, "name": "Mindful Check-in", "description": "Mindfulness practice", "points": 10, "target_value": 5, "unit": "minutes"}
]

# Talent tree nodes (following the user's design)
TALENT_TREE_NODES = {
    # EFFICIENCY BRANCH (Blue) - Chore bonuses
    "quick_wipe": {"name": "Quick Wipe", "branch": TalentBranch.EFFICIENCY, "tier": 1, "description": "+2 bonus points for small cleaning chores", "effect": "small_chore_bonus", "cost": 1},
    "laundry_maid": {"name": "Laundry Maid", "branch": TalentBranch.EFFICIENCY, "tier": 2, "description": "+3 bonus points for laundry tasks", "effect": "laundry_bonus", "cost": 1, "prerequisites": ["quick_wipe"]},
    "trash_master": {"name": "Trash Master", "branch": TalentBranch.EFFICIENCY, "tier": 3, "description": "+5 bonus points for taking out trash", "effect": "trash_bonus", "cost": 1, "prerequisites": ["laundry_maid"]},
    "dishes_speed": {"name": "Dishes Speed", "branch": TalentBranch.EFFICIENCY, "tier": 4, "description": "+3 bonus points for dish-related tasks", "effect": "dishes_bonus", "cost": 1, "prerequisites": ["trash_master"]},
    "toilet_dodge": {"name": "Toilet Dodge", "branch": TalentBranch.EFFICIENCY, "tier": 5, "description": "+5 bonus points for bathroom cleaning (because you're brave!)", "effect": "bathroom_bonus", "cost": 1, "prerequisites": ["dishes_speed"]},
    "vacuum_hero": {"name": "Vacuum Hero", "branch": TalentBranch.EFFICIENCY, "tier": 6, "description": "+4 bonus points for vacuuming tasks", "effect": "vacuum_bonus", "cost": 1, "prerequisites": ["toilet_dodge"]},
    "housekeeper_edge": {"name": "Housekeeper's Edge", "branch": TalentBranch.EFFICIENCY, "tier": 7, "description": "+10 bonus points for big chores", "effect": "big_chore_bonus", "cost": 1, "prerequisites": ["vacuum_hero"]},
    
    # COUPLE BRANCH (Pink) - Relationship bonuses
    "hug_timer": {"name": "Hug Timer", "branch": TalentBranch.COUPLE, "tier": 1, "description": "+3 bonus points for timed relationship activities", "effect": "timed_couple_bonus", "cost": 1},
    "massage_points": {"name": "Massage Points", "branch": TalentBranch.COUPLE, "tier": 2, "description": "+5 bonus points for giving massages", "effect": "massage_bonus", "cost": 1, "prerequisites": ["hug_timer"]},
    "team_boost": {"name": "Team Boost", "branch": TalentBranch.COUPLE, "tier": 3, "description": "Double points when both partners complete chores within 1 hour", "effect": "teamwork_bonus", "cost": 1, "prerequisites": ["massage_points"]},
    "gratitude_shoutout": {"name": "Gratitude Shoutout", "branch": TalentBranch.COUPLE, "tier": 4, "description": "+2 points for expressing gratitude to partner", "effect": "gratitude_bonus", "cost": 1, "prerequisites": ["team_boost"]},
    "romance_perk": {"name": "Romance Perk", "branch": TalentBranch.COUPLE, "tier": 5, "description": "+8 bonus points for date planning and romantic gestures", "effect": "romance_bonus", "cost": 1, "prerequisites": ["gratitude_shoutout"]},
    "double_up": {"name": "Double Up", "branch": TalentBranch.COUPLE, "tier": 6, "description": "Weekend relationship activities give double points", "effect": "weekend_couple_bonus", "cost": 1, "prerequisites": ["romance_perk"]},
    "soulmate_bonus": {"name": "Soulmate Bonus", "branch": TalentBranch.COUPLE, "tier": 7, "description": "+15 points when completing couple goals together", "effect": "soulmate_bonus", "cost": 1, "prerequisites": ["double_up"]},
    
    # GROWTH BRANCH (Green) - Health/wellness bonuses  
    "hydration_harmony": {"name": "Hydration Harmony", "branch": TalentBranch.GROWTH, "tier": 1, "description": "+2 bonus points for hydration goals", "effect": "hydration_bonus", "cost": 1},
    "step_sync": {"name": "Step Sync", "branch": TalentBranch.GROWTH, "tier": 2, "description": "+3 bonus points for walking/step goals", "effect": "walking_bonus", "cost": 1, "prerequisites": ["hydration_harmony"]},
    "stretch_it_out": {"name": "Stretch It Out", "branch": TalentBranch.GROWTH, "tier": 3, "description": "+4 bonus points for stretching and flexibility", "effect": "stretching_bonus", "cost": 1, "prerequisites": ["step_sync"]},
    "mind_checkin": {"name": "Mind Check-In", "branch": TalentBranch.GROWTH, "tier": 4, "description": "+5 bonus points for meditation and mindfulness", "effect": "mindfulness_bonus", "cost": 1, "prerequisites": ["stretch_it_out"]},
    "consistency_buff": {"name": "Consistency Buff", "branch": TalentBranch.GROWTH, "tier": 5, "description": "+10 points for 7-day health activity streaks", "effect": "consistency_bonus", "cost": 1, "prerequisites": ["mind_checkin"]},
    "early_bird": {"name": "Early Bird", "branch": TalentBranch.GROWTH, "tier": 6, "description": "+5 bonus points for morning activities before 8am", "effect": "morning_bonus", "cost": 1, "prerequisites": ["consistency_buff"]},
    "wellness_overflow": {"name": "Wellness Overflow", "branch": TalentBranch.GROWTH, "tier": 7, "description": "All health activities give +50% bonus points", "effect": "wellness_master", "cost": 1, "prerequisites": ["early_bird"]}
}

# API Routes
@api_router.post("/users", response_model=User)
async def create_user(request: CreateUserRequest):
    """Create a new user or join existing couple"""
    if request.couple_code:
        # Find existing couple
        existing_user = await db.users.find_one({"couple_id": request.couple_code})
        if not existing_user:
            raise HTTPException(status_code=404, detail="Couple code not found")
        
        # Create partner user
        partner_user = User(
            name=request.name,
            couple_id=request.couple_code,
            partner_id=existing_user["id"]
        )
        
        # Update existing user with partner info
        await db.users.update_one(
            {"id": existing_user["id"]},
            {"$set": {"partner_id": partner_user.id}}
        )
        
        await db.users.insert_one(partner_user.dict())
        
        # Initialize talent tree for new user
        talent_tree = UserTalentTree(user_id=partner_user.id)
        await db.user_talent_trees.insert_one(talent_tree.dict())
        
        return partner_user
    else:
        # Create new couple
        couple_id = str(uuid.uuid4())[:8]
        user = User(name=request.name, couple_id=couple_id)
        await db.users.insert_one(user.dict())
        
        # Initialize talent tree for new user
        talent_tree = UserTalentTree(user_id=user.id)
        await db.user_talent_trees.insert_one(talent_tree.dict())
        
        # Initialize default couple settings
        settings = CoupleSettings(couple_id=couple_id)
        await db.couple_settings.insert_one(settings.dict())
        
        # Initialize default chores
        for room, chores in DEFAULT_CHORES.items():
            for chore_data in chores:
                chore = Chore(room=room, **chore_data)
                await db.chores.insert_one(chore.dict())
        
        # Initialize default health activities  
        for activity_data in DEFAULT_HEALTH_ACTIVITIES:
            activity = HealthActivity(**activity_data)
            await db.health_activities.insert_one(activity.dict())
            
        # Initialize talent tree nodes
        for node_id, node_data in TALENT_TREE_NODES.items():
            node = TalentTreeNode(id=node_id, **node_data)
            await db.talent_tree_nodes.insert_one(node.dict())
        
        return user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.pop('_id', None)
    
    # Update level and talent points based on current total_points
    current_level, progress, needed = calculate_level(user["total_points"])
    total_talent_points = calculate_talent_points(current_level)
    
    # Get used talent points
    talent_tree = await db.user_talent_trees.find_one({"user_id": user_id})
    used_talent_points = len(talent_tree["unlocked_nodes"]) if talent_tree else 0
    available_talent_points = total_talent_points - used_talent_points
    
    # Update user with current stats
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "current_level": current_level,
            "available_talent_points": available_talent_points
        }}
    )
    
    user["current_level"] = current_level
    user["available_talent_points"] = available_talent_points
    user["level_progress"] = progress
    user["level_progress_needed"] = needed
    
    return user

@api_router.get("/couples/{couple_id}/chores")
async def get_chores(couple_id: str):
    """Get all chores organized by room"""
    chores_cursor = db.chores.find({"is_default": True})
    chores = []
    async for chore in chores_cursor:
        chore.pop('_id', None)
        chores.append(chore)
    
    organized_chores = {}
    for room in RoomType:
        organized_chores[room.value] = [
            chore for chore in chores if chore["room"] == room.value
        ]
    
    return organized_chores

@api_router.get("/health-activities")
async def get_health_activities():
    """Get all available health activities"""
    activities_cursor = db.health_activities.find({})
    activities = []
    async for activity in activities_cursor:
        activity.pop('_id', None)
        activities.append(activity)
    
    return activities

@api_router.post("/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, request: CompleteChoreRequest):
    """Complete a chore and award points with bonuses"""
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    chore = await db.chores.find_one({"id": chore_id})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Calculate base points
    base_points = {"small": 5, "medium": 10, "big": 20}[chore["size"]]
    
    # Calculate bonus points from talent tree
    bonus_points = await calculate_chore_bonus(request.user_id, chore)
    
    total_points = base_points + bonus_points
    
    # Update user points and level
    new_total = user["total_points"] + total_points
    await db.users.update_one(
        {"id": request.user_id},
        {"$inc": {"total_points": total_points}}
    )
    
    # Record completion
    completion = ChoreCompletion(
        user_id=request.user_id,
        chore_id=chore_id,
        points_earned=base_points,
        bonus_points=bonus_points
    )
    await db.chore_completions.insert_one(completion.dict())
    
    # Send real-time update to partner
    await manager.send_to_couple(user["couple_id"], {
        "type": "chore_completed",
        "user_name": user["name"],
        "chore_name": chore["name"],
        "points": total_points,
        "sound": "whah-ping"
    })
    
    return {
        "message": "Chore completed!",
        "points_earned": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "new_total": new_total
    }

@api_router.post("/health-activities/{activity_id}/complete")
async def complete_health_activity(activity_id: str, request: CompleteHealthActivityRequest):
    """Complete a health activity and award points"""
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    activity = await db.health_activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Health activity not found")
    
    # Check if target value is met
    if activity.get("target_value") and request.value < activity["target_value"]:
        raise HTTPException(status_code=400, detail=f"Target not met. Need {activity['target_value']} {activity.get('unit', 'units')}")
    
    base_points = activity["points"]
    
    # Calculate bonus points from talent tree
    bonus_points = await calculate_health_bonus(request.user_id, activity)
    
    total_points = base_points + bonus_points
    
    # Update user points
    new_total = user["total_points"] + total_points
    await db.users.update_one(
        {"id": request.user_id},
        {"$inc": {"total_points": total_points}}
    )
    
    # Record completion
    completion = HealthActivityCompletion(
        user_id=request.user_id,
        activity_id=activity_id,
        value=request.value,
        points_earned=base_points,
        bonus_points=bonus_points
    )
    await db.health_activity_completions.insert_one(completion.dict())
    
    return {
        "message": "Health activity completed!",
        "points_earned": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "new_total": new_total
    }

async def calculate_chore_bonus(user_id: str, chore: dict) -> int:
    """Calculate bonus points from talent tree for chores"""
    talent_tree = await db.user_talent_trees.find_one({"user_id": user_id})
    if not talent_tree:
        return 0
    
    bonus = 0
    unlocked_nodes = talent_tree["unlocked_nodes"]
    
    # Check various talent bonuses
    if "quick_wipe" in unlocked_nodes and chore["size"] == "small":
        bonus += 2
    if "laundry_maid" in unlocked_nodes and "laundry" in chore["name"].lower():
        bonus += 3
    if "trash_master" in unlocked_nodes and "trash" in chore["name"].lower():
        bonus += 5
    if "dishes_speed" in unlocked_nodes and ("dish" in chore["name"].lower() or "wash" in chore["name"].lower()):
        bonus += 3
    if "toilet_dodge" in unlocked_nodes and chore["room"] == "bathroom":
        bonus += 5
    if "vacuum_hero" in unlocked_nodes and "vacuum" in chore["name"].lower():
        bonus += 4
    if "housekeeper_edge" in unlocked_nodes and chore["size"] == "big":
        bonus += 10
    
    # Couple bonuses for US tab
    if chore["room"] == "us":
        if "hug_timer" in unlocked_nodes and chore.get("timer_minutes"):
            bonus += 3
        if "massage_points" in unlocked_nodes and "massage" in chore["name"].lower():
            bonus += 5
        if "romance_perk" in unlocked_nodes and ("date" in chore["name"].lower() or chore["size"] == "big"):
            bonus += 8
    
    return bonus

async def calculate_health_bonus(user_id: str, activity: dict) -> int:
    """Calculate bonus points from talent tree for health activities"""
    talent_tree = await db.user_talent_trees.find_one({"user_id": user_id})
    if not talent_tree:
        return 0
    
    bonus = 0
    unlocked_nodes = talent_tree["unlocked_nodes"]
    
    # Health activity bonuses
    if "hydration_harmony" in unlocked_nodes and activity["type"] == "hydration":
        bonus += 2
    if "step_sync" in unlocked_nodes and activity["type"] == "walk":
        bonus += 3
    if "stretch_it_out" in unlocked_nodes and activity["type"] == "stretching":
        bonus += 4
    if "mind_checkin" in unlocked_nodes and activity["type"] in ["meditation", "mindfulness"]:
        bonus += 5
    
    # Master bonus
    if "wellness_overflow" in unlocked_nodes:
        bonus = int(bonus * 1.5)  # +50% bonus
    
    return bonus

@api_router.get("/users/{user_id}/talent-tree")
async def get_user_talent_tree(user_id: str):
    """Get user's talent tree progress"""
    talent_tree = await db.user_talent_trees.find_one({"user_id": user_id})
    if not talent_tree:
        raise HTTPException(status_code=404, detail="Talent tree not found")
    
    talent_tree.pop('_id', None)
    
    # Get all available talent nodes
    nodes_cursor = db.talent_tree_nodes.find({})
    all_nodes = []
    async for node in nodes_cursor:
        node.pop('_id', None)
        all_nodes.append(node)
    
    return {
        "unlocked_nodes": talent_tree["unlocked_nodes"],
        "available_nodes": all_nodes
    }

@api_router.post("/users/{user_id}/talent-tree/unlock")
async def unlock_talent_node(user_id: str, request: UnlockTalentNodeRequest):
    """Unlock a talent tree node"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["available_talent_points"] < 1:
        raise HTTPException(status_code=400, detail="Not enough talent points")
    
    node = await db.talent_tree_nodes.find_one({"id": request.node_id})
    if not node:
        raise HTTPException(status_code=404, detail="Talent node not found")
    
    talent_tree = await db.user_talent_trees.find_one({"user_id": user_id})
    
    # Check prerequisites
    for prereq in node.get("prerequisites", []):
        if prereq not in talent_tree["unlocked_nodes"]:
            raise HTTPException(status_code=400, detail=f"Prerequisite {prereq} not unlocked")
    
    # Unlock the node
    await db.user_talent_trees.update_one(
        {"user_id": user_id},
        {"$addToSet": {"unlocked_nodes": request.node_id}}
    )
    
    return {"message": f"Unlocked {node['name']}!"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()