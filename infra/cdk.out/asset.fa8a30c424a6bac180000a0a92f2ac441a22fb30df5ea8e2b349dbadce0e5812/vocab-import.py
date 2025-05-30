import json
import psycopg2
import boto3
import csv
import io
import os
import urllib.request
from psycopg2.extras import execute_values

def lambda_handler(event, context):
    print("🚀 Starting vocabulary data import...")
    
    # Get database credentials from Secrets Manager
    secrets_client = boto3.client('secretsmanager')
    secret_arn = event['secret_arn']
    
    try:
        secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
        secret = json.loads(secret_response['SecretString'])
        
        # Connect to database
        conn = psycopg2.connect(
            host=secret['host'],
            database=secret['dbname'],
            user=secret['username'],
            password=secret['password'],
            port=secret['port']
        )
        cursor = conn.cursor()
        
        # Create tables if they don't exist and add missing constraints
        create_tables_sql = """
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

        -- Create vocabulary questions table
        CREATE TABLE IF NOT EXISTS vocabulary_questions (
            id SERIAL PRIMARY KEY,
            book_id INTEGER NOT NULL,
            ka INTEGER NOT NULL,
            np1 VARCHAR(500) NOT NULL,
            jp_kanji VARCHAR(500) NOT NULL,
            jp_rubi VARCHAR(500) NOT NULL,
            nepali_sentence TEXT DEFAULT '',
            japanese_question TEXT DEFAULT '',
            japanese_example TEXT DEFAULT '',
            extra_data JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE
        );
        
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_vocab_questions_book_id ON vocabulary_questions(book_id);
        CREATE INDEX IF NOT EXISTS idx_vocab_questions_ka ON vocabulary_questions(ka);
        """
        
        cursor.execute(create_tables_sql)
        conn.commit()
        print("✅ Tables created/verified")
        
        # Load vocabulary data from CSV files
        def load_csv_from_s3_or_url(csv_path, level):
            """Load CSV data efficiently from file path or URL"""
            try:
                # Try to read from local file first (for Lambda with mounted volumes)
                if os.path.exists(csv_path):
                    with open(csv_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                else:
                    # Try to download from URL if it's a URL
                    if csv_path.startswith('http'):
                        with urllib.request.urlopen(csv_path) as response:
                            content = response.read().decode('utf-8')
                    else:
                        # Default embedded content for N4 (fallback)
                        if level == 'N4':
                            content = """ka,NP1,JP-kanji,JP-rubi,NP-sentence,JP-question,exa,renban,S0,S3,S5,S7,S2,S4,N2,N4,N6,N8
1,शौक,趣味,しゅみ,मेरो शौक चलचित्र हेर्ने हो,私の（　）は、映画をみることです,私の趣味は、映画をみることです,1,1"""
                        else:
                            raise FileNotFoundError(f"CSV file not found: {csv_path}")
                
                # Parse CSV efficiently
                csv_reader = csv.DictReader(io.StringIO(content))
                return list(csv_reader)
                
            except Exception as e:
                print(f"❌ Error loading CSV from {csv_path}: {str(e)}")
                return []

        def bulk_insert_vocab_book_and_questions(vocab_data, level, book_name, description):
            """Efficiently insert vocabulary book and questions using bulk operations"""
            if not vocab_data:
                print(f"⚠️ No data to insert for {level}")
                return 0
                
            # Insert or get vocabulary book - first try to get existing
            cursor.execute("SELECT id FROM vocabulary_books WHERE name = %s", (book_name,))
            result = cursor.fetchone()
            
            if result:
                book_id = result[0]
                # Update existing book
                cursor.execute("""
                    UPDATE vocabulary_books 
                    SET description = %s, level = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (description, level, book_id))
            else:
                # Insert new book
                cursor.execute("""
                    INSERT INTO vocabulary_books (name, description, level, language_pair)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (book_name, description, level, "JP-NP"))
                book_id = cursor.fetchone()[0]
            
            # Clear existing questions for this book to avoid duplicates
            cursor.execute("DELETE FROM vocabulary_questions WHERE book_id = %s", (book_id,))
            
            # Prepare data for bulk insert - handle different CSV formats
            questions_data = []
            for row in vocab_data:
                # Handle different CSV column naming conventions
                ka = row.get('ka', '1')
                np1 = row.get('NP1', '') or row.get('english', '') or ''
                jp_kanji = row.get('JP-kanji', '') or row.get('jp_kanji', '') or ''
                jp_rubi = row.get('JP-rubi', '') or row.get('jp_rubi', '') or ''
                np_sentence = row.get('NP-sentence', '') or row.get('EN-sentence', '') or ''
                jp_question = row.get('JP-question', '') or row.get('jp_question', '') or ''
                jp_example = row.get('exa', '') or row.get('japanese_example', '') or ''
                
                questions_data.append((
                    book_id,
                    int(ka) if ka and ka.isdigit() else 1,
                    np1,
                    jp_kanji,
                    jp_rubi,
                    np_sentence,
                    jp_question,
                    jp_example
                ))
            
            # Bulk insert using execute_values for maximum efficiency
            if questions_data:
                execute_values(
                    cursor,
                    """
                    INSERT INTO vocabulary_questions (
                        book_id, ka, np1, jp_kanji, jp_rubi,
                        nepali_sentence, japanese_question, japanese_example
                    ) VALUES %s
                    """,
                    questions_data,
                    template=None,
                    page_size=1000  # Process in chunks of 1000 for optimal performance
                )
                print(f"✅ Bulk inserted {len(questions_data)} questions for {level}")
                return len(questions_data)
            
            return 0

        # Load and process N4 vocabulary
        n4_csv_path = event.get('n4_csv_path', '/opt/frontend/public/N4_vocab.csv')
        n4_data = load_csv_from_s3_or_url(n4_csv_path, 'N4')
        n4_inserted = bulk_insert_vocab_book_and_questions(
            n4_data, 
            'N4', 
            'N4語彙', 
            'JLPT N4レベルの語彙集（日本語・ネパール語対照）'
        )

        # Load and process N3 vocabulary
        n3_csv_path = event.get('n3_csv_path', '/opt/frontend/public/N3_vocab.csv')
        n3_data = load_csv_from_s3_or_url(n3_csv_path, 'N3')
        n3_inserted = bulk_insert_vocab_book_and_questions(
            n3_data, 
            'N3', 
            'N3語彙', 
            'JLPT N3レベルの語彙集（日本語・ネパール語対照）'
        )

        # Load and process みん日 vocabulary
        minnichi_csv_path = event.get('minnichi_csv_path', '/opt/frontend/public/みん日1.csv')
        minnichi_data = load_csv_from_s3_or_url(minnichi_csv_path, 'みん日')
        minnichi_inserted = bulk_insert_vocab_book_and_questions(
            minnichi_data, 
            'みん日', 
            'みん日', 
            'みんなの日本語初級の語彙集（日本語・ネパール語対照）'
        )

        total_inserted = n4_inserted + n3_inserted + minnichi_inserted
        conn.commit()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) FROM vocabulary_books")
        book_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vocabulary_questions")
        question_count = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"✅ Data import completed: {total_inserted} questions inserted ({n4_inserted} N4, {n3_inserted} N3, {minnichi_inserted} みん日)")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Vocabulary data imported successfully using bulk operations',
                'books': book_count,
                'questions': question_count,
                'inserted': total_inserted,
                'n4_inserted': n4_inserted,
                'n3_inserted': n3_inserted,
                'minnichi_inserted': minnichi_inserted,
                'optimization': 'Used execute_values bulk insert with 1000-row chunks'
            })
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }