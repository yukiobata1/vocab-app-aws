import type { QuizTemplate } from '../types/quiz';

/**
 * クイズテンプレートをローカルストレージで管理するサービス
 * 将来的にはバックエンドAPIに置き換え可能
 */
class QuizTemplateService {
  private readonly TEMPLATES_KEY = 'vocab_quiz_templates';
  private readonly ACTIVE_TEMPLATE_KEY = 'vocab_active_template';

  /**
   * すべてのテンプレートを取得
   */
  getAllTemplates(): QuizTemplate[] {
    try {
      const stored = localStorage.getItem(this.TEMPLATES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('テンプレート読み込みエラー:', error);
      return [];
    }
  }

  /**
   * 特定のテンプレートを取得
   */
  getTemplate(id: string): QuizTemplate | null {
    const templates = this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * テンプレートを保存
   */
  saveTemplate(template: QuizTemplate): void {
    try {
      const templates = this.getAllTemplates();
      const existingIndex = templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      } else {
        templates.push(template);
      }
      
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('テンプレート保存エラー:', error);
      throw new Error('テンプレートの保存に失敗しました');
    }
  }

  /**
   * テンプレートを削除
   */
  deleteTemplate(id: string): boolean {
    try {
      const templates = this.getAllTemplates();
      const filteredTemplates = templates.filter(t => t.id !== id);
      
      if (filteredTemplates.length === templates.length) {
        return false; // テンプレートが見つからない
      }
      
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(filteredTemplates));
      
      // アクティブなテンプレートが削除された場合はクリア
      if (this.getActiveTemplateId() === id) {
        this.clearActiveTemplate();
      }
      
      return true;
    } catch (error) {
      console.error('テンプレート削除エラー:', error);
      return false;
    }
  }

  /**
   * アクティブなテンプレートIDを設定
   */
  setActiveTemplate(templateId: string): void {
    try {
      localStorage.setItem(this.ACTIVE_TEMPLATE_KEY, templateId);
    } catch (error) {
      console.error('アクティブテンプレート設定エラー:', error);
    }
  }

  /**
   * アクティブなテンプレートIDを取得
   */
  getActiveTemplateId(): string | null {
    try {
      return localStorage.getItem(this.ACTIVE_TEMPLATE_KEY);
    } catch (error) {
      console.error('アクティブテンプレート取得エラー:', error);
      return null;
    }
  }

  /**
   * アクティブなテンプレートを取得
   */
  getActiveTemplate(): QuizTemplate | null {
    const activeId = this.getActiveTemplateId();
    return activeId ? this.getTemplate(activeId) : null;
  }

  /**
   * アクティブなテンプレートをクリア
   */
  clearActiveTemplate(): void {
    try {
      localStorage.removeItem(this.ACTIVE_TEMPLATE_KEY);
    } catch (error) {
      console.error('アクティブテンプレートクリアエラー:', error);
    }
  }

  /**
   * テンプレート名が既に存在するかチェック
   */
  isNameExists(name: string, excludeId?: string): boolean {
    const templates = this.getAllTemplates();
    return templates.some(t => t.name === name && t.id !== excludeId);
  }

  /**
   * テンプレートの統計情報を取得
   */
  getTemplateStats(templateId: string): {
    totalQuestions: number;
    questionTypes: string[];
    lessonRange: string;
    createdAt: string;
  } | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const questionTypes = [...new Set(template.templateQuestions.map(q => q.type))];
    const lessonRange = `課${template.config.lessonRange.start}-${template.config.lessonRange.end}`;

    return {
      totalQuestions: template.templateQuestions.length,
      questionTypes,
      lessonRange,
      createdAt: template.createdAt
    };
  }

  /**
   * すべてのデータをクリア（デバッグ用）
   */
  clearAllData(): void {
    try {
      localStorage.removeItem(this.TEMPLATES_KEY);
      localStorage.removeItem(this.ACTIVE_TEMPLATE_KEY);
    } catch (error) {
      console.error('データクリアエラー:', error);
    }
  }

  /**
   * データをエクスポート（バックアップ用）
   */
  exportData(): string {
    const templates = this.getAllTemplates();
    const activeTemplateId = this.getActiveTemplateId();
    
    return JSON.stringify({
      templates,
      activeTemplateId,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * データをインポート（バックアップから復元）
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('無効なデータ形式です');
      }
      
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(data.templates));
      
      if (data.activeTemplateId) {
        localStorage.setItem(this.ACTIVE_TEMPLATE_KEY, data.activeTemplateId);
      }
      
      return true;
    } catch (error) {
      console.error('データインポートエラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const quizTemplateService = new QuizTemplateService();