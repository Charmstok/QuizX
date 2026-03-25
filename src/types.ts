export type StudyTab = 'home' | 'quiz' | 'recite' | 'wrong';

export type QuestionType = '判断' | '单选' | '多选' | '填空';

export type QuestionBank = {
  id: string;
  name: string;
  source: '本地 Excel' | '微信 Excel';
  questionCount: number;
  updatedAt: string;
  questionTypes: QuestionType[];
};
