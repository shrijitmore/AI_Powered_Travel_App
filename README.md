TravelQuest AI – Developer Documentation (MVP)

Overview
TravelQuest AI is a gamified travel app with an AI assistant. Users pick or get AI-suggested paths (journeys), complete tasks/missions, earn points, unlock achievements, and claim rewards. The app includes an interactive map experience, motivation messages, leaderboards, and personalization hooks.

Stack
- Frontend: Expo (React Native) + expo-router
- Backend: FastAPI (Uvicorn)
- Database: MongoDB (motor async client)
- AI: Emergent Integrations LLM (Gemini 2.5 Pro)

Repo Structure
app/
├─ backend/
│  ├─ server.py               # FastAPI server (all endpoints live here)
│  ├─ .env                    # Mongo URL, DB name, Emergent LLM Key (protected)
│  └─ requirements.txt
├─ frontend/
│  ├─ app/                    # expo-router routes
│  │  ├─ index.tsx            # Home + Tab-like main view
│  │  ├─ map.tsx              # Map UI (mobile-first placeholder)
│  │  ├─ achievements.tsx     # Achievements screen
│  │  ├─ rewards.tsx          # Rewards Store screen
│  │  ├─ assistant.tsx        # AI Assistant chat screen
│  │  └─ paths/
│  │     ├─ index.tsx         # Paths list + AI Suggest buttons
│  │     └─ [id].tsx          # Path detail + Task management
│  ├─ .env                    # Expo public backend URL and packager config (protected)
│  ├─ app.json                # Expo config (protected)
│  ├─ metro.config.js         # Metro cache config (protected)
│  └─ package.json            # Main: expo-router/entry
├─ README.md                  # This documentation
├─ test_result.md             # Testing protocol and state (protected protocol section)
└─ tests/                     # Placeholder

