import type { 
  VocabQuestion, 
  QuizConfig, 
  QuizQuestion, 
  Quiz
} from '../types/quiz';
import { QuestionType, QUESTION_TYPE_CONFIGS } from '../types/quiz';
import type { VocabQuestion as ApiVocabQuestion } from '../config/api';

/**
 * API形式の語彙データをVocabQuestionに変換
 */
function convertApiDataToVocabQuestion(apiData: ApiVocabQuestion): VocabQuestion {
  return {
    id: apiData.id,
    ka: apiData.ka,
    np1: apiData.np1,
    jp_kanji: apiData.jp_kanji,
    jp_rubi: apiData.jp_rubi,
    nepali_sentence: apiData.nepali_sentence || '',
    japanese_question: apiData.japanese_question || '',
    japanese_example: apiData.japanese_example || '',
    extra_data: apiData.extra_data || {},
    created_at: apiData.created_at,
    updated_at: apiData.updated_at
  };
}

/**
 * 配列をシャッフル
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 語彙データから出題範囲をフィルタリング
 */
function filterQuestionsByKaRange(questions: VocabQuestion[], kaRange: { start: number; end: number }): VocabQuestion[] {
  return questions.filter(q => q.ka >= kaRange.start && q.ka <= kaRange.end);
}


/**
 * フォールバック対応の選択肢を生成
 */
function generateOptionsWithFallback(
  correctAnswer: string, 
  allQuestions: VocabQuestion[], 
  optionsField: keyof VocabQuestion,
  count: number = 4
): string[] {
  // 正解以外の選択肢を収集（フォールバック対応）
  const wrongOptions = allQuestions
    .map(q => getAnswerWithFallback(q, optionsField))
    .filter(option => option && option !== correctAnswer && option.trim() !== '')
    .filter((option, index, array) => array.indexOf(option) === index); // 重複除去

  // ランダムに選択
  const shuffledWrong = shuffleArray(wrongOptions);
  const selectedWrong = shuffledWrong.slice(0, count - 1);

  // 正解を含めてシャッフル
  const allOptions = [correctAnswer, ...selectedWrong];
  return shuffleArray(allOptions);
}

/**
 * フォールバック対応：jp_kanjiがない場合はjp_rubiを使用
 */
function getAnswerWithFallback(question: VocabQuestion, field: keyof VocabQuestion): string {
  const value = question[field] as string;
  
  // jp_kanjiが空でjp_rubiがある場合、jp_rubiを使用
  if (field === 'jp_kanji' && (!value || value.trim() === '') && question.jp_rubi && question.jp_rubi.trim() !== '') {
    return question.jp_rubi;
  }
  
  return value || '';
}

/**
 * 単一の問題を生成
 */
function generateSingleQuestion(
  sourceQuestion: VocabQuestion,
  questionType: QuestionType,
  allQuestions: VocabQuestion[]
): QuizQuestion {
  const config = QUESTION_TYPE_CONFIGS[questionType];
  
  // 複数の質問フィールドがある場合は結合
  const questionTexts = config.questionFields.map(field => {
    const value = sourceQuestion[field] as string;
    return value || '';
  }).filter(text => text.trim() !== '');

  // 複数の質問文を適切に結合
  let questionText = '';
  if (questionTexts.length === 1) {
    questionText = questionTexts[0];
  } else if (questionTexts.length === 2) {
    // 例: 文脈 + ネパール語 の場合
    const [context, nepali] = questionTexts;
    if (config.questionFields.includes('japanese_question') && config.questionFields.includes('np1')) {
      questionText = `${context}\n\n意味：${nepali}`;
    } else {
      questionText = questionTexts.join(' / ');
    }
  } else {
    questionText = questionTexts.join(' / ');
  }
  
  const correctAnswer = getAnswerWithFallback(sourceQuestion, config.answerField);
  
  // 選択肢生成（フォールバック対応）
  const options = generateOptionsWithFallback(
    correctAnswer,
    allQuestions,
    config.optionsField
  );

  return {
    id: `${sourceQuestion.id}-${questionType}-${Date.now()}`,
    type: questionType,
    questionText: questionText || '',
    correctAnswer,
    options
  };
}

