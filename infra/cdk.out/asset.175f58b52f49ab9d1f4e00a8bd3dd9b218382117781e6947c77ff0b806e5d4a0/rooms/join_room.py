import json
import traceback
from boto3.dynamodb.conditions import Key
from room_utils import (
    table, validate_room_code, create_response, get_room_item, is_room_expired
)

def lambda_handler(event, context):
    """
    Join a quiz room (add student to room).
    
    Path parameter: roomCode
    Request body:
    {
        "studentName": string
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
        
        student_name = body.get('studentName', '').strip()
        if not student_name:
            return create_response(400, {
                'error': 'Missing or empty studentName'
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
        
        # Get current students list
        students_joined = room_item.get('studentsJoined', [])
        
        # Add student if not already in the list
        if student_name not in students_joined:
            students_joined.append(student_name)
            
            # Update room in DynamoDB
            table.update_item(
                Key={'roomCode': room_code},
                UpdateExpression='SET studentsJoined = :students',
                ExpressionAttributeValues={
                    ':students': students_joined
                }
            )
        
        return create_response(200, {
            'message': 'Successfully joined room',
            'studentsJoined': students_joined
        })
        
    except Exception as e:
        print(f"Error joining room: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return create_response(500, {
            'error': 'Internal server error'
        })