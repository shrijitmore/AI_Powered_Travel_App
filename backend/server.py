from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional, Dict, Any
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
import uuid
import random

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "test_database")
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Helper: ObjectId serializer

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == "_id" and isinstance(value, ObjectId):
                result["id"] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, (dict, list)):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

# Pydantic models
class Location(BaseModel):
    latitude: float
    longitude: float
    name: str

class RouteRequest(BaseModel):
    start: Location
    end: Location
    preferences: Dict[str, Any] = {}

class Route(BaseModel):
    id: Optional[str] = None
    user_id: str
    start: Location
    end: Location
    waypoints: List[Location] = []
    route_type: str  # "fastest", "scenic", "cheapest"
    distance: Optional[float] = None
    duration: Optional[float] = None
    ai_description: Optional[str] = None
    points_earned: int = 0
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Challenge(BaseModel):
    id: Optional[str] = None
    route_id: str
    type: str  # "photo", "food", "location", "hidden_gem"
    title: str
    description: str
    location: Location
    points: int = 10
    completed: bool = False
    completed_at: Optional[datetime] = None

class User(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
    total_points: int = 0
    level: int = 1
    badges: List[str] = []
    routes_completed: int = 0
    achievements: List[str] = []
    rewards_owned: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIRouteResponse(BaseModel):
    routes: List[Dict[str, Any]]
    explanation: str

class Achievement(BaseModel):
    id: Optional[str] = None
    title: str
    condition_type: str  # 'points' | 'routes_completed'
    condition_value: int
    reward_points: int = 0
    badge_icon: Optional[str] = None  # base64

class RewardItem(BaseModel):
    id: Optional[str] = None
    item_name: str
    cost: int
    category: str  # 'Badge' | 'Boost' | 'Cosmetic'

class MotivationMessage(BaseModel):
    id: Optional[str] = None
    trigger_event: str  # 'task_completed' | 'route_completed' | 'daily_login'
    message_text: str

# NEW: Paths and Tasks
class PathModel(BaseModel):
    id: Optional[str] = None
    name: str
    start_point: Location
    end_point: Location
    difficulty: str = "Easy"  # Easy | Medium | Hard
    ai_suggested: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskModel(BaseModel):
    id: Optional[str] = None
    path_id: str
    task_description: str
    reward_points: int = 10
    status: str = "Not Started"  # Not Started | In Progress | Completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class PathSuggestRequest(BaseModel):
    goal: str  # 'scenic' | 'shortest' | 'adventurous'
    center: Optional[Location] = None
    count: int = 3

class PathSuggestResponse(BaseModel):
    paths: List[Dict[str, Any]]
    explanation: str

# Initialize AI Chat

def get_ai_chat():
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            "You are a helpful travel assistant specialized in route planning and travel recommendations. "
            "Provide practical advice about routes, points of interest, and travel optimization."
        ),
    ).with_model("gemini", "gemini-2.5-pro")

# Utility: Achievement checking
async def check_and_award_achievements(user_id: str) -> Dict[str, Any]:
    if not ObjectId.is_valid(user_id):
        return {"unlocked": [], "awarded_points": 0}

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"unlocked": [], "awarded_points": 0}

    achievements = await db.achievements.find().to_list(100)
    unlocked: List[str] = []
    awarded_points = 0

    for ach in achievements:
        title = ach.get("title")
        if title in (user.get("achievements") or []):
            continue
        condition_type = ach.get("condition_type")
        condition_value = ach.get("condition_value", 0)

        meets = False
        if condition_type == "points":
            meets = user.get("total_points", 0) >= condition_value
        elif condition_type == "routes_completed":
            meets = user.get("routes_completed", 0) >= condition_value

        if meets:
            unlocked.append(title)
            awarded_points += int(ach.get("reward_points", 0))

    if unlocked:
        update = {
            "$addToSet": {"badges": {"$each": unlocked}, "achievements": {"$each": unlocked}},
        }
        if awarded_points:
            update["$inc"] = {"total_points": awarded_points}
        await db.users.update_one({"_id": ObjectId(user_id)}, update)

    return {"unlocked": unlocked, "awarded_points": awarded_points}

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "gamified_travel_backend"}

# Users
@app.post("/api/users")
async def create_user(user: User):
    user_dict = user.model_dump(exclude={"id"})
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    return serialize_doc(user_dict)

