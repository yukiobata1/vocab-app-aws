# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Japanese-Nepali vocabulary learning application with a React TypeScript frontend and AWS serverless backend. The app supports quiz-based vocabulary practice with multiple question types and real-time collaborative features.

## Architecture

### Frontend (`/frontend`)
- **Framework**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Testing**: Vitest + React Testing Library
- **State Management**: Quiz state managed through React Context/local state
- **API Integration**: REST API calls to AWS Lambda functions

### Backend (Serverless AWS)
- **Infrastructure**: AWS CDK in TypeScript (`/infra`)
- **Database**: Aurora Serverless v2 PostgreSQL with RDS Proxy
- **API**: Lambda functions behind API Gateway
- **Languages**: Python 3.9 for Lambda functions

### Key Components
- **Quiz System**: Support for 7 different question types (Nepali↔Japanese, Kanji↔Reading, Fill-in-blank)
- **Multi-tenant**: Vocabulary books (N4, N5, etc.) with lesson-based organization
- **Real-time Features**: Teacher dashboard and student rooms (WebSocket integration planned)

## Development Commands

### Frontend Development
```bash
cd frontend
npm install           # Install dependencies
npm run dev          # Start development server (Vite)
npm run build        # Build for production (TypeScript + Vite)
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:ui      # Run tests with Vitest UI
npm run preview      # Preview production build
```

### Infrastructure Management
```bash
cd infra
npm install          # Install CDK dependencies
npm run build        # Compile TypeScript
npm run watch        # Watch for changes
npm run test         # Run Jest tests
npm run deploy:dev   # Deploy to development environment
npm run deploy:prod  # Deploy to production environment
npm run destroy:dev  # Destroy development stack
npm run destroy:prod # Destroy production stack
```

### Database Operations
```bash
# After infrastructure deployment, run migrations
cd infra
aws secretsmanager get-secret-value --secret-id <secret-arn> --query 'SecretString' --output text | jq -r '.password'
# Use the DB endpoint from CloudFormation outputs to connect
```

## Code Organization

### Frontend Structure
- `src/components/Quiz/`: React components for quiz functionality
  - `QuizContainer.tsx`: Main quiz orchestration
  - `TeacherDashboard.tsx`: Teacher controls and monitoring
  - `StudentQuiz.tsx`: Student quiz interface
- `src/types/quiz.ts`: TypeScript definitions for quiz system and question types
- `src/utils/`: Quiz generation and room management utilities
- `src/config/api.ts`: API configuration and endpoint definitions

### Infrastructure
- `lib/vocab-app-stack.ts`: Main CDK stack with Aurora, Lambda, and API Gateway
- `lambda/api/`: Python Lambda functions for CRUD operations
- Two environments: `dev` (single writer, 0.5-2 ACU) and `prod` (with reader, 1-16 ACU)

### Question Types System
The quiz supports 7 configurable question types defined in `types/quiz.ts`:
- Nepali → Kanji/Reading
- Kanji ↔ Reading  
- Context-based fill-in-blank
- Japanese → Nepali

## Environment Configuration

### Frontend Environment Variables
- `VITE_API_BASE_URL`: API Gateway base URL
- `VITE_API_VOCAB_ENDPOINT`: Vocabulary API endpoint
- `VITE_APP_ENV`: Environment (development/production)

### AWS Configuration
- Development: Aurora scales 0.5-2 ACU, 3-day backup
- Production: Aurora scales 1-16 ACU, 7-day backup, deletion protection
- Database credentials stored in AWS Secrets Manager
- Lambda functions use psycopg2 layer for PostgreSQL connectivity

## Database Schema

Key tables:
- `vocabulary_books`: Book metadata (N4, N5, etc.)
- `vocabulary_questions`: Individual vocab items with Japanese/Nepali translations
- `students`: User accounts
- `student_answers`: Response tracking
- `student_progress`: Progress per book per student
- `review_schedule`: Spaced repetition system

## Development Notes

- Frontend uses Vite for fast development with HMR
- TypeScript strict mode enabled
- Quiz questions generate 4-choice multiple choice with intelligent distractors
- API endpoints handle both vocabulary books listing and individual questions
- Infrastructure supports both development and production environments with different scaling parameters