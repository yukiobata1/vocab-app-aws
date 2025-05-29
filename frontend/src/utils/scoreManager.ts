interface ScoreRecord {
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: number;
  studentName: string;
}

interface ScoreStats {
  maxScore: number;
  maxPercentage: number;
  totalQuizzes: number;
  averagePercentage: number;
  recentScores: ScoreRecord[];
}

const STORAGE_KEY = 'vocab_quiz_scores';
const MAX_RECENT_SCORES = 10;

export class ScoreManager {
  static saveScore(score: number, totalQuestions: number, studentName: string): ScoreRecord {
    const percentage = Math.round((score / totalQuestions) * 100);
    const newRecord: ScoreRecord = {
      score,
      totalQuestions,
      percentage,
      timestamp: Date.now(),
      studentName
    };

    const existingScores = this.getAllScores();
    existingScores.push(newRecord);

    // Keep only the most recent scores
    const sortedScores = existingScores
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_RECENT_SCORES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedScores));
    
    return newRecord;
  }

  static getAllScores(): ScoreRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load scores:', error);
      return [];
    }
  }

  static getScoreStats(): ScoreStats {
    const scores = this.getAllScores();
    
    if (scores.length === 0) {
      return {
        maxScore: 0,
        maxPercentage: 0,
        totalQuizzes: 0,
        averagePercentage: 0,
        recentScores: []
      };
    }

    const maxScore = Math.max(...scores.map(s => s.score));
    const maxPercentage = Math.max(...scores.map(s => s.percentage));
    const totalQuizzes = scores.length;
    const averagePercentage = Math.round(
      scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length
    );

    return {
      maxScore,
      maxPercentage,
      totalQuizzes,
      averagePercentage,
      recentScores: scores.slice(0, 5) // Show only 5 most recent
    };
  }

  static getPersonalBest(studentName: string): ScoreRecord | null {
    const scores = this.getAllScores().filter(s => s.studentName === studentName);
    
    if (scores.length === 0) return null;
    
    return scores.reduce((best, current) => 
      current.percentage > best.percentage ? current : best
    );
  }

  static clearAllScores(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}