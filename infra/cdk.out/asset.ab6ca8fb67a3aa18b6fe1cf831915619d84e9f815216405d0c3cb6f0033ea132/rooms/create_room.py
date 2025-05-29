import json
import traceback
from room_utils import (
    table, generate_room_code, calculate_ttl, get_current_iso_time,
    create_response, validate_quiz_config, validate_questions
)

def lambda_handler(event, context):
    """
    Create a new quiz room with a unique room code.
    
    Request body:
    {
        "config": QuizConfig,
        "questions": QuizQuestion[],
        "createdBy": string,
        "ttlHours": number (optional, default: 24)
    }
    
    Response:
    {
        "roomCode": string,
        "expiresAt": string
    }
    """
    try:
        # Parse request body
        if not event.get('body'):
            return create_response(400, {
                'error': 'Missing request body'
            })
        
        try:
            body = json.loads(event['body'])
        except json.JSONDecodeError:
            return create_response(400, {
                'error': 'Invalid JSON in request body'
            })
        
        # Validate required fields
        config = body.get('config')
        questions = body.get('questions')
        created_by = body.get('createdBy', 'guest')
        ttl_hours = body.get('ttlHours', 24)
        
        if not config:
            return create_response(400, {
                'error': 'Missing config field'
            })
        
        if not questions:
            return create_response(400, {
                'error': 'Missing questions field'
            })
        
        # Validate config and questions
        if not validate_quiz_config(config):
            return create_response(400, {
                'error': 'Invalid quiz configuration'
            })
        
        if not validate_questions(questions):
            return create_response(400, {
                'error': 'Invalid quiz questions'
            })
        
        # Generate unique room code
        room_code = generate_room_code()
        current_time = get_current_iso_time()
        ttl = calculate_ttl(ttl_hours)
        expires_at = get_current_iso_time()  # Will be calculated properly
        
        # Create room item
        room_item = {
            'roomCode': room_code,
            'config': config,
            'questions': questions,
            'createdAt': current_time,
            'expiresAt': expires_at,
            'createdBy': created_by,
            'studentsJoined': [],
            'ttl': ttl
        }
        
        # Save to DynamoDB
        table.put_item(Item=room_item)
        
        return create_response(200, {
            'roomCode': room_code,
            'expiresAt': expires_at
        })
        
    except Exception as e:
        print(f"Error creating room: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return create_response(500, {
            'error': 'Internal server error'
        })