import json
import psycopg2
from db_utils import get_db_connection, lambda_response, handle_db_error

def lambda_handler(event, context):
    """
    語彙データ読み取りテスト用Lambda関数
    GET /vocab?book_id=1&limit=10
    """
    try:
        # クエリパラメータの取得
        query_params = event.get('queryStringParameters') or {}
        book_id = query_params.get('book_id')
        limit = int(query_params.get('limit', 50))
        offset = int(query_params.get('offset', 0))
        
        print(f"Request params: book_id={book_id}, limit={limit}, offset={offset}")
        
        # データベース接続
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 語彙ブック一覧を取得（book_idが指定されていない場合）
        if not book_id:
            cursor.execute("""
                SELECT id, name, description, level, language_pair, 
                       created_at, updated_at,
                       (SELECT COUNT(*) FROM vocabulary_questions WHERE book_id = vocabulary_books.id) as question_count
                FROM vocabulary_books 
                ORDER BY created_at DESC 
                LIMIT %s OFFSET %s
            """, (limit, offset))
            
            books = []
            for row in cursor.fetchall():
                books.append({
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'level': row[3],
                    'language_pair': row[4],
                    'created_at': row[5],
                    'updated_at': row[6],
                    'question_count': row[7]
                })
            
            return lambda_response(200, {
                'books': books,
                'total': len(books),
                'offset': offset,
                'limit': limit
            })
        
        # 特定の語彙ブックの質問を取得
        else:
            # まず語彙ブック情報を取得
            cursor.execute("""
                SELECT id, name, description, level, language_pair, created_at, updated_at
                FROM vocabulary_books WHERE id = %s
            """, (book_id,))
            
            book_row = cursor.fetchone()
            if not book_row:
                return lambda_response(404, {'error': 'Vocabulary book not found'})
            
            book = {
                'id': book_row[0],
                'name': book_row[1],
                'description': book_row[2],
                'level': book_row[3],
                'language_pair': book_row[4],
                'created_at': book_row[5],
                'updated_at': book_row[6]
            }
            
            # 語彙質問を取得
            cursor.execute("""
                SELECT id, ka, np1, jp_kanji, jp_rubi,
                       nepali_sentence, japanese_question, japanese_example,
                       extra_data, created_at, updated_at
                FROM vocabulary_questions 
                WHERE book_id = %s 
                ORDER BY ka 
                LIMIT %s OFFSET %s
            """, (book_id, limit, offset))
            
            questions = []
            for row in cursor.fetchall():
                questions.append({
                    'id': row[0],
                    'ka': row[1],
                    'np1': row[2],
                    'jp_kanji': row[3],
                    'jp_rubi': row[4],
                    'nepali_sentence': row[5],
                    'japanese_question': row[6],
                    'japanese_example': row[7],
                    'extra_data': row[8],
                    'created_at': row[9],
                    'updated_at': row[10]
                })
            
            return lambda_response(200, {
                'book': book,
                'questions': questions,
                'total': len(questions),
                'offset': offset,
                'limit': limit
            })
    
    except psycopg2.Error as e:
        return handle_db_error(e)
    except Exception as e:
        print(f"Error: {str(e)}")
        return lambda_response(500, {
            'error': 'Internal server error',
            'message': str(e)
        })
    finally:
        if 'conn' in locals():
            conn.close()