@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    try:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return serialize_doc(user)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

# AI Route Planning
@app.post("/api/routes/plan")
async def plan_route(route_request: RouteRequest):
    try:
        chat = get_ai_chat()
        prompt = f"""
        Plan a travel route from {route_request.start.name} (lat: {route_request.start.latitude}, lon: {route_request.start.longitude})
        to {route_request.end.name} (lat: {route_request.end.latitude}, lon: {route_request.end.longitude}).

        User preferences: {route_request.preferences}

        Please provide:
        1. Three route options: fastest, scenic, and cheapest
        2. Estimated distance and duration for each
        3. Key points of interest along each route
        4. Trade-offs explanation
        5. Recommend 2-3 challenges/tasks for travelers (like trying local food, taking photos at landmarks, etc.)

        Format your response as practical travel advice with specific recommendations.
        """
        message = UserMessage(text=prompt)
        ai_response = await chat.send_message(message)

        start_lat, start_lon = route_request.start.latitude, route_request.start.longitude
        end_lat, end_lon = route_request.end.latitude, route_request.end.longitude

        def generate_waypoints(route_type: str, num_points: int = 3):
            waypoints = []
            for i in range(1, num_points + 1):
                progress = i / (num_points + 1)
                if route_type == "scenic":
                    lat_offset = (end_lat - start_lat) * progress + 0.01 * (i % 2 - 0.5)
                    lon_offset = (end_lon - start_lon) * progress + 0.01 * (i % 2 - 0.5)
                elif route_type == "fastest":
                    lat_offset = (end_lat - start_lat) * progress
                    lon_offset = (end_lon - start_lon) * progress
                else:
                    lat_offset = (end_lat - start_lat) * progress + 0.005 * (1 - progress)
                    lon_offset = (end_lon - start_lon) * progress - 0.005 * progress
                waypoints.append({
                    "latitude": start_lat + lat_offset,
                    "longitude": start_lon + lon_offset,
                    "name": f"Waypoint {i}"
                })
            return waypoints

        routes = [
            {
                "type": "fastest",
                "distance": 120.5,
                "duration": 90,
                "description": "Highway route via main roads",
                "waypoints": generate_waypoints("fastest"),
                "color": "#FF6B6B",
                "challenges": [
                    {
                        "type": "photo",
                        "title": "Highway Milestone",
                        "description": "Take a photo at the highway rest stop",
                        "location": {
                            "latitude": start_lat + (end_lat - start_lat) * 0.5,
                            "longitude": start_lon + (end_lon - start_lon) * 0.5,
                            "name": "Highway Rest Stop"
                        },
                        "points": 15
                    }
                ]
            },
            {
                "type": "scenic",
                "distance": 145.2,
                "duration": 120,
                "description": "Scenic route through countryside",
                "waypoints": generate_waypoints("scenic"),
                "color": "#4ECDC4",
                "challenges": [
                    {
                        "type": "photo",
                        "title": "Scenic Viewpoint",
                        "description": "Capture the beautiful countryside view",
                        "location": {
                            "latitude": start_lat + (end_lat - start_lat) * 0.3 + 0.01,
                            "longitude": start_lon + (end_lon - start_lon) * 0.3 + 0.01,
                            "name": "Scenic Overlook"
                        },
                        "points": 25
                    },
                    {
                        "type": "food",
                        "title": "Local Delicacy",
                        "description": "Try a local specialty at the roadside diner",
                        "location": {
                            "latitude": start_lat + (end_lat - start_lat) * 0.7,
                            "longitude": start_lon + (end_lon - start_lon) * 0.7,
                            "name": "Country Diner"
                        },
                        "points": 20
                    }
                ]
            },
            {
                "type": "cheapest",
                "distance": 135.8,
                "duration": 105,
                "description": "Budget-friendly route avoiding tolls",
                "waypoints": generate_waypoints("cheapest"),
                "color": "#FFD93D",
                "challenges": [
                    {
                        "type": "location",
                        "title": "Hidden Gem",
                        "description": "Discover the local market",
                        "location": {
                            "latitude": start_lat + (end_lat - start_lat) * 0.6,
                            "longitude": start_lon + (end_lon - start_lon) * 0.6 - 0.005,
                            "name": "Local Market"
                        },
                        "points": 30
                    }
                ]
            }
        ]

        return AIRouteResponse(routes=routes, explanation=ai_response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error planning route: {str(e)}")

# Save planned route
@app.post("/api/routes")
async def save_route(route: Route):
    route_dict = route.model_dump(exclude={"id"})
    result = await db.routes.insert_one(route_dict)
    route_dict["_id"] = result.inserted_id
    return serialize_doc(route_dict)

@app.get("/api/routes/user/{user_id}")
async def get_user_routes(user_id: str):
    try:
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID format")
        routes = await db.routes.find({"user_id": user_id}).to_list(100)
        return serialize_doc(routes)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

# Complete route
@app.patch("/api/routes/{route_id}/complete")
async def complete_route(route_id: str, user_id: str):
    try:
        if not ObjectId.is_valid(route_id):
            raise HTTPException(status_code=400, detail="Invalid route ID format")

        route_result = await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$set": {"completed": True, "points_earned": 50}}
        )
        if route_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Route not found")

        if ObjectId.is_valid(user_id):
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"total_points": 50, "routes_completed": 1}, "$addToSet": {"badges": "Route Completer"}}
            )
            ach_result = await check_and_award_achievements(user_id)
            msg_doc = await db.motivation_messages.find_one({"trigger_event": "route_completed"})
            motivation = msg_doc.get("message_text") if msg_doc else "Great job! Keep going!"
            return {"message": "Route completed successfully", "points_awarded": 50, "achievement": ach_result, "motivation": motivation}

        return {"message": "Route completed successfully", "points_awarded": 50}
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid route ID format")

