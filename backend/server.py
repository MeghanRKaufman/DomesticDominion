from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
import json
import asyncio
import httpx
import random
import math
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
# ChatGPT API Configuration (using Emergent LLM key)
CHATGPT_API_KEY = os.environ.get('PI_API_KEY', 'sk-emergent-281893dE8B579E7725')  # Reusing Emergent LLM key

# ChatGPT Client for message enhancement (kind/constructive criticism)
async def enhance_message_with_chatgpt(message: str, message_type: str = "general") -> dict:
    """
    Enhance a message using ChatGPT for kind and constructive communication
    message_type: "general", "criticism", "request", "appreciation"
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Create enhancement prompt based on type
        if message_type == "criticism":
            system_prompt = "You are a communication expert. Rewrite messages to be constructive, kind, and solution-focused. Turn criticism into helpful feedback that builds people up rather than tears them down. Keep the core message but make it compassionate."
            user_prompt = f"Please rewrite this message to be more constructive and kind, while keeping the core point: '{message}'"
        elif message_type == "request":
            system_prompt = "You are a communication expert. Rewrite requests to be polite, considerate, and collaborative. Frame asks in ways that respect everyone's time and effort."
            user_prompt = f"Please rewrite this request to be more considerate and collaborative: '{message}'"
        elif message_type == "appreciation":
            system_prompt = "You are a communication expert. Enhance appreciation messages to be more heartfelt and specific."
            user_prompt = f"Please enhance this appreciation message to be more heartfelt: '{message}'"
        else:  # general
            system_prompt = "You are a communication expert. Rewrite messages to be kind, clear, and constructive. Maintain the original intent but improve tone and clarity."
            user_prompt = f"Please rewrite this message to be kinder and clearer: '{message}'"
        
        # Use Emergent LLM integration
        chat = LlmChat(
            api_key=CHATGPT_API_KEY,
            model="gpt-4o-mini",  # Fast and cost-effective
            system_instructions=system_prompt
        )
        
        response = chat.send_user_message(UserMessage(content=user_prompt))
        enhanced_message = response.content.strip()
        
        # Remove quotes if ChatGPT added them
        if enhanced_message.startswith('"') and enhanced_message.endswith('"'):
            enhanced_message = enhanced_message[1:-1]
        
        return {
            "enhanced_message": enhanced_message,
            "original_message": message,
            "message_type": message_type,
            "success": True
        }
            
    except Exception as e:
        print(f"ChatGPT API Error: {e}")
        # Fallback enhancement
        fallback_prefixes = {
            "criticism": "I wanted to share some thoughts: ",
            "request": "When you have a moment, could you please ",
            "appreciation": "I really appreciate that ",
            "general": ""
        }
        prefix = fallback_prefixes.get(message_type, "")
        
        return {
            "enhanced_message": f"{prefix}{message}",
            "original_message": message,
            "message_type": message_type,
            "success": False,
            "note": f"ChatGPT API error: {str(e)}"
        }

# Create the main app
app = FastAPI(title="Domestic Dominion - Kingdom Management RPG", version="3.0.0")
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
        "RANDOM_CHECK_PROBABILITY": 0.25,  # 25% chance of random verification request
        "VERIFICATION_TIMEOUT_HOURS": 24,  # Time limit to get verification
        "FAILED_VERIFICATION_PENALTY": 0.5  # Lose 50% of points if verification fails
    },
    "CHORE_WEIGHTS": {
        # Weight factors for fair distribution (higher = more "costly" chore)
        "TIME": {
            "quick": 1,      # < 10 min
            "medium": 2,     # 10-30 min
            "long": 3        # > 30 min
        },
        "DIFFICULTY": {
            "easy": 1,
            "medium": 2,
            "hard": 3
        },
        "GROSSNESS": {
            "clean": 1,      # Not gross at all
            "mild": 1.5,     # Slightly unpleasant
            "gross": 2,      # Nobody wants this
            "nasty": 3       # The worst tasks
        }
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

# Talent Tree Structure - Domestic Dominion
TALENT_TREE = {
    "self_care": {
        "name": "Self-Care Specialist",
        "icon": "💚",
        "description": "Trust, flexibility, dignity - reduces penalties and friction",
        "tiers": {
            1: {
                "name": "Personal Trust",
                "level_required": 1,
                "talents": [
                    {
                        "id": "sc_self_report",
                        "name": "Self-Report",
                        "cost": 1,
                        "description": "One routine chore per day may be marked complete without verification",
                        "effect_type": "verification_skip",
                        "effect_value": 1
                    },
                    {
                        "id": "sc_soft_miss",
                        "name": "Soft Miss",
                        "cost": 1,
                        "description": "Miss one chore per week without penalty or streak loss",
                        "effect_type": "miss_protection",
                        "effect_value": 1
                    }
                ]
            },
            2: {
                "name": "Flexibility",
                "level_required": 10,
                "talents": [
                    {
                        "id": "sc_time_shift",
                        "name": "Time Shift",
                        "cost": 1,
                        "description": "Move chores freely within the same calendar day",
                        "effect_type": "schedule_flexibility",
                        "effect_value": "same_day"
                    },
                    {
                        "id": "sc_wide_window",
                        "name": "Wide Window",
                        "cost": 1,
                        "description": "Move chores across a 3-day window without approval",
                        "effect_type": "schedule_flexibility",
                        "effect_value": "3_day"
                    }
                ]
            },
            3: {
                "name": "Consistency Protection",
                "level_required": 20,
                "talents": [
                    {
                        "id": "sc_bounce_back",
                        "name": "Bounce Back",
                        "cost": 1,
                        "description": "Completing a chore after a miss restores your streak",
                        "effect_type": "streak_protection",
                        "effect_value": True
                    },
                    {
                        "id": "sc_expectation_lock",
                        "name": "Expectation Lock",
                        "cost": 1,
                        "description": "Chore requirements cannot change after assignment",
                        "effect_type": "requirement_lock",
                        "effect_value": True
                    }
                ]
            },
            4: {
                "name": "Reduced Oversight",
                "level_required": 30,
                "talents": [
                    {
                        "id": "sc_verification_grace",
                        "name": "Verification Grace",
                        "cost": 1,
                        "description": "Verification rate is reduced for routine chores",
                        "effect_type": "verification_rate_reduction",
                        "effect_value": 0.15  # 20% -> 15%
                    },
                    {
                        "id": "sc_proof_simplification",
                        "name": "Proof Simplification",
                        "cost": 1,
                        "description": "Certain chores require fewer proof steps",
                        "effect_type": "proof_reduction",
                        "effect_value": True
                    }
                ]
            },
            5: {
                "name": "Earned Trust",
                "level_required": 40,
                "talents": [
                    {
                        "id": "sc_verification_immunity",
                        "name": "Verification Immunity",
                        "cost": 1,
                        "description": "One chore per week auto-approved",
                        "effect_type": "auto_approve",
                        "effect_value": 1
                    },
                    {
                        "id": "sc_failure_shield",
                        "name": "Failure Shield",
                        "cost": 1,
                        "description": "One failed verification per month does not reduce status",
                        "effect_type": "failure_protection",
                        "effect_value": 1
                    }
                ]
            },
            6: {
                "name": "Autonomy",
                "level_required": 50,
                "talents": [
                    {
                        "id": "sc_flexible_deadlines",
                        "name": "Flexible Deadlines",
                        "cost": 1,
                        "description": "One automatic 24-hour extension per week",
                        "effect_type": "deadline_extension",
                        "effect_value": 1
                    },
                    {
                        "id": "sc_chore_refusal",
                        "name": "Chore Refusal",
                        "cost": 1,
                        "description": "Decline one assigned chore per week with no penalty",
                        "effect_type": "refusal_allowance",
                        "effect_value": 1
                    }
                ]
            },
            7: {
                "name": "CAPSTONE: Honor System",
                "level_required": 60,
                "talents": [
                    {
                        "id": "sc_honor_system",
                        "name": "Honor System",
                        "cost": 2,
                        "description": "Routine chores rarely verified. Status marked as Trusted. Random audits still apply.",
                        "effect_type": "capstone",
                        "effect_value": "honor_system",
                        "is_capstone": True
                    }
                ]
            }
        }
    },
    "housework": {
        "name": "Housework Master",
        "icon": "🏆",
        "description": "Competence, specialization, clarity - makes work clearer and more efficient",
        "tiers": {
            1: {
                "name": "Familiarity",
                "level_required": 1,
                "talents": [
                    {
                        "id": "hw_room_bias",
                        "name": "Room Bias",
                        "cost": 1,
                        "description": "You are preferentially assigned chores in one chosen room",
                        "effect_type": "room_preference",
                        "effect_value": "select_room"
                    },
                    {
                        "id": "hw_routine_recognition",
                        "name": "Routine Recognition",
                        "cost": 1,
                        "description": "Repeating the same chore weekly reduces verification",
                        "effect_type": "routine_verification_reduction",
                        "effect_value": 0.5
                    }
                ]
            },
            2: {
                "name": "Scope Control",
                "level_required": 10,
                "talents": [
                    {
                        "id": "hw_chore_bundling",
                        "name": "Chore Bundling",
                        "cost": 1,
                        "description": "Related chores can be grouped and verified together",
                        "effect_type": "bundle_verification",
                        "effect_value": True
                    },
                    {
                        "id": "hw_partial_credit",
                        "name": "Partial Credit",
                        "cost": 1,
                        "description": "Incomplete heavy chores earn partial XP instead of failure",
                        "effect_type": "partial_xp",
                        "effect_value": True
                    }
                ]
            },
            3: {
                "name": "Specialization",
                "level_required": 20,
                "talents": [
                    {
                        "id": "hw_soft_ownership",
                        "name": "Soft Room Ownership",
                        "cost": 1,
                        "description": "You are first-offered chores in your chosen room",
                        "effect_type": "room_ownership",
                        "effect_value": "soft"
                    },
                    {
                        "id": "hw_repeat_bonus",
                        "name": "Repeat Bonus",
                        "cost": 1,
                        "description": "Consistent completion of the same chore earns bonus XP",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.15
                    }
                ]
            },
            4: {
                "name": "Efficiency (Real)",
                "level_required": 30,
                "talents": [
                    {
                        "id": "hw_batch_bonus",
                        "name": "Batch Bonus",
                        "cost": 1,
                        "description": "Completing multiple chores in the same area grants XP multiplier",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.20
                    },
                    {
                        "id": "hw_verification_streamline",
                        "name": "Verification Streamline",
                        "cost": 1,
                        "description": "Entire batches may be verified together",
                        "effect_type": "batch_verification",
                        "effect_value": True
                    }
                ]
            },
            5: {
                "name": "Trust & Difficulty",
                "level_required": 40,
                "talents": [
                    {
                        "id": "hw_reduced_proof",
                        "name": "Reduced Proof",
                        "cost": 1,
                        "description": "Some chores no longer require photo proof",
                        "effect_type": "proof_exemption",
                        "effect_value": True
                    },
                    {
                        "id": "hw_unpopular_bonus",
                        "name": "Unpopular Chore Bonus",
                        "cost": 1,
                        "description": "Low-demand chores grant extra XP",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.25
                    }
                ]
            },
            6: {
                "name": "Authority",
                "level_required": 50,
                "talents": [
                    {
                        "id": "hw_hard_ownership",
                        "name": "Hard Room Ownership",
                        "cost": 1,
                        "description": "You permanently own a room unless you opt out",
                        "effect_type": "room_ownership",
                        "effect_value": "hard"
                    },
                    {
                        "id": "hw_definition_input",
                        "name": "Definition Input",
                        "cost": 1,
                        "description": "You help define completion standards for owned chores",
                        "effect_type": "standard_definition",
                        "effect_value": True
                    }
                ]
            },
            7: {
                "name": "CAPSTONE: Domain Expert",
                "level_required": 60,
                "talents": [
                    {
                        "id": "hw_domain_expert",
                        "name": "Domain Expert",
                        "cost": 2,
                        "description": "Bonus XP for all chores in owned room. Default standards set by you. Others defer to your definitions.",
                        "effect_type": "capstone",
                        "effect_value": "domain_expert",
                        "is_capstone": True
                    }
                ]
            }
        }
    },
    "teamwork": {
        "name": "Teamwork Champion",
        "icon": "🤝",
        "description": "Coordination, sequencing, reliability - reduces friction for others",
        "tiers": {
            1: {
                "name": "Reliability",
                "level_required": 1,
                "talents": [
                    {
                        "id": "tw_coverage_ready",
                        "name": "Coverage Ready",
                        "cost": 1,
                        "description": "You may claim unassigned chores first",
                        "effect_type": "priority_claim",
                        "effect_value": True
                    },
                    {
                        "id": "tw_swap_fast_track",
                        "name": "Swap Fast-Track",
                        "cost": 1,
                        "description": "Your chore swaps bypass approval delays",
                        "effect_type": "instant_swap",
                        "effect_value": True
                    }
                ]
            },
            2: {
                "name": "Sequencing",
                "level_required": 10,
                "talents": [
                    {
                        "id": "tw_advance_prep",
                        "name": "Advance Prep Credit",
                        "cost": 1,
                        "description": "Completing prerequisite chores grants bonus XP",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.15
                    },
                    {
                        "id": "tw_sequence_bonus",
                        "name": "Sequence Bonus",
                        "cost": 1,
                        "description": "Completing chores in proper order grants bonus XP",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.15
                    }
                ]
            },
            3: {
                "name": "Load Sharing",
                "level_required": 20,
                "talents": [
                    {
                        "id": "tw_chore_takeover",
                        "name": "Formal Chore Takeover",
                        "cost": 1,
                        "description": "You may absorb another chore into yours (visible transfer)",
                        "effect_type": "takeover",
                        "effect_value": True
                    },
                    {
                        "id": "tw_shared_proof",
                        "name": "Shared Proof",
                        "cost": 1,
                        "description": "One proof can satisfy multiple related chores",
                        "effect_type": "shared_verification",
                        "effect_value": True
                    }
                ]
            },
            4: {
                "name": "Coverage",
                "level_required": 30,
                "talents": [
                    {
                        "id": "tw_overflow_catcher",
                        "name": "Overflow Catcher",
                        "cost": 1,
                        "description": "When others exceed limits, you are offered work first",
                        "effect_type": "overflow_priority",
                        "effect_value": True
                    },
                    {
                        "id": "tw_coverage_agreements",
                        "name": "Coverage Agreements",
                        "cost": 1,
                        "description": "Pre-arranged coverage for illness or absence",
                        "effect_type": "coverage_system",
                        "effect_value": True
                    }
                ]
            },
            5: {
                "name": "Leadership",
                "level_required": 40,
                "talents": [
                    {
                        "id": "tw_volunteer_authority",
                        "name": "Volunteer Authority",
                        "cost": 1,
                        "description": "Take extra chores without penalty stacking",
                        "effect_type": "extra_chore_protection",
                        "effect_value": True
                    },
                    {
                        "id": "tw_temp_assignment",
                        "name": "Temporary Assignment Control",
                        "cost": 1,
                        "description": "Assign chores with recipient consent",
                        "effect_type": "assignment_permission",
                        "effect_value": True
                    }
                ]
            },
            6: {
                "name": "Stability",
                "level_required": 50,
                "talents": [
                    {
                        "id": "tw_team_streak",
                        "name": "Team Streak Bonus",
                        "cost": 1,
                        "description": "If all chores complete on time, you gain bonus XP",
                        "effect_type": "xp_bonus",
                        "effect_value": 0.30
                    },
                    {
                        "id": "tw_trust_anchor",
                        "name": "Trust Anchor",
                        "cost": 1,
                        "description": "Your participation reduces verification for others",
                        "effect_type": "team_verification_reduction",
                        "effect_value": 0.05
                    }
                ]
            },
            7: {
                "name": "CAPSTONE: Coordinator",
                "level_required": 60,
                "talents": [
                    {
                        "id": "tw_coordinator",
                        "name": "Coordinator",
                        "cost": 2,
                        "description": "Unlocks multi-person chore chains. Enables household projects. Visible status as coordination lead.",
                        "effect_type": "capstone",
                        "effect_value": "coordinator",
                        "is_capstone": True
                    }
                ]
            }
        }
    },
    "hybrid": {
        "name": "Hybrid Talents",
        "icon": "🌈",
        "description": "Unlock after Tier 3 in any two specs",
        "talents": [
            {
                "id": "hy_prepared_ally",
                "name": "Prepared Ally",
                "cost": 1,
                "description": "Prerequisite + follow-up chores grant bonus XP",
                "requires_specs": ["teamwork", "housework"],
                "requires_tier": 3,
                "effect_type": "xp_bonus",
                "effect_value": 0.20
            },
            {
                "id": "hy_reliable_adult",
                "name": "Reliable Adult",
                "cost": 1,
                "description": "Coverage actions never penalize you",
                "requires_specs": ["self_care", "teamwork"],
                "requires_tier": 3,
                "effect_type": "coverage_protection",
                "effect_value": True
            },
            {
                "id": "hy_sustainable_specialist",
                "name": "Sustainable Specialist",
                "cost": 1,
                "description": "Repeated work never increases verification",
                "requires_specs": ["self_care", "housework"],
                "requires_tier": 3,
                "effect_type": "verification_protection",
                "effect_value": True
            }
        ]
    }
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
    COUPLE = "Couple"  # Kept but renamed to "Connection" in frontend
    GROWTH = "Growth"
    HOUSEKEEPING = "Housekeeping"
    COUPLING = "Coupling"  # Now "Connection" - unlocks romantic quests with talent combo

class TaskDifficulty(str, Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

class QuestType(str, Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY" 
    SPECIAL = "SPECIAL"

class UserRole(str, Enum):
    ADMIN = "admin"  # Household creator, can assign chores, manage members
    MEMBER = "member"  # Regular player
    GUEST = "guest"  # Limited access

class HouseholdType(str, Enum):
    APARTMENT = "Apartment"
    HOUSE = "House"
    SHARED = "Shared Housing / Dorm"
    FAMILY = "family"
    ROOMMATES = "roommates"
    COUPLE = "couple"
    OTHER = "other"

# Comprehensive 10-Tier Talent Tree System (Domestic Dominion)
# Based on new world map specification with 3 kingdoms/branches
NEW_TALENT_TREE_NODES = {
    # ===== HOUSEKEEPING HEROES (Country I: Sanctum of Stewardry) =====
    # Free Tiers 1-5
    # Tier 1: Dustvale - Basic cleaning, dishes, tidying
    "hh_dish_duty": {
        "id": "hh_dish_duty",
        "name": "Dish Duty",
        "branch": "Housekeeping",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts each time you log dishwashing within 12 hrs of meal",
        "effect": {"type": "time_bonus", "category": "dishwashing", "time_window": 12, "bonus": 5},
        "prerequisites": [],
        "position": {"x": 100, "y": 50},
        "premium": False
    },
    
    # Tier 2: Clothfold Downs - Laundry, linens, organization
    "hh_laundry_legends": {
        "id": "hh_laundry_legends", 
        "name": "Laundry Legends",
        "branch": "Housekeeping",
        "tier": 2,
        "cost": 2,
        "description": "+10% point bonus when laundry is folded same day",
        "effect": {"type": "category_multiplier", "category": "laundry", "condition": "same_day", "multiplier": 1.1},
        "prerequisites": ["hh_dish_duty"],
        "position": {"x": 100, "y": 120},
        "premium": False
    },
    
    # Tier 3: Pawshire Fields - Pet care
    "hh_pet_patrol": {
        "id": "hh_pet_patrol",
        "name": "Pet Patrol", 
        "branch": "Housekeeping",
        "tier": 3,
        "cost": 2,
        "description": "Unlocks pet task tracking (feeding, litter box, walks, meds)",
        "effect": {"type": "unlock_category", "category": "pet_tasks", "tasks": ["feeding", "litter", "walks", "medication"]},
        "prerequisites": ["hh_laundry_legends"],
        "position": {"x": 100, "y": 190},
        "premium": False
    },
    
    # Tier 4: Motorstead - Vehicle maintenance
    "hh_vehicle_vanguard": {
        "id": "hh_vehicle_vanguard",
        "name": "Vehicle Vanguard",
        "branch": "Housekeeping", 
        "tier": 4,
        "cost": 2,
        "description": "Unlocks car-related tasks (oil check, gas fill, cleaning)",
        "effect": {"type": "unlock_category", "category": "vehicle_tasks", "tasks": ["oil_check", "gas_fill", "car_cleaning", "maintenance"]},
        "prerequisites": ["hh_pet_patrol"],
        "position": {"x": 100, "y": 260},
        "premium": False
    },
    
    # Tier 5: Twin Task Hills - Synchronize chores with partner
    "hh_tag_team_clean": {
        "id": "hh_tag_team_clean",
        "name": "Tag Team Clean",
        "branch": "Housekeeping",
        "tier": 5,
        "cost": 3,
        "description": "Bonus for completing a chore within 2 hrs of partner's",
        "effect": {"type": "partner_sync_bonus", "time_window": 2, "bonus_multiplier": 1.2},
        "prerequisites": ["hh_vehicle_vanguard"],
        "position": {"x": 100, "y": 330},
        "premium": False
    },
    
    # Premium Tiers 6-10 (Paid unlock)
    # Tier 6: Sparkspire City - Efficiency bonuses
    "hh_efficiency_expert": {
        "id": "hh_efficiency_expert",
        "name": "Efficiency Expert",
        "branch": "Housekeeping",
        "tier": 6,
        "cost": 3,
        "description": "+15% base points when completing 3+ chores in a row",
        "effect": {"type": "streak_bonus", "min_streak": 3, "multiplier": 1.15},
        "prerequisites": ["hh_tag_team_clean"],
        "position": {"x": 100, "y": 400},
        "premium": True
    },
    
    # Tier 7: Zenwood Sanctuary - Home as calm, balanced energy
    "hh_sanctuary_sensei": {
        "id": "hh_sanctuary_sensei", 
        "name": "Sanctuary Sensei",
        "branch": "Housekeeping",
        "tier": 7,
        "cost": 3,
        "description": "Partner receives a calm-day bonus if all rooms logged",
        "effect": {"type": "partner_bonus", "condition": "all_rooms_complete", "bonus": "calm_day"},
        "prerequisites": ["hh_efficiency_expert"],
        "position": {"x": 100, "y": 470},
        "premium": True
    },
    
    # Tier 8: Ecohollow Grove - Environmentally mindful chores
    "hh_green_guardian": {
        "id": "hh_green_guardian",
        "name": "Green Guardian", 
        "branch": "Housekeeping",
        "tier": 8,
        "cost": 4,
        "description": "Track and reward eco-actions (recycling, low water use)",
        "effect": {"type": "unlock_category", "category": "eco_tasks", "bonus_multiplier": 1.25},
        "prerequisites": ["hh_sanctuary_sensei"],
        "position": {"x": 100, "y": 540},
        "premium": True
    },
    
    # Tier 9: Citadel of Order - Total household harmony
    "hh_homebound_hero": {
        "id": "hh_homebound_hero",
        "name": "Homebound Hero",
        "branch": "Housekeeping",
        "tier": 9,
        "cost": 4,
        "description": "Gain 2x points for weekend home reset routines",
        "effect": {"type": "time_multiplier", "days": ["saturday", "sunday"], "category": "home_reset", "multiplier": 2.0},
        "prerequisites": ["hh_green_guardian"],
        "position": {"x": 100, "y": 610},
        "premium": True
    },
    
    # Tier 10: Crown of the Keep - Mastery node
    "hh_keeper_of_keep": {
        "id": "hh_keeper_of_keep",
        "name": "Keeper of the Keep",
        "branch": "Housekeeping", 
        "tier": 10,
        "cost": 5,
        "description": "Auto-completes one daily low-value task when you reach 100% partner approval for a week",
        "effect": {"type": "mastery_autocomplete", "condition": "100_percent_approval", "duration": "week"},
        "prerequisites": ["hh_homebound_hero"],
        "position": {"x": 100, "y": 680},
        "premium": True
    },
    
    # ===== COUPLING QUESTLINE (Country II: The Heartlands of Concord) =====
    # Free Tiers 1-5
    # Tier 1: Affection's Edge - Small kindnesses, compliments
    "cq_quality_quest": {
        "id": "cq_quality_quest",
        "name": "Quality Quest",
        "branch": "Coupling",
        "tier": 1,
        "cost": 1,
        "description": "+10 pts for shared activities logged (dinner, show, walk)",
        "effect": {"type": "category_bonus", "category": "shared_activities", "bonus": 10},
        "prerequisites": [],
        "position": {"x": 300, "y": 50},
        "premium": False
    },
    
    # Tier 2: Bondbridge Fields - Shared activity quests
    "cq_compliment_chain": {
        "id": "cq_compliment_chain",
        "name": "Compliment Chain",
        "branch": "Coupling",
        "tier": 2,
        "cost": 2,
        "description": "Consecutive days of positive notes grant streak bonus",
        "effect": {"type": "streak_bonus", "category": "positive_notes", "bonus_per_day": 2},
        "prerequisites": ["cq_quality_quest"],
        "position": {"x": 300, "y": 120},
        "premium": False
    },
    
    # Tier 3: Echo's Hollow - Logging appreciation notes
    "cq_shared_goal_setter": {
        "id": "cq_shared_goal_setter", 
        "name": "Shared Goal Setter",
        "branch": "Coupling",
        "tier": 3,
        "cost": 2,
        "description": "Unlocks weekly 'Team Quest' board",
        "effect": {"type": "unlock_feature", "feature": "team_quest_board", "frequency": "weekly"},
        "prerequisites": ["cq_compliment_chain"],
        "position": {"x": 300, "y": 190},
        "premium": False
    },
    
    # Tier 4: Trustmere Vale - Partner verification and cooperation
    "cq_verification_bonus": {
        "id": "cq_verification_bonus",
        "name": "Verification Bonus",
        "branch": "Coupling",
        "tier": 4,
        "cost": 2,
        "description": "+5 pts for partner-verified tasks",
        "effect": {"type": "verification_bonus", "bonus": 5},
        "prerequisites": ["cq_shared_goal_setter"],
        "position": {"x": 300, "y": 260},
        "premium": False
    },
    
    # Tier 5: Sacrifice Summit - Take a task for love
    "cq_take_one_for_love": {
        "id": "cq_take_one_for_love",
        "name": "Take One For Love", 
        "branch": "Coupling",
        "tier": 5,
        "cost": 3,
        "description": "Option to take partner's task for 3x reward",
        "effect": {"type": "takeover_multiplier", "multiplier": 3.0},
        "prerequisites": ["cq_verification_bonus"],
        "position": {"x": 300, "y": 330},
        "premium": False
    },
    
    # Premium Tiers 6-10
    # Tier 6: Duality Basin - Timed partner task completion bonuses
    "cq_bond_builder": {
        "id": "cq_bond_builder",
        "name": "Bond Builder",
        "branch": "Coupling",
        "tier": 6,
        "cost": 3,
        "description": "+20% points if both partners complete a quest within 2 hrs",
        "effect": {"type": "partner_sync_bonus", "time_window": 2, "multiplier": 1.2},
        "prerequisites": ["cq_take_one_for_love"],
        "position": {"x": 300, "y": 400},
        "premium": True
    },
    
    # Tier 7: Empathy Keep - Emotional intelligence rewards
    "cq_empathy_echo": {
        "id": "cq_empathy_echo",
        "name": "Empathy Echo",
        "branch": "Coupling",
        "tier": 7,
        "cost": 3,
        "description": "Each compliment written adds +1 to partner's morale meter",
        "effect": {"type": "partner_morale_bonus", "bonus_per_compliment": 1},
        "prerequisites": ["cq_bond_builder"],
        "position": {"x": 300, "y": 470},
        "premium": True
    },
    
    # Tier 8: Harmony Garden - Conflict resolution via reworded critiques
    "cq_harmony_halo": {
        "id": "cq_harmony_halo",
        "name": "Harmony Halo",
        "branch": "Coupling",
        "tier": 8,
        "cost": 4,
        "description": "Negative logs are rephrased automatically into growth notes",
        "effect": {"type": "message_filter", "filter_type": "negative_to_growth"},
        "prerequisites": ["cq_empathy_echo"],
        "position": {"x": 300, "y": 540},
        "premium": True
    },
    
    # Tier 9: Union Cathedral - Joint chores and couple challenges
    "cq_unity_upgrade": {
        "id": "cq_unity_upgrade",
        "name": "Unity Upgrade",
        "branch": "Coupling",
        "tier": 9,
        "cost": 4,
        "description": "Unlocks 'dual chores' (tasks only rewardable when done together)",
        "effect": {"type": "unlock_category", "category": "dual_chores", "requirement": "both_partners"},
        "prerequisites": ["cq_harmony_halo"],
        "position": {"x": 300, "y": 610},
        "premium": True
    },
    
    # Tier 10: Soulforge Citadel - Mastery node  
    "cq_soul_sync": {
        "id": "cq_soul_sync",
        "name": "Soul Sync",
        "branch": "Coupling",
        "tier": 10,
        "cost": 5,
        "description": "Permanently doubles verification rewards if relationship satisfaction stays above 80% for a month",
        "effect": {"type": "mastery_verification_double", "condition": "80_percent_satisfaction", "duration": "month"},
        "prerequisites": ["cq_unity_upgrade"],
        "position": {"x": 300, "y": 680},
        "premium": True
    },
    
    # ===== PERSONAL GROWTH PATH (Country III: The Realm of Resonance) =====
    # Free Tiers 1-5
    # Tier 1: Routine Ridge - Building daily consistency
    "pg_routine_rookie": {
        "id": "pg_routine_rookie",
        "name": "Routine Rookie",
        "branch": "Growth",
        "tier": 1,
        "cost": 1,
        "description": "+5 pts for every 3-day streak of all tasks completed",
        "effect": {"type": "streak_bonus", "streak_length": 3, "bonus": 5},
        "prerequisites": [],
        "position": {"x": 500, "y": 50},
        "premium": False
    },
    
    # Tier 2: Mirrorpool Glen - Reflection and self-awareness
    "pg_reflective_learner": {
        "id": "pg_reflective_learner",
        "name": "Reflective Learner",
        "branch": "Growth",
        "tier": 2,
        "cost": 2,
        "description": "Unlocks daily self-question prompts",
        "effect": {"type": "unlock_feature", "feature": "daily_self_questions", "frequency": "daily"},
        "prerequisites": ["pg_routine_rookie"],
        "position": {"x": 500, "y": 120},
        "premium": False
    },
    
    # Tier 3: Zenstep Meadow - Learning rest, balance, and forgiveness
    "pg_zen_mode": {
        "id": "pg_zen_mode", 
        "name": "Zen Mode",
        "branch": "Growth",
        "tier": 3,
        "cost": 2,
        "description": "Choose 1 day a week to skip non-critical tasks with no penalty",
        "effect": {"type": "skip_allowance", "frequency": "weekly", "task_type": "non_critical"},
        "prerequisites": ["pg_reflective_learner"],
        "position": {"x": 500, "y": 190},
        "premium": False
    },
    
    # Tier 4: Harmony Hollow - Partner-aligned self-ratings
    "pg_mindful_mirror": {
        "id": "pg_mindful_mirror",
        "name": "Mindful Mirror",
        "branch": "Growth",
        "tier": 4,
        "cost": 2,
        "description": "+10 pts for self-evaluation that matches partner's rating",
        "effect": {"type": "partner_alignment_bonus", "bonus": 10},
        "prerequisites": ["pg_zen_mode"],
        "position": {"x": 500, "y": 260},
        "premium": False
    },
    
    # Tier 5: Moodspire Plateau - Emotional consistency rewards
    "pg_mood_manager": {
        "id": "pg_mood_manager",
        "name": "Mood Manager",
        "branch": "Growth",
        "tier": 5,
        "cost": 3,
        "description": "+10% points if all logs remain positive for a week",
        "effect": {"type": "positivity_bonus", "duration": "week", "multiplier": 1.1},
        "prerequisites": ["pg_mindful_mirror"],
        "position": {"x": 500, "y": 330},
        "premium": False
    },
    
    # Premium Tiers 6-10
    # Tier 6: Serenity Marsh - Calming tools (pause critiques, reflect options)
    "pg_self_soother": {
        "id": "pg_self_soother",
        "name": "Self-Soother",
        "branch": "Growth",
        "tier": 6,
        "cost": 3,
        "description": "Unlocks 'calm break' feature to pause your partner's critique for 24 hrs",
        "effect": {"type": "pause_critiques", "duration": 24, "frequency": "as_needed"},
        "prerequisites": ["pg_mood_manager"],
        "position": {"x": 500, "y": 400},
        "premium": True
    },
    
    # Tier 7: Balance Bridge - Equal focus on self and relationship tasks
    "pg_balance_buff": {
        "id": "pg_balance_buff",
        "name": "Balance Buff",
        "branch": "Growth",
        "tier": 7,
        "cost": 3,
        "description": "+10% base points on days with both self and partner quests complete",
        "effect": {"type": "balance_bonus", "requirement": "both_quest_types", "multiplier": 1.1},
        "prerequisites": ["pg_self_soother"],
        "position": {"x": 500, "y": 470},
        "premium": True
    },
    
    # Tier 8: Spiritwood Trail - Journaling, gratitude, meditation tasks
    "pg_growth_guardian": {
        "id": "pg_growth_guardian",
        "name": "Growth Guardian",
        "branch": "Growth",
        "tier": 8,
        "cost": 4,
        "description": "Unlocks mini-quests like journaling, meditation, or gratitude",
        "effect": {"type": "unlock_category", "category": "mindfulness_quests", "types": ["journaling", "meditation", "gratitude"]},
        "prerequisites": ["pg_balance_buff"],
        "position": {"x": 500, "y": 540},
        "premium": True
    },
    
    # Tier 9: Gracepeak Monastery - Altruism rewards (acts of service)
    "pg_altruist_aura": {
        "id": "pg_altruist_aura",
        "name": "Altruist Aura",
        "branch": "Growth",
        "tier": 9,
        "cost": 4,
        "description": "2x points for doing tasks that directly benefit your partner's comfort",
        "effect": {"type": "altruism_multiplier", "multiplier": 2.0, "target": "partner_comfort"},
        "prerequisites": ["pg_growth_guardian"],
        "position": {"x": 500, "y": 610},
        "premium": True
    },
    
    # Tier 10: Enlightened Pinnacle - Mastery node
    "pg_enlightened_partner": {
        "id": "pg_enlightened_partner",
        "name": "Enlightened Partner",
        "branch": "Growth",
        "tier": 10,
        "cost": 5,
        "description": "Gain 1 free 'Zen Token' weekly, which lets you skip or swap a task without penalty and gift that break to your partner",
        "effect": {"type": "mastery_zen_token", "frequency": "weekly", "benefits": ["skip_task", "swap_task", "gift_partner"]},
        "prerequisites": ["pg_altruist_aura"],
        "position": {"x": 500, "y": 680},
        "premium": True
    }
}


# Predefined Quest Templates (NES-themed) with fairness weights
DEFAULT_QUEST_TEMPLATES = {
    # DAILY QUESTS - Standard household tasks
    # weight factors: time (quick/medium/long), grossness (clean/mild/gross/nasty)
    "daily": [
        {"title": "🛏️ Make the bed", "room": "Bedroom", "points": 5, "difficulty": "EASY", "category": "household", "icon": "🛏️", "time": "quick", "grossness": "clean"},
        {"title": "🍽️ Wash dishes", "room": "Kitchen", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🍽️", "time": "medium", "grossness": "mild"},
        {"title": "🧹 Vacuum living room", "room": "Living Room", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🧹", "time": "medium", "grossness": "clean"},
        {"title": "🧺 Do laundry", "room": "Laundry Room", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🧺", "time": "long", "grossness": "mild"},
        {"title": "🍳 Cook breakfast", "room": "Kitchen", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🍳", "time": "medium", "grossness": "clean"},
        {"title": "🚿 Clean bathroom", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "household", "icon": "🚿", "time": "medium", "grossness": "gross"},
        {"title": "🗑️ Take out trash", "room": "Kitchen", "points": 5, "difficulty": "EASY", "category": "household", "icon": "🗑️", "time": "quick", "grossness": "gross"},
        {"title": "💧 Water plants", "room": "Living Room", "points": 5, "difficulty": "EASY", "category": "household", "icon": "💧", "time": "quick", "grossness": "clean"},
        {"title": "🦷 Brush teeth", "room": "Bathroom", "points": 5, "difficulty": "EASY", "category": "personal", "icon": "🦷", "time": "quick", "grossness": "clean"},
    ],
    
    # WEEKLY QUESTS - Bigger household projects
    "weekly": [
        {"title": "🏪 Grocery shopping", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🏪", "time": "long", "grossness": "clean"},
        {"title": "🧽 Deep clean kitchen", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🧽", "time": "long", "grossness": "gross"},
        {"title": "🍲 Food pantry visit", "room": "Kitchen", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🍲", "time": "long", "grossness": "clean"},
        {"title": "🧼 Deep clean bathroom", "room": "Bathroom", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🧼", "time": "long", "grossness": "nasty"},
        {"title": "🛋️ Organize living room", "room": "Living Room", "points": 20, "difficulty": "HARD", "category": "household", "icon": "🛋️", "time": "long", "grossness": "clean"},
        {"title": "👕 Organize closet", "room": "Bedroom", "points": 20, "difficulty": "HARD", "category": "household", "icon": "👕", "time": "long", "grossness": "clean"},
    ],
    
    # PET TASKS
    "pet": [
        {"title": "🍖 Feed pets", "room": "Kitchen", "points": 5, "difficulty": "EASY", "category": "pet", "icon": "🍖", "time": "quick", "grossness": "clean"},
        {"title": "🐕 Walk pets", "room": "Outside", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🐕", "time": "medium", "grossness": "mild"},
        {"title": "🛁 Groom or bathe pets", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🛁", "time": "medium", "grossness": "mild"},
        {"title": "🏥 Vet visits", "room": "Outside", "points": 20, "difficulty": "HARD", "category": "pet", "icon": "🏥", "time": "long", "grossness": "clean"},
        {"title": "🧹 Clean litter box", "room": "Bathroom", "points": 10, "difficulty": "MEDIUM", "category": "pet", "icon": "🧹", "time": "quick", "grossness": "nasty"},
    ],
    
    # VEHICLE TASKS
    "vehicle": [
        {"title": "🛢️ Check oil / fluids", "room": "Outside", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🛢️", "time": "quick", "grossness": "mild"},
        {"title": "🧽 Clean or vacuum car", "room": "Outside", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🧽", "time": "medium", "grossness": "mild"},
        {"title": "⛽ Fill gas", "room": "Outside", "points": 5, "difficulty": "EASY", "category": "vehicle", "icon": "⛽", "time": "quick", "grossness": "clean"},
        {"title": "🔧 Repair or maintenance", "room": "Outside", "points": 20, "difficulty": "HARD", "category": "vehicle", "icon": "🔧", "time": "long", "grossness": "gross"},
        {"title": "🚗 Wash exterior", "room": "Outside", "points": 10, "difficulty": "MEDIUM", "category": "vehicle", "icon": "🚗", "time": "medium", "grossness": "clean"},
    ],
    
    # SPECIAL QUESTS - Event-based or irregular
    "special": [
        {"title": "🎄 Holiday decorating", "room": "Living Room", "points": 20, "difficulty": "HARD", "category": "special", "icon": "🎄", "time": "long", "grossness": "clean"},
        {"title": "🛠️ Fix household item", "room": "General", "points": 20, "difficulty": "HARD", "category": "special", "icon": "🛠️", "time": "long", "grossness": "mild"},
        {"title": "💊 Schedule appointments", "room": "General", "points": 10, "difficulty": "MEDIUM", "category": "special", "icon": "💊", "time": "quick", "grossness": "clean"},
        {"title": "📦 Organize storage", "room": "General", "points": 20, "difficulty": "HARD", "category": "special", "icon": "📦", "time": "long", "grossness": "mild"},
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



# Dynamic Chore Generation based on Household Data
def generate_household_chores(onboarding_data: dict) -> List[dict]:
    """
    Generate comprehensive personalized chore list based on progressive onboarding data
    Implements room-based, weighted chore generation with metadata
    """
    chores = []
    chore_id_counter = 1
    
    def add_chore(title: str, room: str, difficulty: str, category: str = "household", 
                  time_estimate: int = 15, grossness_level: int = 0, verification_eligible: bool = True):
        """Add a chore with full metadata"""
        nonlocal chore_id_counter
        base_points = {"EASY": 5, "MEDIUM": 10, "HARD": 20}.get(difficulty, 10)
        chores.append({
            "taskId": f"task_{chore_id_counter}",
            "title": title,
            "room": room,
            "difficulty": difficulty,
            "basePoints": base_points,
            "category": category,
            "time_estimate": time_estimate,  # minutes
            "grossness_level": grossness_level,  # 0-3
            "verification_eligible": verification_eligible,
            "icon": "📋"
        })
        chore_id_counter += 1
    
    # Extract comprehensive setup data
    rooms = onboarding_data.get('rooms', {})
    laundry_type = onboarding_data.get('laundryType', 'in_unit')
    drying_method = onboarding_data.get('dryingMethod', ['dryer'])
    pets = onboarding_data.get('pets', [])
    vehicles = onboarding_data.get('vehicles', [])
    trash_days = onboarding_data.get('trashDays', [])
    
    # ========== LIVING ROOM / SHARED SPACES ==========
    # Light
    add_chore("Tidy surfaces", "Living Room", "EASY", time_estimate=10, grossness_level=0)
    add_chore("Return items to proper rooms", "Living Room", "EASY", time_estimate=10, grossness_level=0)
    add_chore("Trash pickup", "Living Room", "EASY", time_estimate=5, grossness_level=1)
    
    # Standard
    add_chore("Vacuum or sweep", "Living Room", "MEDIUM", time_estimate=20, grossness_level=1)
    add_chore("Dust shelves / electronics", "Living Room", "MEDIUM", time_estimate=15, grossness_level=1)
    add_chore("Organize clutter zones", "Living Room", "MEDIUM", time_estimate=25, grossness_level=0)
    
    # Heavy
    add_chore("Deep vacuum (under furniture)", "Living Room", "HARD", time_estimate=40, grossness_level=2)
    add_chore("Spot clean upholstery", "Living Room", "HARD", time_estimate=30, grossness_level=2)
    add_chore("Window cleaning", "Living Room", "HARD", time_estimate=35, grossness_level=1)
    
    # ========== KITCHEN ==========
    # Light
    add_chore("Load/unload dishwasher", "Kitchen", "EASY", time_estimate=10, grossness_level=1)
    add_chore("Wipe counters", "Kitchen", "EASY", time_estimate=10, grossness_level=1)
    add_chore("Kitchen trash/recycling", "Kitchen", "EASY", time_estimate=5, grossness_level=2)
    
    # Standard
    add_chore("Hand wash dishes", "Kitchen", "MEDIUM", time_estimate=20, grossness_level=2)
    add_chore("Clean sink & stove", "Kitchen", "MEDIUM", time_estimate=20, grossness_level=2)
    add_chore("Sweep kitchen floor", "Kitchen", "MEDIUM", time_estimate=15, grossness_level=1)
    
    # Heavy
    add_chore("Mop kitchen floor", "Kitchen", "HARD", time_estimate=30, grossness_level=2)
    add_chore("Fridge clean-out", "Kitchen", "HARD", time_estimate=40, grossness_level=3)
    add_chore("Pantry reorganization", "Kitchen", "HARD", time_estimate=45, grossness_level=1)
    
    # ========== BATHROOMS ==========
    bathrooms_count = rooms.get('bathrooms', 1)
    for i in range(1, bathrooms_count + 1):
        bath_label = f"Bathroom {i}" if bathrooms_count > 1 else "Bathroom"
        
        # Light
        add_chore(f"Replace towels - {bath_label}", bath_label, "EASY", time_estimate=5, grossness_level=0)
        add_chore(f"Empty trash - {bath_label}", bath_label, "EASY", time_estimate=3, grossness_level=2)
        add_chore(f"Quick wipe sink/mirror - {bath_label}", bath_label, "EASY", time_estimate=10, grossness_level=1)
        
        # Standard
        add_chore(f"Toilet cleaning - {bath_label}", bath_label, "MEDIUM", time_estimate=15, grossness_level=3)
        add_chore(f"Shower wipe-down - {bath_label}", bath_label, "MEDIUM", time_estimate=20, grossness_level=2)
        add_chore(f"Floor sweep/mop - {bath_label}", bath_label, "MEDIUM", time_estimate=20, grossness_level=2)
        
        # Heavy
        add_chore(f"Deep scrub tub/shower - {bath_label}", bath_label, "HARD", time_estimate=40, grossness_level=3)
        add_chore(f"Mold/mildew treatment - {bath_label}", bath_label, "HARD", time_estimate=35, grossness_level=3)
    
    # ========== BEDROOMS ==========
    bedrooms_count = rooms.get('bedrooms', 1)
    for i in range(1, bedrooms_count + 1):
        bed_label = f"Bedroom {i}" if bedrooms_count > 1 else "Bedroom"
        
        # Light
        add_chore(f"Make bed - {bed_label}", bed_label, "EASY", time_estimate=5, grossness_level=0)
        add_chore(f"Tidy floor - {bed_label}", bed_label, "EASY", time_estimate=10, grossness_level=0)
        add_chore(f"Trash removal - {bed_label}", bed_label, "EASY", time_estimate=3, grossness_level=1)
        
        # Standard
        add_chore(f"Vacuum/sweep - {bed_label}", bed_label, "MEDIUM", time_estimate=15, grossness_level=1)
        add_chore(f"Dust surfaces - {bed_label}", bed_label, "MEDIUM", time_estimate=15, grossness_level=1)
        add_chore(f"Change bedding - {bed_label}", bed_label, "MEDIUM", time_estimate=20, grossness_level=1)
        
        # Heavy
        add_chore(f"Closet organization - {bed_label}", bed_label, "HARD", time_estimate=60, grossness_level=1)
    
    # ========== LAUNDRY (SYSTEM-AWARE) ==========
    if laundry_type == 'in_unit':
        # Light
        add_chore("Sort laundry", "Laundry Room", "EASY", time_estimate=10, grossness_level=1)
        add_chore("Fold clothes", "Laundry Room", "EASY", time_estimate=20, grossness_level=0)
        
        # Standard
        add_chore("Wash & dry loads", "Laundry Room", "MEDIUM", time_estimate=90, grossness_level=1)
        add_chore("Put away shared items", "Laundry Room", "MEDIUM", time_estimate=15, grossness_level=0)
        
        if 'line_dry' in drying_method:
            add_chore("Line-drying management", "Laundry Room", "MEDIUM", time_estimate=30, grossness_level=0)
    
    elif laundry_type == 'laundromat':
        # Heavy (time + cost aware)
        runs_per_week = onboarding_data.get('laundromat_runs_per_week', 1)
        add_chore("Laundromat run (includes travel)", "Outdoor", "HARD", time_estimate=120, grossness_level=1)
    
    # ========== PETS (CONDITIONAL) ==========
    for pet in pets:
        pet_type = pet.get('type', '')
        pet_count = pet.get('count', 1)
        
        if pet_type == 'dog':
            # Light
            add_chore(f"Feed dogs ({pet_count}x)", "Kitchen", "EASY", "pet", time_estimate=5, grossness_level=0)
            add_chore("Water refresh", "Kitchen", "EASY", "pet", time_estimate=3, grossness_level=0)
            
            # Standard
            add_chore("Walk dog", "Outdoor", "MEDIUM", "pet", time_estimate=30, grossness_level=1)
            add_chore("Pick up dog waste", "Outdoor", "MEDIUM", "pet", time_estimate=10, grossness_level=3)
        
        elif pet_type == 'cat':
            # Light
            add_chore(f"Feed cats ({pet_count}x)", "Kitchen", "EASY", "pet", time_estimate=5, grossness_level=0)
            
            # Standard
            add_chore("Litter box cleaning", "Bathroom", "MEDIUM", "pet", time_estimate=15, grossness_level=3)
        
        elif pet_type in ['bird', 'small_pet']:
            # Standard
            add_chore(f"Clean pet habitat ({pet_type})", "General", "MEDIUM", "pet", time_estimate=25, grossness_level=2)
            add_chore(f"Feed small pet ({pet_type})", "General", "EASY", "pet", time_estimate=5, grossness_level=0)
    
    # ========== VEHICLES (CONDITIONAL) ==========
    for vehicle in vehicles:
        v_type = vehicle.get('type', 'Car')
        shared = vehicle.get('shared', True)
        label = f"{v_type} ({'Shared' if shared else 'Personal'})"
        
        # Light
        add_chore(f"Remove trash - {label}", "Garage", "EASY", "vehicle", time_estimate=5, grossness_level=1)
        add_chore(f"Windshield wipe - {label}", "Garage", "EASY", "vehicle", time_estimate=10, grossness_level=1)
        
        # Standard
        add_chore(f"Interior vacuum - {label}", "Garage", "MEDIUM", "vehicle", time_estimate=25, grossness_level=2)
        
        # Heavy
        add_chore(f"Wash/detail - {label}", "Garage", "HARD", "vehicle", time_estimate=60, grossness_level=2)
    
    # ========== ADDITIONAL SPACES ==========
    if rooms.get('basement'):
        add_chore("Basement tidying", "Basement", "MEDIUM", time_estimate=30, grossness_level=1)
        add_chore("Basement deep clean", "Basement", "HARD", time_estimate=60, grossness_level=2)
    
    if rooms.get('attic'):
        add_chore("Attic organization", "Attic", "HARD", time_estimate=90, grossness_level=2)
    
    if rooms.get('office'):
        add_chore("Office desk organization", "Office", "EASY", time_estimate=15, grossness_level=0)
        add_chore("Office dusting", "Office", "EASY", time_estimate=10, grossness_level=1)
    
    if rooms.get('garage'):
        add_chore("Garage sweep", "Garage", "MEDIUM", time_estimate=20, grossness_level=1)
    
    # ========== TRASH SCHEDULE CHORES ==========
    if trash_days:
        add_chore(f"Take out trash (Days: {', '.join(trash_days)})", "General", "EASY", time_estimate=10, grossness_level=2)
        add_chore(f"Recycling out (Days: {', '.join(trash_days)})", "General", "EASY", time_estimate=10, grossness_level=1)
    
    return chores


# Models
class User(BaseModel):
    userId: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}")
    displayName: str
    householdId: str  # Changed from coupleId
    role: UserRole = UserRole.MEMBER
    points: int = 0
    level: int = 1
    talentPoints: int = 0
    talentBuild: Dict[str, Any] = Field(default_factory=dict)  # {"selected_talents": [...], "chosen_room": "Kitchen", "capstone": None}
    dailyActions: Dict[str, Any] = Field(default_factory=dict)
    householdPoints: int = 0  # Changed from couplePoints
    # Talent tracking
    missedChoresThisWeek: int = 0
    verificationsSkippedThisWeek: int = 0
    deadlineExtensionsThisWeek: int = 0
    failedVerificationsThisMonth: int = 0
    chosenRoom: Optional[str] = None  # For Housework spec
    trustLevel: str = "standard"  # standard, trusted, honor_system
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(BaseModel):
    taskId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room: str
    title: str
    basePoints: int
    difficulty: TaskDifficulty
    category: str = "household"  # household, pet, vehicle, personal, kindness, special
    quest_type: QuestType = QuestType.DAILY
    linkGroupId: Optional[str] = None
    recurrence: str = "daily"
    assignedTo: Optional[str] = None  # userId
    timerMinutes: Optional[int] = None
    description: Optional[str] = None
    icon: str = "📋"
    can_swap: bool = True  # NEW: Can this task be swapped?
    can_challenge: bool = True  # NEW: Can players challenge for this task?
    requires_verification: bool = False
    targetPlayer: Optional[str] = None  # NEW: For kindness quests - which player to help
    swapRequests: List[str] = Field(default_factory=list)  # NEW: UserIds who want to swap

class TalentNode(BaseModel):
    nodeId: Optional[str] = None  # For backward compatibility
    id: Optional[str] = None      # New field name
    branch: TalentBranch
    tier: int
    costTalentPoints: Optional[int] = None  # For backward compatibility
    cost: Optional[int] = None              # New field name
    title: Optional[str] = None             # For backward compatibility
    name: Optional[str] = None              # New field name
    description: str
    effect: Dict[str, Any]
    prerequisites: Optional[List[str]] = Field(default_factory=list)  # New field
    position: Optional[Dict[str, int]] = Field(default_factory=dict)  # New field
    premium: Optional[bool] = False                                   # New field

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

class Household(BaseModel):
    householdId: str = Field(default_factory=lambda: f"household_{uuid.uuid4().hex[:8]}")
    inviteCode: str = Field(default_factory=lambda: f"{uuid.uuid4().hex[:6].upper()}")
    creatorId: str
    creatorName: str
    householdType: HouseholdType = HouseholdType.ROOMMATES
    memberIds: List[str] = Field(default_factory=list)  # All member userIds
    memberLimit: int = 12  # Max 12 players
    isActive: bool = False
    choresAssigned: bool = False  # NEW: Admin manually assigns chores
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
    # Enhanced onboarding data
    householdSetup: Dict[str, Any] = Field(default_factory=dict)
    # NEW: Detailed appliance/living situation
    hasWasherDryer: bool = False
    hasDishwasher: bool = False
    livesUpstairs: bool = False
    gamePreferences: Dict[str, Any] = Field(default_factory=dict)
    customizedChores: List[dict] = Field(default_factory=list)  # List of task dictionaries
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class HouseholdInvitation(BaseModel):
    inviteCode: str
    message: str
    theme: str
    questPhrase: str
    creatorName: str
    householdType: HouseholdType
    currentMembers: int
    maxMembers: int
    expiresAt: datetime
    userId: str  # Creator's userId
    householdId: str  # For direct access

# NEW: Chore Swap Model
class ChoreSwap(BaseModel):
    swapId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    householdId: str
    taskId: str
    requesterId: str  # Who wants to swap
    requesterName: str
    targetId: str  # Who they want to swap with
    targetName: str
    status: str = "pending"  # pending, accepted, declined
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
# NEW: Mini-Game Challenge Model
class MiniGameChallenge(BaseModel):
    challengeId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    householdId: str
    taskId: str
    challengerId: str
    challengerName: str
    challengedId: str
    challengedName: str
    gameType: str  # "spin", "tap", "trivia", "rock_paper_scissors"
    winnerId: Optional[str] = None
    status: str = "pending"  # pending, completed
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Request Models
class CreateUserRequest(BaseModel):
    displayName: str
    householdCode: Optional[str] = None  # Changed from coupleCode

class CreateHouseholdRequest(BaseModel):  # Changed from CreateCoupleRequest
    creatorName: str
    householdType: HouseholdType = HouseholdType.ROOMMATES
    memberLimit: int = 12

class EnhancedHouseholdRequest(BaseModel):  # Changed from EnhancedCoupleRequest
    householdName: str
    adminName: str
    householdType: HouseholdType = HouseholdType.ROOMMATES
    memberLimit: int = 12
    householdSetup: Dict[str, Any] = Field(default_factory=dict)
    # Legacy fields (optional for backward compatibility)
    playerName: Optional[str] = None
    hasWasherDryer: bool = False
    hasDishwasher: bool = False
    livesUpstairs: bool = False
    preferences: Dict[str, Any] = Field(default_factory=dict)

class JoinHouseholdRequest(BaseModel):  # Changed from JoinCoupleRequest
    memberName: str  # Changed from partnerName
    inviteCode: str

# NEW: Chore Swap Requests
class RequestChoreSwapRequest(BaseModel):
    requesterId: str
    targetId: str
    taskId: str
    
class RespondChoreSwapRequest(BaseModel):
    swapId: str
    response: str  # "accept" or "decline"
    
# NEW: Mini-Game Challenge Requests
class CreateMiniGameChallengeRequest(BaseModel):
    challengerId: str
    challengedId: str
    taskId: str
    gameType: str  # "spin", "tap", "trivia", "rock_paper_scissors"
    
class CompleteMiniGameRequest(BaseModel):
    challengeId: str
    winnerId: str

class CompleteTaskRequest(BaseModel):
    userId: str
    notes: Optional[str] = None
    photo: Optional[str] = None
    bonusPoints: Optional[int] = None
    verificationData: Optional[Dict[str, Any]] = None

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

# Old 3-tier talent tree (kept for backward compatibility with existing functions)
OLD_TALENT_TREE_NODES = {
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

# Use the new 10-tier talent tree as the main one
TALENT_TREE_NODES = NEW_TALENT_TREE_NODES

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

DAYS_OF_WEEK = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
]


def create_default_weekly_availability() -> Dict[str, Dict[str, Any]]:
    return {
        "Monday": {"enabled": True, "start": "18:00", "end": "22:00"},
        "Tuesday": {"enabled": True, "start": "18:00", "end": "22:00"},
        "Wednesday": {"enabled": True, "start": "18:00", "end": "22:00"},
        "Thursday": {"enabled": True, "start": "18:00", "end": "22:00"},
        "Friday": {"enabled": True, "start": "18:00", "end": "22:00"},
        "Saturday": {"enabled": True, "start": "09:00", "end": "21:00"},
        "Sunday": {"enabled": True, "start": "09:00", "end": "21:00"}
    }


def normalize_availability_preferences(availability: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    weekly = create_default_weekly_availability()
    overrides = {}

    if not isinstance(availability, dict):
        return {"weekly": weekly, "overrides": overrides}

    weekly_config = availability.get("weekly")
    if isinstance(weekly_config, dict):
        for day in DAYS_OF_WEEK:
            day_values = weekly_config.get(day, {})
            if not isinstance(day_values, dict):
                continue
            weekly[day] = {
                "enabled": day_values.get("enabled", weekly[day]["enabled"]),
                "start": day_values.get("start", weekly[day]["start"]),
                "end": day_values.get("end", weekly[day]["end"])
            }
    else:
        weekday_window = availability.get("mondayToFriday", {})
        weekend_window = availability.get("weekend", {})
        low_energy_days = set(availability.get("lowEnergyDays", []))

        for day in DAYS_OF_WEEK[:5]:
            weekly[day] = {
                "enabled": day not in low_energy_days,
                "start": weekday_window.get("start", weekly[day]["start"]),
                "end": weekday_window.get("end", weekly[day]["end"])
            }

        for day in DAYS_OF_WEEK[5:]:
            weekly[day] = {
                "enabled": day not in low_energy_days,
                "start": weekend_window.get("start", weekly[day]["start"]),
                "end": weekend_window.get("end", weekly[day]["end"])
            }

    raw_overrides = availability.get("overrides", {})
    if isinstance(raw_overrides, dict):
        for date_key, override_values in raw_overrides.items():
            if not isinstance(override_values, dict):
                continue
            try:
                day_name = datetime.strptime(date_key, "%Y-%m-%d").strftime("%A")
            except ValueError:
                continue

            base_window = weekly.get(day_name, {"enabled": True, "start": "18:00", "end": "22:00"})
            overrides[date_key] = {
                "enabled": override_values.get("enabled", base_window["enabled"]),
                "start": override_values.get("start", base_window["start"]),
                "end": override_values.get("end", base_window["end"])
            }

    return {"weekly": weekly, "overrides": overrides}


def normalize_user_preferences(preferences: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    normalized = dict(preferences or {})
    normalized["availability"] = normalize_availability_preferences(normalized.get("availability"))
    normalized["choreAversions"] = normalized.get("choreAversions", [])
    normalized["preferredTasks"] = normalized.get("preferredTasks", [])
    normalized["maxDailyChoreLoad"] = normalized.get("maxDailyChoreLoad", 10)
    return normalized


def resolve_member_availability(member: Dict[str, Any], date_str: str) -> Optional[Dict[str, Any]]:
    preferences = normalize_user_preferences(member.get("preferences", {}))
    availability = preferences.get("availability", {})

    try:
        day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except ValueError:
        return None

    weekly_schedule = availability.get("weekly", create_default_weekly_availability())
    day_window = weekly_schedule.get(day_name, {"enabled": True, "start": "18:00", "end": "22:00"})
    active_window = availability.get("overrides", {}).get(date_str, day_window)

    if not active_window.get("enabled", True):
        return None

    return {
        "date": date_str,
        "day": day_name,
        "start": active_window.get("start", day_window.get("start", "18:00")),
        "end": active_window.get("end", day_window.get("end", "22:00")),
        "source": "override" if date_str in availability.get("overrides", {}) else "weekly"
    }


def calculate_chore_weight(chore: Dict) -> float:
    """Calculate the fairness weight of a chore based on time, difficulty, and grossness"""
    weights = GAME_CONSTANTS["CHORE_WEIGHTS"]
    
    # Get weight factors
    time_weight = weights["TIME"].get(chore.get("time", "medium"), 2)
    difficulty_weight = weights["DIFFICULTY"].get(chore.get("difficulty", "medium").lower(), 2)
    grossness_weight = weights["GROSSNESS"].get(chore.get("grossness", "clean"), 1)
    
    # Combined weight = time * difficulty * grossness factor
    total_weight = time_weight * difficulty_weight * grossness_weight
    return total_weight

def get_user_verification_rate(user: Dict) -> float:
    """Calculate user's verification rate based on talents (base 25%, talents can reduce it)"""
    base_rate = GAME_CONSTANTS["VERIFICATION"]["RANDOM_CHECK_PROBABILITY"]
    
    # Check if user has talents that reduce verification
    talent_build = user.get("talentBuild", {})
    unlocked_nodes = talent_build.get("nodeIds", [])
    
    reduction = 0.0
    for node_id in unlocked_nodes:
        if node_id in TALENT_TREE_NODES:
            node = TALENT_TREE_NODES[node_id]
            effect = node.get("effect", {})
            
            # Check for verification reduction talents
            if effect.get("type") == "verification_reduction":
                reduction += effect.get("reduction", 0)
            # Trusted member talent reduces verification
            elif effect.get("type") == "trust_bonus":
                reduction += 0.05  # 5% reduction for trust talents
    
    # Apply reduction (minimum 5% verification rate)
    final_rate = max(0.05, base_rate - reduction)
    return final_rate

