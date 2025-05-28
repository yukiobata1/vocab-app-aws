import json
import psycopg2
from db_utils import get_db_connection, lambda_response, handle_db_error

def lambda_handler(event, context):
    """
    語彙データ書き込みテスト用Lambda関数
    POST /vocab
    {
        "action": "create_book" | "create_question",
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
        
        if action == 'create_book':
            return create_vocabulary_book(cursor, data)
        elif action == 'create_question':
            return create_vocabulary_question(cursor, data)
        elif action == 'test_insert':
            return test_database_insert(cursor)
        else:
            return lambda_response(400, {
                'error': 'Invalid action',
                'message': 'Action must be create_book, create_question, or test_insert'
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

def create_vocabulary_book(cursor, data):
    """語彙ブックを作成"""
    name = data.get('name')
    description = data.get('description', '')
    level = data.get('level', 'N4')
    language_pair = data.get('language_pair', 'JP-NP')
    
    if not name:
        return lambda_response(400, {
            'error': 'Missing required field',
            'message': 'name is required'
        })
    
    cursor.execute("""
        INSERT INTO vocabulary_books (name, description, level, language_pair)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, description, level, language_pair, created_at, updated_at
    """, (name, description, level, language_pair))
    
    row = cursor.fetchone()
    book = {
        'id': row[0],
        'name': row[1],
        'description': row[2],
        'level': row[3],
        'language_pair': row[4],
        'created_at': row[5],
        'updated_at': row[6]
    }
    
    return lambda_response(201, {
        'message': 'Vocabulary book created successfully',
        'book': book
    })

def create_vocabulary_question(cursor, data):
    """語彙質問を作成"""
    book_id = data.get('book_id')
    ka = data.get('ka')
    np1 = data.get('np1')
    jp_kanji = data.get('jp_kanji')
    jp_rubi = data.get('jp_rubi')
    
    # 必須フィールドのチェック
    required_fields = ['book_id', 'ka', 'np1', 'jp_kanji', 'jp_rubi']
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return lambda_response(400, {
            'error': 'Missing required fields',
            'message': f'Required fields: {", ".join(missing_fields)}'
        })
    
    # 語彙ブックの存在確認
    cursor.execute("SELECT id FROM vocabulary_books WHERE id = %s", (book_id,))
    if not cursor.fetchone():
        return lambda_response(404, {
            'error': 'Book not found',
            'message': f'Vocabulary book with id {book_id} does not exist'
        })
    
    # extra_dataを作成（その他のフィールドをJSONに格納）
    extra_data = {}
    optional_fields = ['nepali_sentence', 'japanese_question', 'japanese_example']
    for field in optional_fields:
        if field in data:
            extra_data[field] = data[field]
    
    cursor.execute("""
        INSERT INTO vocabulary_questions 
        (book_id, ka, np1, jp_kanji, jp_rubi, 
         nepali_sentence, japanese_question, japanese_example, extra_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, book_id, ka, np1, jp_kanji, jp_rubi, 
                  nepali_sentence, japanese_question, japanese_example, 
                  extra_data, created_at, updated_at
    """, (book_id, ka, np1, jp_kanji, jp_rubi,
          data.get('nepali_sentence', ''), 
          data.get('japanese_question', ''), 
          data.get('japanese_example', ''),
          json.dumps(extra_data)))
    
    row = cursor.fetchone()
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
    
    return lambda_response(201, {
        'message': 'Vocabulary question created successfully',
        'question': question
    })

def test_database_insert(cursor):
    """データベースへのテスト書き込み"""
    # テスト用語彙ブックを作成
    cursor.execute("""
        INSERT INTO vocabulary_books (name, description, level, language_pair)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name
    """, ('テストブック', 'Lambda接続テスト用のブック', 'N4', 'JP-NP'))
    
    book_row = cursor.fetchone()
    book_id = book_row[0]
    book_name = book_row[1]
    
    # テスト用質問を作成
    test_questions = [
        {
            'ka': 1,
            'np1': 'घर',
            'jp_kanji': '家',
            'jp_rubi': 'いえ',
            'japanese_question': '私の（　　）は大きいです。',
            'japanese_example': '私の家は大きいです。'
        },
        {
            'ka': 2,
            'np1': 'पानी',
            'jp_kanji': '水',
            'jp_rubi': 'みず',
            'japanese_question': '（　　）を飲みます。',
            'japanese_example': '水を飲みます。'
        }
    ]
    
    created_questions = []
    for q in test_questions:
        cursor.execute("""
            INSERT INTO vocabulary_questions 
            (book_id, ka, np1, jp_kanji, jp_rubi, 
             japanese_question, japanese_example)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, ka, np1, jp_kanji, jp_rubi
        """, (book_id, q['ka'], q['np1'], q['jp_kanji'], 
              q['jp_rubi'], q['japanese_question'], q['japanese_example']))
        
        question_row = cursor.fetchone()
        created_questions.append({
            'id': question_row[0],
            'ka': question_row[1],
            'np1': question_row[2],
            'jp_kanji': question_row[3],
            'jp_rubi': question_row[4]
        })
    
    return lambda_response(201, {
        'message': 'Test data inserted successfully',
        'book': {'id': book_id, 'name': book_name},
        'questions': created_questions,
        'total_questions': len(created_questions)
    })