# Challenges
@app.post("/api/challenges")
async def create_challenge(challenge: Challenge):
    challenge_dict = challenge.model_dump(exclude={"id"})
    result = await db.challenges.insert_one(challenge_dict)
    challenge_dict["_id"] = result.inserted_id
    return serialize_doc(challenge_dict)

@app.get("/api/challenges/route/{route_id}")
async def get_route_challenges(route_id: str):
    try:
        if not ObjectId.is_valid(route_id):
            raise HTTPException(status_code=400, detail="Invalid route ID format")
        challenges = await db.challenges.find({"route_id": route_id}).to_list(100)
        return serialize_doc(challenges)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid route ID format")

@app.patch("/api/challenges/{challenge_id}/complete")
async def complete_challenge(challenge_id: str, user_id: str):
    try:
        if not ObjectId.is_valid(challenge_id):
            raise HTTPException(status_code=400, detail="Invalid challenge ID format")
        challenge = await db.challenges.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")

        await db.challenges.update_one(
            {"_id": ObjectId(challenge_id)},
            {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc)}}
        )

        if ObjectId.is_valid(user_id):
            points = challenge.get("points", 10)
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"total_points": points}}
            )
            ach_result = await check_and_award_achievements(user_id)
            msg_doc = await db.motivation_messages.find_one({"trigger_event": "task_completed"})
            motivation = msg_doc.get("message_text") if msg_doc else "🔥 You’re unstoppable! Keep going!"
            return {"message": "Challenge completed successfully", "points_awarded": points, "achievement": ach_result, "motivation": motivation}

        return {"message": "Challenge completed successfully", "points_awarded": challenge.get("points", 10)}
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid challenge ID format")

# AI Chat
@app.post("/api/chat")
async def chat_with_ai(message: str, user_context: str = ""):
    try:
        chat = get_ai_chat()
        prompt = f"""
        User context: {user_context}
        User question: {message}

        Provide helpful travel advice, route recommendations, or answer travel-related questions.
        Keep responses practical and engaging for a travel app user.
        """
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in chat: {str(e)}")

# Leaderboard
@app.get("/api/leaderboard")
async def get_leaderboard(limit: int = 10):
    users = await db.users.find().sort("total_points", -1).limit(limit).to_list(limit)
    return serialize_doc(users)