Protected Configuration – DO NOT MODIFY
- frontend/.env: EXPO_TUNNEL_SUBDOMAIN, EXPO_PACKAGER_HOSTNAME, EXPO_PUBLIC_BACKEND_URL
- backend/.env: MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
- frontend/app.json: base Expo configuration
- frontend/metro.config.js: Metro cache/workers tuning
- package.json: main field must remain "expo-router/entry"
- URL/Port Rules:
  - Backend binds to 0.0.0.0:8001
  - All backend API routes MUST be prefixed with /api
  - Frontend calls MUST use EXPO_PUBLIC_BACKEND_URL
  - Ingress forwards /api/* to backend 8001

Quick Start
1) Backend (FastAPI)
- Already managed by supervisor in this environment. If needed locally:
  - pip install -r backend/requirements.txt
  - set envs: MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
  - uvicorn backend.server:app --host 0.0.0.0 --port 8001 --reload

2) Frontend (Expo)
- cd frontend
- yarn install
- expo start (use web, Android, iOS, or Expo Go)
- Ensure frontend/.env contains EXPO_PUBLIC_BACKEND_URL pointing to the backend ingress domain

3) Seed Demo Data (optional)
- POST /api/seed to create sample achievements, rewards, motivation messages, example paths & tasks

Data Models (Mongo)
- User: id, name, email, total_points, level, routes_completed, badges[], achievements[], rewards_owned[], created_at
- PathModel: id, name, start_point, end_point, difficulty, ai_suggested, created_at
- TaskModel: id, path_id, task_description, reward_points, status, created_at, completed_at
- Route: id, user_id, start, end, waypoints[], route_type, distance, duration, ai_description, points_earned, completed, created_at
- Challenge: id, route_id, type, title, description, location, points, completed, completed_at
- Achievement: id, title, condition_type, condition_value, reward_points, badge_icon
- RewardItem: id, item_name, cost, category
- MotivationMessage: id, trigger_event, message_text

API Reference (All routes prefixed by /api)
Health
- GET /api/health → { status, service }

Users
- POST /api/users → create user
- GET /api/users/{user_id} → user details

Paths (Journeys)
- POST /api/paths → create path
- GET /api/paths?ai_suggested=true|false&difficulty=Easy|Medium|Hard → list
- GET /api/paths/{path_id} → details

AI Path Suggestion
- POST /api/paths/suggest
  body: { goal: 'scenic' | 'shortest' | 'adventurous', center?: { latitude, longitude, name }, count?: number }
  returns: { paths: [createdPaths], explanation: string }
  Notes: Creates ai_suggested=true paths in DB and seeds 2 tasks per path.

Tasks (Per Path)
- POST /api/tasks → create task
- GET /api/paths/{path_id}/tasks → list tasks for a path
- PATCH /api/tasks/{task_id}/status?status=Not+Started|In+Progress|Completed&user_id={optional}
  - Upon Completed: awards task.reward_points to user and triggers achievement check + motivation message
  - returns: { task, points_awarded, achievement, motivation }

Route Planning
- POST /api/routes/plan → AI route options + challenges

Routes
- POST /api/routes → save
- GET /api/routes/user/{user_id} → list
- PATCH /api/routes/{route_id}/complete?user_id=... → awards points + achievement check + motivation

Route Waypoints
- GET /api/routes/{route_id}/waypoints → route with waypoints for map (minor edge case: invalid ID may return 500)

Challenges
- POST /api/challenges → create
- GET /api/challenges/route/{route_id} → list
- PATCH /api/challenges/{challenge_id}/complete?user_id=... → awards points + motivation

Achievements
- GET /api/achievements → list config
- POST /api/achievements → create
- GET /api/achievements/status?user_id=... → unlocked flags per achievement
- POST /api/achievements/check?user_id=... → { unlocked[], awarded_points }

Rewards Store
- GET /api/rewards/items → list store items
- POST /api/rewards/items → create item
- GET /api/rewards/user/{user_id}/inventory → owned items
- POST /api/rewards/claim { user_id, item_id } → deduct points + add to inventory

Motivation
- GET /api/motivation?trigger=task_completed|route_completed|daily_login → one message

Seed
- POST /api/seed → seeds achievements, rewards, messages, paths & tasks

NEW: AI Nearby Suggestions (based on user location)
- POST /api/ai/nearby-suggestions
  Request body:
  {
    "lat": number,
    "lon": number,
    "goal": "scenic" | "food" | "history" | "adventurous", // default scenic
    "radius_km": number,   // default 3.0
    "limit": number        // default 5
  }
  Response:
  {
    "suggestions": [
      {
        "name": string,
        "type": "restaurant" | "landmark" | "viewpoint" | "gas_station" | "hotel",
        "location": { "latitude": number, "longitude": number, "name": string },
        "reason": string,
        "score": number,            // relevance score (goal fit + proximity)
        "suggested_tasks": [string] // micro-tasks to gamify the visit
      }
    ],
    "explanation": string // brief motivating AI summary
  }
  Notes:
  - The endpoint synthesizes nearby POIs and ranks them for the goal, returns tasks per suggestion, and includes an AI-written summary.

Sample curl Snippets
- Nearby AI Suggestions (Food)
  curl -X POST "$BASE/api/ai/nearby-suggestions" \
    -H "Content-Type: application/json" \
    -d '{"lat":37.7749, "lon":-122.4194, "goal":"food", "radius_km":3, "limit":5}'

Frontend – App Structure (expo-router)
Routes
- / (index.tsx)
  - Buttons: Explore Map, Select Destination | Paths, Plan New Route, Complete Demo Route, Rewards, Achievements, Assistant
- /map (map.tsx)
  - New: "AI Explore Nearby" button with quick goal chips (Scenic, Food, History, Adventure)
  - Opens an AI Suggestions modal showing name/type/score/reason/suggested tasks and an explanation
- /achievements, /rewards, /assistant – as described earlier
- /paths and /paths/[id] – as described earlier

Mobile UX
- Safe areas, thumb-friendly controls, minimal modals with clear actions
- Keyboard handling in assistant
- No absolute main layouts; all flex; minimum 44pt touch areas

Workflows (End-to-End)
- AI Nearby Exploration
  1) User opens Map, taps "AI Explore Nearby"
  2) Selects a goal (e.g., Food)
  3) Backend returns ranked suggestions + tasks + AI explanation
  4) User can pick one and manually plan route to it (or we can auto-plan in future)

Troubleshooting
- AI budget exhaustion may temporarily affect explanation text; suggestions still generate via heuristic ranking
- If no location permission, the map and AI explore feature will prompt/retry

Roadmap
- One-tap "Navigate" from AI suggestion (auto-plan route to the suggestion’s location)
- Tie suggested_tasks directly to Task system for instant logging
- Personalization using user history to bias goals and POIs
- Real maps with react-native-maps & polylines (needs Google Maps API key)

Change Log (Recent)
- Added: Paths & Tasks models/APIs and screens
- Added: AI Path Suggestion endpoint and UI
- Added: Home button to open Paths
- Added: AI Nearby Suggestions endpoint and Map UI (modal with tasks + explanation)

Ownership
- Backend: app/backend/server.py
- Frontend: app/frontend/app
- Docs: app/README.md