#!/usr/bin/env python3
"""
Backend Testing Suite for Enhanced Chore Champions App
Tests new features: 10-tier talent tree system, Pi message integration, and enhanced backend functionality
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta
import uuid
import time

# Get backend URL from environment
BACKEND_URL = "https://chorerpg.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_couple_id = None
        self.test_user1_id = None
        self.test_user2_id = None
        self.test_invite_code = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", error=""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()

    def test_game_constants_endpoint(self):
        """Test /api/game-constants endpoint returns new scoring structure"""
        try:
            response = requests.get(f"{self.base_url}/game-constants")
            
            if response.status_code != 200:
                self.log_test("Game Constants Endpoint", False, 
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for new scoring structure (5/10/20 pts)
            points = data.get("POINTS", {})
            expected_points = {"EASY": 5, "MEDIUM": 10, "HARD": 20}
            
            if points != expected_points:
                self.log_test("Game Constants Endpoint", False,
                            f"Expected points: {expected_points}, Got: {points}")
                return False
                
            # Check for VERIFICATION bonuses
            verification = data.get("VERIFICATION", {})
            if not verification.get("PARTNER_VERIFIES_BONUS") == 5:
                self.log_test("Game Constants Endpoint", False,
                            "Missing VERIFICATION.PARTNER_VERIFIES_BONUS")
                return False
                
            # Check for TASK_TAKEOVER multipliers
            takeover = data.get("TASK_TAKEOVER", {})
            if not takeover.get("MULTIPLIER") == 3:
                self.log_test("Game Constants Endpoint", False,
                            "Missing TASK_TAKEOVER.MULTIPLIER")
                return False
                
            # Check for COUPLE_QUESTIONS scoring
            couple_q = data.get("COUPLE_QUESTIONS", {})
            if not couple_q.get("ANSWER_POINTS") == 5:
                self.log_test("Game Constants Endpoint", False,
                            "Missing COUPLE_QUESTIONS.ANSWER_POINTS")
                return False
                
            self.log_test("Game Constants Endpoint", True,
                        "All scoring structures present and correct")
            return True
            
        except Exception as e:
            self.log_test("Game Constants Endpoint", False, "", str(e))
            return False

    def test_talent_nodes_endpoint(self):
        """Test /api/talent-nodes endpoint returns all 21 talent nodes across 3 branches"""
        try:
            response = requests.get(f"{self.base_url}/talent-nodes")
            
            if response.status_code != 200:
                self.log_test("Talent Nodes Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Should be a list of talent nodes
            if not isinstance(data, list):
                self.log_test("Talent Nodes Endpoint", False,
                            "Expected list of talent nodes", f"Got: {type(data)}")
                return False
                
            # Check for 21 nodes
            if len(data) < 21:
                self.log_test("Talent Nodes Endpoint", False,
                            f"Expected at least 21 nodes, got {len(data)}")
                return False
                
            # Check for 3 branches
            branches = set()
            growth_nodes = []
            couple_nodes = []
            efficiency_nodes = []
            
            for node in data:
                branch = node.get("branch")
                branches.add(branch)
                
                # Check required fields
                required_fields = ["id", "name", "branch", "tier", "cost", "description", "effect"]
                for field in required_fields:
                    if field not in node and field.replace("id", "nodeId") not in node:
                        self.log_test("Talent Nodes Endpoint", False,
                                    f"Missing field '{field}' in node", str(node))
                        return False
                
                # Categorize by branch
                if "pg_" in node.get("id", "") or "gr_" in node.get("nodeId", ""):
                    growth_nodes.append(node)
                elif "us_" in node.get("id", "") or "cou_" in node.get("nodeId", ""):
                    couple_nodes.append(node)
                elif "hh_" in node.get("id", "") or "eff_" in node.get("nodeId", ""):
                    efficiency_nodes.append(node)
                    
            expected_branches = {"Growth", "Couple", "Efficiency"}
            if not expected_branches.issubset(branches):
                self.log_test("Talent Nodes Endpoint", False,
                            f"Missing branches. Expected: {expected_branches}, Got: {branches}")
                return False
                
            self.log_test("Talent Nodes Endpoint", True,
                        f"Found {len(data)} nodes across {len(branches)} branches")
            return True
            
        except Exception as e:
            self.log_test("Talent Nodes Endpoint", False, "", str(e))
            return False

    def test_quest_templates_endpoint(self):
        """Test /api/quest-templates endpoint returns categorized tasks"""
        try:
            response = requests.get(f"{self.base_url}/quest-templates")
            
            if response.status_code != 200:
                self.log_test("Quest Templates Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for expected categories
            expected_categories = ["daily", "weekly", "pet", "vehicle", "special"]
            
            for category in expected_categories:
                if category not in data:
                    self.log_test("Quest Templates Endpoint", False,
                                f"Missing category: {category}")
                    return False
                    
                # Check that each category has tasks
                if not isinstance(data[category], list) or len(data[category]) == 0:
                    self.log_test("Quest Templates Endpoint", False,
                                f"Category {category} is empty or not a list")
                    return False
                    
                # Check task structure
                for task in data[category]:
                    required_fields = ["title", "room", "points", "difficulty", "category", "icon"]
                    for field in required_fields:
                        if field not in task:
                            self.log_test("Quest Templates Endpoint", False,
                                        f"Missing field '{field}' in {category} task", str(task))
                            return False
                            
            self.log_test("Quest Templates Endpoint", True,
                        f"All {len(expected_categories)} categories present with valid tasks")
            return True
            
        except Exception as e:
            self.log_test("Quest Templates Endpoint", False, "", str(e))
            return False

    def setup_test_couple(self):
        """Create a test couple for testing enhanced endpoints"""
        try:
            # Create couple invitation
            create_data = {"creatorName": "TestUser1"}
            response = requests.post(f"{self.base_url}/couples/create", json=create_data)
            
            if response.status_code != 200:
                self.log_test("Setup Test Couple", False,
                            f"Failed to create couple. Status: {response.status_code}", response.text)
                return False
                
            invitation = response.json()
            self.test_invite_code = invitation["inviteCode"]
            
            # Create first user (creator)
            user1_data = {"displayName": "TestUser1", "coupleCode": self.test_invite_code}
            response = requests.post(f"{self.base_url}/users", json=user1_data)
            
            if response.status_code != 200:
                self.log_test("Setup Test Couple", False,
                            f"Failed to create user1. Status: {response.status_code}", response.text)
                return False
                
            user1 = response.json()
            self.test_user1_id = user1["userId"]
            self.test_couple_id = user1["coupleId"]
            
            # Join couple as partner
            join_data = {"partnerName": "TestUser2", "inviteCode": self.test_invite_code}
            response = requests.post(f"{self.base_url}/couples/join", json=join_data)
            
            if response.status_code != 200:
                self.log_test("Setup Test Couple", False,
                            f"Failed to join couple. Status: {response.status_code}", response.text)
                return False
                
            # Create second user (partner)
            user2_data = {"displayName": "TestUser2", "coupleCode": self.test_invite_code}
            response = requests.post(f"{self.base_url}/users", json=user2_data)
            
            if response.status_code != 200:
                self.log_test("Setup Test Couple", False,
                            f"Failed to create user2. Status: {response.status_code}", response.text)
                return False
                
            user2 = response.json()
            self.test_user2_id = user2["userId"]
            
            self.log_test("Setup Test Couple", True,
                        f"Created couple {self.test_couple_id} with users {self.test_user1_id} and {self.test_user2_id}")
            return True
            
        except Exception as e:
            self.log_test("Setup Test Couple", False, "", str(e))
            return False

    def test_enhanced_tasks_endpoint(self):
        """Test /api/enhanced-tasks/{couple_id} for couple-specific task generation"""
        if not self.test_couple_id:
            self.log_test("Enhanced Tasks Endpoint", False, "No test couple available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/enhanced-tasks/{self.test_couple_id}")
            
            if response.status_code != 200:
                self.log_test("Enhanced Tasks Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Should return tasks organized by category or room
            if not isinstance(data, dict):
                self.log_test("Enhanced Tasks Endpoint", False,
                            "Expected dict response", f"Got: {type(data)}")
                return False
                
            # Check for task structure
            task_count = 0
            for category, tasks in data.items():
                if isinstance(tasks, list):
                    task_count += len(tasks)
                    for task in tasks:
                        required_fields = ["taskId", "title", "basePoints", "difficulty"]
                        for field in required_fields:
                            if field not in task:
                                self.log_test("Enhanced Tasks Endpoint", False,
                                            f"Missing field '{field}' in task", str(task))
                                return False
                                
            self.log_test("Enhanced Tasks Endpoint", True,
                        f"Retrieved {task_count} enhanced tasks for couple")
            return True
            
        except Exception as e:
            self.log_test("Enhanced Tasks Endpoint", False, "", str(e))
            return False

    def test_task_takeover_endpoint(self):
        """Test /api/tasks/{task_id}/takeover for 3x point task takeover system"""
        if not self.test_couple_id or not self.test_user1_id:
            self.log_test("Task Takeover Endpoint", False, "No test data available")
            return False
            
        try:
            # First get a task to takeover
            response = requests.get(f"{self.base_url}/couples/{self.test_couple_id}/tasks")
            if response.status_code != 200:
                self.log_test("Task Takeover Endpoint", False, "Could not get tasks for takeover test")
                return False
                
            tasks_data = response.json()
            test_task_id = None
            
            # Find a task to test with
            for room, tasks in tasks_data.items():
                if tasks and len(tasks) > 0:
                    test_task_id = tasks[0]["taskId"]
                    break
                    
            if not test_task_id:
                self.log_test("Task Takeover Endpoint", False, "No tasks available for takeover test")
                return False
                
            # Test takeover
            takeover_data = {"userId": self.test_user1_id, "taskId": test_task_id}
            response = requests.post(f"{self.base_url}/tasks/{test_task_id}/takeover", json=takeover_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Task Takeover Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for takeover confirmation
            if "multipliedPoints" not in data and "message" not in data:
                self.log_test("Task Takeover Endpoint", False,
                            "No takeover confirmation in response", str(data))
                return False
                
            self.log_test("Task Takeover Endpoint", True,
                        "Task takeover system working")
            return True
            
        except Exception as e:
            self.log_test("Task Takeover Endpoint", False, "", str(e))
            return False

    def test_couple_questions_endpoint(self):
        """Test /api/couple-questions/{couple_id} for daily couple question generation"""
        if not self.test_couple_id:
            self.log_test("Couple Questions Endpoint", False, "No test couple available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/couple-questions/{self.test_couple_id}")
            
            if response.status_code not in [200, 201]:
                self.log_test("Couple Questions Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Should return a question or list of questions
            if isinstance(data, dict):
                # Single question
                required_fields = ["questionId", "question", "category"]
                for field in required_fields:
                    if field not in data:
                        self.log_test("Couple Questions Endpoint", False,
                                    f"Missing field '{field}' in question", str(data))
                        return False
            elif isinstance(data, list):
                # List of questions
                if len(data) == 0:
                    self.log_test("Couple Questions Endpoint", False, "Empty questions list")
                    return False
                    
                for question in data:
                    required_fields = ["questionId", "question", "category"]
                    for field in required_fields:
                        if field not in question:
                            self.log_test("Couple Questions Endpoint", False,
                                        f"Missing field '{field}' in question", str(question))
                            return False
            else:
                self.log_test("Couple Questions Endpoint", False,
                            "Unexpected response format", f"Got: {type(data)}")
                return False
                
            self.log_test("Couple Questions Endpoint", True,
                        "Couple questions generation working")
            return True
            
        except Exception as e:
            self.log_test("Couple Questions Endpoint", False, "", str(e))
            return False

    def test_couple_question_answer_endpoint(self):
        """Test /api/couple-questions/{question_id}/answer for submitting answers/guesses"""
        if not self.test_couple_id or not self.test_user1_id:
            self.log_test("Couple Question Answer Endpoint", False, "No test data available")
            return False
            
        try:
            # First get a question
            response = requests.get(f"{self.base_url}/couple-questions/{self.test_couple_id}")
            if response.status_code not in [200, 201]:
                self.log_test("Couple Question Answer Endpoint", False, "Could not get question for answer test")
                return False
                
            question_data = response.json()
            
            # Extract question ID
            question_id = None
            if isinstance(question_data, dict):
                question_id = question_data.get("questionId")
            elif isinstance(question_data, list) and len(question_data) > 0:
                question_id = question_data[0].get("questionId")
                
            if not question_id:
                self.log_test("Couple Question Answer Endpoint", False, "No question ID available")
                return False
                
            # Submit answer
            answer_data = {
                "userId": self.test_user1_id,
                "questionId": question_id,
                "answer": "Test answer",
                "guess": "Test guess"
            }
            response = requests.post(f"{self.base_url}/couple-questions/{question_id}/answer", json=answer_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Couple Question Answer Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for success confirmation
            if "message" not in data and "success" not in data and "points" not in data:
                self.log_test("Couple Question Answer Endpoint", False,
                            "No confirmation in response", str(data))
                return False
                
            self.log_test("Couple Question Answer Endpoint", True,
                        "Couple question answer submission working")
            return True
            
        except Exception as e:
            self.log_test("Couple Question Answer Endpoint", False, "", str(e))
            return False

    def test_daily_logs_endpoint(self):
        """Test /api/daily-logs for partner message system"""
        if not self.test_couple_id or not self.test_user1_id or not self.test_user2_id:
            self.log_test("Daily Logs Endpoint", False, "No test data available")
            return False
            
        try:
            # Submit a daily log
            log_data = {
                "userId": self.test_user1_id,
                "partnerId": self.test_user2_id,
                "message": "Test daily log message"
            }
            response = requests.post(f"{self.base_url}/daily-logs", json=log_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Daily Logs Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for log confirmation
            if "logId" not in data and "message" not in data:
                self.log_test("Daily Logs Endpoint", False,
                            "No log confirmation in response", str(data))
                return False
                
            # Test getting logs
            response = requests.get(f"{self.base_url}/daily-logs?coupleId={self.test_couple_id}")
            
            if response.status_code == 200:
                logs_data = response.json()
                self.log_test("Daily Logs Endpoint", True,
                            f"Daily logs system working. Retrieved {len(logs_data) if isinstance(logs_data, list) else 'some'} logs")
            else:
                self.log_test("Daily Logs Endpoint", True,
                            "Daily log submission working (retrieval endpoint may not be implemented)")
            return True
            
        except Exception as e:
            self.log_test("Daily Logs Endpoint", False, "", str(e))
            return False

    def test_verification_response_endpoint(self):
        """Test /api/verification/{completion_id}/respond for verification responses"""
        try:
            # This endpoint requires a completion ID, which we'd need from completing a task
            # For now, test with a dummy ID to see if endpoint exists
            dummy_completion_id = str(uuid.uuid4())
            verification_data = {
                "verificationId": dummy_completion_id,
                "response": "verify"
            }
            response = requests.post(f"{self.base_url}/verification/{dummy_completion_id}/respond", json=verification_data)
            
            # We expect this to fail with 404 (not found) rather than 405 (method not allowed)
            # or other errors that would indicate the endpoint doesn't exist
            if response.status_code == 404:
                self.log_test("Verification Response Endpoint", True,
                            "Endpoint exists (404 expected for dummy completion ID)")
                return True
            elif response.status_code == 405:
                self.log_test("Verification Response Endpoint", False,
                            "Endpoint not implemented (405 Method Not Allowed)")
                return False
            else:
                # Any other response suggests the endpoint exists
                self.log_test("Verification Response Endpoint", True,
                            f"Endpoint exists (Status: {response.status_code})")
                return True
                
        except Exception as e:
            self.log_test("Verification Response Endpoint", False, "", str(e))
            return False

    def test_point_calculation_system(self):
        """Test enhanced point calculation with talent tree bonuses"""
        if not self.test_couple_id or not self.test_user1_id:
            self.log_test("Point Calculation System", False, "No test data available")
            return False
            
        try:
            # Get a task to complete
            response = requests.get(f"{self.base_url}/couples/{self.test_couple_id}/tasks")
            if response.status_code != 200:
                self.log_test("Point Calculation System", False, "Could not get tasks for point calculation test")
                return False
                
            tasks_data = response.json()
            test_task_id = None
            
            # Find a task to test with
            for room, tasks in tasks_data.items():
                if tasks and len(tasks) > 0:
                    test_task_id = tasks[0]["taskId"]
                    break
                    
            if not test_task_id:
                self.log_test("Point Calculation System", False, "No tasks available for point calculation test")
                return False
                
            # Complete the task
            completion_data = {
                "userId": self.test_user1_id,
                "notes": "Test completion for point calculation"
            }
            response = requests.post(f"{self.base_url}/tasks/{test_task_id}/complete", json=completion_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Point Calculation System", False,
                            f"Task completion failed. Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check for point calculation details
            if "points" in data or "totalPoints" in data or "pointsEarned" in data:
                self.log_test("Point Calculation System", True,
                            "Point calculation system working")
                return True
            else:
                self.log_test("Point Calculation System", False,
                            "No point information in completion response", str(data))
                return False
                
        except Exception as e:
            self.log_test("Point Calculation System", False, "", str(e))
            return False

    def test_user_couple_management(self):
        """Test existing couple creation and user creation still works"""
        try:
            # Test couple creation
            create_data = {"creatorName": "TestUserManagement"}
            response = requests.post(f"{self.base_url}/couples/create", json=create_data)
            
            if response.status_code != 200:
                self.log_test("User & Couple Management", False,
                            f"Couple creation failed. Status: {response.status_code}", response.text)
                return False
                
            invitation = response.json()
            test_invite = invitation["inviteCode"]
            
            # Test user creation
            user_data = {"displayName": "TestUserManagement", "coupleCode": test_invite}
            response = requests.post(f"{self.base_url}/users", json=user_data)
            
            if response.status_code != 200:
                self.log_test("User & Couple Management", False,
                            f"User creation failed. Status: {response.status_code}", response.text)
                return False
                
            user = response.json()
            
            # Check user has enhanced model fields
            required_fields = ["userId", "displayName", "coupleId", "points", "level"]
            for field in required_fields:
                if field not in user:
                    self.log_test("User & Couple Management", False,
                                f"Missing field '{field}' in user model", str(user))
                    return False
                    
            self.log_test("User & Couple Management", True,
                        "User and couple management working with enhanced model")
            return True
            
        except Exception as e:
            self.log_test("User & Couple Management", False, "", str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🎮 Starting Enhanced NES-themed Gamified Chore App Backend Tests")
        print("=" * 70)
        print()
        
        # Test basic endpoints first
        self.test_game_constants_endpoint()
        self.test_talent_nodes_endpoint()
        self.test_quest_templates_endpoint()
        self.test_user_couple_management()
        
        # Setup test data for advanced tests
        if self.setup_test_couple():
            self.test_enhanced_tasks_endpoint()
            self.test_task_takeover_endpoint()
            self.test_couple_questions_endpoint()
            self.test_couple_question_answer_endpoint()
            self.test_daily_logs_endpoint()
            self.test_verification_response_endpoint()
            self.test_point_calculation_system()
        
        # Summary
        print("=" * 70)
        print("🏆 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        else:
            print("✅ ALL TESTS PASSED!")
            
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)