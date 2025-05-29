#!/usr/bin/env python3
"""
Test script for Room Code API endpoints
Tests the deployed Lambda functions through API Gateway
"""

import json
import requests
import time
from datetime import datetime

# API Gateway URL from CloudFormation output
API_BASE_URL = "https://3typ7gyorh.execute-api.ap-northeast-1.amazonaws.com/dev"

def test_create_room():
    """Test creating a new room"""
    print("🧪 Testing CREATE ROOM...")
    
    # Sample quiz configuration
    quiz_config = {
        "bookId": 1,
        "bookTitle": "N4 Vocabulary",
        "questionCount": 5,
        "lessonRange": {"start": 1, "end": 5},
        "enabledQuestionTypes": ["nepali_to_kanji", "kanji_to_nepali"]
    }
    
    # Sample quiz questions
    quiz_questions = [
        {
            "id": "q1",
            "type": "nepali_to_kanji",
            "questionText": "शौक",
            "correctAnswer": "趣味",
            "options": ["趣味", "勉強", "仕事", "遊び"]
        },
        {
            "id": "q2", 
            "type": "kanji_to_nepali",
            "questionText": "勉強",
            "correctAnswer": "अध्ययन",
            "options": ["अध्ययन", "काम", "खेल", "मनोरञ्जन"]
        }
    ]
    
    payload = {
        "config": quiz_config,
        "questions": quiz_questions,
        "createdBy": "test_teacher",
        "ttlHours": 24
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/room",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            room_code = result.get("roomCode")
            print(f"✅ Room created successfully! Room Code: {room_code}")
            return room_code
        else:
            print(f"❌ Failed to create room")
            return None
            
    except Exception as e:
        print(f"❌ Error creating room: {e}")
        return None

def test_get_room(room_code):
    """Test getting room by room code"""
    print(f"\n🧪 Testing GET ROOM with code: {room_code}")
    
    try:
        response = requests.get(f"{API_BASE_URL}/room/{room_code}")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            room = result.get("room")
            print(f"✅ Room retrieved successfully!")
            print(f"   Questions count: {len(room.get('questions', []))}")
            print(f"   Created by: {room.get('createdBy')}")
            print(f"   Created at: {room.get('createdAt')}")
            return True
        else:
            print(f"❌ Failed to get room")
            return False
            
    except Exception as e:
        print(f"❌ Error getting room: {e}")
        return False

def test_join_room(room_code, student_name):
    """Test joining a room"""
    print(f"\n🧪 Testing JOIN ROOM with student: {student_name}")
    
    payload = {"studentName": student_name}
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/room/{room_code}/join",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Successfully joined room!")
            print(f"   Students joined: {result.get('studentsJoined', [])}")
            return True
        else:
            print(f"❌ Failed to join room")
            return False
            
    except Exception as e:
        print(f"❌ Error joining room: {e}")
        return False

def test_get_room_stats(room_code):
    """Test getting room statistics"""
    print(f"\n🧪 Testing GET ROOM STATS")
    
    try:
        response = requests.get(f"{API_BASE_URL}/room/{room_code}/stats")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Room stats retrieved successfully!")
            print(f"   Students count: {result.get('studentsCount')}")
            print(f"   Students joined: {result.get('studentsJoined', [])}")
            return True
        else:
            print(f"❌ Failed to get room stats")
            return False
            
    except Exception as e:
        print(f"❌ Error getting room stats: {e}")
        return False

def test_delete_room(room_code):
    """Test deleting a room"""
    print(f"\n🧪 Testing DELETE ROOM")
    
    payload = {"createdBy": "test_teacher"}
    
    try:
        response = requests.delete(
            f"{API_BASE_URL}/room/{room_code}",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print(f"✅ Room deleted successfully!")
            return True
        else:
            print(f"❌ Failed to delete room")
            return False
            
    except Exception as e:
        print(f"❌ Error deleting room: {e}")
        return False

def test_invalid_room_code():
    """Test accessing non-existent room"""
    print(f"\n🧪 Testing INVALID ROOM CODE")
    
    try:
        response = requests.get(f"{API_BASE_URL}/room/INVALID")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print(f"✅ Correctly returned 404 for invalid room code")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing invalid room code: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Room Code API Tests")
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Test started at: {datetime.now()}")
    print("=" * 50)
    
    # Test 1: Create Room
    room_code = test_create_room()
    if not room_code:
        print("❌ Cannot continue tests without room code")
        return
    
    # Test 2: Get Room
    if not test_get_room(room_code):
        print("❌ Get room test failed")
    
    # Test 3: Join Room (multiple students)
    students = ["田中太郎", "佐藤花子", "山田次郎"]
    for student in students:
        test_join_room(room_code, student)
        time.sleep(1)  # Small delay between requests
    
    # Test 4: Get Room Stats
    if not test_get_room_stats(room_code):
        print("❌ Get room stats test failed")
    
    # Test 5: Invalid Room Code
    if not test_invalid_room_code():
        print("❌ Invalid room code test failed")
    
    # Test 6: Delete Room
    if not test_delete_room(room_code):
        print("❌ Delete room test failed")
    
    # Test 7: Verify room is deleted
    print(f"\n🧪 Testing room access after deletion")
    if not test_get_room(room_code):
        print("✅ Room correctly inaccessible after deletion")
    
    print("\n" + "=" * 50)
    print("🏁 Room Code API Tests Completed!")
    print(f"Test finished at: {datetime.now()}")

if __name__ == "__main__":
    main()