import json
import traceback
from room_utils import (
    validate_room_code, create_response, get_room_item, is_room_expired
)

def lambda_handler(event, context):
    """
    Get quiz room statistics.
    
    Path parameter: roomCode
    
    Response:
    {
        "studentsCount": number,
        "studentsJoined": string[],
        "expiresAt": string
    }
    """
    try:
        # Get room code from path parameters
        path_params = event.get('pathParameters', {})
        room_code = path_params.get('roomCode')
        
        if not room_code:
            return create_response(400, {
                'error': 'Missing roomCode path parameter'
            })
        
        # Validate room code format
        room_code = room_code.upper()
        if not validate_room_code(room_code):
            return create_response(400, {
                'error': 'Invalid room code format'
            })
        
        # Get room from DynamoDB
        room_item = get_room_item(room_code)
        
        if not room_item:
            return create_response(404, {
                'error': 'Room not found'
            })
        
        # Check if room is expired
        if is_room_expired(room_item):
            return create_response(404, {
                'error': 'Room expired'
            })
        
        # Extract statistics
        students_joined = room_item.get('studentsJoined', [])
        expires_at = room_item.get('expiresAt', '')
        
        return create_response(200, {
            'studentsCount': len(students_joined),
            'studentsJoined': students_joined,
            'expiresAt': expires_at
        })
        
    except Exception as e:
        print(f"Error getting room stats: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return create_response(500, {
            'error': 'Internal server error'
        })