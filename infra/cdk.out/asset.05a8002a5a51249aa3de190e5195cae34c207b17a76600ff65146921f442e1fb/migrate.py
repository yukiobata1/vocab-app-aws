import json
import psycopg2
from db_utils import get_db_connection, lambda_response, handle_db_error

def lambda_handler(event, context):
    """
    データベースマイグレーション実行Lambda関数
    POST /migrate
    {
        "action": "create_tables" | "check_tables"
    }
    """
    try:
        # リクエストボディをパース
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        action = body.get('action', 'create_tables')
        
        print(f"Migration action: {action}")
        
        # データベース接続
        conn = get_db_connection()
        conn.autocommit = True
        cursor = conn.cursor()
        
        if action == 'create_tables':
            return create_tables(cursor)
        elif action == 'check_tables':
            return check_tables(cursor)
        else:
            return lambda_response(400, {
                'error': 'Invalid action',
                'message': 'Action must be create_tables or check_tables'
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

def create_tables(cursor):
    """テーブル作成"""
    migration_sql = """
    -- Create vocabulary books table
    CREATE TABLE IF NOT EXISTS vocabulary_books (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        level VARCHAR(10) NOT NULL DEFAULT 'N4',
        language_pair VARCHAR(10) NOT NULL DEFAULT 'JP-NP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_vocab_books_level ON vocabulary_books (level);
    CREATE INDEX IF NOT EXISTS idx_vocab_books_language_pair ON vocabulary_books (language_pair);

    -- Create vocabulary questions table
    CREATE TABLE IF NOT EXISTS vocabulary_questions (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL,
        ka INTEGER NOT NULL,
        np1 VARCHAR(500) NOT NULL,
        jp_kanji VARCHAR(500) NOT NULL,
        jp_rubi VARCHAR(500) NOT NULL,
        -- Optional fields
        nepali_sentence TEXT DEFAULT '',
        japanese_question TEXT DEFAULT '',
        japanese_example TEXT DEFAULT '',
        s0 INTEGER DEFAULT 0,
        s2 INTEGER DEFAULT 0,
        s3 INTEGER DEFAULT 0,
        s4 INTEGER DEFAULT 0,
        s5 INTEGER DEFAULT 0,
        s7 INTEGER DEFAULT 0,
        extra_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vocab_questions_book_ka ON vocabulary_questions (book_id, ka);
    CREATE INDEX IF NOT EXISTS idx_vocab_questions_ka ON vocabulary_questions (ka);
    CREATE INDEX IF NOT EXISTS idx_vocab_questions_jp_kanji ON vocabulary_questions (jp_kanji);
    CREATE INDEX IF NOT EXISTS idx_vocab_questions_np1 ON vocabulary_questions (np1);

    -- Create trigger function to update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Create triggers for updated_at columns
    DROP TRIGGER IF EXISTS update_vocabulary_books_updated_at ON vocabulary_books;
    CREATE TRIGGER update_vocabulary_books_updated_at BEFORE UPDATE ON vocabulary_books 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_vocabulary_questions_updated_at ON vocabulary_questions;
    CREATE TRIGGER update_vocabulary_questions_updated_at BEFORE UPDATE ON vocabulary_questions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """
    
    # SQLを実行
    statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
    created_objects = []
    
    for statement in statements:
        if statement:
            try:
                cursor.execute(statement)
                if 'CREATE TABLE' in statement.upper():
                    table_name = statement.split()[5] if 'IF NOT EXISTS' in statement else statement.split()[2]
                    created_objects.append(f"Table: {table_name}")
                elif 'CREATE INDEX' in statement.upper():
                    index_name = statement.split()[4] if 'IF NOT EXISTS' in statement else statement.split()[2]
                    created_objects.append(f"Index: {index_name}")
                elif 'CREATE TRIGGER' in statement.upper():
                    trigger_name = statement.split()[2]
                    created_objects.append(f"Trigger: {trigger_name}")
                elif 'CREATE OR REPLACE FUNCTION' in statement.upper():
                    func_name = statement.split()[4].split('(')[0]
                    created_objects.append(f"Function: {func_name}")
                print(f"✓ Executed: {statement[:50]}...")
            except Exception as e:
                print(f"✗ Error executing: {statement[:50]}...")
                print(f"  Error: {e}")
                raise
    
    return lambda_response(200, {
        'message': 'Database migration completed successfully',
        'created_objects': created_objects,
        'total_statements': len(statements)
    })

def check_tables(cursor):
    """テーブル存在確認"""
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    
    tables = [row[0] for row in cursor.fetchall()]
    
    # 各テーブルのレコード数を取得
    table_info = []
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        table_info.append({
            'table': table,
            'count': count
        })
    
    return lambda_response(200, {
        'message': 'Database tables checked',
        'tables': table_info,
        'total_tables': len(tables)
    })