/**
 * メイン関数：クイズを生成する
 */
export function generateQuiz(apiQuestions: ApiVocabQuestion[], config: QuizConfig): Quiz {
  // 1. API形式のデータを内部形式に変換
  const allQuestions = apiQuestions.map(convertApiDataToVocabQuestion);
  
  // 2. 課の範囲でフィルタリング
  const filteredQuestions = filterQuestionsByKaRange(allQuestions, config.lessonRange);
  
  if (filteredQuestions.length === 0) {
    throw new Error('指定された課の範囲に語彙が見つかりません');
  }

  // 3. 出題数分の語彙をランダム選択
  const shuffledQuestions = shuffleArray(filteredQuestions);
  const selectedQuestions = shuffledQuestions.slice(0, config.questionCount);

  // 4. 各語彙に対してランダムな出題形式を適用
  const generatedQuestions: QuizQuestion[] = [];

  for (const vocabQuestion of selectedQuestions) {
    // 有効な出題形式からランダム選択（フォールバック対応）
    const availableTypes = config.enabledQuestionTypes.filter(type => {
      const typeConfig = QUESTION_TYPE_CONFIGS[type];
      // 複数の質問フィールドのうち少なくとも一つが存在することを確認
      const hasValidQuestion = typeConfig.questionFields.some(field => {
        const questionText = vocabQuestion[field] as string;
        return questionText && questionText.trim() !== '';
      });
      const answerText = getAnswerWithFallback(vocabQuestion, typeConfig.answerField);
      
      // 問題文と答えが両方存在する場合のみ有効
      return hasValidQuestion && answerText && answerText.trim() !== '';
    });

    if (availableTypes.length === 0) {
      // フォールバックしても出題形式がない場合、スキップするのではなく警告のみ
      console.warn(`語彙 ${vocabQuestion.jp_kanji || vocabQuestion.jp_rubi || vocabQuestion.id} に対する有効な出題形式がありません`);
      
      // 最低限ネパール語→読みを試行
      if (vocabQuestion.np1 && vocabQuestion.jp_rubi) {
        try {
          const fallbackQuestion = generateSingleQuestion(
            vocabQuestion,
            QuestionType.NEPALI_TO_RUBI,
            allQuestions
          );
          generatedQuestions.push(fallbackQuestion);
        } catch (error) {
          console.error(`フォールバック問題生成エラー:`, error);
        }
      }
      continue;
    }

    const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    
    try {
      const quizQuestion = generateSingleQuestion(
        vocabQuestion,
        randomType,
        allQuestions // 選択肢生成には全語彙を使用
      );
      generatedQuestions.push(quizQuestion);
    } catch (error) {
      console.error(`問題生成エラー (${vocabQuestion.jp_kanji}):`, error);
    }
  }

  // 5. 生成された問題数が不足している場合の対処
  if (generatedQuestions.length === 0) {
    throw new Error('クイズ問題を生成できませんでした。語彙データを確認してください。');
  }

  if (generatedQuestions.length < config.questionCount) {
    console.warn(`要求された問題数 ${config.questionCount} に対して ${generatedQuestions.length} 問しか生成できませんでした`);
  }

  // 6. Quizオブジェクトとして返す
  return {
    id: `quiz-${Date.now()}`,
    config: {
      ...config,
      questionCount: generatedQuestions.length // 実際に生成された問題数に更新
    },
    questions: generatedQuestions,
    createdAt: new Date().toISOString()
  };
}

/**
 * 課の範囲を取得（利用可能な最小・最大課番号）
 */
export function getAvailableKaRange(questions: ApiVocabQuestion[]): { min: number; max: number } {
  if (questions.length === 0) {
    return { min: 1, max: 1 };
  }

  const kaNumbers = questions.map(q => q.ka).filter(ka => ka != null);
  return {
    min: Math.min(...kaNumbers),
    max: Math.max(...kaNumbers)
  };
}