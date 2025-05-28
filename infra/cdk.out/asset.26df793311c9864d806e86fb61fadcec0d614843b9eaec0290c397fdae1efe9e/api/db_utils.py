import json
import boto3
import psycopg2
import os
from typing import Dict, Any, Optional

def get_db_connection():
    """
    RDS Proxyまたは直接データベース接続を取得
    環境変数から接続情報を取得してpostgreSQLに接続
    """
    secret_arn = os.environ['SECRET_ARN']
    proxy_endpoint = os.environ.get('PROXY_ENDPOINT')
    db_name = os.environ['DB_NAME']
    
    # Secrets Managerからデータベース認証情報を取得
    secrets_client = boto3.client('secretsmanager')
    secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
    secret = json.loads(secret_response['SecretString'])
    
    # RDS Proxy使用を優先（Lambda環境では推奨）
    host = proxy_endpoint if proxy_endpoint else secret['host']
    
    connection = psycopg2.connect(
        host=host,
        database=db_name,
        user=secret['username'],
        password=secret['password'],
        port=secret.get('port', 5432),
        connect_timeout=10
    )
    
    return connection

def lambda_response(status_code: int, body: Any, headers: Optional[Dict] = None) -> Dict:
    """
    Lambda API Gateway形式のレスポンスを生成
    """
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    if headers:
        default_headers.update(headers)
    
    return {
        'statusCode': status_code,
        'headers': default_headers,
        'body': json.dumps(body, ensure_ascii=False, default=str)
    }

def handle_db_error(error: Exception) -> Dict:
    """
    データベースエラーのハンドリング
    """
    print(f"Database error: {str(error)}")
    return lambda_response(500, {
        'error': 'Database connection failed',
        'message': str(error)
    })