def should_trigger_verification(user: Dict, task: Dict) -> bool:
    """Determine if this task completion should trigger verification"""
    verification_rate = get_user_verification_rate(user)
    
    # Higher value tasks have slightly higher verification chance
    base_points = task.get("basePoints", task.get("points", 10))
    if base_points >= 20:
        verification_rate *= 1.2  # 20% more likely for hard tasks
    
    return random.random() < verification_rate

def apply_talent_effects_to_points(user: Dict, task: Dict, base_points: int) -> Dict:
    """Apply all talent effects to calculate final points"""
    talent_build = user.get("talentBuild", {})
    unlocked_nodes = talent_build.get("nodeIds", [])
    
    multiplier = 1.0
    flat_bonus = 0
    effects_applied = []
    
    task_category = task.get("category", "").lower()
    task_room = task.get("room", "").lower()
    
    for node_id in unlocked_nodes:
        if node_id not in TALENT_TREE_NODES:
            continue
            
        node = TALENT_TREE_NODES[node_id]
        effect = node.get("effect", {})
        effect_type = effect.get("type", "")
        
        # Category multiplier (e.g., +10% for laundry)
        if effect_type == "category_multiplier":
            if effect.get("category", "").lower() in task_category:
                multiplier *= effect.get("multiplier", 1.0)
                effects_applied.append(f"{node['name']}: x{effect.get('multiplier', 1.0)}")
        
        # Category bonus (flat points)
        elif effect_type == "category_bonus":
            if effect.get("category", "").lower() in task_category:
                flat_bonus += effect.get("bonus", 0)
                effects_applied.append(f"{node['name']}: +{effect.get('bonus', 0)}")
        
        # Time bonus (bonus for completing within time window)
        elif effect_type == "time_bonus":
            if effect.get("category", "").lower() in task_category:
                flat_bonus += effect.get("bonus", 0)
                effects_applied.append(f"{node['name']}: +{effect.get('bonus', 0)}")
        
        # Streak bonus
        elif effect_type == "streak_bonus":
            # Would need to track consecutive completions
            pass
        
        # Verification bonus
        elif effect_type == "verification_bonus":
            if task.get("verified"):
                flat_bonus += effect.get("bonus", 0)
                effects_applied.append(f"{node['name']}: +{effect.get('bonus', 0)} (verified)")
    
    final_points = int((base_points + flat_bonus) * multiplier)
    
    return {
        "base_points": base_points,
        "flat_bonus": flat_bonus,
        "multiplier": multiplier,
        "final_points": final_points,
        "effects_applied": effects_applied
    }

