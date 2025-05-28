#!/usr/bin/env python3
import psycopg2
import sys
import os
import json
import urllib.parse

def get_db_config():
    """Get database configuration from environment variable or hardcoded values"""
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Parse DATABASE_URL (postgres://user:pass@host:port/dbname)
        parsed = urllib.parse.urlparse(database_url)
        return {
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "dbname": parsed.path[1:],  # Remove leading '/'
            "username": parsed.username,
            "password": parsed.password
        }
    else:
        # Fallback to hardcoded values (for backwards compatibility)
        return {
            "dbClusterIdentifier": "vocabappdevstack-vocabappauroradevf5e41487-7cosknw9gpkc",
            "password": "1#lg-w(+MJNd|{V(d$X3.,#<w1&jFy]m",
            "dbname": "vocabapp",
            "engine": "postgres",
            "port": 5432,
            "host": "vocabappdevstack-vocabappauroradevf5e41487-7cosknw9gpkc.cluster-cjqiaou2awtq.ap-northeast-1.rds.amazonaws.com",
            "username": "vocabadmin"
        }

def run_sql_script(cursor, script_content):
    """Execute SQL script content"""
    # Split by semicolon and execute each statement
    statements = [stmt.strip() for stmt in script_content.split(';') if stmt.strip()]
    for statement in statements:
        if statement:
            try:
                cursor.execute(statement)
                print(f"✓ Executed: {statement[:50]}...")
            except Exception as e:
                print(f"✗ Error executing statement: {statement[:50]}...")
                print(f"  Error: {e}")
                raise

def main():
    print("🗄️  Running database setup...")
    
    try:
        # Get database configuration
        DB_CONFIG = get_db_config()
        
        # Connect to database
        print("📡 Connecting to database...")
        print(f"    Host: {DB_CONFIG['host']}")
        print(f"    Port: {DB_CONFIG['port']}")
        print(f"    Database: {DB_CONFIG['dbname']}")
        print(f"    User: {DB_CONFIG['username']}")
        
        conn = psycopg2.connect(
            host=DB_CONFIG['host'],
            database=DB_CONFIG['dbname'],
            user=DB_CONFIG['username'],
            password=DB_CONFIG['password'],
            port=DB_CONFIG['port'],
            connect_timeout=30
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("✅ Database connection successful")
        
        # Create tables
        print("🚀 Creating tables...")
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
        
        run_sql_script(cursor, create_tables_sql)
        print("✅ Tables created successfully")
        
        # Check existing books
        cursor.execute("SELECT COUNT(*) FROM vocabulary_books;")
        existing_books = cursor.fetchone()[0]
        print(f"📚 Existing vocabulary books: {existing_books}")
        
        print("🎉 Database setup completed successfully!")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()