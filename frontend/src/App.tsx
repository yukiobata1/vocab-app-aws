import React, { useState, useEffect } from 'react';

import './App.css'

interface VocabItem {
  ka: number;
  NP1: string;
  'JP-kanji': string;
  'JP-rubi': string;
  'NP-sentence': string;
  'JP-question': string;
  exa: string;
  renban: number;
  S0: number;
  S3: string;
  S5: string;
  S7: string;
  S2: string;
  S4: string;
  N2: string;
  N4: string;
  N6: string;
  N8: string;
  '': string;
  __1: string;
  __2: string;
  __3: string;
  __4: string;
  __5: string;
  __6: string;
  __7: string;
  __8: string;
}

interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
}

function App() {
  const [allVocab, setAllVocab] = useState<VocabItem[]>([]);
  const [quizData, setQuizData] = useState<QuizData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/N4_vocab.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch N4_vocab.json');
        }
        return res.json();
      })
      .then((data: VocabItem[]) => {
        if (data && data.length > 0) {
          setAllVocab(data);
        } else {
          console.error('No data or empty data in N4_vocab.json');
          // Handle empty or invalid data scenario
        }
      })
      .catch(error => {
        console.error("Error fetching vocab data:", error);
        // Handle fetch error (e.g., show error message to user)
      });
  }, []);

  useEffect(() => {
    if (allVocab.length > 0) {
      generateQuizData(allVocab);
      setIsLoading(false);
    }
  }, [allVocab]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  const generateQuizData = (vocabData: VocabItem[]) => {
    const filteredVocab = vocabData.filter(item => item['JP-question'] && (item['JP-kanji'] || item['JP-rubi']));
    if (filteredVocab.length === 0) {
        console.error("No usable vocab items to generate quiz.");
        setQuizData([]); // クイズデータがない状態を明確にする
        setIsLoading(false);
        return;
    }

    const selectedVocab = shuffleArray(filteredVocab).slice(0, 10);
    if (selectedVocab.length < 10 && filteredVocab.length >=10) {
        console.warn("Could not select 10 unique items for the quiz. Using available items:", selectedVocab.length);
    }
    if (selectedVocab.length === 0 && filteredVocab.length > 0) {
        console.error("Selected vocab is empty even though filtered vocab has items.");
    }


    const newQuizData = selectedVocab.map((item) => {
      const correctAnswer = item['JP-kanji'] || item['JP-rubi'];
      const options: string[] = [correctAnswer];
      const allPossibleOptions = shuffleArray(
        filteredVocab
          .map(v => v['JP-kanji'] || v['JP-rubi'])
          .filter(opt => opt && opt !== correctAnswer)
      );

      let optionIndex = 0;
      while (options.length < 4 && optionIndex < allPossibleOptions.length) {
        const potentialOption = allPossibleOptions[optionIndex];
        if (!options.includes(potentialOption)) {
          options.push(potentialOption);
        }
        optionIndex++;
      }

      while (options.length < 4) {
        const randomFallback = vocabData[Math.floor(Math.random() * vocabData.length)];
        const fallbackOption = randomFallback['JP-kanji'] || randomFallback['JP-rubi'];
        if(fallbackOption && !options.includes(fallbackOption)){
            options.push(fallbackOption);
        } else if (fallbackOption && options.length < 4) { 
             options.push(fallbackOption + " "); 
        } else if (options.length < 4) {
            options.push("選択肢" + options.length); // Ensure unique placeholder
        }
      }


      return {
        question: item['JP-question'],
        options: shuffleArray(options.slice(0,4)), // Ensure exactly 4 options
        correctAnswer: correctAnswer,
      };
    });
    setQuizData(newQuizData);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizFinished(false);
  };

  const handleAnswer = (selectedAnswer: string) => {
    if (quizData.length === 0) return;

    const isCorrect = selectedAnswer === quizData[currentQuestionIndex].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestionIndex < quizData.length - 1) {
      // QuizCard handles its own feedback display and timing
      // App just needs to know when to advance the question or finish
      // setCurrentQuestionIndex will be called by QuizCard after its internal delay
    } else {
      // setQuizFinished(true); // This will also be triggered by QuizCard logic after its delay
    }
  };
  
  const proceedToNextQuestion = () => {
      if (currentQuestionIndex < quizData.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
          setQuizFinished(true);
      }
  };


  const restartQuiz = () => {
    if (allVocab.length > 0) {
      setIsLoading(true);
      generateQuizData(allVocab);
      // setIsLoading(false); // This should be set after quizData is ready
    }
  };
  
  useEffect(() => {
    if (quizData.length > 0 && isLoading) {
        setIsLoading(false);
    }
  }, [quizData, isLoading]);

  if (isLoading) {
    return <div className="loading-container">読み込み中...</div>;
  }

  if (quizData.length === 0 && !isLoading) {
    return <div className="error-container">クイズを読み込めませんでした。データを確認し、ページを再読み込みしてください。</div>;
  }

  return (
    <div className="app-container">
      {!quizFinished ? (
        quizData.length > 0 && currentQuestionIndex < quizData.length ? (
          <QuizCard
            key={currentQuestionIndex} 
            questionData={quizData[currentQuestionIndex]}
            onAnswer={handleAnswer} // App's logic to update score
            onQuestionEnd={proceedToNextQuestion} // App's logic to advance question
          />
        ) : (
          <div className="loading-container">クイズの準備中...</div>
        )
      ) : (
        <ResultCard score={score} totalQuestions={quizData.length} onRestart={restartQuiz} />
      )}
    </div>
  );
}