def distribute_chores_fairly(chores: List[Dict], members: List[Dict], assignment_date: Optional[str] = None) -> Dict[str, List[Dict]]:
    """Distribute chores fairly based on weight, considering member preferences and availability"""
    if not members:
        return {}

    # Initialize distribution
    distribution = {m["userId"]: {"chores": [], "total_weight": 0} for m in members}
    member_ids = [m["userId"] for m in members]

    available_member_ids = member_ids
    if assignment_date:
        available_member_ids = [
            m["userId"]
            for m in members
            if resolve_member_availability(m, assignment_date)
        ]
        if not available_member_ids:
            raise ValueError("No household members are available during their configured windows for this assignment date")

    # Create member preference maps
    member_prefs = {}
    for m in members:
        prefs = normalize_user_preferences(m.get("preferences", {}))
        member_prefs[m["userId"]] = {
            "aversions": set(prefs.get("choreAversions", [])),
            "preferred": set(prefs.get("preferredTasks", [])),
            "max_daily": prefs.get("maxDailyChoreLoad", 10)
        }

    # Calculate weight for each chore and sort by weight (heaviest first for better distribution)
    weighted_chores = []
    for chore in chores:
        weight = calculate_chore_weight(chore)
        weighted_chores.append({"chore": chore, "weight": weight})

    weighted_chores.sort(key=lambda x: x["weight"], reverse=True)

    # Distribute chores using a greedy algorithm
    for wc in weighted_chores:
        chore = wc["chore"]
        weight = wc["weight"]
        chore_category = chore.get("category", "").lower()

        # Find the best member for this chore
        best_member = None
        best_score = float('inf')

        for member_id in available_member_ids:
            prefs = member_prefs[member_id]
            current_weight = distribution[member_id]["total_weight"]
            current_count = len(distribution[member_id]["chores"])

            # Skip if member is at max capacity
            if current_count >= prefs["max_daily"]:
                continue

            # Calculate assignment score (lower is better)
            score = current_weight

            # Penalize if this is an aversion
            if chore_category in prefs["aversions"]:
                score += weight * 2  # Double the effective weight for aversions

            # Bonus if this is preferred
            if chore_category in prefs["preferred"]:
                score -= weight * 0.5  # Reduce effective weight for preferences

            if score < best_score:
                best_score = score
                best_member = member_id

        # Assign to best member (or first available if all available members are already at capacity)
        if best_member is None:
            best_member = min(available_member_ids, key=lambda m: distribution[m]["total_weight"])

        distribution[best_member]["chores"].append(chore)
        distribution[best_member]["total_weight"] += weight

    # Return just the chore lists
    return {m_id: data["chores"] for m_id, data in distribution.items()}

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
        room = task.get("room", "General")
        difficulty = task.get("difficulty", "MEDIUM")
        title = task.get("title", "").lower()
        
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
        room = task.get("room", "General")
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

