# VocabApp Infrastructure

This directory contains the AWS CDK infrastructure code for the VocabApp, which deploys an Aurora Serverless v2 MySQL database to store vocabulary books and student answers.

## Architecture

- **Aurora Serverless v2 MySQL**: Auto-scaling database cluster
- **VPC**: Isolated network with public, private, and database subnets
- **Secrets Manager**: Secure storage for database credentials
- **Security Groups**: Restricted database access within VPC

## Database Schema

### Tables

1. **vocabulary_books**: Stores different vocabulary book collections
2. **vocabulary_questions**: Individual vocabulary questions with Japanese/Nepali translations
3. **students**: Student user accounts
4. **student_answers**: Tracks student responses and correctness
5. **student_progress**: Overall progress per book per student
6. **review_schedule**: Spaced repetition scheduling for review

### Key Features

- Support for multiple vocabulary books (N4, N5, etc.)
- Japanese-Nepali language pair support
- Wrong answer tracking for targeted review
- Spaced repetition system
- Progress tracking and analytics

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18+ installed
- CDK CLI installed: `npm install -g aws-cdk`

### Deploy Infrastructure

```bash
# Install dependencies
cd infra
npm install

# Deploy development environment
./deploy.sh dev

# Deploy production environment
./deploy.sh prod
```

### Run Database Migrations

After deployment, get the database endpoint and password, then run:

```bash
# Get DB endpoint from CloudFormation outputs
aws cloudformation describe-stacks --stack-name VocabAppDevStack --query 'Stacks[0].Outputs'

# Get DB password from Secrets Manager
aws secretsmanager get-secret-value --secret-id <secret-arn> --query 'SecretString' --output text | jq -r '.password'

# Run migrations
./run-migrations.sh dev <db-endpoint> <db-password>
```

## Environment Differences

### Development
- Single Aurora instance (writer only)
- Min capacity: 0.5 ACU
- Max capacity: 2 ACU
- Backup retention: 3 days
- No deletion protection

### Production
- Aurora cluster with reader instance
- Min capacity: 1 ACU
- Max capacity: 16 ACU
- Backup retention: 7 days
- Deletion protection enabled

## Cost Optimization

- Aurora Serverless v2 scales to zero (0.5 ACU minimum in dev)
- Automated backup and maintenance windows during low-traffic hours
- Production includes read replica for better performance and availability

## Security

- Database in isolated subnets (no internet access)
- Credentials stored in AWS Secrets Manager
- Security groups restrict access to VPC only
- Encryption at rest enabled

## Useful Commands

```bash
# Deploy specific environment
npm run deploy:dev
npm run deploy:prod

# Destroy environment (careful!)
npm run destroy:dev
npm run destroy:prod

# View stack outputs
npx cdk ls --long

# Connect to database
mysql -h <endpoint> -u vocabadmin -p vocabapp
```

## Importing Vocabulary Data

To import your N4_vocab.json data:

1. Connect to the database
2. Insert a new vocabulary book record
3. Parse and insert the vocabulary questions
4. Update the sample data script as needed

Example query to import from JSON:
```sql
INSERT INTO vocabulary_questions (
    book_id, ka, renban, nepali_word, japanese_kanji, japanese_reading,
    nepali_sentence, japanese_question, japanese_example
) VALUES (
    1, 1, 1, 'शौक', '趣味', 'しゅみ',
    'मेरो शौक चलचित्र हेर्ने हो',
    '私の（　）は、映画をみることです',
    '私の趣味は、映画をみることです'
);
```