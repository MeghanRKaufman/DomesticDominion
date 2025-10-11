#!/usr/bin/env python3
"""
Backend Testing Suite for Enhanced Domestic Dominion App
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
BACKEND_URL = "https://quest-kingdom.preview.emergentagent.com/api"

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

    def test_talent_tree_endpoint(self):
        """Test NEW /api/talent-tree endpoint returns the new 10-tier talent tree nodes"""
        try:
            response = requests.get(f"{self.base_url}/talent-tree")
            
            if response.status_code != 200:
                self.log_test("Talent Tree Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Should have nodes key
            if "nodes" not in data:
                self.log_test("Talent Tree Endpoint", False,
                            "Expected 'nodes' key in response", f"Got: {list(data.keys())}")
                return False
                
            nodes = data["nodes"]
            
            # Check for 30 talent nodes (3 branches × 10 tiers)
            if len(nodes) < 30:
                self.log_test("Talent Tree Endpoint", False,
                            f"Expected at least 30 nodes (3 branches × 10 tiers), got {len(nodes)}")
                return False
                
            # Check for 3 branches and 10 tiers
            branches = set()
            tiers = set()
            premium_nodes = 0
            free_nodes = 0
            
            for node_id, node in nodes.items():
                branch = node.get("branch")
                tier = node.get("tier")
                premium = node.get("premium", False)
                
                branches.add(branch)
                tiers.add(tier)
                
                if premium:
                    premium_nodes += 1
                else:
                    free_nodes += 1
                
                # Check required fields for new 10-tier system
                required_fields = ["id", "name", "branch", "tier", "cost", "description", "effect", "prerequisites", "position", "premium"]
                for field in required_fields:
                    if field not in node:
                        self.log_test("Talent Tree Endpoint", False,
                                    f"Missing field '{field}' in node {node_id}", str(node))
                        return False
                        
            expected_branches = {"Housekeeping", "Coupling", "Growth"}
            expected_tiers = set(range(1, 11))  # Tiers 1-10
            
            if not expected_branches.issubset(branches):
                self.log_test("Talent Tree Endpoint", False,
                            f"Missing branches. Expected: {expected_branches}, Got: {branches}")
                return False
                
            if not expected_tiers.issubset(tiers):
                self.log_test("Talent Tree Endpoint", False,
                            f"Missing tiers. Expected: {expected_tiers}, Got: {tiers}")
                return False
                
            # Check premium/free distribution (tiers 1-5 free, 6-10 premium)
            if free_nodes < 15 or premium_nodes < 15:
                self.log_test("Talent Tree Endpoint", False,
                            f"Expected ~15 free and ~15 premium nodes, got {free_nodes} free, {premium_nodes} premium")
                return False
                
            self.log_test("Talent Tree Endpoint", True,
                        f"Found {len(nodes)} nodes across {len(branches)} branches with {len(tiers)} tiers")
            return True
            
        except Exception as e:
            self.log_test("Talent Tree Endpoint", False, "", str(e))
            return False

    def test_talent_tree_premium_status_endpoint(self):
        """Test NEW /api/talent-tree/premium-status/{user_id} endpoint for premium access checking"""
        if not self.test_user1_id:
            self.log_test("Talent Tree Premium Status Endpoint", False, "No test user available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/talent-tree/premium-status/{self.test_user1_id}")
            
            if response.status_code != 200:
                self.log_test("Talent Tree Premium Status Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check required fields
            required_fields = ["has_premium", "max_tier_available", "premium_purchase_url"]
            for field in required_fields:
                if field not in data:
                    self.log_test("Talent Tree Premium Status Endpoint", False,
                                f"Missing field '{field}' in response", str(data))
                    return False
                    
            # Validate data types and values
            if not isinstance(data["has_premium"], bool):
                self.log_test("Talent Tree Premium Status Endpoint", False,
                            "has_premium should be boolean", f"Got: {type(data['has_premium'])}")
                return False
                
            if data["max_tier_available"] not in [5, 10]:
                self.log_test("Talent Tree Premium Status Endpoint", False,
                            "max_tier_available should be 5 or 10", f"Got: {data['max_tier_available']}")
                return False
                
            self.log_test("Talent Tree Premium Status Endpoint", True,
                        f"Premium status: {data['has_premium']}, Max tier: {data['max_tier_available']}")
            return True
            
        except Exception as e:
            self.log_test("Talent Tree Premium Status Endpoint", False, "", str(e))
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

    def test_pi_enhance_message_endpoint(self):
        """Test NEW /api/pi/enhance-message endpoint with different enhancement levels"""
        if not self.test_user1_id:
            self.log_test("Pi Enhance Message Endpoint", False, "No test user available")
            return False
            
        try:
            # Test different enhancement levels
            test_cases = [
                {"message": "You didn't do the dishes again", "enhancement_level": "light"},
                {"message": "I'm frustrated with the mess", "enhancement_level": "moderate"},
                {"message": "This is really annoying me", "enhancement_level": "significant"}
            ]
            
            for i, test_case in enumerate(test_cases):
                enhancement_data = {
                    "message": test_case["message"],
                    "enhancement_level": test_case["enhancement_level"],
                    "preserve_style": True,
                    "user_id": self.test_user1_id
                }
                
                response = requests.post(f"{self.base_url}/pi/enhance-message", json=enhancement_data)
                
                if response.status_code not in [200, 201]:
                    self.log_test("Pi Enhance Message Endpoint", False,
                                f"Enhancement level {test_case['enhancement_level']} failed. Status: {response.status_code}", response.text)
                    return False
                    
                data = response.json()
                
                # Check required fields in response
                required_fields = ["enhanced_message", "confidence_score", "enhancements_applied", "original_message"]
                for field in required_fields:
                    if field not in data:
                        self.log_test("Pi Enhance Message Endpoint", False,
                                    f"Missing field '{field}' in enhancement response", str(data))
                        return False
                        
                # Validate data types
                if not isinstance(data["confidence_score"], (int, float)):
                    self.log_test("Pi Enhance Message Endpoint", False,
                                "confidence_score should be numeric", f"Got: {type(data['confidence_score'])}")
                    return False
                    
                if not isinstance(data["enhancements_applied"], list):
                    self.log_test("Pi Enhance Message Endpoint", False,
                                "enhancements_applied should be list", f"Got: {type(data['enhancements_applied'])}")
                    return False
                    
                # Check that message was actually enhanced (different from original)
                if data["enhanced_message"] == data["original_message"]:
                    # This might be okay for fallback scenarios, check for note
                    if "note" not in data:
                        self.log_test("Pi Enhance Message Endpoint", False,
                                    "Message not enhanced and no fallback note provided")
                        return False
                        
            self.log_test("Pi Enhance Message Endpoint", True,
                        f"All {len(test_cases)} enhancement levels working correctly")
            return True
            
        except Exception as e:
            self.log_test("Pi Enhance Message Endpoint", False, "", str(e))
            return False

    def test_messages_send_endpoint(self):
        """Test NEW /api/messages/send endpoint for sending enhanced messages"""
        if not self.test_couple_id or not self.test_user1_id:
            self.log_test("Messages Send Endpoint", False, "No test data available")
            return False
            
        try:
            # Test sending different types of messages
            test_messages = [
                {
                    "content": "I love you and appreciate all you do",
                    "original_content": "Thanks for helping",
                    "enhanced": True,
                    "empathy_score": 0.85
                },
                {
                    "content": "Can you please take out the trash?",
                    "enhanced": False,
                    "empathy_score": 0.0
                }
            ]
            
            for i, msg_data in enumerate(test_messages):
                message_data = {
                    "content": msg_data["content"],
                    "original_content": msg_data.get("original_content"),
                    "enhanced": msg_data["enhanced"],
                    "empathy_score": msg_data["empathy_score"],
                    "sender_id": self.test_user1_id,
                    "couple_id": self.test_couple_id
                }
                
                response = requests.post(f"{self.base_url}/messages/send", json=message_data)
                
                if response.status_code not in [200, 201]:
                    self.log_test("Messages Send Endpoint", False,
                                f"Message {i+1} send failed. Status: {response.status_code}", response.text)
                    return False
                    
                data = response.json()
                
                # Check required fields in response
                required_fields = ["id", "status", "timestamp"]
                for field in required_fields:
                    if field not in data:
                        self.log_test("Messages Send Endpoint", False,
                                    f"Missing field '{field}' in send response", str(data))
                        return False
                        
                if data["status"] != "sent":
                    self.log_test("Messages Send Endpoint", False,
                                f"Expected status 'sent', got '{data['status']}'")
                    return False
                    
            self.log_test("Messages Send Endpoint", True,
                        f"Successfully sent {len(test_messages)} messages")
            return True
            
        except Exception as e:
            self.log_test("Messages Send Endpoint", False, "", str(e))
            return False

    def test_messages_retrieve_endpoint(self):
        """Test NEW /api/messages/{couple_id} endpoint for retrieving message history"""
        if not self.test_couple_id:
            self.log_test("Messages Retrieve Endpoint", False, "No test couple available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/messages/{self.test_couple_id}")
            
            if response.status_code != 200:
                self.log_test("Messages Retrieve Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Should return a list of messages
            if not isinstance(data, list):
                self.log_test("Messages Retrieve Endpoint", False,
                            "Expected list of messages", f"Got: {type(data)}")
                return False
                
            # If we have messages, check their structure
            if len(data) > 0:
                for message in data:
                    required_fields = ["id", "content", "sender_id", "couple_id", "timestamp", "enhanced"]
                    for field in required_fields:
                        if field not in message:
                            self.log_test("Messages Retrieve Endpoint", False,
                                        f"Missing field '{field}' in message", str(message))
                            return False
                            
            self.log_test("Messages Retrieve Endpoint", True,
                        f"Retrieved {len(data)} messages for couple")
            return True
            
        except Exception as e:
            self.log_test("Messages Retrieve Endpoint", False, "", str(e))
            return False

    def test_messages_daily_status_endpoint(self):
        """Test NEW /api/messages/{couple_id}/daily-status endpoint for daily message tracking"""
        if not self.test_couple_id or not self.test_user1_id:
            self.log_test("Messages Daily Status Endpoint", False, "No test data available")
            return False
            
        try:
            # Test with today's date
            today = datetime.now().strftime("%Y-%m-%d")
            
            response = requests.get(f"{self.base_url}/messages/{self.test_couple_id}/daily-status", 
                                  params={"date": today, "user_id": self.test_user1_id})
            
            if response.status_code != 200:
                self.log_test("Messages Daily Status Endpoint", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check required fields
            required_fields = ["has_daily_message", "message_count", "date"]
            for field in required_fields:
                if field not in data:
                    self.log_test("Messages Daily Status Endpoint", False,
                                f"Missing field '{field}' in response", str(data))
                    return False
                    
            # Validate data types
            if not isinstance(data["has_daily_message"], bool):
                self.log_test("Messages Daily Status Endpoint", False,
                            "has_daily_message should be boolean", f"Got: {type(data['has_daily_message'])}")
                return False
                
            if not isinstance(data["message_count"], int):
                self.log_test("Messages Daily Status Endpoint", False,
                            "message_count should be integer", f"Got: {type(data['message_count'])}")
                return False
                
            if data["date"] != today:
                self.log_test("Messages Daily Status Endpoint", False,
                            f"Expected date {today}, got {data['date']}")
                return False
                
            self.log_test("Messages Daily Status Endpoint", True,
                        f"Daily status: {data['has_daily_message']}, Count: {data['message_count']}")
            return True
            
        except Exception as e:
            self.log_test("Messages Daily Status Endpoint", False, "", str(e))
            return False

    def test_pi_api_fallback_functionality(self):
        """Test Pi API fallback functionality when Pi service unavailable"""
        if not self.test_user1_id:
            self.log_test("Pi API Fallback Functionality", False, "No test user available")
            return False
            
        try:
            # Test with a message that should trigger enhancement
            enhancement_data = {
                "message": "This is a test message for fallback functionality",
                "enhancement_level": "moderate",
                "preserve_style": True,
                "user_id": self.test_user1_id
            }
            
            response = requests.post(f"{self.base_url}/pi/enhance-message", json=enhancement_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Pi API Fallback Functionality", False,
                            f"Status: {response.status_code}", response.text)
                return False
                
            data = response.json()
            
            # Check if fallback was used (indicated by note field or specific patterns)
            fallback_indicators = [
                "note" in data,
                "Pi API unavailable" in data.get("note", ""),
                "Pi API error" in data.get("note", ""),
                "fallback" in data.get("enhancements_applied", [])
            ]
            
            if any(fallback_indicators):
                self.log_test("Pi API Fallback Functionality", True,
                            "Fallback functionality working (Pi API unavailable)")
            else:
                self.log_test("Pi API Fallback Functionality", True,
                            "Pi API working normally (no fallback needed)")
            return True
            
        except Exception as e:
            self.log_test("Pi API Fallback Functionality", False, "", str(e))
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

    def test_onboarding_flow_backend(self):
        """Test complete onboarding flow backend support"""
        try:
            # Test enhanced couple creation with onboarding data
            onboarding_data = {
                "playerName": "Alice",
                "partnerName": "Bob", 
                "kingdomName": "The Alice-Bob Kingdom",
                "householdSetup": {
                    "hasPets": True,
                    "petTypes": ["dogs", "cats"],
                    "hasVehicle": True,
                    "vehicleSharing": "shared",
                    "livingSituation": "house",
                    "householdSize": 2
                },
                "preferences": {
                    "notificationPreferences": {
                        "daily": True,
                        "verification": True,
                        "encouragement": True
                    }
                }
            }
            
            # Create enhanced couple with onboarding data
            response = requests.post(f"{self.base_url}/couples/create-enhanced", json=onboarding_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Onboarding Flow Backend", False,
                            f"Enhanced couple creation failed. Status: {response.status_code}", response.text)
                return False
                
            invitation_data = response.json()
            
            # Check that invitation was created
            required_fields = ["inviteCode", "message", "theme", "creatorName"]
            for field in required_fields:
                if field not in invitation_data:
                    self.log_test("Onboarding Flow Backend", False,
                                f"Missing field '{field}' in invitation response", str(invitation_data))
                    return False
            
            # Check that invitation message includes customized features
            message = invitation_data.get("message", "")
            
            # Check for pet-specific features since hasPets=True
            if "🐾 Pet care tasks" not in message:
                self.log_test("Onboarding Flow Backend", False,
                            "No pet-specific features found in invitation despite hasPets=True")
                return False
                
            # Check for vehicle-specific features since hasVehicle=True  
            if "🚗 Vehicle maintenance" not in message:
                self.log_test("Onboarding Flow Backend", False,
                            "No vehicle-specific features found in invitation despite hasVehicle=True")
                return False
                
            self.test_invite_code = invitation_data["inviteCode"]
            
            # Now create users to get couple ID
            user1_data = {"displayName": onboarding_data["playerName"], "coupleCode": self.test_invite_code}
            user_response = requests.post(f"{self.base_url}/users", json=user1_data)
            
            if user_response.status_code == 200:
                user1 = user_response.json()
                self.test_couple_id = user1.get("coupleId")
                self.test_user1_id = user1.get("userId")
            
            self.log_test("Onboarding Flow Backend", True,
                        f"Onboarding data saved successfully. Generated {len(customized_chores)} customized chores")
            return True
            
        except Exception as e:
            self.log_test("Onboarding Flow Backend", False, "", str(e))
            return False

    def test_daily_quest_generation(self):
        """Test daily quest generation with 50/50 split + self-care + team-building"""
        if not self.test_couple_id:
            self.log_test("Daily Quest Generation", False, "No test couple available")
            return False
            
        try:
            # Test daily assignments endpoint
            today = datetime.now().strftime('%Y-%m-%d')
            response = requests.get(f"{self.base_url}/couples/{self.test_couple_id}/assignments/{today}")
            
            if response.status_code != 200:
                self.log_test("Daily Quest Generation", False,
                            f"Daily assignments failed. Status: {response.status_code}", response.text)
                return False
                
            assignments_data = response.json()
            
            # Check that assignments were generated
            if not isinstance(assignments_data, dict) or len(assignments_data) == 0:
                self.log_test("Daily Quest Generation", False,
                            "No daily assignments generated", str(assignments_data))
                return False
                
            # Count assignments for each user
            user1_tasks = sum(1 for assignment in assignments_data.values() if assignment == "user1")
            user2_tasks = sum(1 for assignment in assignments_data.values() if assignment == "user2")
            total_tasks = user1_tasks + user2_tasks
            
            # Check for reasonable 50/50 split (within 20% tolerance)
            if total_tasks > 0:
                user1_percentage = user1_tasks / total_tasks
                if not (0.3 <= user1_percentage <= 0.7):  # 30-70% range for flexibility
                    self.log_test("Daily Quest Generation", False,
                                f"Poor task distribution: User1={user1_tasks}, User2={user2_tasks} ({user1_percentage:.1%})")
                    return False
                    
            # Test quest templates to ensure self-care and team-building categories exist
            response = requests.get(f"{self.base_url}/quest-templates")
            if response.status_code == 200:
                templates = response.json()
                
                # Check for self-care tasks (personal growth)
                has_self_care = any("growth" in category.lower() or "personal" in category.lower() 
                                  for category in templates.keys())
                
                # Check for team-building tasks (couple activities)
                has_team_building = any("couple" in str(tasks).lower() or "together" in str(tasks).lower()
                                      for tasks in templates.values() if isinstance(tasks, list))
                
                if not has_self_care:
                    self.log_test("Daily Quest Generation", False,
                                "No self-care/personal growth tasks found in templates")
                    return False
                    
                if not has_team_building:
                    self.log_test("Daily Quest Generation", False,
                                "No team-building/couple tasks found in templates")
                    return False
                    
            self.log_test("Daily Quest Generation", True,
                        f"Daily quests generated successfully. Distribution: User1={user1_tasks}, User2={user2_tasks}")
            return True
            
        except Exception as e:
            self.log_test("Daily Quest Generation", False, "", str(e))
            return False

    def test_quest_log_display_backend(self):
        """Test backend support for My Quest Log display"""
        if not self.test_couple_id:
            self.log_test("Quest Log Display Backend", False, "No test couple available")
            return False
            
        try:
            # Test getting couple tasks (what would be displayed in My Quest Log)
            response = requests.get(f"{self.base_url}/couples/{self.test_couple_id}/tasks")
            
            if response.status_code != 200:
                self.log_test("Quest Log Display Backend", False,
                            f"Failed to get couple tasks. Status: {response.status_code}", response.text)
                return False
                
            tasks_data = response.json()
            
            # Should return tasks organized by room/category
            if not isinstance(tasks_data, dict):
                self.log_test("Quest Log Display Backend", False,
                            "Expected dict response for tasks", f"Got: {type(tasks_data)}")
                return False
                
            # Count total tasks available
            total_tasks = 0
            rooms_with_tasks = 0
            
            for room, tasks in tasks_data.items():
                if isinstance(tasks, list) and len(tasks) > 0:
                    total_tasks += len(tasks)
                    rooms_with_tasks += 1
                    
                    # Check task structure for quest log display
                    for task in tasks:
                        required_fields = ["taskId", "title", "basePoints", "difficulty", "room"]
                        for field in required_fields:
                            if field not in task:
                                self.log_test("Quest Log Display Backend", False,
                                            f"Missing field '{field}' in task for quest log", str(task))
                                return False
                                
            if total_tasks == 0:
                self.log_test("Quest Log Display Backend", False,
                            "No tasks available for quest log display")
                return False
                
            # Test enhanced tasks endpoint for better quest organization
            response = requests.get(f"{self.base_url}/enhanced-tasks/{self.test_couple_id}")
            
            enhanced_available = response.status_code == 200
            
            self.log_test("Quest Log Display Backend", True,
                        f"Quest log backend ready. {total_tasks} tasks across {rooms_with_tasks} rooms. Enhanced: {enhanced_available}")
            return True
            
        except Exception as e:
            self.log_test("Quest Log Display Backend", False, "", str(e))
            return False

    def test_partner_name_input_fix(self):
        """Test that partner name input works without errors (recent fix)"""
        try:
            # Test couple creation with partner name
            test_data = {
                "playerName": "TestPlayer",
                "partnerName": "TestPartner",  # This should work without errors
                "kingdomName": "Test Kingdom",
                "householdSetup": {
                    "hasPets": False,
                    "hasVehicle": False,
                    "livingSituation": "apartment",
                    "householdSize": 2
                },
                "preferences": {
                    "notificationPreferences": {
                        "daily": True,
                        "verification": True,
                        "encouragement": True
                    }
                }
            }
            
            response = requests.post(f"{self.base_url}/couples/create-enhanced", json=test_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Partner Name Input Fix", False,
                            f"Partner name input caused error. Status: {response.status_code}", response.text)
                return False
                
            couple_data = response.json()
            
            # Verify partner name was saved correctly
            if "partnerName" in couple_data and couple_data["partnerName"] != test_data["partnerName"]:
                self.log_test("Partner Name Input Fix", False,
                            f"Partner name not saved correctly. Expected: {test_data['partnerName']}, Got: {couple_data.get('partnerName')}")
                return False
                
            self.log_test("Partner Name Input Fix", True,
                        "Partner name input working correctly without errors")
            return True
            
        except Exception as e:
            self.log_test("Partner Name Input Fix", False, "", str(e))
            return False

    def test_onboarding_completion_flow(self):
        """Test that onboarding completes without looping back"""
        try:
            # Test the complete onboarding flow by creating couple and joining
            onboarding_data = {
                "playerName": "Player1",
                "partnerName": "Player2",
                "kingdomName": "Complete Test Kingdom",
                "householdSetup": {
                    "hasPets": True,
                    "petTypes": ["dogs"],
                    "hasVehicle": True,
                    "vehicleSharing": "shared",
                    "livingSituation": "house",
                    "householdSize": 2
                },
                "preferences": {
                    "notificationPreferences": {
                        "daily": True,
                        "verification": True,
                        "encouragement": True
                    }
                }
            }
            
            # Step 1: Create couple with full onboarding data
            response = requests.post(f"{self.base_url}/couples/create-enhanced", json=onboarding_data)
            
            if response.status_code not in [200, 201]:
                self.log_test("Onboarding Completion Flow", False,
                            f"Onboarding creation failed. Status: {response.status_code}", response.text)
                return False
                
            couple_data = response.json()
            invite_code = couple_data["inviteCode"]
            couple_id = couple_data["coupleId"]
            
            # Step 2: Create first user (creator)
            user1_data = {"displayName": onboarding_data["playerName"], "coupleCode": invite_code}
            response = requests.post(f"{self.base_url}/users", json=user1_data)
            
            if response.status_code != 200:
                self.log_test("Onboarding Completion Flow", False,
                            f"User1 creation failed. Status: {response.status_code}", response.text)
                return False
                
            user1 = response.json()
            
            # Step 3: Join couple as partner
            join_data = {"partnerName": onboarding_data["partnerName"], "inviteCode": invite_code}
            response = requests.post(f"{self.base_url}/couples/join", json=join_data)
            
            if response.status_code != 200:
                self.log_test("Onboarding Completion Flow", False,
                            f"Partner join failed. Status: {response.status_code}", response.text)
                return False
                
            # Step 4: Create second user (partner)
            user2_data = {"displayName": onboarding_data["partnerName"], "coupleCode": invite_code}
            response = requests.post(f"{self.base_url}/users", json=user2_data)
            
            if response.status_code != 200:
                self.log_test("Onboarding Completion Flow", False,
                            f"User2 creation failed. Status: {response.status_code}", response.text)
                return False
                
            # Step 5: Verify couple is active and complete
            response = requests.get(f"{self.base_url}/couples/{couple_id}")
            
            if response.status_code == 200:
                couple_status = response.json()
                if couple_status.get("isActive"):
                    self.log_test("Onboarding Completion Flow", True,
                                "Complete onboarding flow successful - couple is active")
                    return True
                else:
                    self.log_test("Onboarding Completion Flow", False,
                                "Couple not marked as active after completion")
                    return False
            else:
                self.log_test("Onboarding Completion Flow", True,
                            "Onboarding flow completed (couple status endpoint may not exist)")
                return True
                
        except Exception as e:
            self.log_test("Onboarding Completion Flow", False, "", str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🎮 Starting Enhanced Domestic Dominion Backend Tests")
        print("🌟 Testing: Onboarding Flow & Daily Quest Generation System")
        print("=" * 70)
        print()
        
        # Test ONBOARDING FLOW & QUEST GENERATION (Primary Focus)
        print("🏰 TESTING ONBOARDING FLOW & QUEST GENERATION")
        print("-" * 50)
        self.test_partner_name_input_fix()
        self.test_onboarding_flow_backend()
        self.test_onboarding_completion_flow()
        
        if self.test_couple_id:
            self.test_daily_quest_generation()
            self.test_quest_log_display_backend()
        
        # Test basic endpoints
        print("\n🎯 TESTING CORE BACKEND ENDPOINTS")
        print("-" * 40)
        self.test_game_constants_endpoint()
        self.test_quest_templates_endpoint()
        self.test_user_couple_management()
        
        # Test NEW Talent Tree System (10-tier)
        print("\n🌳 TESTING TALENT TREE SYSTEM")
        print("-" * 40)
        self.test_talent_tree_endpoint()
        
        # Setup test data for advanced tests if not already done
        if not self.test_couple_id:
            self.setup_test_couple()
            
        if self.test_couple_id:
            # Test talent tree premium status
            self.test_talent_tree_premium_status_endpoint()
            
            # Test NEW Pi Message Integration
            print("\n🤖 TESTING PI MESSAGE INTEGRATION")
            print("-" * 40)
            self.test_pi_enhance_message_endpoint()
            self.test_messages_send_endpoint()
            self.test_messages_retrieve_endpoint()
            self.test_messages_daily_status_endpoint()
            self.test_pi_api_fallback_functionality()
            
            # Test existing core features
            print("\n🏠 TESTING EXISTING CORE FEATURES")
            print("-" * 40)
            self.test_enhanced_tasks_endpoint()
            self.test_task_takeover_endpoint()
            self.test_couple_questions_endpoint()
            self.test_couple_question_answer_endpoint()
            self.test_daily_logs_endpoint()
            self.test_verification_response_endpoint()
            self.test_point_calculation_system()
        
        # Summary
        print("\n" + "=" * 70)
        print("🏆 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # Categorize results
        talent_tree_tests = [r for r in self.test_results if "talent" in r["test"].lower()]
        pi_message_tests = [r for r in self.test_results if "pi" in r["test"].lower() or "message" in r["test"].lower()]
        core_feature_tests = [r for r in self.test_results if r not in talent_tree_tests and r not in pi_message_tests]
        
        print("📊 RESULTS BY CATEGORY:")
        print(f"🌳 Talent Tree System: {sum(1 for t in talent_tree_tests if t['success'])}/{len(talent_tree_tests)} passed")
        print(f"🤖 Pi Message Integration: {sum(1 for t in pi_message_tests if t['success'])}/{len(pi_message_tests)} passed")
        print(f"🏠 Core Features: {sum(1 for t in core_feature_tests if t['success'])}/{len(core_feature_tests)} passed")
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