# Map helpers
@app.get("/api/map/points-of-interest")
async def get_points_of_interest(lat: float, lon: float, radius: float = 0.1):
    try:
        pois = []
        poi_types = ["restaurant", "landmark", "viewpoint", "gas_station", "hotel"]
        for i, poi_type in enumerate(poi_types):
            lat_offset = (i - 2) * 0.02
            lon_offset = ((i % 2) - 0.5) * 0.02
            poi = {
                "id": f"poi_{i}",
                "type": poi_type,
                "name": f"{poi_type.replace('_', ' ').title()} {i+1}",
                "location": {
                    "latitude": lat + lat_offset,
                    "longitude": lon + lon_offset,
                    "name": f"{poi_type.replace('_', ' ').title()} {i+1}"
                },
                "description": f"Interesting {poi_type.replace('_', ' ')} near your route",
                "rating": 4.0 + (i * 0.2),
                "challenge_available": i % 2 == 0
            }
            pois.append(poi)
        return {"points_of_interest": pois}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching POIs: {str(e)}")

@app.get("/api/map/challenges/nearby")
async def get_nearby_challenges(lat: float, lon: float, radius: float = 0.1):
    try:
        challenges = []
        challenge_types = ["photo", "food", "location", "hidden_gem"]
        for i, challenge_type in enumerate(challenge_types):
            lat_offset = (i - 1.5) * 0.015
            lon_offset = ((i % 2) - 0.5) * 0.015
            challenge = {
                "id": f"map_challenge_{i}",
                "type": challenge_type,
                "title": f"{challenge_type.replace('_', ' ').title()} Challenge",
                "description": f"Complete this {challenge_type} challenge for rewards!",
                "location": {
                    "latitude": lat + lat_offset,
                    "longitude": lon + lon_offset,
                    "name": f"{challenge_type.title()} Spot"
                },
                "points": 15 + (i * 5),
                "difficulty": ["easy", "medium", "hard"][i % 3],
                "completed": False
            }
            challenges.append(challenge)
        return {"challenges": challenges}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching challenges: {str(e)}")

@app.get("/api/routes/{route_id}/waypoints")
async def get_route_waypoints(route_id: str):
    try:
        if not ObjectId.is_valid(route_id):
            raise HTTPException(status_code=400, detail="Invalid route ID format")
        route = await db.routes.find_one({"_id": ObjectId(route_id)})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        return serialize_doc(route)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid route ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching route waypoints: {str(e)}")

# Achievements
@app.get("/api/achievements")
async def list_achievements():
    items = await db.achievements.find().to_list(100)
    return serialize_doc(items)

@app.post("/api/achievements")
async def create_achievement(achievement: Achievement):
    doc = achievement.model_dump(exclude={"id"})
    result = await db.achievements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@app.get("/api/achievements/status")
async def achievements_status(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    achievements = await db.achievements.find().to_list(100)
    resp = []
    for ach in achievements:
        title = ach.get("title")
        unlocked = title in (user.get("achievements") or [])
        item = serialize_doc(ach)
        item["unlocked"] = unlocked
        resp.append(item)
    return resp

@app.post("/api/achievements/check")
async def achievements_check(user_id: str):
    result = await check_and_award_achievements(user_id)
    return result

# Rewards
@app.get("/api/rewards/items")
async def list_reward_items():
    items = await db.rewards.find().to_list(200)
    return serialize_doc(items)

@app.post("/api/rewards/items")
async def create_reward_item(item: RewardItem):
    doc = item.model_dump(exclude={"id"})
    result = await db.rewards.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@app.get("/api/rewards/user/{user_id}/inventory")
async def user_inventory(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    owned = user.get("rewards_owned", [])
    items = await db.rewards.find({"_id": {"$in": [ObjectId(x) for x in owned if ObjectId.is_valid(x)]}}).to_list(200)
    return serialize_doc(items)

class ClaimRequest(BaseModel):
    user_id: str
    item_id: str

@app.post("/api/rewards/claim")
async def claim_reward(payload: ClaimRequest):
    user_id = payload.user_id
    item_id = payload.item_id
    if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    item = await db.rewards.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    cost = int(item.get("cost", 0))
    if user.get("total_points", 0) < cost:
        raise HTTPException(status_code=400, detail="Insufficient points")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"total_points": -cost}, "$addToSet": {"rewards_owned": str(item.get("_id"))}}
    )

    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {"message": "Reward claimed", "user": serialize_doc(updated_user), "item": serialize_doc(item)}

