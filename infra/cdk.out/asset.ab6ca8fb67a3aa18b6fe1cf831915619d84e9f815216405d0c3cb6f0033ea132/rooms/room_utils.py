import json
import os
import boto3
import time
import random
import string
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ['QUIZ_ROOMS_TABLE']
table = dynamodb.Table(table_name)

def generate_room_code() -> str:
    """Generate a unique 6-character room code."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=6))
        # Check if code already exists
        try:
            response = table.get_item(Key={'roomCode': code})
            if 'Item' not in response:
                return code
        except Exception:
            return code

def calculate_ttl(hours: int = 24) -> int:
    """Calculate TTL timestamp for DynamoDB."""
    return int((datetime.utcnow() + timedelta(hours=hours)).timestamp())

def get_current_iso_time() -> str:
    """Get current time in ISO format."""
    return datetime.utcnow().isoformat() + 'Z'

def validate_room_code(room_code: str) -> bool:
    """Validate room code format."""
    return len(room_code) == 6 and room_code.isalnum() and room_code.isupper()

def create_response(status_code: int, body: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Create API Gateway response."""
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    if headers:
        default_headers.update(headers)
    
    return {
        'statusCode': status_code,
        'headers': default_headers,
        'body': json.dumps(body, ensure_ascii=False)
    }

def validate_quiz_config(config: Dict[str, Any]) -> bool:
    """Validate quiz configuration."""
    required_fields = ['bookId', 'questionCount', 'lessonRange', 'enabledQuestionTypes']
    
    if not all(field in config for field in required_fields):
        return False
    
    # Validate lesson range
    lesson_range = config.get('lessonRange', {})
    if not isinstance(lesson_range, dict) or 'start' not in lesson_range or 'end' not in lesson_range:
        return False
    
    # Validate question count
    question_count = config.get('questionCount')
    if not isinstance(question_count, int) or question_count <= 0:
        return False
    
    # Validate enabled question types
    enabled_types = config.get('enabledQuestionTypes')
    if not isinstance(enabled_types, list) or len(enabled_types) == 0:
        return False
    
    return True

def validate_questions(questions: List[Dict[str, Any]]) -> bool:
    """Validate quiz questions."""
    if not isinstance(questions, list) or len(questions) == 0:
        return False
    
    for question in questions:
        required_fields = ['id', 'type', 'questionText', 'correctAnswer', 'options']
        if not all(field in question for field in required_fields):
            return False
        
        # Validate options
        options = question.get('options', [])
        if not isinstance(options, list) or len(options) < 2:
            return False
        
        # Validate correct answer is in options
        correct_answer = question.get('correctAnswer')
        if correct_answer not in options:
            return False
    
    return True

def get_room_item(room_code: str) -> Optional[Dict[str, Any]]:
    """Get room item from DynamoDB."""
    try:
        response = table.get_item(Key={'roomCode': room_code})
        return response.get('Item')
    except Exception as e:
        print(f"Error getting room item: {e}")
        return None

def is_room_expired(room_item: Dict[str, Any]) -> bool:
    """Check if room is expired based on TTL."""
    ttl = room_item.get('ttl', 0)
    current_time = int(time.time())
    return current_time >= ttl