def generate_customized_chores(household_setup: Dict[str, Any]) -> List[str]:
    """Generate customized chore list based on household setup"""
    customized_chores = []
    
    # Base household chores
    base_chores = [
        "🛏️ Make the bed",
        "🍽️ Wash dishes", 
        "🧹 Vacuum living room",
        "🧺 Do laundry",
        "🍳 Cook meals",
        "🚿 Clean bathroom",
        "🗑️ Take out trash",
        "💧 Water plants"
    ]
    customized_chores.extend(base_chores)
    
    # Add pet-specific chores if they have pets
    if household_setup.get('hasPets'):
        pet_types = household_setup.get('petTypes', [])
        if 'dogs' in pet_types:
            customized_chores.extend([
                "🐕 Walk the dog",
                "🍖 Feed the dog", 
                "🛁 Groom the dog"
            ])
        if 'cats' in pet_types:
            customized_chores.extend([
                "🐱 Feed the cat",
                "🧹 Clean litter box",
                "🛁 Groom the cat"
            ])
        if 'other' in pet_types:
            customized_chores.extend([
                "🐾 Pet care tasks",
                "🏥 Pet health checkups"
            ])
    
    # Add vehicle-specific chores based on sharing arrangement
    vehicle_sharing = household_setup.get('vehicleSharing', 'none')
    if vehicle_sharing != 'none':
        customized_chores.extend([
            "🚗 Wash the car",
            "⛽ Fill up gas tank",
            "🛢️ Check oil and fluids",
            "🔧 Vehicle maintenance"
        ])
    
    # Add living situation specific chores
    living_situation = household_setup.get('livingSituation', 'home')
    if living_situation == 'apartment':
        customized_chores.extend([
            "📦 Take packages to mailroom",
            "🧹 Sweep balcony/patio"
        ])
    elif living_situation == 'house':
        customized_chores.extend([
            "🌿 Yard work and gardening",
            "🏠 Exterior maintenance",
            "📬 Check mailbox"
        ])
    
    return customized_chores