# Motivation
@app.get("/api/motivation")
async def get_motivation(trigger: str = "task_completed"):
    msgs = await db.motivation_messages.find({"trigger_event": trigger}).to_list(100)
    if not msgs:
        defaults = {
            "task_completed": ["🔥 You’re unstoppable! Keep going!", "Nice! Another one down."],
            "route_completed": ["Great job finishing the route!", "🏁 Route complete! On to the next adventure."],
            "daily_login": ["Welcome back, explorer!", "New day, new quests!"]
        }
        sel = random.choice(defaults.get(trigger, ["Keep going!"]))
        return {"message": sel}
    pick = random.choice(msgs)
    return serialize_doc(pick)

# NEW: Paths APIs
@app.post("/api/paths")
async def create_path(path: PathModel):
    doc = path.model_dump(exclude={"id"})
    result = await db.paths.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@app.get("/api/paths")
async def list_paths(ai_suggested: Optional[bool] = None, difficulty: Optional[str] = None):
    query: Dict[str, Any] = {}
    if ai_suggested is not None:
        query["ai_suggested"] = ai_suggested
    if difficulty:
        query["difficulty"] = difficulty
    items = await db.paths.find(query).to_list(200)
    return serialize_doc(items)

@app.get("/api/paths/{path_id}")
async def get_path(path_id: str):
    if not ObjectId.is_valid(path_id):
        raise HTTPException(status_code=400, detail="Invalid path ID format")
    item = await db.paths.find_one({"_id": ObjectId(path_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Path not found")
    return serialize_doc(item)

# NEW: AI Path Suggestion
@app.post("/api/paths/suggest")
async def suggest_paths(req: PathSuggestRequest):
    try:
        chat = get_ai_chat()
        center = req.center or Location(latitude=37.7749, longitude=-122.4194, name="Center")
        prompt = f"""
        The user wants {req.goal} travel paths around {center.name} (lat {center.latitude}, lon {center.longitude}).
        Suggest {req.count} concise path names and a one-line rationale overall.
        """
        message = UserMessage(text=prompt)
        explanation = await chat.send_message(message)

        difficulties = {
            "scenic": ["Medium", "Hard", "Medium"],
            "adventurous": ["Hard", "Hard", "Medium"],
            "shortest": ["Easy", "Easy", "Medium"],
        }
        diffs = difficulties.get(req.goal.lower(), ["Easy", "Medium", "Hard"])

        paths = []
        for i in range(max(1, min(req.count, 5))):
            lat_off = (i - 1) * 0.02
            lon_off = ((i % 2) - 0.5) * 0.02
            start = {
                "latitude": center.latitude + lat_off,
                "longitude": center.longitude + lon_off,
                "name": f"Start {i+1}",
            }
            end = {
                "latitude": center.latitude + lat_off + 0.03,
                "longitude": center.longitude + lon_off + 0.03,
                "name": f"End {i+1}",
            }
            name = {
                "scenic": ["Scenic Ridge Loop", "Lake Panorama Route", "Forest Canopy Trail"],
                "adventurous": ["Rocky Scramble", "Canyon Descent", "Peak Ascent Express"],
                "shortest": ["Direct City Link", "Quick Park Connector", "Straightline Stroll"],
            }.get(req.goal.lower(), ["Explorer Path A", "Explorer Path B", "Explorer Path C"])[i % 3]

            path_doc = {
                "name": name,
                "start_point": start,
                "end_point": end,
                "difficulty": diffs[i % len(diffs)],
                "ai_suggested": True,
                "created_at": datetime.now(timezone.utc),
            }
            ins = await db.paths.insert_one(path_doc)
            path_doc["_id"] = ins.inserted_id

            # create 2 tasks per path
            task_defs = [
                {"task_description": "Reach the featured viewpoint", "reward_points": 20},
                {"task_description": "Take a photo of landmark", "reward_points": 25},
            ]
            for td in task_defs:
                await db.tasks.insert_one({
                    "path_id": str(ins.inserted_id),
                    "task_description": td["task_description"],
                    "reward_points": td["reward_points"],
                    "status": "Not Started",
                    "created_at": datetime.now(timezone.utc),
                })

            paths.append(serialize_doc(path_doc))

        return PathSuggestResponse(paths=paths, explanation=explanation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error suggesting paths: {str(e)}")

# NEW: Tasks APIs
@app.post("/api/tasks")
async def create_task(task: TaskModel):
    if not ObjectId.is_valid(task.path_id):
        raise HTTPException(status_code=400, detail="Invalid path ID format")
    path = await db.paths.find_one({"_id": ObjectId(task.path_id)})
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")
    doc = task.model_dump(exclude={"id"})
    result = await db.tasks.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@app.get("/api/paths/{path_id}/tasks")
async def list_tasks_for_path(path_id: str):
    if not ObjectId.is_valid(path_id):
        raise HTTPException(status_code=400, detail="Invalid path ID format")
    items = await db.tasks.find({"path_id": path_id}).to_list(500)
    return serialize_doc(items)

@app.patch("/api/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str, user_id: Optional[str] = None):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format")
    if status not in ["Not Started", "In Progress", "Completed"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update: Dict[str, Any] = {"status": status}
    points_awarded = 0
    if status == "Completed" and not task.get("completed_at"):
        update["completed_at"] = datetime.now(timezone.utc)
        points_awarded = int(task.get("reward_points", 10))
        if user_id and ObjectId.is_valid(user_id):
            await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"total_points": points_awarded}})

    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})

    achievement = {"unlocked": [], "awarded_points": 0}
    motivation = None
    if status == "Completed" and user_id and ObjectId.is_valid(user_id):
        achievement = await check_and_award_achievements(user_id)
        msg_doc = await db.motivation_messages.find_one({"trigger_event": "task_completed"})
        motivation = msg_doc.get("message_text") if msg_doc else "🔥 You’re unstoppable! Keep going!"

    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return {
        "task": serialize_doc(updated_task),
        "points_awarded": points_awarded,
        "achievement": achievement,
        "motivation": motivation,
    }

