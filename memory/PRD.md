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
- Positive random events / secret missions inspired by daily observances
- Admin sandbox simulation mode for whole-house testing and player-perspective preview

## Current Product Scope
Domestic Dominion is a full-stack React + FastAPI + MongoDB application for running a shared household like an RPG party. Players join a household, receive fairly distributed chores, complete quests for XP, unlock talent upgrades, coordinate through verification, manage personal availability, receive surprise secret missions themed around public daily observances, and now support an admin-only sandbox simulator for whole-house testing.

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
- Assigned tasks include `scheduledWindow` metadata when availability applies

### Verification System
- ~25% verification trigger on task completion
- Pending verification list in UI for other household members
- Approval flow holds XP until approval, then awards XP + verification bonus
- Rejection flow correctly resets `completed=false`, allowing re-completion
- Self-verification prevention

### Talent Tree & Progression
- Talent tree UI and backend integration
- Talent modifiers affecting XP and verification behavior
- XP, level, and talent-point progression

### Communication
- Constructive Concerns form
- AI rewrite endpoint using emergentintegrations + OpenAI GPT-4o

### Availability Calendar
- `Profile & Settings` tab in frontend
- Weekly availability editor for all 7 days
- Calendar-based per-date override editor
- Save flow persists normalized availability to user preferences
- Existing assignments redistribute after availability changes
- Assignment engine skips unavailable members for the assignment date

### Random Events / Secret Missions
- Public daily observance theme integration via `https://todaysholiday.herokuapp.com/holidays/{month}/{day}`
- Mongo-backed caching of daily observance data in `daily_observances`
- Secret mission popup/bubble UI separate from normal quest cards
- Mix of solo, pair, and household moments with acts-of-kindness framing
- 1 active secret mission per user at a time
- Schedule-aware prompting that respects in-app availability windows
- Accept / dismiss / complete lifecycle with XP rewards
- Pair/team follow-up logic that re-offers a simplified mission to pending/dismissed participants after another participant completes their part

### Admin Sandbox Simulator (latest)
- Admin-only `Sandbox Sim` tab in frontend
- Create a sandbox household with 2-8 simulated players
- Aerial whole-house dashboard showing each player’s chores, missions, refusals, misses, notes, and schedule state
- Click any simulated player to “play as them” within a perspective panel
- Simulated actions for chores: complete / refuse / miss
- Simulated actions for secret missions: accept / dismiss / complete
- Simulated schedule editing across all 7 days with immediate sandbox refresh
- Simulated notes authored as the selected player
- Manual secret-mission trigger for the selected simulated player
- Mock endorsement rewards system with coupon drops, shop offers, and achievement unlocks
- **MOCKED** businesses currently include McKingBurger, CastleBean Coffee, DragonFuel Grocers, QuestWash Laundry, Crown Cinema, and TableTop Tavern

## Testing Status

### Verified Passing
- `/app/test_reports/iteration_2.json`
  - Verification system E2E tested
- `/app/test_reports/iteration_3.json`
  - Availability Calendar tested end-to-end
  - 19/19 backend tests passed
- `/app/test_reports/iteration_4.json`
  - Random Events / Secret Missions fully tested
  - 37/37 backend tests passed, 1 skipped
- `/app/test_reports/iteration_5.json`
  - Admin Sandbox Simulator fully tested
  - 38/38 backend tests passed
  - Sandbox frontend UI verified
  - Regressions for random events, availability, and verification all passed

### Additional Main-Agent Verification
- Local smoke screenshot of `Sandbox Sim` tab passed
- `pytest /app/backend/tests/test_sandbox_simulator.py` passed locally
- Combined regression run for sandbox + random events passed locally

## Architecture

### Frontend
- `/app/frontend/src/App.js` - main application shell, tabs, data loading, quest UI, secret mission state, sandbox tab integration
- `/app/frontend/src/components/ProgressiveOnboarding.js` - admin onboarding
- `/app/frontend/src/components/MemberOnboarding.js` - member onboarding
- `/app/frontend/src/components/AvailabilitySettingsPanel.jsx` - availability calendar editor
- `/app/frontend/src/components/RandomEventBubble.jsx` - secret mission popup UI
- `/app/frontend/src/components/AdminSandboxSimulator.jsx` - sandbox aerial dashboard and player perspective simulator
- `/app/frontend/src/components/TalentTree.js` - talent tree

### Backend
- `/app/backend/server.py` - monolithic FastAPI app containing live household logic plus sandbox simulator APIs
- `/app/backend/tests/test_verification_flow.py` - verification regression coverage
- `/app/backend/tests/test_availability_calendar.py` - availability regression coverage
- `/app/backend/tests/test_random_events.py` - random event regression coverage
- `/app/backend/tests/test_sandbox_simulator.py` - sandbox simulator regression coverage
- `/app/backend/tests/test_sandbox_comprehensive.py` - expanded sandbox coverage added by testing agent

### Database Collections
- `households`
- `users`
- `tasks`
- `task_completions`
- `daily_observances`
- `random_events`
- `sandbox_households`

## Important Data/Behavior Notes
- User availability is stored in `users.preferences.availability`
  - `weekly`: Monday-Sunday default windows
  - `overrides`: `YYYY-MM-DD` per-day overrides
- Assignment currently targets the current day and only assigns tasks to members available that day
- Pending random-event prompts respect availability windows
- Accepted random-event missions remain visible until completed, even if the user is no longer inside the original prompt window
- Sandbox simulation state is intentionally separate from live households
- Mock endorsement rewards are **MOCKED** placeholders for future real-world partnerships

## Current Priorities

### P0
- User validation of the Admin Sandbox Simulator, Random Events, Availability Calendar, and verification flows in real usage

### P1
- Household stats view showing top contributors and completion breakdown
- Streak bonuses for consecutive task completions
- Broader random-event content library / more event archetypes
- More tailored sandbox scenarios and player archetypes

### P2
- Chore swapping between members
- In-app mini-games
- Simulation mode expansion / scripted scenarios

### Refactor / Technical Debt
- Break `/app/backend/server.py` into routes, services, and models
- Break `/app/frontend/src/App.js` into smaller tab/page components
- Address pre-existing dialog accessibility warning (`DialogContent` missing description/aria-describedby)

## Latest Change Log
- 2026-04-27: Added Admin Sandbox Simulator with aerial dashboard, player perspective switching, schedule editing, notes, task/event simulation, and mock endorsement rewards
- 2026-04-27: Added sandbox regression coverage and verified end-to-end behavior in `/app/test_reports/iteration_5.json`
- 2026-04-22: Added Random Events / Secret Missions backend, popup UI, XP flow, and public daily observance theming
- 2026-04-16: Added availability normalization and availability-aware chore assignment in backend
- 2026-04-16: Fixed verification rejection bug so rejected tasks can be completed again
