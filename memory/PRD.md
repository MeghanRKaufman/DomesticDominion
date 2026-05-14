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
- Mini-game duel system for chore decisions

## Current Product Scope
Domestic Dominion is a full-stack React + FastAPI + MongoDB application for running a shared household like an RPG party. Players join a household, receive fairly distributed chores, complete quests for XP, unlock talent upgrades, coordinate through verification, manage personal availability, receive surprise secret missions themed around public daily observances, test whole-house scenarios in a sandbox simulator, and challenge housemates in mini-game duels that can decide who gets a chore.

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

### Admin Sandbox Simulator
- Admin-only `Sandbox Sim` tab in frontend
- Create a sandbox household with 2-8 simulated players
- Aerial whole-house dashboard showing each player’s chores, missions, refusals, misses, notes, and schedule state
- Click any simulated player to “play as them” within a perspective panel
- Simulated actions for chores, secret missions, schedules, notes, and mock endorsement rewards
- **MOCKED** businesses include McKingBurger, CastleBean Coffee, DragonFuel Grocers, QuestWash Laundry, Crown Cinema, and TableTop Tavern

### Mini-Game Duel Arena
- New `Mini Games` tab in frontend
- Create a duel challenge for one of your assigned chores against another household member
- Supports 1-round or best-of-3 duel format
- Both players receive flat XP + team XP when the duel is accepted
- Winner receives +25% bonus XP when the match resolves
- Winner chooses simple final task assignment: **me** or **them**
- Task becomes `duelPending` during the challenge and cannot be completed normally until resolved
- Pending/open duel list includes pending, active, and awaiting-choice states

### Expanded Mini-Game Roster (latest)
- Existing duel games retained:
  - Rock-Paper-Scissors
  - Trivia Duel
  - Simon Says Duel
  - Whack-a-Mole Duel
- New duel games added:
  - Cleaning-supply themed **Memory Flip**
  - **Dots-and-Boxes** duel
  - **War** card duel
- Memory Flip uses 12 cards / 6 cleaning-supply pairs: spray, sponge, gloves, soap, broom, bucket
- Boxes uses a 2x2 dots-and-boxes grid with 12 edges and 4 boxes
- War uses a 5-draw card battle structure
- All new games use the same duel reward rules and score-based winner resolution

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
- `/app/test_reports/iteration_6.json`
  - Mini-Game Duel Arena fully tested
  - 83/83 backend tests passed, 1 skipped
- `/app/test_reports/iteration_7.json`
  - Mini-game roster expansion fully tested
  - 29/29 mini-game tests passed
  - Frontend Mini-Games tab verified with all 7 duel game types

## Architecture

### Frontend
- `/app/frontend/src/App.js` - main application shell, tabs, data loading, quest UI, random events, sandbox tab integration, mini-games tab integration
- `/app/frontend/src/components/AvailabilitySettingsPanel.jsx` - availability calendar editor
- `/app/frontend/src/components/RandomEventBubble.jsx` - secret mission popup UI
- `/app/frontend/src/components/AdminSandboxSimulator.jsx` - sandbox aerial dashboard and player perspective simulator
- `/app/frontend/src/components/MiniGameArena.jsx` - duel challenge creation, open challenge list, and all current duel game UIs
- `/app/frontend/src/components/TalentTree.js` - talent tree

### Backend
- `/app/backend/server.py` - monolithic FastAPI app containing live household logic, sandbox simulator APIs, random events, and mini-game duel APIs
- `/app/backend/tests/test_verification_flow.py` - verification regression coverage
- `/app/backend/tests/test_availability_calendar.py` - availability regression coverage
- `/app/backend/tests/test_random_events.py` - random event regression coverage
- `/app/backend/tests/test_sandbox_simulator.py` - sandbox simulator regression coverage
- `/app/backend/tests/test_mini_game_duels.py` - targeted mini-game duel coverage
- `/app/backend/tests/test_mini_game_comprehensive.py` - expanded mini-game coverage added by testing agent

### Database Collections
- `households`
- `users`
- `tasks`
- `task_completions`
- `daily_observances`
- `random_events`
- `sandbox_households`
- `mini_game_challenges`

## Important Data/Behavior Notes
- User availability is stored in `users.preferences.availability`
  - `weekly`: Monday-Sunday default windows
  - `overrides`: `YYYY-MM-DD` per-day overrides
- Assignment currently targets the current day and only assigns tasks to members available that day
- Pending random-event prompts respect availability windows
- Accepted random-event missions remain visible until completed, even if the user is no longer inside the original prompt window
- Sandbox simulation state is intentionally separate from live households
- Mock endorsement rewards are **MOCKED** placeholders for future real-world partnerships
- Mini-game duel creation scopes active-duel checks by `householdId` because `taskId` is not globally unique across households
- Chore swap endpoints likewise scope all task lookups by `householdId`
- Chore Swap rules: max 3 pending swap requests per user, 12h cooldown on a chore after an accepted swap, `swapsInitiatedThisWeek` increments at finalization and lightly biases the fairness distributor toward giving that user more chores next cycle

## Current Priorities

### P0
- User validation of the new Chore Swap Exchange (trade/give/marketplace) end-to-end in real usage

### P1
- Household stats view showing top contributors and completion breakdown
- Streak bonuses for consecutive task completions
- Broader mini-game roster beyond current wave if desired

### P2
- Duel History + Rivalries Panel
- More tailored sandbox scenarios and player archetypes
- In-app mini-game tournaments / rivalry systems
- Simulation mode expansion / scripted scenarios
- Household-specific card skins for Memory Flip and War

### Refactor / Technical Debt
- Break `/app/backend/server.py` into routes, services, and models
- Break `/app/frontend/src/App.js` into smaller tab/page components
- Address pre-existing dialog accessibility warning (`DialogContent` missing description/aria-describedby) in older dialogs
- Investigate pre-existing `/quests` 403 console error for non-admin users (surfaced in iteration_8)

## Latest Change Log
- 2026-05-14: Built **Epic Invite** scroll feature — themed shareable poster (epic/hype/chill tones auto-picked from household theme), personal-message field, Web Share API + copy actions, curated quest-hook bank. New endpoint `GET /api/households/{household_id}/epic-invite`. Replaces the basic invite-code card in the admin Kingdom Control Center.
- 2026-05-14: Built full Chore Swap Exchange — Trade / Give / Open Marketplace types, target-accept + admin-approval flow, max 3 pending per user, 12h per-task cooldown, fairness-model tracking via `swapsInitiatedThisWeek`. Verified in `/app/test_reports/iteration_8.json` (27/27 tests, full E2E browser flow).
- 2026-05-12: Expanded duel roster with Memory Flip (cleaning-supply theme), Dots-and-Boxes, and War; verified in `/app/test_reports/iteration_7.json`
- 2026-05-05: Added Mini-Game Duel Arena with duel challenge flow, 4 original game types, 1-or-3 round support, flat accepted XP, +25% winner bonus, and winner task choice (`me` / `them`)
- 2026-05-05: Added duelPending task lock so chores in an active duel cannot be completed normally
- 2026-04-27: Added Admin Sandbox Simulator with aerial dashboard, player perspective switching, schedule editing, notes, task/event simulation, and mock endorsement rewards
- 2026-04-22: Added Random Events / Secret Missions backend, popup UI, XP flow, and public daily observance theming
- 2026-04-16: Added availability normalization and availability-aware chore assignment in backend
- 2026-04-16: Fixed verification rejection bug so rejected tasks can be completed again