# Seeder
@app.post("/api/seed")
async def seed_samples():
    if await db.achievements.count_documents({}) == 0:
        await db.achievements.insert_many([
            {"title": "Explorer Badge", "condition_type": "points", "condition_value": 100, "reward_points": 50},
            {"title": "Trailblazer Badge", "condition_type": "routes_completed", "condition_value": 5, "reward_points": 75},
        ])
    if await db.rewards.count_documents({}) == 0:
        await db.rewards.insert_many([
            {"item_name": "Golden Compass", "cost": 120, "category": "Badge"},
            {"item_name": "Speed Boost", "cost": 80, "category": "Boost"},
            {"item_name": "Premium Badge", "cost": 150, "category": "Badge"},
        ])
    if await db.motivation_messages.count_documents({}) == 0:
        await db.motivation_messages.insert_many([
            {"trigger_event": "task_completed", "message_text": "🔥 You’re unstoppable! Keep going!"},
            {"trigger_event": "route_completed", "message_text": "🏁 Route complete! On to the next adventure."},
            {"trigger_event": "daily_login", "message_text": "Welcome back, explorer!"},
        ])
    if await db.paths.count_documents({}) == 0:
        scenic_trail = {
            "name": "Scenic Mountain Trail",
            "start_point": {"latitude": 37.773, "longitude": -122.431, "name": "Trailhead"},
            "end_point": {"latitude": 37.802, "longitude": -122.448, "name": "Summit"},
            "difficulty": "Medium",
            "ai_suggested": True,
            "created_at": datetime.now(timezone.utc),
        }
        city_walk = {
            "name": "City Landmark Walk",
            "start_point": {"latitude": 37.7749, "longitude": -122.4194, "name": "Downtown"},
            "end_point": {"latitude": 37.7849, "longitude": -122.4094, "name": "Old Town"},
            "difficulty": "Easy",
            "ai_suggested": False,
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.paths.insert_many([scenic_trail, city_walk])
        p1, p2 = res.inserted_ids
        await db.tasks.insert_many([
            {"path_id": str(p1), "task_description": "Reach the Lake Viewpoint", "reward_points": 20, "status": "Not Started", "created_at": datetime.now(timezone.utc)},
            {"path_id": str(p1), "task_description": "Take a photo of the summit landmark", "reward_points": 30, "status": "Not Started", "created_at": datetime.now(timezone.utc)},
            {"path_id": str(p2), "task_description": "Try a local delicacy", "reward_points": 15, "status": "Not Started", "created_at": datetime.now(timezone.utc)},
            {"path_id": str(p2), "task_description": "Find the hidden mural", "reward_points": 25, "status": "Not Started", "created_at": datetime.now(timezone.utc)},
        ])
    return {"message": "Seeded sample data"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)