# API Routes

@api_router.post("/households/create", response_model=HouseholdInvitation)
async def create_household_invitation(request: CreateHouseholdRequest):
    """Create a new household and generate adventure invitation"""
    # Create household record
    household = Household(
        creatorId=f"temp_{uuid.uuid4().hex[:8]}",
        creatorName=request.creatorName,
        householdType=request.householdType,
        memberLimit=request.memberLimit,
        memberIds=[]
    )
    
    await db.households.insert_one(household.model_dump())
    
    # Generate invitation message based on household type
    type_specific = {
        "family": "👨‍👩‍👧‍👦 family",
        "roommates": "🏠 roommate squad",
        "couple": "💑 dynamic duo",
        "other": "🎮 household crew"
    }
    
    invitation_messages = [
        f"🗡️ **SUMMONS TO ADVENTURE** 🛡️\n\n"
        f"Greetings! {request.creatorName} seeks legendary {type_specific[request.householdType]} members!\n\n"
        f"Join the {household.adventureTheme} and {household.questPhrase}!\n\n"
        f"✨ **What awaits you:**\n"
        f"• Epic household quests with XP rewards\n"
        f"• Legendary talent trees to unlock\n"
        f"• Mini-games and challenges\n" 
        f"• Glory, honor, and domestic prosperity!\n\n"
        f"🏰 **Join Code:** {household.inviteCode}\n"
        f"👥 **Slots:** {request.memberLimit} members max\n\n"
        f"Will you accept this call to adventure? 🌟"
    ]
    
    invitation = HouseholdInvitation(
        inviteCode=household.inviteCode,
        message=random.choice(invitation_messages),
        theme=household.adventureTheme,
        questPhrase=household.questPhrase,
        creatorName=request.creatorName,
        householdType=request.householdType,
        currentMembers=0,
        maxMembers=request.memberLimit,
        expiresAt=datetime.utcnow() + timedelta(days=7)
    )
    
    return invitation

