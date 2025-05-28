import json
import psycopg2
from db_utils import get_db_connection, lambda_response, handle_db_error

def lambda_handler(event, context):
    """
    語彙データ更新テスト用Lambda関数
    PUT /vocab
    {
        "action": "update_book" | "update_question" | "update_scores",
        "data": {...}
    }
    """
    try:
        # HTTPメソッドを確認
        http_method = event.get('httpMethod', '').upper()
        if http_method == 'OPTIONS':
            return lambda_response(200, {})
        
        # リクエストボディをパース
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        action = body.get('action')
        data = body.get('data', {})
        
        print(f"Request: action={action}, data={data}")
        
        # データベース接続
        conn = get_db_connection()
        conn.autocommit = True
        cursor = conn.cursor()
        
        if action == 'update_book':
            return update_vocabulary_book(cursor, data)
        elif action == 'update_question':
            return update_vocabulary_question(cursor, data)
        elif action == 'test_update':
            return test_database_update(cursor)
        else:
            return lambda_response(400, {
                'error': 'Invalid action',
                'message': 'Action must be update_book, update_question, or test_update'
            })
    
    except psycopg2.Error as e:
        return handle_db_error(e)
    except json.JSONDecodeError:
        return lambda_response(400, {
            'error': 'Invalid JSON',
            'message': 'Request body must be valid JSON'
        })
    except Exception as e:
        print(f"Error: {str(e)}")
        return lambda_response(500, {
            'error': 'Internal server error',
            'message': str(e)
        })
    finally:
        if 'conn' in locals():
            conn.close()

def update_vocabulary_book(cursor, data):
    """語彙ブックを更新"""
    book_id = data.get('id')
    if not book_id:
        return lambda_response(400, {
            'error': 'Missing required field',
            'message': 'id is required'
        })
    
    # 更新フィールドを動的に構築
    update_fields = []
    update_values = []
    
    for field in ['name', 'description', 'level', 'language_pair']:
        if field in data:
            update_fields.append(f"{field} = %s")
            update_values.append(data[field])
    
    if not update_fields:
        return lambda_response(400, {
            'error': 'No fields to update',
            'message': 'At least one field (name, description, level, language_pair) must be provided'
        })
    
    update_values.append(book_id)
    
    cursor.execute(f"""
        UPDATE vocabulary_books 
        SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, name, description, level, language_pair, created_at, updated_at
    """, update_values)
    
    row = cursor.fetchone()
    if not row:
        return lambda_response(404, {
            'error': 'Book not found',
            'message': f'Vocabulary book with id {book_id} does not exist'
        })
    
    book = {
        'id': row[0],
        'name': row[1],
        'description': row[2],
        'level': row[3],
        'language_pair': row[4],
        'created_at': row[5],
        'updated_at': row[6]
    }
    
    return lambda_response(200, {
        'message': 'Vocabulary book updated successfully',
        'book': book
    })

def update_vocabulary_question(cursor, data):
    """語彙質問を更新"""
    question_id = data.get('id')
    if not question_id:
        return lambda_response(400, {
            'error': 'Missing required field',
            'message': 'id is required'
        })
    
    # 更新フィールドを動的に構築
    update_fields = []
    update_values = []
    
    allowed_fields = [
        'ka', 'np1', 'jp_kanji', 'jp_rubi',
        'nepali_sentence', 'japanese_question', 'japanese_example'
    ]
    
    for field in allowed_fields:
        if field in data:
            update_fields.append(f"{field} = %s")
            update_values.append(data[field])
    
    if not update_fields:
        return lambda_response(400, {
            'error': 'No fields to update',
            'message': f'At least one field must be provided: {", ".join(allowed_fields)}'
        })
    
    update_values.append(question_id)
    
    cursor.execute(f"""
        UPDATE vocabulary_questions 
        SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, book_id, ka, np1, jp_kanji, jp_rubi,
                  nepali_sentence, japanese_question, japanese_example, extra_data, created_at, updated_at
    """, update_values)
    
    row = cursor.fetchone()
    if not row:
        return lambda_response(404, {
            'error': 'Question not found',
            'message': f'Vocabulary question with id {question_id} does not exist'
        })
    
    question = {
        'id': row[0],
        'book_id': row[1],
        'ka': row[2],
        'np1': row[3],
        'jp_kanji': row[4],
        'jp_rubi': row[5],
        'nepali_sentence': row[6],
        'japanese_question': row[7],
        'japanese_example': row[8],
        'extra_data': row[9],
        'created_at': row[10],
        'updated_at': row[11]
    }
    
    return lambda_response(200, {
        'message': 'Vocabulary question updated successfully',
        'question': question
    })


def test_database_update(cursor):
    """データベース更新のテスト"""
    # 最新の語彙ブックを取得
    cursor.execute("""
        SELECT id, name FROM vocabulary_books 
        ORDER BY created_at DESC LIMIT 1
    """)
    
    book_row = cursor.fetchone()
    if not book_row:
        return lambda_response(404, {
            'error': 'No books found',
            'message': 'Create a book first using test_insert action'
        })
    
    book_id = book_row[0]
    original_name = book_row[1]
    
    # ブック名を更新
    new_name = f"{original_name} (更新済み)"
    cursor.execute("""
        UPDATE vocabulary_books 
        SET name = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING name, updated_at
    """, (new_name, book_id))
    
    updated_book = cursor.fetchone()
    
    return lambda_response(200, {
        'message': 'Test update completed successfully',
        'updated_book': {
            'id': book_id,
            'name': updated_book[0],
            'updated_at': updated_book[1]
        }
    })