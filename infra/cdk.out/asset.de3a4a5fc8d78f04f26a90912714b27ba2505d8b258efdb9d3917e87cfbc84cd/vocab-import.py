import json
import psycopg2
import boto3
import csv
import io
import base64

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
        
        # Create tables if they don't exist
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
            ka INTEGER,
            renban INTEGER NOT NULL,
            nepali_word VARCHAR(500) NOT NULL,
            japanese_kanji VARCHAR(500) NOT NULL,
            japanese_reading VARCHAR(500) NOT NULL,
            nepali_sentence TEXT,
            japanese_question TEXT NOT NULL,
            japanese_example TEXT NOT NULL,
            s0 INTEGER DEFAULT 0,
            s2 INTEGER DEFAULT 0,
            s3 INTEGER DEFAULT 0,
            s4 INTEGER DEFAULT 0,
            s5 INTEGER DEFAULT 0,
            s7 INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE
        );
        """
        
        cursor.execute(create_tables_sql)
        conn.commit()
        print("✅ Tables created/verified")
        
        # Sample data for testing
        sample_n4_data = [
            {
                'ka': '1', 'renban': '1', 'NP1': 'शौक', 'JP-kanji': '趣味', 'JP-rubi': 'しゅみ',
                'NP-sentence': 'मेरो शौक चलचित्र हेर्ने हो', 'JP-question': '私の（　）は、映画をみることです',
                'exa': '私の趣味は、映画をみることです', 'S0': '1'
            },
            {
                'ka': '1', 'renban': '2', 'NP1': 'मलाई चासो छ', 'JP-kanji': '興味', 'JP-rubi': 'きょうみ',
                'NP-sentence': 'मलाई जापानी चलचित्रहरूमा रुचि छ', 'JP-question': '日本の映画に（　）があります',
                'exa': '日本の映画に興味があります', 'S0': '1'
            }
        ]
        
        # Insert N4 vocabulary book
        cursor.execute("""
            INSERT INTO vocabulary_books (name, description, level, language_pair)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING id
        """, ("N4語彙", "JLPT N4レベルの語彙集（日本語・ネパール語対照）", "N4", "JP-NP"))
        
        result = cursor.fetchone()
        if result:
            n4_book_id = result[0]
        else:
            cursor.execute("SELECT id FROM vocabulary_books WHERE name = %s", ("N4語彙",))
            n4_book_id = cursor.fetchone()[0]
        
        # Insert sample N4 questions
        for row in sample_n4_data:
            cursor.execute("""
                INSERT INTO vocabulary_questions (
                    book_id, ka, renban, nepali_word, japanese_kanji, japanese_reading,
                    nepali_sentence, japanese_question, japanese_example, s0
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (
                n4_book_id,
                int(row['ka']) if row['ka'] else None,
                int(row['renban']) if row['renban'] else None,
                row['NP1'] or '',
                row['JP-kanji'] or '',
                row['JP-rubi'] or '',
                row['NP-sentence'] or '',
                row['JP-question'] or '',
                row['exa'] or '',
                int(row['S0']) if row['S0'] else 0
            ))
        
        conn.commit()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) FROM vocabulary_books")
        book_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vocabulary_questions")
        question_count = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Vocabulary data imported successfully',
                'books': book_count,
                'questions': question_count
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