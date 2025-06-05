import json
import psycopg2
import boto3

def lambda_handler(event, context):
    print("🧹 Starting cleanup of vocabulary books with fewer than 5 questions...")
    
    # Get database credentials from Secrets Manager
    secrets_client = boto3.client('secretsmanager')
    secret_arn = event['secret_arn']
    min_questions = event.get('min_questions', 5)  # Default to 5, can be overridden
    
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
        
        # Get books with question counts
        cursor.execute("""
            SELECT 
                vb.id, 
                vb.name, 
                vb.description,
                vb.level,
                COUNT(vq.id) as question_count
            FROM vocabulary_books vb
            LEFT JOIN vocabulary_questions vq ON vb.id = vq.book_id
            GROUP BY vb.id, vb.name, vb.description, vb.level
            HAVING COUNT(vq.id) < %s
            ORDER BY COUNT(vq.id) ASC, vb.name ASC
        """, (min_questions,))
        
        books_to_delete = cursor.fetchall()
        
        if not books_to_delete:
            print(f"✅ No books found with fewer than {min_questions} questions")
            conn.close()
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': f'No books found with fewer than {min_questions} questions',
                    'deleted_books': [],
                    'deleted_count': 0
                })
            }
        
        print(f"📊 Found {len(books_to_delete)} books with fewer than {min_questions} questions:")
        deleted_books = []
        
        for book_id, name, description, level, question_count in books_to_delete:
            print(f"   - ID {book_id}: '{name}' ({level}) - {question_count} questions")
            deleted_books.append({
                'id': book_id,
                'name': name,
                'description': description,
                'level': level,
                'question_count': question_count
            })
        
        # If dry_run is specified, don't actually delete
        if event.get('dry_run', False):
            print("🔍 DRY RUN: Would delete the above books (no actual deletion performed)")
            conn.close()
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': f'DRY RUN: Found {len(books_to_delete)} books that would be deleted',
                    'books_to_delete': deleted_books,
                    'deleted_count': 0,
                    'dry_run': True
                })
            }
        
        # Delete the books (CASCADE will automatically delete associated questions)
        book_ids = [book[0] for book in books_to_delete]
        cursor.execute("""
            DELETE FROM vocabulary_books 
            WHERE id = ANY(%s)
        """, (book_ids,))
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        print(f"🗑️ Successfully deleted {deleted_count} vocabulary books")
        
        # Get remaining books count
        cursor.execute("SELECT COUNT(*) FROM vocabulary_books")
        remaining_books = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vocabulary_questions")
        remaining_questions = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully deleted {deleted_count} vocabulary books with fewer than {min_questions} questions',
                'deleted_books': deleted_books,
                'deleted_count': deleted_count,
                'remaining_books': remaining_books,
                'remaining_questions': remaining_questions,
                'min_questions_threshold': min_questions
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