@api_router.post("/households/create-enhanced", response_model=HouseholdInvitation)
async def create_enhanced_household(request: EnhancedHouseholdRequest):
    """Create a new household with comprehensive onboarding data"""
    
    # Get player name (new or legacy)
    player_name = request.adminName if request.adminName else request.playerName
    
    # Generate customized chore list based on comprehensive household setup
    customized_chores = generate_household_chores(request.householdSetup)
    
    # Extract rooms data for legacy fields
    rooms_data = request.householdSetup.get('rooms', {})
    
    # Create household with enhanced data
    household = Household(
        creatorName=player_name,
        creatorId=f"user_{uuid.uuid4().hex[:8]}",
        householdType=request.householdType,
        memberLimit=request.memberLimit,
        householdSetup=request.householdSetup,
        hasWasherDryer=request.householdSetup.get('laundryType') == 'in_unit',
        hasDishwasher=rooms_data.get('kitchen', False),  # Kitchen existence implies dishwasher possibility
        livesUpstairs=request.householdSetup.get('floors') == 'multi-level',
        gamePreferences=request.preferences,
        customizedChores=customized_chores,
        choresAssigned=False,  # Admin must manually assign
        memberIds=[]
    )
    
    admin_preferences = normalize_user_preferences({
        **request.preferences,
        "availability": request.householdSetup.get("availability", {}),
        "choreAversions": request.householdSetup.get("choreAversions", []),
        "preferredTasks": request.householdSetup.get("preferredTasks", []),
        "maxDailyChoreLoad": request.householdSetup.get("maxDailyChoreLoad", 3)
    })

    # Create user for the creator (as admin)
    creator_user = User(
        displayName=player_name,
        householdId=household.householdId,
        userId=household.creatorId,
        role=UserRole.ADMIN
    )
    creator_doc = creator_user.model_dump()
    creator_doc["preferences"] = admin_preferences
    creator_doc["onboardingComplete"] = True
    
    # Add creator to member list
    household.memberIds.append(household.creatorId)
    
    # Save to database
    await db.households.insert_one(household.model_dump())
    await db.users.insert_one(creator_doc)
    
    # Create enhanced invitation message
    household_features = []
    
    # Pets
    pets = request.householdSetup.get('pets', [])
    if pets:
        pet_summary = ', '.join([f"{p['count']} {p['type']}(s)" for p in pets])
        household_features.append(f"🐾 Pet care tasks for: {pet_summary}")
    
    # Vehicles
    vehicles = request.householdSetup.get('vehicles', [])
    if vehicles:
        household_features.append(f"🚗 {len(vehicles)} vehicle maintenance tasks")
    
    # Laundry
    laundry_type = request.householdSetup.get('laundryType', 'in_unit')
    if laundry_type == 'in_unit':
        household_features.append("🧺 In-home laundry tasks")
    elif laundry_type == 'laundromat':
        household_features.append("🏪 Laundromat trip quests")
    else:
        household_features.append("🏢 Shared laundry room tasks")
    
    # Room count
    household_features.append(f"🏠 {rooms_data.get('bathrooms', 1)} bathroom(s), {rooms_data.get('bedrooms', 1)} bedroom(s)")
    
    # Floors
    if request.householdSetup.get('floors') == 'multi-level':
        household_features.append("🏢 Multi-level home adjustments")
    
    # Talent spec
    initial_spec = request.householdSetup.get('initialTalentSpec', '')
    spec_names = {
        'self_care': 'Self-Care Specialist',
        'teamwork': 'Teamwork Champion',
        'housework': 'Housework Master'
    }
    if initial_spec:
        household_features.append(f"⚔️ Starting as: {spec_names.get(initial_spec, initial_spec)}")
    
    invitation_message = f"""
🏰 **{request.householdName or 'EPIC HOUSEHOLD'} ADVENTURE AWAITS!** 🏰

{player_name} has crafted a legendary household quest for up to {request.memberLimit} members! 

🎯 **Your Customized Quest Includes:**
{chr(10).join('• ' + feature for feature in household_features)}
• ⚖️ Fair task distribution system
• 🎮 Daily challenges and team bonuses
• 🌳 Talent trees for personal growth
• 💬 Constructive communication tools

📋 **Chores Generated:** {len(customized_chores)} personalized tasks!

🎪 **Adventure Code:** {household.inviteCode}

Share this code with your household members to join the quest!
"""
    
    return HouseholdInvitation(
        householdId=household.householdId,
        inviteCode=household.inviteCode,
        message=invitation_message,
        theme="epic_household",
        questPhrase=f"{request.householdName or 'Your Kingdom'} awaits!",
        creatorName=household.creatorName,
        householdType=request.householdType,
        currentMembers=1,
        maxMembers=request.memberLimit,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=7),
        userId=household.creatorId
    )

@api_router.post("/households/join", response_model=dict)
async def join_household_adventure(request: JoinHouseholdRequest):
    """Join an existing household using invitation code"""
    # Find household by invite code
    household = await db.households.find_one({"inviteCode": request.inviteCode})
    if not household:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    # Check if household is full
    current_members = len(household.get("memberIds", []))
    if current_members >= household.get("memberLimit", 12):
        raise HTTPException(status_code=400, detail=f"This household is full ({household['memberLimit']} members max)!")
    
    # Create new member user with preferences if provided
    member_preferences = {}
    if hasattr(request, 'memberPreferences') and request.memberPreferences:
        member_preferences = request.memberPreferences
    member_preferences = normalize_user_preferences(member_preferences)
    
    new_member = User(
        displayName=request.memberName,
        householdId=household["householdId"],
        role=UserRole.MEMBER
    )
    
    # Add member preferences to user document
    member_doc = new_member.model_dump()
    member_doc["preferences"] = member_preferences
    
    # Add member to household
    await db.households.update_one(
        {"inviteCode": request.inviteCode},
        {
            "$push": {"memberIds": new_member.userId},
            "$set": {"isActive": True}
        }
    )
    
    # Save new member
    await db.users.insert_one(member_doc)
    
    # Auto-redistribute chores among all members
    try:
        # Get admin user to trigger redistribution
        admin_id = household.get("creatorId") or household.get("memberIds", [None])[0]
        if admin_id:
            # Call the assign chores function internally with reset=True
            await auto_assign_chores(household["householdId"], admin_id, reset=True)
    except Exception as e:
        print(f"Warning: Could not auto-redistribute chores: {e}")
    
    return {
        "message": f"🎉 Welcome to the adventure, {request.memberName}! You have joined {household['creatorName']} in the {household['adventureTheme']}!",
        "householdId": household["householdId"],
        "householdName": household.get("name", household.get("adventureTheme", "Your Household")),
        "adventureTheme": household["adventureTheme"],
        "userId": new_member.userId,
        "needsOnboarding": True
    }

@api_router.get("/households/{invite_code}/preview")
async def preview_household_invitation(invite_code: str):
    """Preview household invitation details"""
    household = await db.households.find_one({"inviteCode": invite_code})
    if not household:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    current_members = len(household.get("memberIds", []))
    
    return {
        "creatorName": household["creatorName"],
        "adventureTheme": household["adventureTheme"],
        "questPhrase": household["questPhrase"],
        "householdType": household.get("householdType", "other"),
        "currentMembers": current_members,
        "maxMembers": household.get("memberLimit", 12),
        "isAvailable": current_members < household.get("memberLimit", 12)
    }

# Update member preferences after onboarding
class MemberPreferencesRequest(BaseModel):
    userId: str
    preferences: Dict[str, Any]