interface QuizCardProps {
  questionData: QuizData;
  onAnswer: (selectedAnswer: string) => void; // For score calculation
  onQuestionEnd: () => void; // To proceed to next question or result
}

const QuizCard: React.FC<QuizCardProps> = ({ questionData, onAnswer, onQuestionEnd }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<{[key: string]: string | null}>({});
  const [sounds, setSounds] = useState<{correct: HTMLAudioElement, incorrect: HTMLAudioElement} | null>(null);

  useEffect(() => {
    const correctSound = new Audio('/right.mp3');
    const incorrectSound = new Audio('/wrong.mp3');
    
    // 音声ファイルをプリロード
    correctSound.load();
    incorrectSound.load();
    
    setSounds({ correct: correctSound, incorrect: incorrectSound });
  }, []);

  const handleOptionClick = (option: string) => {
    if (selectedOption || !sounds) return;

    setSelectedOption(option);
    onAnswer(option);

    const isCorrect = option === questionData.correctAnswer;
    
    // 振動フィードバック
    if (navigator.vibrate) {
      navigator.vibrate(isCorrect ? 100 : 200);
    }

    // 音声フィードバック
    if (isCorrect) {
      sounds.correct.play().catch(e => console.log('音声の再生に失敗しました:', e));
    } else {
      sounds.incorrect.play().catch(e => console.log('音声の再生に失敗しました:', e));
    }

    const newFeedbackStates: {[key: string]: string | null} = {};
    questionData.options.forEach(opt => {
        if (opt === questionData.correctAnswer) {
            newFeedbackStates[opt] = 'correct';
        } else if (opt === option && option !== questionData.correctAnswer) {
            newFeedbackStates[opt] = 'incorrect';
        } else {
            newFeedbackStates[opt] = null;
        }
    });
    setFeedbackStates(newFeedbackStates);

    setTimeout(() => {
      onQuestionEnd();
      setSelectedOption(null);
      setFeedbackStates({});
    }, 2000);
  };
  
  if (!questionData) {
    return <div className="loading-container">問題データを読み込んでいます...</div>;
  }

  return (
    <div className="quiz-card">
      <h2 className="question-text">{questionData.question}</h2>
      <div className="options-grid">
        {questionData.options.map((option, index) => {
          let buttonClass = 'option-button';
          // Apply feedback class if this option was selected or is the correct answer (after selection)
          if (selectedOption) {
            if (feedbackStates[option] === 'correct') {
              buttonClass += ' correct';
            } else if (feedbackStates[option] === 'incorrect') {
              buttonClass += ' incorrect';
            } else if (option === questionData.correctAnswer && selectedOption !== questionData.correctAnswer && feedbackStates[selectedOption] === 'incorrect'){
              // If wrong answer was selected, also highlight the correct one.
              buttonClass += ' correct-answer-reveal'; // A different style for revealed correct answer
            }
          }
          return (
            <button
              key={index}
              className={buttonClass}
              onClick={() => handleOptionClick(option)}
              disabled={!!selectedOption}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ResultCardProps {
  score: number;
  totalQuestions: number;
  onRestart: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ score, totalQuestions, onRestart }) => {
  const getMotivationalMessage = () => {
    if (totalQuestions === 0) return "問題がありませんでした。";
    const percentage = (score / totalQuestions) * 100;
    if (percentage === 100) return "素晴らしい！全問正解です！🎉";
    if (percentage >= 80) return "すごい！あと少しで全問正解！💪";
    if (percentage >= 60) return "よくできました！この調子で頑張ろう！👍";
    if (percentage >= 40) return "ナイスチャレンジ！次はもっとできる！😊";
    return "お疲れ様でした！続けて挑戦しよう！✨";
  };

  return (
    <div className="result-card">
      <h2 className="result-title">クイズ終了！</h2>
      <p className="score-display">正答数: {score} / {totalQuestions}</p>
      <p className="motivational-message">{getMotivationalMessage()}</p>
      <button onClick={onRestart} className="restart-button">もう一度挑戦する</button>
    </div>
  );
};

export default App
