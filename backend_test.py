#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Gamified Travel Assistant
Tests all endpoints including AI integrations, user management, routes, challenges, and leaderboard
"""

import asyncio
import aiohttp
import json
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
BACKEND_URL = "https://travelquest-2.preview.emergentagent.com/api"

class TravelAppTester:
    def __init__(self):
        self.session = None
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
        self.test_data = {
            "user_id": None,
            "route_id": None,
            "challenge_id": None
        }

    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()

    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()

    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        
        if success:
            self.test_results["passed"] += 1
        else:
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"{test_name}: {message}")

    async def test_health_check(self):
        """Test health check endpoint"""
        try:
            async with self.session.get(f"{BACKEND_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "healthy":
                        self.log_test("Health Check", True, "Backend is healthy")
                    else:
                        self.log_test("Health Check", False, f"Unexpected health status: {data}")
                else:
                    self.log_test("Health Check", False, f"HTTP {response.status}")
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")

    async def test_create_user(self):
        """Test user creation"""
        user_data = {
            "name": "Sarah Johnson",
            "email": "sarah.johnson@email.com",
            "total_points": 0,
            "level": 1,
            "badges": [],
            "routes_completed": 0
        }
        
        try:
            async with self.session.post(f"{BACKEND_URL}/users", json=user_data) as response:
                if response.status == 200:
                    data = await response.json()
                    if "id" in data and data["name"] == user_data["name"]:
                        self.test_data["user_id"] = data["id"]
                        self.log_test("Create User", True, f"User created with ID: {data['id']}")
                    else:
                        self.log_test("Create User", False, "Missing ID or incorrect data in response", data)
                else:
                    error_data = await response.text()
                    self.log_test("Create User", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Create User", False, f"Exception: {str(e)}")

    async def test_get_user(self):
        """Test getting user by ID"""
        if not self.test_data["user_id"]:
            self.log_test("Get User", False, "No user ID available from create test")
            return

        try:
            async with self.session.get(f"{BACKEND_URL}/users/{self.test_data['user_id']}") as response:
                if response.status == 200:
                    data = await response.json()
                    if data["id"] == self.test_data["user_id"] and data["name"] == "Sarah Johnson":
                        self.log_test("Get User", True, "User retrieved successfully")
                    else:
                        self.log_test("Get User", False, "User data mismatch", data)
                else:
                    error_data = await response.text()
                    self.log_test("Get User", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Get User", False, f"Exception: {str(e)}")

    async def test_invalid_user_id(self):
        """Test error handling for invalid user ID"""
        try:
            async with self.session.get(f"{BACKEND_URL}/users/invalid_id") as response:
                if response.status == 400:
                    self.log_test("Invalid User ID Handling", True, "Correctly rejected invalid user ID")
                else:
                    self.log_test("Invalid User ID Handling", False, f"Expected 400, got {response.status}")
        except Exception as e:
            self.log_test("Invalid User ID Handling", False, f"Exception: {str(e)}")

    async def test_ai_route_planning(self):
        """Test AI route planning with Gemini integration"""
        route_request = {
            "start": {
                "latitude": 40.7128,
                "longitude": -74.0060,
                "name": "New York City"
            },
            "end": {
                "latitude": 34.0522,
                "longitude": -118.2437,
                "name": "Los Angeles"
            },
            "preferences": {
                "budget": "medium",
                "interests": ["food", "nature", "culture"]
            }
        }

        try:
            async with self.session.post(f"{BACKEND_URL}/routes/plan", json=route_request) as response:
                if response.status == 200:
                    data = await response.json()
                    if "routes" in data and "explanation" in data and len(data["routes"]) > 0:
                        # Check if we have the expected route types
                        route_types = [route.get("type") for route in data["routes"]]
                        expected_types = ["fastest", "scenic", "cheapest"]
                        if all(rt in route_types for rt in expected_types):
                            self.log_test("AI Route Planning", True, f"Generated {len(data['routes'])} route options with AI explanation")
                        else:
                            self.log_test("AI Route Planning", False, f"Missing expected route types. Got: {route_types}")
                    else:
                        self.log_test("AI Route Planning", False, "Missing routes or explanation in response", data)
                else:
                    error_data = await response.text()
                    self.log_test("AI Route Planning", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("AI Route Planning", False, f"Exception: {str(e)}")

    async def test_save_route(self):
        """Test saving a planned route"""
        if not self.test_data["user_id"]:
            self.log_test("Save Route", False, "No user ID available")
            return

        route_data = {
            "user_id": self.test_data["user_id"],
            "start": {
                "latitude": 40.7128,
                "longitude": -74.0060,
                "name": "New York City"
            },
            "end": {
                "latitude": 34.0522,
                "longitude": -118.2437,
                "name": "Los Angeles"
            },
            "waypoints": [
                {
                    "latitude": 39.7392,
                    "longitude": -104.9903,
                    "name": "Denver"
                }
            ],
            "route_type": "scenic",
            "distance": 2445.5,
            "duration": 1800,
            "ai_description": "Beautiful cross-country route through the Rocky Mountains",
            "points_earned": 0,
            "completed": False
        }

        try:
            async with self.session.post(f"{BACKEND_URL}/routes", json=route_data) as response:
                if response.status == 200:
                    data = await response.json()
                    if "id" in data and data["user_id"] == self.test_data["user_id"]:
                        self.test_data["route_id"] = data["id"]
                        self.log_test("Save Route", True, f"Route saved with ID: {data['id']}")
                    else:
                        self.log_test("Save Route", False, "Missing ID or incorrect user_id in response", data)
                else:
                    error_data = await response.text()
                    self.log_test("Save Route", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Save Route", False, f"Exception: {str(e)}")

    async def test_get_user_routes(self):
        """Test getting user's routes"""
        if not self.test_data["user_id"]:
            self.log_test("Get User Routes", False, "No user ID available")
            return

        try:
            async with self.session.get(f"{BACKEND_URL}/routes/user/{self.test_data['user_id']}") as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list) and len(data) > 0:
                        # Check if our saved route is in the list
                        route_found = any(route.get("id") == self.test_data["route_id"] for route in data)
                        if route_found:
                            self.log_test("Get User Routes", True, f"Retrieved {len(data)} routes for user")
                        else:
                            self.log_test("Get User Routes", False, "Saved route not found in user routes")
                    else:
                        self.log_test("Get User Routes", False, "No routes returned or invalid format", data)
                else:
                    error_data = await response.text()
                    self.log_test("Get User Routes", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Get User Routes", False, f"Exception: {str(e)}")

    async def test_create_challenge(self):
        """Test creating a challenge for a route"""
        if not self.test_data["route_id"]:
            self.log_test("Create Challenge", False, "No route ID available")
            return

        challenge_data = {
            "route_id": self.test_data["route_id"],
            "type": "photo",
            "title": "Capture the Golden Gate",
            "description": "Take a photo of the Golden Gate Bridge from Crissy Field",
            "location": {
                "latitude": 37.8024,
                "longitude": -122.4662,
                "name": "Crissy Field"
            },
            "points": 25,
            "completed": False
        }

        try:
            async with self.session.post(f"{BACKEND_URL}/challenges", json=challenge_data) as response:
                if response.status == 200:
                    data = await response.json()
                    if "id" in data and data["route_id"] == self.test_data["route_id"]:
                        self.test_data["challenge_id"] = data["id"]
                        self.log_test("Create Challenge", True, f"Challenge created with ID: {data['id']}")
                    else:
                        self.log_test("Create Challenge", False, "Missing ID or incorrect route_id in response", data)
                else:
                    error_data = await response.text()
                    self.log_test("Create Challenge", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Create Challenge", False, f"Exception: {str(e)}")

    async def test_get_route_challenges(self):
        """Test getting challenges for a route"""
        if not self.test_data["route_id"]:
            self.log_test("Get Route Challenges", False, "No route ID available")
            return

        try:
            async with self.session.get(f"{BACKEND_URL}/challenges/route/{self.test_data['route_id']}") as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list) and len(data) > 0:
                        challenge_found = any(challenge.get("id") == self.test_data["challenge_id"] for challenge in data)
                        if challenge_found:
                            self.log_test("Get Route Challenges", True, f"Retrieved {len(data)} challenges for route")
                        else:
                            self.log_test("Get Route Challenges", False, "Created challenge not found in route challenges")
                    else:
                        self.log_test("Get Route Challenges", False, "No challenges returned or invalid format", data)
                else:
                    error_data = await response.text()
                    self.log_test("Get Route Challenges", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Get Route Challenges", False, f"Exception: {str(e)}")

    async def test_complete_challenge(self):
        """Test completing a challenge and awarding points"""
        if not self.test_data["challenge_id"] or not self.test_data["user_id"]:
            self.log_test("Complete Challenge", False, "Missing challenge ID or user ID")
            return

        try:
            url = f"{BACKEND_URL}/challenges/{self.test_data['challenge_id']}/complete?user_id={self.test_data['user_id']}"
            async with self.session.patch(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if "points_awarded" in data and data["points_awarded"] > 0:
                        self.log_test("Complete Challenge", True, f"Challenge completed, {data['points_awarded']} points awarded")
                    else:
                        self.log_test("Complete Challenge", False, "No points awarded or missing points_awarded field", data)
                else:
                    error_data = await response.text()
                    self.log_test("Complete Challenge", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Complete Challenge", False, f"Exception: {str(e)}")

    async def test_complete_route(self):
        """Test completing a route and awarding points"""
        if not self.test_data["route_id"] or not self.test_data["user_id"]:
            self.log_test("Complete Route", False, "Missing route ID or user ID")
            return

        try:
            url = f"{BACKEND_URL}/routes/{self.test_data['route_id']}/complete?user_id={self.test_data['user_id']}"
            async with self.session.patch(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if "points_awarded" in data and data["points_awarded"] > 0:
                        self.log_test("Complete Route", True, f"Route completed, {data['points_awarded']} points awarded")
                    else:
                        self.log_test("Complete Route", False, "No points awarded or missing points_awarded field", data)
                else:
                    error_data = await response.text()
                    self.log_test("Complete Route", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Complete Route", False, f"Exception: {str(e)}")

    async def test_ai_chat(self):
        """Test AI travel assistant chat"""
        try:
            chat_data = {
                "message": "What are the best places to visit in San Francisco for a first-time visitor?",
                "user_context": "Planning a 3-day trip to San Francisco"
            }
            
            async with self.session.post(f"{BACKEND_URL}/chat", json=chat_data) as response:
                if response.status == 200:
                    data = await response.json()
                    if "response" in data and len(data["response"]) > 50:  # Expect substantial response
                        self.log_test("AI Chat", True, "AI chat responded with travel advice")
                    else:
                        self.log_test("AI Chat", False, "AI response too short or missing", data)
                else:
                    error_data = await response.text()
                    self.log_test("AI Chat", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("AI Chat", False, f"Exception: {str(e)}")

    async def test_leaderboard(self):
        """Test leaderboard functionality"""
        try:
            async with self.session.get(f"{BACKEND_URL}/leaderboard") as response:
                if response.status == 200:
                    data = await response.json()
                    if isinstance(data, list):
                        # Check if our user appears in leaderboard (should have points from completed route/challenge)
                        user_found = any(user.get("id") == self.test_data["user_id"] for user in data)
                        if user_found:
                            user_data = next(user for user in data if user.get("id") == self.test_data["user_id"])
                            if user_data.get("total_points", 0) > 0:
                                self.log_test("Leaderboard", True, f"User found in leaderboard with {user_data['total_points']} points")
                            else:
                                self.log_test("Leaderboard", False, "User found but has no points")
                        else:
                            self.log_test("Leaderboard", True, f"Leaderboard returned {len(data)} users (test user may not be in top 10)")
                    else:
                        self.log_test("Leaderboard", False, "Leaderboard response is not a list", data)
                else:
                    error_data = await response.text()
                    self.log_test("Leaderboard", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("Leaderboard", False, f"Exception: {str(e)}")

    async def test_user_points_update(self):
        """Verify user points were updated after completing route and challenge"""
        if not self.test_data["user_id"]:
            self.log_test("User Points Update", False, "No user ID available")
            return

        try:
            async with self.session.get(f"{BACKEND_URL}/users/{self.test_data['user_id']}") as response:
                if response.status == 200:
                    data = await response.json()
                    total_points = data.get("total_points", 0)
                    routes_completed = data.get("routes_completed", 0)
                    badges = data.get("badges", [])
                    
                    if total_points >= 75:  # 50 from route + 25 from challenge
                        self.log_test("User Points Update", True, f"User has {total_points} points, {routes_completed} routes completed, badges: {badges}")
                    else:
                        self.log_test("User Points Update", False, f"Expected at least 75 points, got {total_points}")
                else:
                    error_data = await response.text()
                    self.log_test("User Points Update", False, f"HTTP {response.status}: {error_data}")
        except Exception as e:
            self.log_test("User Points Update", False, f"Exception: {str(e)}")

    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Comprehensive Backend API Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)

        await self.setup_session()
        
        try:
            # Core API tests
            await self.test_health_check()
            
            # User management tests
            await self.test_create_user()
            await self.test_get_user()
            await self.test_invalid_user_id()
            
            # AI route planning tests
            await self.test_ai_route_planning()
            
            # Route management tests
            await self.test_save_route()
            await self.test_get_user_routes()
            
            # Challenge system tests
            await self.test_create_challenge()
            await self.test_get_route_challenges()
            await self.test_complete_challenge()
            
            # Route completion test
            await self.test_complete_route()
            
            # AI chat test
            await self.test_ai_chat()
            
            # Leaderboard test
            await self.test_leaderboard()
            
            # Verify gamification mechanics
            await self.test_user_points_update()
            
        finally:
            await self.cleanup_session()

        # Print summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        print(f"📈 Success Rate: {(self.test_results['passed'] / (self.test_results['passed'] + self.test_results['failed']) * 100):.1f}%")
        
        if self.test_results['errors']:
            print("\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        return self.test_results['failed'] == 0

async def main():
    """Main test runner"""
    tester = TravelAppTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Backend is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {tester.test_results['failed']} tests failed. Check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())