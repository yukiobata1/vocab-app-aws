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
        """
        
        cursor.execute(create_tables_sql)
        conn.commit()
        print("✅ Tables created/verified")
        
        # Load N4 vocabulary data from embedded CSV content
        csv_content = """ka,NP1,JP-kanji,JP-rubi,NP-sentence,JP-question,exa,renban,S0,S3,S5,S7,S2,S4,N2,N4,N6,N8
1,शौक,趣味,しゅみ,मेरो शौक चलचित्र हेर्ने हो,私の（　）は、映画をみることです,私の趣味は、映画をみることです,1,1
1,मलाई चासो छ,興味,きょうみ,मलाई जापानी चलचित्रहरूमा रुचि छ,日本の映画に（　）があります,日本の映画に興味があります,2,1
1,उपन्यास,小説,しょうせつ,मलाई उपन्यास मन पर्छ,私は（　）が好きです,私は小説が好きです,3,1
1,सपना,夢,ゆめ,भविष्यको लागि तपाईंको सपना के हो,将来の（　）は何ですか,将来の夢は何ですか,4,1
1,भविष्य,将来,しょうらい,म भविष्यमा डाक्टर बन्न चाहन्छु,（　）、医者になりたいです,将来、医者になりたいです,5,1
1,सवारी साधन,乗り物,のりもの,मेरो भाइलाई कार मन पर्छ,弟は（　）が好きです,弟は乗り物が好きです,6,1
1,पार्टटाइम काम,,あるばいと,मेरी बहिनी एक सुपरमार्केटमा पार्टटाइम काम गर्छिन्,妹はスーパーで（　）をしています,妹はスーパーでアルバイトをしています,7,1
1,राम्रो,上手い,うまい,मेरी बहिनी चित्रकला मा राम्रो छ,姉は絵が（　）です,妹は絵が上手いです,8,1
1,बल,力,ちから,मेरो भाइ मेरो बुबा भन्दा बलियो छ,兄は父より（　）が強いです,兄は父より力が強いです,9,1
1,सेतो,白い,しろい,यो कागज सेतो छ,この紙は（　）です,この紙は白いです,10,1
2,वर्षा,雨,あめ,हिजो धेरै वर्षा भयो,昨日（　）がたくさん降りました,昨日雨がたくさん降りました,11,1
2,हावा,風,かぜ,आज बिहान चिसो हावा चलिरहेको छ,今朝（　）が冷たいです,今朝風が冷たいです,12,1
2,आकाश,空,そら,आजको आकाश नीलो छ,今日の（　）は青いです,今日の空は青いです,13,1
2,पहाड,山,やま,नेपालमा धेरै अग्लो पहाडहरू छन्,ネパールには高い（　）がたくさんあります,ネパールには高い山がたくさんあります,14,1
2,समुद्र,海,うみ,जापानमा समुद्र छ,日本には（　）があります,日本には海があります,15,1
2,नदी,川,かわ,यहाँ एक सानो नदी छ,ここに小さな（　）があります,ここに小さな川があります,16,1
2,ताल,湖,みずうみ,फुजी पहाडको नजिक पाँच ताल छन्,富士山の近くに五つの（　）があります,富士山の近くに五つの湖があります,17,1
2,बगैँचा,庭,にわ,हाम्रो घरको बगैँचामा फूलहरू छन्,私たちの家の（　）に花があります,私たちの家の庭に花があります,18,1
2,रूख,木,き,बगैँचामा ठूलो रूख छ,庭に大きな（　）があります,庭に大きな木があります,19,1
2,फूल,花,はな,गुलाबको फूल सुन्दर छ,バラの（　）は美しいです,バラの花は美しいです,20,1
3,घर,家,いえ,मेरो घर स्टेशनको नजिक छ,私の（　）は駅の近くです,私の家は駅の近くです,21,1
3,कोठा,部屋,へや,यो कोठा ठूलो छ,この（　）は大きいです,この部屋は大きいです,22,1
3,भान्सा,台所,だいどころ,आमा भान्सामा खाना पकाउनुहुन्छ,母は（　）で料理します,母は台所で料理します,23,1
3,शयनकक्ष,寝室,しんしつ,मेरो शयनकक्षमा किताबहरू छन्,私の（　）に本があります,私の寝室に本があります,24,1
3,बैठक कक्ष,居間,いま,बैठक कक्षमा टेलिभिजन छ,（　）にテレビがあります,居間にテレビがあります,25,1
3,बाथरूम,風呂,ふろ,म हरेक दिन बाथरूम गर्छु,私は毎日（　）に入ります,私は毎日風呂に入ります,26,1
3,शौचालय,お手洗い,おてあらい,शौचालय दोस्रो तलामा छ,（　）は二階にあります,お手洗いは二階にあります,27,1
3,ढोका,ドア,どあ,कृपया ढोका बन्द गर्नुहोस्,（　）を閉めてください,ドアを閉めてください,28,1
3,झ्याल,窓,まど,झ्याल खोल्नुहोस्,（　）を開けてください,窓を開けてください,29,1
3,पर्दा,カーテン,かーてん,कोठामा रातो पर्दा छ,部屋に赤い（　）があります,部屋に赤いカーテンがあります,30,1
4,स्कूल,学校,がっこう,म हरेक दिन स्कूल जान्छु,私は毎日（　）に行きます,私は毎日学校に行きます,31,1
4,कक्षा,教室,きょうしつ,हाम्रो कक्षामा ३० जना विद्यार्थी छन्,私たちの（　）に30人の学生がいます,私たちの教室に30人の学生がいます,32,1
4,शिक्षक,先生,せんせい,शिक्षक धेरै दयालु हुनुहुन्छ,（　）はとても親切です,先生はとても親切です,33,1
4,विद्यार्थी,学生,がくせい,उहाँ जापानी भाषाका विद्यार्थी हुनुहुन्छ,彼は日本語の（　）です,彼は日本語の学生です,34,1
4,अध्ययन,勉強,べんきょう,म हरेक दिन जापानी भाषाको अध्ययन गर्छु,私は毎日日本語を（　）します,私は毎日日本語を勉強します,35,1
4,परीक्षा,試験,しけん,भोलि जापानी भाषाको परीक्षा छ,明日日本語の（　）があります,明日日本語の試験があります,36,1
4,गृहकार्य,宿題,しゅくだい,मलाई गृहकार्य गर्न मन पर्दैन,（　）をするのが嫌いです,宿題をするのが嫌いです,37,1
4,किताब,本,ほん,यो किताब धेरै रोचक छ,この（　）はとても面白いです,この本はとても面白いです,38,1
4,नोटबुक,ノート,のーと,कृपया नोटबुकमा लेख्नुहोस्,（　）に書いてください,ノートに書いてください,39,1
4,कलम,ペン,ぺん,यो कलम राम्रो छ,この（　）はいいです,このペンはいいです,40,1
5,काम,仕事,しごと,मेरो बुबाको काम अस्पतालमा छ,父の（　）は病院です,父の仕事は病院です,41,1
5,कम्पनी,会社,かいしゃ,उहाँ ठूलो कम्पनीमा काम गर्नुहुन्छ,彼は大きな（　）で働いています,彼は大きな会社で働いています,42,1
5,कार्यालय,事務所,じむしょ,मेरो कार्यालय टोकियोमा छ,私の（　）は東京にあります,私の事務所は東京にあります,43,1
5,बैंक,銀行,ぎんこう,म बैंकमा काम गर्छु,私は（　）で働いています,私は銀行で働いています,44,1
5,डाक्टर,医者,いしゃ,मेरी आमा डाक्टर हुनुहुन्छ,母は（　）です,母は医者です,45,1
5,नर्स,看護師,かんごし,अस्पतालमा धेरै नर्सहरू छन्,病院にたくさんの（　）がいます,病院にたくさんの看護師がいます,46,1
5,शिक्षक,教師,きょうし,उहाँ माध्यमिक विद्यालयका शिक्षक हुनुहुन्छ,彼は中学校の（　）です,彼は中学校の教師です,47,1
5,इन्जिनियर,エンジニア,えんじにあ,मेरो दाजु इन्जिनियर हुनुहुन्छ,兄は（　）です,兄はエンジニアです,48,1
5,व्यापारी,商人,しょうにん,उहाँ सफल व्यापारी हुनुहुन्छ,彼は成功した（　）です,彼は成功した商人です,49,1
5,चालक,運転手,うんてんしゅ,उहाँ ट्याक्सीको चालक हुनुहुन्छ,彼はタクシーの（　）です,彼はタクシーの運転手です,50,1"""
        
        # Parse CSV data
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        n4_vocab_data = list(csv_reader)
        
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
        
        # Clear existing questions for this book to avoid duplicates
        cursor.execute("DELETE FROM vocabulary_questions WHERE book_id = %s", (n4_book_id,))
        
        # Insert N4 vocabulary questions from CSV data
        inserted_count = 0
        for row in n4_vocab_data:
            cursor.execute("""
                INSERT INTO vocabulary_questions (
                    book_id, ka, np1, jp_kanji, jp_rubi,
                    nepali_sentence, japanese_question, japanese_example
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                n4_book_id,
                int(row['ka']) if row['ka'] else 1,
                row['NP1'] or '',
                row['JP-kanji'] or '',
                row['JP-rubi'] or '',
                row['NP-sentence'] or '',
                row['JP-question'] or '',
                row['exa'] or ''
            ))
            inserted_count += 1
        
        conn.commit()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) FROM vocabulary_books")
        book_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vocabulary_questions")
        question_count = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"✅ Data import completed: {inserted_count} questions inserted")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Vocabulary data imported successfully',
                'books': book_count,
                'questions': question_count,
                'inserted': inserted_count
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