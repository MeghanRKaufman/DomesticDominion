# Domestic Dominion - Product Requirements Document

## Original Problem Statement
Build a household management RPG app that gamifies chores for 2-12+ players in a shared household.
Core requirements:
- Household-centric gameplay with an admin role
- Dynamic chore generation from onboarding surveys
- Weighted fairness model based on time, difficulty, and grossness
- WoW-style talent tree with gameplay modifiers
- Invite-code based household joining
- AI-assisted constructive concerns form
- 25% random chore verification system
- Availability-aware assignment that respects player schedules

## Current Product Scope
Domestic Dominion is a full-stack React + FastAPI + MongoDB application for running a shared household like an RPG party. Players join a household, receive fairly distributed chores, complete quests for XP, unlock talent upgrades, and coordinate responsibilities with visibility into task load and verification.

## Implemented Features

### Household Setup & Access
- 6-step admin onboarding flow
- 4-step member onboarding flow after joining with invite code
- Household invite code generation, persistence, preview, and copy fallback
- Join flow that correctly links new users into existing households

### Chore Assignment & Fairness
- Auto-redistribution of chores when new members join
- Weighted fairness algorithm using time, difficulty, and grossness
- Preference-aware assignment using chore aversions, preferred tasks, and max daily load
- Availability-aware assignment using weekly defaults plus date overrides
- Assigned tasks now include `scheduledWindow` metadata when availability applies

### Verification System
- ~25% verification trigger on task completion
- Pending verification list in UI for other household members
- Approval flow holds XP until approval, then awards XP + verification bonus
- Rejection flow now correctly resets `completed=false`, allowing re-completion
- Self-verification prevention

### Talent Tree & Progression
- Talent tree UI and backend integration
- Talent modifiers affecting XP and verification behavior
- XP, level, and talent-point progression

### Communication
- Constructive Concerns form
- AI rewrite endpoint using emergentintegrations + OpenAI GPT-4o

### Availability Calendar (latest)
- New `Profile & Settings` tab in frontend
- Weekly availability editor for all 7 days
- Calendar-based per-date override editor
- Save flow persists normalized availability to user preferences
- Existing assignments redistribute after availability changes
- Assignment engine now skips unavailable members for the assignment date
- Proper 400 error returned when all members are unavailable

## Testing Status

### Verified Passing
- `/app/test_reports/iteration_2.json`
  - Verification system E2E tested
  - Root-cause identified for rejected-task re-completion bug
- `/app/test_reports/iteration_3.json`
  - Availability Calendar feature tested end-to-end
  - 19/19 backend tests passed
  - Frontend availability UI verified working
  - Verification rejection regression passed
  - Join + redistribution regression passed

### Additional Main-Agent Verification
- Local smoke screenshot of `Profile & Settings` tab passed on internal frontend
- Backend self-test confirmed unavailable members receive 0 tasks and assigned tasks contain `scheduledWindow`

## Architecture

### Frontend
- `/app/frontend/src/App.js` - main application shell, tabs, data loading, quest UI
- `/app/frontend/src/components/ProgressiveOnboarding.js` - admin onboarding
- `/app/frontend/src/components/MemberOnboarding.js` - member onboarding
- `/app/frontend/src/components/AvailabilitySettingsPanel.jsx` - availability calendar editor
- `/app/frontend/src/components/TalentTree.js` - talent tree

### Backend
- `/app/backend/server.py` - monolithic FastAPI app containing routes, models, and assignment logic
- `/app/backend/tests/test_verification_flow.py` - verification regression coverage
- `/app/backend/tests/test_availability_calendar.py` - availability calendar coverage

### Database Collections
- `households`
- `users`
- `tasks`
- `task_completions`

## Important Data/Behavior Notes
- User availability is stored in `users.preferences.availability`
  - `weekly`: Monday-Sunday default windows
  - `overrides`: `YYYY-MM-DD` per-day overrides
- Assignment currently targets the current day and only assigns tasks to members available that day
- Admin onboarding preferences are now persisted to the admin user record
- Frontend refresh flow now hydrates current user from backend when loading game data

## Current Priorities

### P0
- User validation of the new Availability Calendar and verification flows in real usage

### P1
- Household stats view showing top contributors and completion breakdown
- Random positive events system
- Streak bonuses for consecutive task completions

### P2
- Chore swapping between members
- In-app mini-games
- Simulation mode for testing gameplay loops

### Refactor / Technical Debt
- Break `/app/backend/server.py` into routes, services, and models
- Break `/app/frontend/src/App.js` into smaller tab/page components
- Clean up duplicate/redefined backend models/functions highlighted by lint

## Latest Change Log
- 2026-04-16: Fixed verification rejection bug so rejected tasks can be completed again
- 2026-04-16: Added availability normalization and availability-aware chore assignment in backend
- 2026-04-16: Added `Profile & Settings` availability calendar UI with weekly defaults + date overrides
- 2026-04-16: Added scheduled window display on assigned quest cards
- 2026-04-16: Added backend regression coverage for availability calendar
