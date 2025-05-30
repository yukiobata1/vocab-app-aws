import type { 
  VocabQuestion, 
  QuizConfig, 
  QuizTemplate,
  QuizTemplateQuestion,
  QuizQuestion,
  QuizInstance,
  QuestionType
} from '../types/quiz';
import { QUESTION_TYPE_CONFIGS } from '../types/quiz';
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
// function shuffleArray<T>(array: T[]): T[] {
//   const shuffled = [...array];
//   for (let i = shuffled.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//   }
//   return shuffled;
// }

/**
 * 決定論的シャッフル（シード値ベース）
 */
function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;
  
  // Simple linear congruential generator
  const random = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % Math.pow(2, 32);
    return currentSeed / Math.pow(2, 32);
  };
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * すべての可能な選択肢を収集（テンプレート用）
 */
function collectAllOptions(
  correctAnswer: string,
  allQuestions: VocabQuestion[],
  optionsField: keyof VocabQuestion
): string[] {
  return allQuestions
    .map(q => q[optionsField] as string)
    .filter(option => option && option !== correctAnswer && option.trim() !== '')
    .filter((option, index, array) => array.indexOf(option) === index); // 重複除去
}

/**
 * 固定された問題セットを生成（決定論的）
 */
function generateFixedQuestionSet(
  allQuestions: VocabQuestion[],
  config: QuizConfig
): { vocab: VocabQuestion; type: QuestionType }[] {
  // 課の範囲でフィルタリング
  const filteredQuestions = allQuestions.filter(
    q => q.ka >= config.lessonRange.start && q.ka <= config.lessonRange.end
  );

  if (filteredQuestions.length === 0) {
    throw new Error('指定された課の範囲に語彙が見つかりません');
  }

  // 決定論的に語彙を選択（課番号順、IDの小さい順）
  const sortedQuestions = filteredQuestions.sort((a, b) => {
    if (a.ka !== b.ka) return a.ka - b.ka;
    return a.id - b.id;
  });

  const selectedQuestions = sortedQuestions.slice(0, config.questionCount);
  const questionSet: { vocab: VocabQuestion; type: QuestionType }[] = [];

  for (let i = 0; i < selectedQuestions.length; i++) {
    const vocab = selectedQuestions[i];
    
    // 有効な出題形式を取得
    const availableTypes = config.enabledQuestionTypes.filter(type => {
      const typeConfig = QUESTION_TYPE_CONFIGS[type];
      // 複数の質問フィールドのうち少なくとも一つが存在することを確認
      const hasValidQuestion = typeConfig.questionFields.some(field => {
        const questionText = vocab[field] as string;
        return questionText && questionText.trim() !== '';
      });
      const answerText = vocab[typeConfig.answerField] as string;
      
      return hasValidQuestion && answerText && answerText.trim() !== '';
    });

    if (availableTypes.length === 0) {
      console.warn(`語彙 ${vocab.jp_kanji} に対する有効な出題形式がありません`);
      continue;
    }

    // 決定論的に出題形式を選択（問題のインデックスベース）
    const typeIndex = i % availableTypes.length;
    const selectedType = availableTypes[typeIndex];

    questionSet.push({ vocab, type: selectedType });
  }

  return questionSet;
}

/**
 * クイズテンプレートを生成
 */
export function generateQuizTemplate(
  apiQuestions: ApiVocabQuestion[], 
  config: QuizConfig, 
  templateName: string,
  createdBy: string
): QuizTemplate {
  const allQuestions = apiQuestions.map(convertApiDataToVocabQuestion);
  const questionSet = generateFixedQuestionSet(allQuestions, config);

  const templateQuestions: QuizTemplateQuestion[] = questionSet.map((item, index) => {
    const typeConfig = QUESTION_TYPE_CONFIGS[item.type];
    // 複数の質問フィールドがある場合は結合
    const questionTexts = typeConfig.questionFields.map(field => {
      const value = item.vocab[field] as string;
      return value || '';
    }).filter(text => text.trim() !== '');

    // 複数の質問文を適切に結合
    let questionText = '';
    if (questionTexts.length === 1) {
      questionText = questionTexts[0];
    } else if (questionTexts.length === 2) {
      // 例: 文脈 + ネパール語 の場合
      const [context, nepali] = questionTexts;
      if (typeConfig.questionFields.includes('japanese_question') && typeConfig.questionFields.includes('np1')) {
        questionText = `${context}\n\n意味：${nepali}`;
      } else {
        questionText = questionTexts.join(' / ');
      }
    } else {
      questionText = questionTexts.join(' / ');
    }
    
    const correctAnswer = item.vocab[typeConfig.answerField] as string;
    
    // すべての可能な選択肢を収集
    const allPossibleOptions = collectAllOptions(
      correctAnswer,
      allQuestions,
      typeConfig.optionsField
    );

    return {
      id: `template-q-${index + 1}`,
      type: item.type,
      questionText: questionText || '',
      correctAnswer,
      sourceVocabId: item.vocab.id,
      allPossibleOptions
    };
  });

  return {
    id: `template-${Date.now()}`,
    name: templateName,
    config,
    templateQuestions,
    createdAt: new Date().toISOString(),
    createdBy
  };
}

/**
 * テンプレートから個別のクイズインスタンスを生成
 */
export function generateQuizFromTemplate(
  template: QuizTemplate, 
  studentId: string
): QuizInstance {
  // 学生IDをシード値として使用（同じ学生なら同じ順序）
  const studentSeed = studentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const questions: QuizQuestion[] = template.templateQuestions.map((templateQ, index) => {
    // 学生ごとに異なる選択肢を生成
    const questionSeed = studentSeed + index;
    
    // 不正解選択肢をランダム選択（最大3個）
    const shuffledWrong = deterministicShuffle(templateQ.allPossibleOptions, questionSeed);
    const selectedWrong = shuffledWrong.slice(0, 3);
    
    // 正解と不正解を混ぜてシャッフル
    const allOptions = [templateQ.correctAnswer, ...selectedWrong];
    const finalOptions = deterministicShuffle(allOptions, questionSeed + 1000);

    return {
      id: `${template.id}-${templateQ.id}-${studentId}`,
      type: templateQ.type,
      questionText: templateQ.questionText,
      correctAnswer: templateQ.correctAnswer,
      options: finalOptions
    };
  });

  return {
    templateId: template.id,
    studentId,
    questions,
    generatedAt: new Date().toISOString()
  };
}