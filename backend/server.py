from fastapi import FastAPI, HTTPException, Depends
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

# Helper function to convert ObjectId to string
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIRouteResponse(BaseModel):
    routes: List[Dict[str, Any]]
    explanation: str

# Initialize AI Chat
def get_ai_chat():
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message="You are a helpful travel assistant specialized in route planning and travel recommendations. Provide practical advice about routes, points of interest, and travel optimization."
    ).with_model("gemini", "gemini-2.5-pro")

# API Routes

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "gamified_travel_backend"}

# User Management
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

# Route Planning with AI - Enhanced for Map Integration
@app.post("/api/routes/plan")
async def plan_route(route_request: RouteRequest):
    try:
        # Create AI chat instance
        chat = get_ai_chat()
        
        # Prepare message for AI
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
        
        # Generate enhanced route data with waypoints for map visualization
        start_lat, start_lon = route_request.start.latitude, route_request.start.longitude
        end_lat, end_lon = route_request.end.latitude, route_request.end.longitude
        
        # Calculate intermediate waypoints for different route types
        def generate_waypoints(route_type: str, num_points: int = 3):
            waypoints = []
            for i in range(1, num_points + 1):
                progress = i / (num_points + 1)
                
                if route_type == "scenic":
                    # Add some curve for scenic route
                    lat_offset = (end_lat - start_lat) * progress + 0.01 * (i % 2 - 0.5)
                    lon_offset = (end_lon - start_lon) * progress + 0.01 * (i % 2 - 0.5)
                elif route_type == "fastest":
                    # Direct route
                    lat_offset = (end_lat - start_lat) * progress
                    lon_offset = (end_lon - start_lon) * progress
                else:  # cheapest
                    # Slightly different path
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
        
        return AIRouteResponse(
            routes=routes,
            explanation=ai_response
        )
        
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

# Complete a route and award points
@app.patch("/api/routes/{route_id}/complete")
async def complete_route(route_id: str, user_id: str):
    try:
        if not ObjectId.is_valid(route_id):
            raise HTTPException(status_code=400, detail="Invalid route ID format")
        
        # Update route as completed
        route_result = await db.routes.update_one(
            {"_id": ObjectId(route_id)},
            {"$set": {"completed": True, "points_earned": 50}}
        )
        
        if route_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Route not found")
        
        # Award points to user
        if ObjectId.is_valid(user_id):
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$inc": {"total_points": 50, "routes_completed": 1},
                    "$addToSet": {"badges": "Route Completer"}
                }
            )
        
        return {"message": "Route completed successfully", "points_awarded": 50}
        
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid route ID format")

# Challenge Management
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

# Complete a challenge
@app.patch("/api/challenges/{challenge_id}/complete")
async def complete_challenge(challenge_id: str, user_id: str):
    try:
        if not ObjectId.is_valid(challenge_id):
            raise HTTPException(status_code=400, detail="Invalid challenge ID format")
        
        challenge = await db.challenges.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Update challenge as completed
        await db.challenges.update_one(
            {"_id": ObjectId(challenge_id)},
            {"$set": {"completed": True, "completed_at": datetime.now(timezone.utc)}}
        )
        
        # Award points to user
        if ObjectId.is_valid(user_id):
            points = challenge.get("points", 10)
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"total_points": points}}
            )
        
        return {"message": "Challenge completed successfully", "points_awarded": challenge.get("points", 10)}
        
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid challenge ID format")

# AI Travel Assistant Chat
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

# Get user leaderboard
@app.get("/api/leaderboard")
async def get_leaderboard(limit: int = 10):
    users = await db.users.find().sort("total_points", -1).limit(limit).to_list(limit)
    return serialize_doc(users)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)