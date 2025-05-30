import json
import traceback
from room_utils import (
    table, validate_room_code, create_response, get_room_item
)

def lambda_handler(event, context):
    """
    Delete a quiz room.
    
    Path parameter: roomCode
    Request body:
    {
        "createdBy": string
    }
    
    Response: 200 OK or error
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
        
        created_by = body.get('createdBy', '').strip()
        if not created_by:
            return create_response(400, {
                'error': 'Missing or empty createdBy'
            })
        
        # Get room from DynamoDB
        room_item = get_room_item(room_code)
        
        if not room_item:
            return create_response(404, {
                'error': 'Room not found'
            })
        
        # Check if the user is authorized to delete the room
        room_created_by = room_item.get('createdBy', '')
        if room_created_by != created_by:
            return create_response(403, {
                'error': 'Not authorized to delete this room'
            })
        
        # Delete room from DynamoDB
        table.delete_item(Key={'roomCode': room_code})
        
        return create_response(200, {
            'message': 'Room deleted successfully'
        })
        
    except Exception as e:
        print(f"Error deleting room: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return create_response(500, {
            'error': 'Internal server error'
        })