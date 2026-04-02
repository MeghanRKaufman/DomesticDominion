# Domestic Dominion - Product Requirements Document

## Original Problem Statement
Build a household management RPG app that gamifies chores. The app should support:
- Households with 2-12+ players (moved from couple-centric to household-centric)
- Admin role with chore assignment capabilities
- Dynamic chore generation based on household setup (onboarding survey)
- WoW-style talent tree for rule modifiers
- Fair chore distribution weighted by time, difficulty, and "grossness"

## Core Features

### Implemented ✅
1. **6-Step Progressive Onboarding (Admin)**
   - Step 1: Household basics (name, admin name, size) + welcome description
   - Step 2: Home layout (rooms, bathrooms, bedrooms)
   - Step 3: Utilities (laundry type, trash days)
   - Step 4: Pets & Vehicles (optional)
   - Step 5: Availability (weekday/weekend hours)
   - Step 6: Personal preferences (aversions, preferred tasks)

2. **4-Step Member Onboarding (Joining Members)**
   - Step 1: Room setup (private/shared), pets, vehicles
   - Step 2: Availability (weekday/weekend hours, max daily chores)
   - Step 3: Chore aversions
   - Step 4: Preferred tasks

3. **Household Management**
   - Create households with invite codes
   - Join households via invite code (with member onboarding)
   - Auto-redistribute chores when new members join
   - Invite code displayed in Kingdom Control with copy button

4. **Chore System with Weighted Fairness** ✅ NEW
   - Chores have weight attributes: time (quick/medium/long), difficulty, grossness
   - Fair distribution algorithm considers total weight, not just count
   - Member preferences (aversions/preferred) affect assignment
   - Each member's total chore weight is balanced

5. **25% Verification System** ✅ NEW
   - ~25% of completed tasks trigger verification requirement
   - Household members can approve or reject verifications
   - Approved = XP awarded + verification bonus (+5 XP)
   - Rejected = task marked incomplete, no XP
   - Pending verifications shown on Home tab

6. **Talent Tree with Effects** ✅ NEW
   - Talents now apply real effects to gameplay:
     - Category multipliers (e.g., +10% XP for laundry tasks)
     - Flat bonuses for specific task types
     - Verification reduction (lower chance of verification trigger)
     - Time bonuses for completing within windows

7. **Dashboard Features**
   - Household Bulletin Board
   - Constructive Concerns form (5 fields, AI-powered rewrite)
   - Level/XP display with tooltips
   - Pending Verifications section

8. **AI Features**
   - Concern form rewrites messages with class and etiquette using GPT-4o

### Not Yet Implemented
- Player availability calendar
- Random positive events
- Chore swapping
- Mini-games
- Streak bonuses

## Architecture

### Frontend (React)
- `/app/frontend/src/App.js` - Main app component
- `/app/frontend/src/components/ProgressiveOnboarding.js` - 6-step onboarding
- `/app/frontend/src/components/TalentTree.js` - Talent tree UI

### Backend (FastAPI)
- `/app/backend/server.py` - All API endpoints and models

### Database (MongoDB)
- `households` - Household data and customized chores
- `users` - User profiles, levels, talent builds
- `tasks` - Task assignments

## Key API Endpoints
- `POST /api/households/create-enhanced` - Create household
- `POST /api/households/join` - Join via invite code
- `POST /api/households/{id}/assign-chores` - Assign chores
- `GET /api/households/{id}/my-tasks/{user_id}` - Get user's tasks
- `POST /api/tasks/{id}/complete` - Complete a task
- `GET /api/talents/tree` - Get talent tree structure

## Recent Changes (Jan 27, 2026)

### Bug Fixes
1. Fixed 422 error on household creation - changed `householdType` from 'ROOMMATES' to 'roommates'
2. Fixed double `/api/api` prefix in all API calls
3. Fixed join flow - modal now renders when "I was invited" is clicked
4. Fixed My Quests display - inverted conditional logic corrected
5. Removed Step 7 (talent spec selection) from onboarding per user request
6. Fixed TalentTree.js API path - added `/api` prefix
7. Fixed loadGameData to properly populate myDailyChores from API response (flattens room-grouped tasks)
8. Simplified Constructive Concerns form - now 2 questions: "What is the concern?" and "How does this affect the household and why is it important?"

### Known Issues
- Task completion checkbox click may need verification
- Talent tree effects not implemented in backend

## Next Priority Tasks
1. Verify task completion works end-to-end (click checkbox → API call → XP awarded)
2. Implement talent tree rule modifier effects
3. Test full flow: create household → assign chores → view quests → complete task

