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
1. **6-Step Progressive Onboarding**
   - Step 1: Household basics (name, admin name, size)
   - Step 2: Home layout (rooms, bathrooms, bedrooms)
   - Step 3: Utilities (laundry type, trash days)
   - Step 4: Pets & Vehicles (optional)
   - Step 5: Availability (weekday/weekend hours)
   - Step 6: Personal preferences (aversions, preferred tasks)

2. **Household Management**
   - Create households with invite codes
   - Join households via invite code
   - Admin dashboard with chore assignment

3. **Chore System**
   - Dynamic chore generation based on household setup
   - Fair distribution among household members
   - Task completion with XP rewards

4. **Talent Tree UI**
   - WoW-style visual talent tree
   - Three specializations: Self-Care, Teamwork, Housework
   - Hybrid talents for cross-specialization

5. **Dashboard Features**
   - Household Bulletin Board
   - Constructive Concerns form
   - My Quests tab with task list

### Not Yet Implemented
- Talent tree rule modifiers (effects don't apply to gameplay yet)
- Weighted chore system (fairness by difficulty/grossness)
- Verification system (~20% random trigger)
- Player availability calendar
- Random positive events
- Chore swapping
- Mini-games

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

## Recent Changes (Jan 2026)

### Bug Fixes
1. Fixed 422 error on household creation - changed `householdType` from 'ROOMMATES' to 'roommates'
2. Fixed double `/api/api` prefix in API calls
3. Fixed join flow - modal now renders when "I was invited" is clicked
4. Fixed My Quests display - inverted conditional logic corrected
5. Removed Step 7 (talent spec selection) from onboarding per user request

### Known Issues
- Talent tree effects not implemented in backend
- Session persistence may need verification on page refresh

## Next Priority Tasks
1. Implement talent tree rule modifier effects
2. Test chore completion flow end-to-end
3. Implement verification system
