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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Gamified Chore App", version="1.0.0")
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

class GameType(str, Enum):
    CHESS = "chess"
    BACKGAMMON = "backgammon"
    BATTLESHIP = "battleship"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    couple_id: str
    partner_id: Optional[str] = None
    points: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CoupleSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    couple_id: str
    end_of_day_time: str = "23:59"  # HH:MM format
    timezone: str = "UTC"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Chore(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room: RoomType
    name: str
    description: Optional[str] = None
    timer_minutes: Optional[int] = None
    points: int = 10
    is_default: bool = True
    couple_id: Optional[str] = None

class TalentTreeNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    room: RoomType
    chore_id: Optional[str] = None
    investment: int = 0  # Points invested
    modifier_percentage: float = 0.0  # -5% to +5%

class DailyAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    couple_id: str
    date: str  # YYYY-MM-DD format
    assignments: Dict[str, str]  # chore_id: user_id
    percentages: Dict[str, Dict[str, float]]  # chore_id: {user_id: percentage}
    completed_chores: List[str] = []
    user_points: Dict[str, int] = {}

class ChoreCompletion(BaseModel):
    chore_id: str
    user_id: str
    completed: bool
    completed_at: Optional[datetime] = None

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

class UpdateCoupleSettingsRequest(BaseModel):
    end_of_day_time: str
    timezone: str

class TalentTreeInvestment(BaseModel):
    room: RoomType
    chore_id: Optional[str] = None
    investment: int

class CreateGameRequest(BaseModel):
    game_type: GameType
    opponent_id: str

# Default chores for each room
DEFAULT_CHORES = {
    RoomType.KITCHEN: [
        {"name": "Wash dishes", "points": 15},
        {"name": "Wipe counters", "points": 10},
        {"name": "Clean stovetop", "points": 10},
        {"name": "Take out trash", "points": 8},
        {"name": "Load/unload dishwasher", "points": 12}
    ],
    RoomType.BATHROOM: [
        {"name": "Clean toilet", "points": 20},
        {"name": "Clean shower/tub", "points": 18},
        {"name": "Clean sink and mirror", "points": 12},
        {"name": "Mop floor", "points": 15}
    ],
    RoomType.LIVING_ROOM: [
        {"name": "Vacuum/sweep", "points": 15},
        {"name": "Dust furniture", "points": 12},
        {"name": "Organize items", "points": 10}
    ],
    RoomType.BEDROOM: [
        {"name": "Make bed", "points": 8},
        {"name": "Organize closet", "points": 15},
        {"name": "Vacuum/sweep", "points": 12}
    ],
    RoomType.US: [
        {"name": "Heart-to-heart hug", "timer_minutes": 2, "points": 10},
        {"name": "Give massage", "timer_minutes": 5, "points": 15},
        {"name": "Quality conversation", "timer_minutes": 10, "points": 20}
    ]
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
        return partner_user
    else:
        # Create new couple
        couple_id = str(uuid.uuid4())[:8]  # Short couple code
        user = User(name=request.name, couple_id=couple_id)
        await db.users.insert_one(user.dict())
        
        # Initialize default couple settings
        settings = CoupleSettings(couple_id=couple_id)
        await db.couple_settings.insert_one(settings.dict())
        
        # Initialize default chores
        for room, chores in DEFAULT_CHORES.items():
            for chore_data in chores:
                chore = Chore(room=room, **chore_data)
                await db.chores.insert_one(chore.dict())
        
        return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.get("/couples/{couple_id}/chores")
async def get_chores(couple_id: str):
    """Get all chores organized by room"""
    chores = await db.chores.find({"is_default": True}).to_list(1000)
    
    organized_chores = {}
    for room in RoomType:
        organized_chores[room.value] = [
            chore for chore in chores if chore["room"] == room.value
        ]
    
    return organized_chores

@api_router.post("/chores/{chore_id}/complete")
async def complete_chore(chore_id: str, completion: ChoreCompletion):
    """Mark a chore as completed and award points"""
    user = await db.users.find_one({"id": completion.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    chore = await db.chores.find_one({"id": chore_id})
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    # Award points
    points_to_award = chore["points"]
    await db.users.update_one(
        {"id": completion.user_id},
        {"$inc": {"points": points_to_award}}
    )
    
    # Update daily assignment
    today = datetime.now().strftime("%Y-%m-%d")
    await db.daily_assignments.update_one(
        {"couple_id": user["couple_id"], "date": today},
        {
            "$addToSet": {"completed_chores": chore_id},
            "$inc": {f"user_points.{completion.user_id}": points_to_award}
        }
    )
    
    # Send real-time update to partner
    await manager.send_to_couple(user["couple_id"], {
        "type": "chore_completed",
        "chore_id": chore_id,
        "user_name": user["name"],
        "points": points_to_award,
        "sound": "whah-ping"
    })
    
    return {"message": "Chore completed", "points_awarded": points_to_award}

@api_router.get("/couples/{couple_id}/assignments/{date}")
async def get_daily_assignment(couple_id: str, date: str):
    """Get daily chore assignments for a specific date"""
    assignment = await db.daily_assignments.find_one({"couple_id": couple_id, "date": date})
    if not assignment:
        # Generate new assignment if doesn't exist
        assignment = await generate_daily_assignments(couple_id, date)
    return assignment

@api_router.post("/couples/{couple_id}/settings")
async def update_couple_settings(couple_id: str, settings: UpdateCoupleSettingsRequest):
    """Update couple settings"""
    await db.couple_settings.update_one(
        {"couple_id": couple_id},
        {"$set": settings.dict()},
        upsert=True
    )
    return {"message": "Settings updated"}

@api_router.post("/users/{user_id}/talent-tree")
async def invest_talent_points(user_id: str, investments: List[TalentTreeInvestment]):
    """Invest points in talent tree"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    total_investment = sum(inv.investment for inv in investments)
    if total_investment > user["points"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Clear existing investments for today
    await db.talent_tree_nodes.delete_many({"user_id": user_id})
    
    # Create new investments
    for investment in investments:
        # Calculate modifier (max 5% advantage per chore)
        modifier = min(investment.investment * 0.1, 5.0)  # 10 points = 1%
        
        node = TalentTreeNode(
            user_id=user_id,
            room=investment.room,
            chore_id=investment.chore_id,
            investment=investment.investment,
            modifier_percentage=modifier
        )
        await db.talent_tree_nodes.insert_one(node.dict())
    
    # Deduct points
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"points": -total_investment}}
    )
    
    return {"message": "Talent tree updated"}

@api_router.post("/games", response_model=Game)
async def create_game(request: CreateGameRequest, current_user_id: str):
    """Create a new game"""
    game = Game(
        couple_id="",  # Will be set from user data
        game_type=request.game_type,
        player1_id=current_user_id,
        player2_id=request.opponent_id
    )
    
    # Initialize game state based on type
    if request.game_type == GameType.CHESS:
        game.game_state = {"board": "initial", "turn": current_user_id}
    elif request.game_type == GameType.BACKGAMMON:
        game.game_state = {"board": "initial", "turn": current_user_id}
    elif request.game_type == GameType.BATTLESHIP:
        game.game_state = {"phase": "setup", "turn": current_user_id}
    
    await db.games.insert_one(game.dict())
    return game

# WebSocket endpoint
@app.websocket("/ws/{couple_id}")
async def websocket_endpoint(websocket: WebSocket, couple_id: str):
    await manager.connect(websocket, couple_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(couple_id)

# Helper functions
async def generate_daily_assignments(couple_id: str, date: str):
    """Generate daily chore assignments using talent tree"""
    users = await db.users.find({"couple_id": couple_id}).to_list(2)
    if len(users) != 2:
        raise HTTPException(status_code=400, detail="Couple not complete")
    
    chores = await db.chores.find({"is_default": True}).to_list(1000)
    
    assignments = {}
    percentages = {}
    
    for chore in chores:
        # Get talent tree modifiers for this chore
        modifiers = {}
        for user in users:
            nodes = await db.talent_tree_nodes.find({
                "user_id": user["id"],
                "$or": [
                    {"room": chore["room"], "chore_id": chore["id"]},
                    {"room": chore["room"], "chore_id": None}
                ]
            }).to_list(10)
            
            modifier = sum(node["modifier_percentage"] for node in nodes)
            modifiers[user["id"]] = min(max(modifier, -5), 5)  # Cap at ±5%
        
        # Calculate probabilities (base 50% + modifier)
        prob1 = 50 + modifiers.get(users[0]["id"], 0)
        prob2 = 100 - prob1
        
        # Assign chore randomly based on probabilities
        if random.random() * 100 < prob1:
            assignments[chore["id"]] = users[0]["id"]
        else:
            assignments[chore["id"]] = users[1]["id"]
        
        percentages[chore["id"]] = {
            users[0]["id"]: prob1,
            users[1]["id"]: prob2
        }
    
    assignment = DailyAssignment(
        couple_id=couple_id,
        date=date,
        assignments=assignments,
        percentages=percentages
    )
    
    await db.daily_assignments.insert_one(assignment.dict())
    return assignment.dict()

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()