@api_router.post("/users/{user_id}/preferences")
async def update_member_preferences(user_id: str, request: MemberPreferencesRequest):
    """Update a user's preferences and availability settings"""
    user = await db.users.find_one({"userId": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    normalized_preferences = normalize_user_preferences(request.preferences)
    
    # Update preferences
    await db.users.update_one(
        {"userId": user_id},
        {"$set": {
            "preferences": normalized_preferences,
            "onboardingComplete": True
        }}
    )
    
    # Trigger chore redistribution if household has chores assigned
    household = await db.households.find_one({"householdId": user.get("householdId")})
    if household and household.get("choresAssigned"):
        try:
            admin_id = household.get("creatorId") or household.get("memberIds", [None])[0]
            if admin_id:
                await auto_assign_chores(household["householdId"], admin_id, reset=True)
        except Exception as e:
            print(f"Warning: Could not redistribute chores after preference update: {e}")
    
    return {
        "success": True,
        "message": "Preferences saved! Chores have been redistributed fairly.",
        "preferences": normalized_preferences
    }

# NEW: Auto Chore Assignment (Fair & Even Split)
@api_router.post("/households/{household_id}/assign-chores")
async def auto_assign_chores(household_id: str, admin_user_id: str, reset: bool = False):
    """Admin triggers automatic fair/even chore distribution among all members using weighted fairness"""
    # Verify admin permissions (skip if called internally for redistribution)
    admin = await db.users.find_one({"userId": admin_user_id, "householdId": household_id})
    if not admin:
        raise HTTPException(status_code=403, detail="User not found in household")
    
    # Allow non-admins to trigger redistribution only if reset=True (internal call)
    if admin.get("role") != "admin" and not reset:
        raise HTTPException(status_code=403, detail="Only household admin can assign chores")
    
    household = await db.households.find_one({"householdId": household_id})
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    
    # Get all household members with their preferences
    member_ids = household.get("memberIds", [])
    if len(member_ids) < 1:
        raise HTTPException(status_code=400, detail="Need at least 1 member to assign chores")
    
    members = []
    for member_id in member_ids:
        member = await db.users.find_one({"userId": member_id}, {"_id": 0})
        if member:
            members.append(member)
    
    # Generate fair distribution of tasks
    today = datetime.utcnow().strftime('%Y-%m-%d')
    last_assigned = household.get("lastAssignedDate")
    
    # Check if this is a new day (reset) or first assignment
    is_reset = last_assigned == today or reset
    
    # Get or create task list - use household's customized chores
    if household.get("customizedChores") and len(household.get("customizedChores")) > 0:
        tasks = household.get("customizedChores")
    else:
        # Fallback to default if no customized chores exist
        tasks = DEFAULT_TASKS.copy() if 'DEFAULT_TASKS' in globals() else []
        
    if len(tasks) == 0:
        raise HTTPException(status_code=400, detail="No tasks available to assign. Please recreate your household.")
    
    # Use weighted fair distribution algorithm
    try:
        fair_distribution = distribute_chores_fairly(tasks, members, today)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
    # Save task assignments
    member_task_counts = {}
    member_weight_totals = {}
    
    for member_id, assigned_chores in fair_distribution.items():
        member = await db.users.find_one({"userId": member_id})
        member_name = member.get("displayName", "Unknown") if member else "Unknown"
        availability_window = resolve_member_availability(member or {}, today)
        member_task_counts[member_name] = len(assigned_chores)
        member_weight_totals[member_name] = sum(calculate_chore_weight(c) for c in assigned_chores)
        
        for task in assigned_chores:
            task_copy = task.copy()
            task_copy["assignedTo"] = member_id
            task_copy["date"] = today
            task_copy["householdId"] = household_id
            task_copy["completed"] = False
            task_copy["verified"] = False
            task_copy["pendingVerification"] = False
            task_copy["weight"] = calculate_chore_weight(task)
            if availability_window:
                task_copy["scheduledWindow"] = availability_window
            
            # Save task assignment
            await db.tasks.update_one(
                {"taskId": task["taskId"], "householdId": household_id},
                {"$set": task_copy},
                upsert=True
            )
    
    # Mark chores as assigned and record metrics
    await db.households.update_one(
        {"householdId": household_id},
        {"$set": {
            "choresAssigned": True, 
            "lastAssignedDate": today,
            "isActive": True
        }}
    )
    
    return {
        "message": f"🎯 Chores {'redistributed' if is_reset else 'assigned'} fairly based on difficulty and preferences!",
        "distribution": member_task_counts,
        "fairnessWeights": member_weight_totals,
        "date": today,
        "totalMembers": len(members),
        "totalTasks": len(tasks),
        "isReset": is_reset,
        "algorithm": "weighted_fair_distribution"
    }

@api_router.get("/households/{household_id}/stats")
async def get_household_stats(household_id: str):
    """Get household statistics including member list, assignment status, and daily progress"""
    household = await db.households.find_one({"householdId": household_id})
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    
    # Get all members
    members = []
    for member_id in household.get("memberIds", []):
        user = await db.users.find_one({"userId": member_id})
        if user:
            members.append({
                "userId": user["userId"],
                "displayName": user["displayName"],
                "role": user.get("role", "member"),
                "level": user.get("level", 1),
                "points": user.get("points", 0)
            })
    
    # Get today's task assignments
    today = datetime.utcnow().strftime('%Y-%m-%d')
    tasks_today = await db.tasks.find({
        "householdId": household_id,
        "date": today
    }).to_list(1000)
    
    # Calculate completion stats
    total_tasks = len(tasks_today)
    completed_tasks = sum(1 for task in tasks_today if task.get("completed", False))
    
    # Per-member task counts
    member_task_counts = {}
    for task in tasks_today:
        assigned_to = task.get("assignedTo")
        if assigned_to:
            member_task_counts[assigned_to] = member_task_counts.get(assigned_to, 0) + 1
    
    return {
        "householdId": household_id,
        "householdType": household.get("householdType", "other"),
        "creatorName": household.get("creatorName"),
        "adventureTheme": household.get("adventureTheme"),
        "inviteCode": household.get("inviteCode"),
        "isActive": household.get("isActive", False),
        "choresAssigned": household.get("choresAssigned", False),
        "lastAssignedDate": household.get("lastAssignedDate"),
        "members": members,
        "memberCount": len(members),
        "maxMembers": household.get("memberLimit", 12),
        "todayStats": {
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "completionRate": (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
            "tasksPerMember": member_task_counts
        }
    }


# NEW: Chore Swap Endpoints
@api_router.post("/chore-swaps/request")
async def request_chore_swap(request: RequestChoreSwapRequest):
    """Request to swap a chore with another household member"""
    # Verify both users exist and are in same household
    requester = await db.users.find_one({"userId": request.requesterId})
    target = await db.users.find_one({"userId": request.targetId})
    
    if not requester or not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if requester.get("householdId") != target.get("householdId"):
        raise HTTPException(status_code=400, detail="Users must be in same household")
    
    # Verify task exists and is assigned to requester
    task = await db.tasks.find_one({"taskId": request.taskId})
    if not task or task.get("assignedTo") != request.requesterId:
        raise HTTPException(status_code=400, detail="Task not assigned to requester")
    
    if not task.get("can_swap", True):
        raise HTTPException(status_code=400, detail="This task cannot be swapped")
    
    # Create swap request
    swap = ChoreSwap(
        householdId=requester["householdId"],
        taskId=request.taskId,
        requesterId=request.requesterId,
        requesterName=requester["displayName"],
        targetId=request.targetId,
        targetName=target["displayName"]
    )
    
    await db.chore_swaps.insert_one(swap.model_dump())
    
    return {
        "message": f"Swap request sent to {target['displayName']}!",
        "swapId": swap.swapId,
        "status": "pending"
    }

@api_router.get("/tasks")
async def get_household_tasks(householdId: str, date: str = None):
    """Get all tasks for a household, optionally filtered by date"""
    try:
        query = {"householdId": householdId}
        if date:
            query["date"] = date
        
        tasks = await db.tasks.find(query).to_list(1000)
        
        # Remove MongoDB _id field
        for task in tasks:
            task.pop('_id', None)
        
        return tasks
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        return []

@api_router.get("/households/{household_id}/my-tasks/{user_id}")
async def get_user_tasks(household_id: str, user_id: str, date: str = None):
    """Get tasks assigned to a specific user in a household"""
    try:
        if not date:
            date = datetime.utcnow().strftime('%Y-%m-%d')
        
        # Query tasks assigned to this user
        query = {
            "householdId": household_id,
            "assignedTo": user_id,
            "date": date
        }
        
        tasks = await db.tasks.find(query).to_list(1000)
        
        # Group tasks by room and remove _id
        tasks_by_room = {}
        for task in tasks:
            task.pop('_id', None)
            room = task.get("room", "General")
            if room not in tasks_by_room:
                tasks_by_room[room] = []
            tasks_by_room[room].append(task)
        
        return tasks_by_room
    except Exception as e:
        print(f"Error fetching user tasks: {e}")
        return {}

@api_router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: CompleteTaskRequest):
    """Complete a task and award XP with progression tracking, verification, and talent effects"""
    try:
        # Find the user
        user = await db.users.find_one({"userId": request.userId}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's householdId to find the correct task
        household_id = user.get("householdId")
        if not household_id:
            raise HTTPException(status_code=400, detail="User is not part of a household")
        
        # Find the task - MUST include householdId since taskId is not globally unique
        task = await db.tasks.find_one({"taskId": task_id, "householdId": household_id}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Verify the user is assigned to this task
        if task.get("assignedTo") != request.userId:
            raise HTTPException(status_code=403, detail="You can only complete tasks assigned to you")
        
        # Check if already completed
        if task.get("completed"):
            raise HTTPException(status_code=400, detail="Task already completed")
        
        # Check if verification is required (25% base chance, modified by talents)
        requires_verification = should_trigger_verification(user, task)
        
        # Calculate base XP
        base_points = task.get("basePoints", task.get("points", 10))
        bonus_points = request.bonusPoints or 0
        
        # Apply talent effects to calculate final points
        talent_effects = apply_talent_effects_to_points(user, task, base_points)
        total_xp_earned = talent_effects["final_points"] + bonus_points
        
        # If verification required, hold the points
        if requires_verification:
            # Mark task as pending verification
            await db.tasks.update_one(
                {"taskId": task_id, "householdId": household_id},
                {"$set": {
                    "completed": True,
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                    "completedBy": request.userId,
                    "pendingVerification": True,
                    "verificationRequestedAt": datetime.now(timezone.utc).isoformat(),
                    "pointsHeld": total_xp_earned
                }}
            )
            
            return {
                "success": True,
                "message": "🔍 Quest complete! Awaiting verification from a household member.",
                "requiresVerification": True,
                "xpPending": total_xp_earned,
                "talentEffects": talent_effects["effects_applied"],
                "task": {
                    "taskId": task_id,
                    "title": task.get("title")
                }
            }
        
        # No verification needed - award points immediately
        old_points = user.get("points", 0)
        new_points = old_points + total_xp_earned
        
        old_level, old_talent_points = calculate_level(old_points)
        new_level, new_talent_points = calculate_level(new_points)
        
        # Calculate XP needed for next level
        xp_for_current_level = (new_level - 1) * GAME_CONSTANTS["LEVELING"]["POINTS_PER_LEVEL"]
        xp_for_next_level = new_level * GAME_CONSTANTS["LEVELING"]["POINTS_PER_LEVEL"]
        xp_progress = new_points - xp_for_current_level
        xp_needed = xp_for_next_level - xp_for_current_level
        
        # Check if leveled up
        leveled_up = new_level > old_level
        talent_points_gained = new_talent_points - old_talent_points
        
        # Update user in database
        await db.users.update_one(
            {"userId": request.userId},
            {"$set": {
                "points": new_points,
                "level": new_level
            }}
        )
        
        # Mark task as complete
        await db.tasks.update_one(
            {"taskId": task_id, "householdId": household_id},
            {"$set": {
                "completed": True,
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "completedBy": request.userId,
                "pendingVerification": False,
                "verified": True
            }}
        )
        
        # Record completion in history
        completion_record = {
            "completionId": str(uuid.uuid4()),
            "userId": request.userId,
            "taskId": task_id,
            "householdId": user.get("householdId"),
            "pointsEarned": total_xp_earned,
            "basePoints": base_points,
            "talentBonus": talent_effects["flat_bonus"],
            "talentMultiplier": talent_effects["multiplier"],
            "bonusPoints": bonus_points,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": request.notes,
            "photo": request.photo,
            "verified": True
        }
        await db.task_completions.insert_one(completion_record)
        
        # Build response
        response = {
            "success": True,
            "message": "Quest completed! ⚔️" if not leveled_up else f"🎉 LEVEL UP! You are now Level {new_level}!",
            "xpEarned": total_xp_earned,
            "basePoints": base_points,
            "bonusPoints": bonus_points,
            "progression": {
                "oldLevel": old_level,
                "newLevel": new_level,
                "leveledUp": leveled_up,
                "totalXP": new_points,
                "xpProgress": xp_progress,
                "xpNeeded": xp_needed,
                "xpForNextLevel": xp_for_next_level,
                "talentPoints": new_talent_points,
                "talentPointsGained": talent_points_gained
            },
            "task": {
                "taskId": task_id,
                "title": task.get("title")
            }
        }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing task: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error completing task: {str(e)}")

# Verification System Endpoints
class VerifyTaskRequest(BaseModel):
    verifierId: str
    approved: bool
    notes: str = ""

@api_router.get("/tasks/pending-verification/{household_id}")
async def get_pending_verifications(household_id: str):
    """Get all tasks pending verification in a household"""
    try:
        tasks = await db.tasks.find({
            "householdId": household_id,
            "pendingVerification": True
        }).to_list(100)
        
        # Get user info for each task
        result = []
        for task in tasks:
            task.pop('_id', None)
            user = await db.users.find_one({"userId": task.get("completedBy")}, {"_id": 0})
            if user:
                task["completedByName"] = user.get("displayName")
            result.append(task)
        
        return result
    except Exception as e:
        print(f"Error fetching pending verifications: {e}")
        return []

@api_router.post("/tasks/{task_id}/verify")
async def verify_task(task_id: str, request: VerifyTaskRequest):
    """Verify or reject a completed task"""
    try:
        # Find the verifier
        verifier = await db.users.find_one({"userId": request.verifierId}, {"_id": 0})
        if not verifier:
            raise HTTPException(status_code=404, detail="Verifier not found")
        
        household_id = verifier.get("householdId")
        
        # Find the task
        task = await db.tasks.find_one({
            "taskId": task_id, 
            "householdId": household_id,
            "pendingVerification": True
        }, {"_id": 0})
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found or not pending verification")
        
        # Can't verify your own task
        if task.get("completedBy") == request.verifierId:
            raise HTTPException(status_code=400, detail="You cannot verify your own task")
        
        completed_by = task.get("completedBy")
        points_held = task.get("pointsHeld", 0)
        
        if request.approved:
            # Verification approved - award held points plus bonus
            verification_bonus = GAME_CONSTANTS["VERIFICATION"]["PARTNER_VERIFIES_BONUS"]
            total_points = points_held + verification_bonus
            
            # Get the user who completed the task
            user = await db.users.find_one({"userId": completed_by}, {"_id": 0})
            if user:
                old_points = user.get("points", 0)
                new_points = old_points + total_points
                old_level, _ = calculate_level(old_points)
                new_level, new_talent_points = calculate_level(new_points)
                
                # Update user points
                await db.users.update_one(
                    {"userId": completed_by},
                    {"$set": {"points": new_points, "level": new_level}}
                )
                
                # Mark task as verified
                await db.tasks.update_one(
                    {"taskId": task_id, "householdId": household_id},
                    {"$set": {
                        "pendingVerification": False,
                        "verified": True,
                        "verifiedBy": request.verifierId,
                        "verifiedAt": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Award verifier a small bonus too
                await db.users.update_one(
                    {"userId": request.verifierId},
                    {"$inc": {"points": 2}}  # Small bonus for verifying
                )
                
                return {
                    "success": True,
                    "message": f"✅ Task verified! {user.get('displayName')} earned {total_points} XP (+{verification_bonus} verification bonus)",
                    "pointsAwarded": total_points,
                    "verificationBonus": verification_bonus,
                    "leveledUp": new_level > old_level
                }
        else:
            # Verification rejected - apply penalty
            penalty_rate = GAME_CONSTANTS["VERIFICATION"]["FAILED_VERIFICATION_PENALTY"]
            penalty_points = int(points_held * penalty_rate)
            
            # Mark task as failed verification
            await db.tasks.update_one(
                {"taskId": task_id, "householdId": household_id},
                {"$set": {
                    "completed": False,
                    "pendingVerification": False,
                    "verified": False,
                    "verificationFailed": True,
                    "verifiedBy": request.verifierId,
                    "verifiedAt": datetime.now(timezone.utc).isoformat(),
                    "rejectionNotes": request.notes
                }}
            )
            
            # Track failed verifications for the user
            await db.users.update_one(
                {"userId": completed_by},
                {"$inc": {"failedVerificationsThisMonth": 1}}
            )
            
            return {
                "success": True,
                "message": f"❌ Verification rejected. Task marked as incomplete.",
                "pointsLost": penalty_points,
                "notes": request.notes
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/talents/tree")
async def get_talent_tree():
    """Get the complete talent tree structure"""
    return {
        "talents": TALENT_TREE,
        "rules": {
            "points_per_5_levels": GAME_CONSTANTS["LEVELING"]["TALENT_POINTS_PER_5_LEVELS"],
            "respec_cost": 10000,
            "capstones_exclusive": True
        }
    }

@api_router.get("/talents/user/{user_id}")
async def get_user_talents(user_id: str):
    """Get user's current talent selections and available points"""
    user = await db.users.find_one({"userId": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate talent points
    level = user.get("level", 1)
    talent_points_earned = math.floor((level - 1) / GAME_CONSTANTS["LEVELING"]["LEVELS_PER_TALENT_POINT"]) * GAME_CONSTANTS["LEVELING"]["TALENT_POINTS_PER_5_LEVELS"]
    
    # Get selected talents
    talent_build = user.get("talentBuild", {})
    selected_talents = talent_build.get("selected_talents", [])
    
    # Calculate spent points
    spent_points = sum([
        next((t["cost"] for spec in TALENT_TREE.values() if "tiers" in spec for tier in spec["tiers"].values() for t in tier["talents"] if t["id"] == talent_id), 0)
        for talent_id in selected_talents
    ])
    
    # Add hybrid talents
    if "hybrid" in TALENT_TREE:
        spent_points += sum([
            next((t["cost"] for t in TALENT_TREE["hybrid"]["talents"] if t["id"] == talent_id), 0)
            for talent_id in selected_talents
        ])
    
    available_points = talent_points_earned - spent_points
    
    return {
        "userId": user_id,
        "level": level,
        "points": user.get("points", 0),
        "talentPointsTotal": talent_points_earned,
        "talentPointsSpent": spent_points,
        "talentPointsAvailable": available_points,
        "selectedTalents": selected_talents,
        "chosenRoom": user.get("chosenRoom"),
        "capstone": talent_build.get("capstone"),
        "trustLevel": user.get("trustLevel", "standard")
    }

@api_router.post("/talents/select")
async def select_talent(request: dict):
    """Select a talent for a user"""
    try:
        user_id = request.get("userId")
        talent_id = request.get("talentId")
        chosen_room = request.get("chosenRoom")  # Optional, for room_bias talent
        
        if not user_id or not talent_id:
            raise HTTPException(status_code=400, detail="userId and talentId required")
        
        # Get user
        user = await db.users.find_one({"userId": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if talent exists
        talent = None
        spec_name = None
        tier_num = None
        
        # Search in main specs
        for spec_key, spec_data in TALENT_TREE.items():
            if "tiers" in spec_data:
                for tier_key, tier_data in spec_data["tiers"].items():
                    for t in tier_data["talents"]:
                        if t["id"] == talent_id:
                            talent = t
                            spec_name = spec_key
                            tier_num = tier_key
                            break
                    if talent:
                        break
            if talent:
                break
        
        # Check hybrid talents
        if not talent and "hybrid" in TALENT_TREE:
            for t in TALENT_TREE["hybrid"]["talents"]:
                if t["id"] == talent_id:
                    talent = t
                    spec_name = "hybrid"
                    break
        
        if not talent:
            raise HTTPException(status_code=404, detail="Talent not found")
        
        # Check level requirement
        level = user.get("level", 1)
        if spec_name != "hybrid":
            tier_data = TALENT_TREE[spec_name]["tiers"][tier_num]
            if level < tier_data["level_required"]:
                raise HTTPException(status_code=400, detail=f"Level {tier_data['level_required']} required")
        
        # Check if user has enough talent points
        talent_build = user.get("talentBuild", {})
        selected_talents = talent_build.get("selected_talents", [])
        
        # Calculate available points
        talent_points_earned = math.floor((level - 1) / GAME_CONSTANTS["LEVELING"]["LEVELS_PER_TALENT_POINT"]) * GAME_CONSTANTS["LEVELING"]["TALENT_POINTS_PER_5_LEVELS"]
        
        spent_points = sum([
            next((t["cost"] for spec in TALENT_TREE.values() if "tiers" in spec for tier in spec["tiers"].values() for t in tier["talents"] if t["id"] == tid), 0)
            for tid in selected_talents
        ])
        
        if "hybrid" in TALENT_TREE:
            spent_points += sum([
                next((t["cost"] for t in TALENT_TREE["hybrid"]["talents"] if t["id"] == tid), 0)
                for tid in selected_talents
            ])
        
        available_points = talent_points_earned - spent_points
        
        if available_points < talent.get("cost", 1):
            raise HTTPException(status_code=400, detail="Not enough talent points")
        
        # Check capstone exclusivity
        if talent.get("is_capstone") and talent_build.get("capstone"):
            raise HTTPException(status_code=400, detail="You already have a capstone talent")
        
        # Add talent to user's build
        if talent_id not in selected_talents:
            selected_talents.append(talent_id)
        
        talent_build["selected_talents"] = selected_talents
        
        if talent.get("is_capstone"):
            talent_build["capstone"] = talent_id
        
        # Update chosen room if applicable
        if chosen_room and talent.get("effect_type") == "room_preference":
            await db.users.update_one(
                {"userId": user_id},
                {"$set": {"chosenRoom": chosen_room}}
            )
        
        # Update trust level if honor system capstone
        if talent_id == "sc_honor_system":
            await db.users.update_one(
                {"userId": user_id},
                {"$set": {"trustLevel": "honor_system"}}
            )
        
        # Save talent build
        await db.users.update_one(
            {"userId": user_id},
            {"$set": {"talentBuild": talent_build}}
        )
        
        return {
            "success": True,
            "message": f"Talent '{talent['name']}' selected!",
            "talentBuild": talent_build,
            "pointsRemaining": available_points - talent.get("cost", 1)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error selecting talent: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/talents/respec")
async def respec_talents(request: dict):
    """Reset all talents for a user (costs 10,000 XP)"""
    try:
        user_id = request.get("userId")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="userId required")
        
        user = await db.users.find_one({"userId": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has enough XP
        respec_cost = 10000
        if user.get("points", 0) < respec_cost:
            raise HTTPException(status_code=400, detail=f"Need {respec_cost} XP to respec")
        
        # Deduct XP and reset talents
        new_points = user["points"] - respec_cost
        
        await db.users.update_one(
            {"userId": user_id},
            {"$set": {
                "points": new_points,
                "talentBuild": {"selected_talents": [], "capstone": None},
                "chosenRoom": None,
                "trustLevel": "standard"
            }}
        )
        
        return {
            "success": True,
            "message": "Talents reset successfully",
            "xpRemaining": new_points
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error respeccing talents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Concern Rewriting with AI
class ConcernRewriteRequest(BaseModel):
    to: str
    area: str
    description: str
    impact: str
    solution: str

@api_router.post("/concerns/rewrite")
async def rewrite_concern(request: ConcernRewriteRequest):
    """Rewrite a concern with class and etiquette using AI"""
    try:
        api_key = os.environ.get("PI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Build the original message
        original = f"To: {request.to}\nArea: {request.area}\nConcern: {request.description}\nImpact: {request.impact}\nSolution: {request.solution}"
        
        # Create AI chat
        chat = LlmChat(
            api_key=api_key,
            session_id=f"concern-{uuid.uuid4()}",
            system_message="""You are a diplomatic communication expert. Your job is to rewrite household concerns to be:
- Respectful and non-accusatory
- Empathetic and understanding
- Solution-focused
- Warm but clear about the issue

Rewrite the concern as a friendly, constructive message that the recipient would be receptive to. 
Keep it concise (2-4 sentences max). Don't use formal language - keep it casual but kind.
Start with a friendly greeting like "Hey [name]" or "Hi everyone" depending on the recipient.
Output ONLY the rewritten message, nothing else."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"Please rewrite this concern:\n\n{original}"
        )
        
        rewritten = await chat.send_message(user_message)
        
        return {
            "success": True,
            "original": original,
            "rewritten": rewritten.strip(),
            "area": request.area,
            "to": request.to
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error rewriting concern: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to rewrite concern: {str(e)}")

async def respond_to_chore_swap(request: RespondChoreSwapRequest):
    """Accept or decline a chore swap request"""
    swap = await db.chore_swaps.find_one({"swapId": request.swapId})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if request.response == "accept":
        # Swap the task assignments
        task = await db.tasks.find_one({"taskId": swap["taskId"]})
        
        await db.tasks.update_one(
            {"taskId": swap["taskId"]},
            {"$set": {"assignedTo": swap["targetId"]}}
        )
        
        # Update swap status
        await db.chore_swaps.update_one(
            {"swapId": request.swapId},
            {"$set": {"status": "accepted"}}
        )
        
        return {
            "message": f"✅ Swap accepted! {task['title']} is now assigned to {swap['targetName']}",
            "status": "accepted"
        }
    else:
        # Decline swap
        await db.chore_swaps.update_one(
            {"swapId": request.swapId},
            {"$set": {"status": "declined"}}
        )
        
        return {
            "message": "❌ Swap declined",
            "status": "declined"
        }

@api_router.get("/chore-swaps/{household_id}/pending")
async def get_pending_swaps(household_id: str, user_id: str):
    """Get all pending swap requests for a user"""
    swaps = await db.chore_swaps.find({
        "householdId": household_id,
        "targetId": user_id,
        "status": "pending"
    }).to_list(100)
    
    for swap in swaps:
        swap.pop('_id', None)
    
    return {"swaps": swaps}

# NEW: Mini-Game Challenge Endpoints
@api_router.post("/mini-game-challenges/create")
async def create_mini_game_challenge(request: CreateMiniGameChallengeRequest):
    """Challenge another household member to a mini-game for a task"""
    # Verify both users exist
    challenger = await db.users.find_one({"userId": request.challengerId})
    challenged = await db.users.find_one({"userId": request.challengedId})
    
    if not challenger or not challenged:
        raise HTTPException(status_code=404, detail="User not found")
    
    if challenger.get("householdId") != challenged.get("householdId"):
        raise HTTPException(status_code=400, detail="Users must be in same household")
    
    # Verify task
    task = await db.tasks.find_one({"taskId": request.taskId})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not task.get("can_challenge", True):
        raise HTTPException(status_code=400, detail="This task cannot be challenged")
    
    # Create challenge
    challenge = MiniGameChallenge(
        householdId=challenger["householdId"],
        taskId=request.taskId,
        challengerId=request.challengerId,
        challengerName=challenger["displayName"],
        challengedId=request.challengedId,
        challengedName=challenged["displayName"],
        gameType=request.gameType
    )
    
    await db.mini_game_challenges.insert_one(challenge.model_dump())
    
    return {
        "message": f"🎮 Challenge sent! {challenger['displayName']} vs {challenged['displayName']} - {request.gameType}",
        "challengeId": challenge.challengeId,
        "gameType": request.gameType
    }

@api_router.post("/mini-game-challenges/complete")
async def complete_mini_game_challenge(request: CompleteMiniGameRequest):
    """Record the winner of a mini-game challenge"""
    challenge = await db.mini_game_challenges.find_one({"challengeId": request.challengeId})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Verify winner is one of the participants
    if request.winnerId not in [challenge["challengerId"], challenge["challengedId"]]:
        raise HTTPException(status_code=400, detail="Winner must be a participant")
    
    # Update challenge
    await db.mini_game_challenges.update_one(
        {"challengeId": request.challengeId},
        {"$set": {"winnerId": request.winnerId, "status": "completed"}}
    )
    
    # Loser gets the task
    loser_id = challenge["challengedId"] if request.winnerId == challenge["challengerId"] else challenge["challengerId"]
    
    await db.tasks.update_one(
        {"taskId": challenge["taskId"]},
        {"$set": {"assignedTo": loser_id}}
    )
    
    winner = await db.users.find_one({"userId": request.winnerId})
    loser = await db.users.find_one({"userId": loser_id})
    task = await db.tasks.find_one({"taskId": challenge["taskId"]})
    
    return {
        "message": f"🏆 {winner['displayName']} wins! {loser['displayName']} gets the task: {task['title']}",
        "winnerId": request.winnerId,
        "loserId": loser_id
    }

@api_router.get("/mini-game-challenges/{household_id}/pending")
async def get_pending_challenges(household_id: str, user_id: str):
    """Get all pending challenges for a user"""
    challenges = await db.mini_game_challenges.find({
        "householdId": household_id,
        "$or": [{"challengerId": user_id}, {"challengedId": user_id}],
        "status": "pending"
    }).to_list(100)
    
    for challenge in challenges:
        challenge.pop('_id', None)
    
    return {"challenges": challenges}


@api_router.post("/users", response_model=User)
async def create_user(request: CreateUserRequest):
    """Create a new user and link to couple"""
    if request.householdCode:
        # Find couple by invite code
        couple = await db.couples.find_one({"inviteCode": request.householdCode})
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
                {"inviteCode": request.householdCode},
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
        room = task.get("room", "General")  # Default to "General" if room not specified
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
    users = await db.users.find({"householdId": couple_id}).to_list(100)  # Changed from coupleId
    
    if not users:
        # Return empty if no users found
        return {}
    
    # Find user in the list
    user_key = None
    for idx, user in enumerate(users):
        if user["userId"] == user_id:
            user_key = f"user{idx+1}"
            break
    
    if not user_key:
        # User not found in household
        return {}
    
    # Filter tasks assigned to this user
    my_tasks = {}
    for task_id, assigned_to in user_assignments.items():
        if assigned_to == user_key and task_id in tasks_by_id:
            task = tasks_by_id[task_id]
            room = task.get("room", "General")
            if room not in my_tasks:
                my_tasks[room] = []
            my_tasks[room].append(task)
    
    return my_tasks

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
        # Ensure both 'name' and 'title' fields exist for compatibility
        if "title" in node_data_copy and "name" not in node_data_copy:
            node_data_copy["name"] = node_data_copy["title"]
        # Ensure both 'cost' and 'costTalentPoints' fields exist for compatibility
        if "costTalentPoints" in node_data_copy and "cost" not in node_data_copy:
            node_data_copy["cost"] = node_data_copy["costTalentPoints"]
        nodes_list.append(node_data_copy)
    return nodes_list

# Get talent tree nodes (updated for 10-tier system)
@api_router.get("/talent-tree")
async def get_talent_tree():
    """Get all talent tree nodes for the new 10-tier system"""
    return {"nodes": NEW_TALENT_TREE_NODES}

# Check if user can unlock premium tiers
@api_router.get("/talent-tree/premium-status/{user_id}")
async def get_premium_status(user_id: str):
    """Check if user has premium access for tiers 6-10"""
    try:
        user = await db.users.find_one({"userId": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # For now, mock premium status - in production this would check subscription
        has_premium = user.get("premium_access", False)
        
        return {
            "has_premium": has_premium,
            "max_tier_available": 10 if has_premium else 5,
            "premium_purchase_url": "/premium-upgrade"  # Mock URL
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== PI MESSAGE INTEGRATION ENDPOINTS =====

# Message models
class MessageRequest(BaseModel):
    message: str
    enhancement_level: str = "moderate"
    preserve_style: bool = True
    user_id: str

class SendMessageRequest(BaseModel):
    content: str
    original_content: Optional[str] = None
    enhanced: bool = False
    empathy_score: float = 0.0
    sender_id: str
    couple_id: str

# Pi message enhancement endpoint
@api_router.post("/chatgpt/enhance-message")
async def enhance_message_endpoint(request: MessageRequest):
    """
    Enhance a message using ChatGPT for kind and constructive communication
    """
    try:
        # Determine message type from enhancement level
        message_type_map = {
            "light": "general",
            "moderate": "general",
            "significant": "criticism"
        }
        message_type = message_type_map.get(request.enhancement_level, "general")
        
        result = await enhance_message_with_chatgpt(
            message=request.message,
            message_type=message_type
        )
        
        # Log the enhancement for analytics (optional)
        enhancement_log = {
            "user_id": request.user_id,
            "timestamp": datetime.now(timezone.utc),
            "original_message": request.message,
            "enhanced_message": result["enhanced_message"],
            "message_type": message_type,
            "success": result["success"]
        }
        
        # Store in database for future analysis (optional)
        await db.message_enhancements.insert_one(enhancement_log)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Message enhancement failed: {str(e)}")

@app.post("/api/ai/enhance_message")
async def enhance_message(request: dict):
    """Enhance message with ChatGPT-5 (replacing Pi API)"""
    try:
        message_text = request.get('message', '')
        enhancement_level = request.get('level', 'gentle')  # gentle, supportive, encouraging
        
        if not message_text.strip():
            return JSONResponse(
                status_code=400, 
                content={"error": "Message text is required"}
            )
        
        # Get the Emergent LLM key
        emergent_llm_key = os.environ.get('EMERGENT_LLM_KEY')
        
        if not emergent_llm_key:
            # Fallback if no key available
            suggestions = [
                f"Hey love, I was wondering if you might have a moment to help with: {message_text}",
                f"When you get a chance, could you possibly help with this? {message_text} No rush! 💕",
                f"I'd really appreciate your help with: {message_text} ✨"
            ]
            return {
                "enhanced_message": random.choice(suggestions),
                "original_message": message_text,
                "enhancement_level": enhancement_level,
                "api_used": "fallback"
            }
        
        # Create ChatGPT-5 client
        chat = LlmChat(
            api_key=emergent_llm_key,
            session_id=f"message_enhancement_{random.randint(1000, 9999)}",
            system_message=f"""You are a relationship communication expert. 
            
Your job is to rewrite messages between romantic partners in a {enhancement_level}, positive, and loving way while maintaining the core request/meaning.

Guidelines:
- Keep the same essential message/request
- Remove any complainy, nagging, or annoyed tone
- Add warmth, appreciation, and love
- Be specific to the request, don't be too generic
- Use natural language, not overly flowery
- Include light emojis if appropriate (1-2 max)

Enhancement level '{enhancement_level}' means:
- gentle: Soft, understanding, patient tone
- supportive: Encouraging, team-oriented, belief in partner
- encouraging: Enthusiastic, motivating, "we can do this" energy"""
        ).with_model("openai", "gpt-5")
        
        # Create user message
        user_message = UserMessage(
            text=f"Original message: '{message_text}'\n\nPlease rewrite this message to be more {enhancement_level} and positive while keeping the core request. Only return the rewritten message, nothing else."
        )
        
        # Send message to ChatGPT-5
        response = await chat.send_message(user_message)
        
        return {
            "enhanced_message": response.strip(),
            "original_message": message_text,
            "enhancement_level": enhancement_level,
            "api_used": "chatgpt-5"
        }
        
    except Exception as e:
        # Fallback on any error
        suggestions = [
            f"Hey love, I was wondering if you might have a moment to help with: {message_text}",
            f"When you get a chance, could you possibly help with this? {message_text} No rush! 💕",
            f"I'd really appreciate your help with: {message_text} ✨"
        ]
        return {
            "enhanced_message": random.choice(suggestions),
            "original_message": message_text,
            "enhancement_level": enhancement_level,
            "api_used": "fallback_error",
            "error": str(e)
        }
# Send message endpoint
@api_router.post("/messages/send")
async def send_message(request: SendMessageRequest):
    """
    Send a message between partners
    """
    try:
        # Create message document
        message_doc = {
            "id": str(uuid.uuid4()),
            "content": request.content,
            "original_content": request.original_content,
            "enhanced": request.enhanced,
            "empathy_score": request.empathy_score,
            "sender_id": request.sender_id,
            "couple_id": request.couple_id,
            "timestamp": datetime.now(timezone.utc),
            "read": False
        }
        
        # Store message in database
        await db.messages.insert_one(message_doc)
        
        # Notify partner via websocket if connected
        if request.couple_id in manager.active_connections:
            notification = {
                "type": "new_message",
                "sender_id": request.sender_id,
                "content": request.content,
                "enhanced": request.enhanced,
                "timestamp": message_doc["timestamp"].isoformat()
            }
            await manager.send_to_couple(request.couple_id, notification)
        
        return {"id": message_doc["id"], "status": "sent", "timestamp": message_doc["timestamp"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

# Get messages for a couple
@api_router.get("/messages/{couple_id}")
async def get_messages(couple_id: str, limit: int = 50):
    """
    Get recent messages for a couple
    """
    try:
        messages = await db.messages.find(
            {"couple_id": couple_id}
        ).sort("timestamp", -1).limit(limit).to_list(length=None)
        
        # Convert ObjectId and datetime for JSON serialization
        for message in messages:
            if "_id" in message:
                del message["_id"]
            message["timestamp"] = message["timestamp"].isoformat()
        
        return messages
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

# Check daily message status
@api_router.get("/messages/{couple_id}/daily-status")
async def check_daily_message_status(couple_id: str, date: str, user_id: str):
    """
    Check if user has sent their required daily message
    """
    try:
        # Parse date
        target_date = datetime.fromisoformat(date)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Check for messages from user on that date
        message_count = await db.messages.count_documents({
            "couple_id": couple_id,
            "sender_id": user_id,
            "timestamp": {"$gte": start_of_day, "$lte": end_of_day}
        })
        
        return {
            "has_daily_message": message_count > 0,
            "message_count": message_count,
            "date": date
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check daily message status: {str(e)}")

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
        originalAssignee=task.get("assignedOnlyTo") or "unassigned",
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
        existing_question.pop('_id', None)
        return existing_question
    
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
    return new_question.dict()

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