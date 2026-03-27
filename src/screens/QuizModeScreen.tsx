import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { SectionTitle } from '../components/SectionTitle';
import {
  createQuizSession,
  discardQuizSession,
  getInProgressQuizSession,
  listQuestionsByBank,
  saveQuizSession,
  saveQuizSessionProgress,
} from '../db/quizDb';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { colors, radius, spacing } from '../theme';
import type {
  QuestionBank,
  QuestionOption,
  QuizAnswerRecord,
  QuizQuestion,
  QuizSessionProgress,
  QuizSessionSummary,
} from '../types';
import { useSQLiteContext } from '../vendor/expoSqlite';

type QuizModeScreenProps = {
  banks: QuestionBank[];
};

export function QuizModeScreen({ banks }: QuizModeScreenProps) {
  const db = useSQLiteContext();
  const [activeBank, setActiveBank] = useState<QuestionBank | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<string[]>([]);
  const [draftTextAnswer, setDraftTextAnswer] = useState('');
  const [submittedAnswers, setSubmittedAnswers] = useState<QuizAnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuizSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingProgress, setIsSyncingProgress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentRecord = currentQuestion
    ? submittedAnswers.find((item) => item.questionId === currentQuestion.id) ?? null
    : null;

  useAndroidBackHandler(
    () => {
      if (isLoading || isSyncingProgress || isSaving) {
        return true;
      }

      if (activeBank || summary) {
        handleChangeBank();
        return true;
      }

      return false;
    },
    [activeBank, isLoading, isSaving, isSyncingProgress, summary],
  );

  const handleStartBank = async (bank: QuestionBank) => {
    setIsLoading(true);

    try {
      const nextQuestions = await listQuestionsByBank(db, bank.id);

      if (nextQuestions.length === 0) {
        Alert.alert('题库为空', '这个题库还没有可作答的题目，请先导入完整题库。');
        return;
      }

      let existingSession = await getInProgressQuizSession(db, bank.id);
      const existingSessionQuestions = existingSession
        ? buildQuestionsForSession(nextQuestions, existingSession.questionIds)
        : [];
      const existingSessionQuestionCount =
        existingSessionQuestions.length > 0 ? existingSessionQuestions.length : nextQuestions.length;

      if (existingSession && existingSession.questionIds.length > 0 && existingSessionQuestions.length === 0) {
        await discardQuizSession(db, existingSession.id);
        existingSession = null;
      }

      if (existingSession && existingSession.answeredQuestions >= existingSessionQuestionCount) {
        await discardQuizSession(db, existingSession.id);
        existingSession = null;
      }

      if (existingSession) {
        setIsLoading(false);
        const action = await promptQuizSessionChoice(
          bank.name,
          existingSession.answeredQuestions,
          nextQuestions.length,
        );

        if (action === 'cancel') {
          return;
        }

        setIsLoading(true);

        if (action === 'resume') {
          applySessionState(bank, existingSessionQuestions, existingSession);
          return;
        }

        await discardQuizSession(db, existingSession.id);
      }

      const createdSession = await createQuizSession(db, {
        bank,
        totalQuestions: nextQuestions.length,
        questionIds: nextQuestions.map((question) => question.id),
      });

      applySessionState(bank, nextQuestions, createdSession);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取题目失败。';
      Alert.alert('无法开始答题', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCurrent = async () => {
    if (!currentQuestion || currentRecord || isSyncingProgress) {
      return;
    }

    const selectedAnswers = buildSelectedAnswers(currentQuestion, draftAnswers, draftTextAnswer);

    if (selectedAnswers.length === 0) {
      Alert.alert('答案为空', getEmptyAnswerMessage(currentQuestion));
      return;
    }

    await submitAnswer(currentQuestion, selectedAnswers);
  };

  const handleAdvance = async () => {
    if (!currentQuestion || !currentRecord) {
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetDraftForNextQuestion();
      return;
    }

    if (!activeBank || !startedAt || !activeSessionId) {
      return;
    }

    setIsSaving(true);

    try {
      const savedSummary = await saveQuizSession(db, {
        sessionId: activeSessionId,
        bank: activeBank,
        startedAt,
        answers: submittedAnswers,
        totalQuestions: questions.length,
      });

      setSummary(savedSummary);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存答题记录失败。';
      Alert.alert('结果保存失败', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestartSameBank = () => {
    if (!activeBank) {
      return;
    }

    void handleStartBank(activeBank);
  };

  const handleChangeBank = () => {
    setActiveBank(null);
    setQuestions([]);
    setCurrentIndex(0);
    setDraftAnswers([]);
    setDraftTextAnswer('');
    setSubmittedAnswers([]);
    setStartedAt(null);
    setActiveSessionId(null);
    setSummary(null);
  };

  const resetDraftForNextQuestion = () => {
    setDraftAnswers([]);
    setDraftTextAnswer('');
  };

  const handlePickOption = async (option: QuestionOption) => {
    if (!currentQuestion || currentRecord || isSyncingProgress) {
      return;
    }

    if (currentQuestion.type === '单选' || currentQuestion.type === '判断') {
      const selectedAnswers = [option.key];
      setDraftAnswers(selectedAnswers);
      await submitAnswer(currentQuestion, selectedAnswers);
      return;
    }

    setDraftAnswers(
      draftAnswers.includes(option.key)
        ? draftAnswers.filter((item) => item !== option.key)
        : [...draftAnswers, option.key],
    );
  };

  const submitAnswer = async (question: QuizQuestion, selectedAnswers: string[]) => {
    if (!activeBank || !startedAt || !activeSessionId) {
      return;
    }

    const nextRecord = createAnswerRecord(question, selectedAnswers);
    const nextAnswers = [...submittedAnswers, nextRecord];

    setIsSyncingProgress(true);

    try {
      await saveQuizSessionProgress(db, {
        sessionId: activeSessionId,
        bank: activeBank,
        startedAt,
        answers: nextAnswers,
        totalQuestions: questions.length,
      });
      setSubmittedAnswers(nextAnswers);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存作答进度失败。';
      Alert.alert('保存进度失败', message);
    } finally {
      setIsSyncingProgress(false);
    }
  };

  const applySessionState = (
    bank: QuestionBank,
    nextQuestions: QuizQuestion[],
    session: QuizSessionProgress,
  ) => {
    setActiveBank(bank);
    setActiveSessionId(session.id);
    setQuestions(nextQuestions);
    setCurrentIndex(Math.min(session.answeredQuestions, Math.max(nextQuestions.length - 1, 0)));
    setDraftAnswers([]);
    setDraftTextAnswer('');
    setSubmittedAnswers(session.answers);
    setStartedAt(session.startedAt);
    setSummary(null);
  };

  if (summary && activeBank) {
    const wrongAnswers = submittedAnswers.filter((item) => !item.isCorrect);
    const accuracyText = `${Math.round(summary.accuracy * 100)}%`;

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle eyebrow="答题结果" title={activeBank.name} />

        <View style={styles.heroCard}>
          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricLabel}>正确率</Text>
              <Text style={styles.metricValue}>{accuracyText}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardSuccess]}>
              <Text style={styles.metricLabel}>答对</Text>
              <Text style={styles.metricValue}>{summary.correctQuestions}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>总题数</Text>
              <Text style={styles.metricValue}>{summary.totalQuestions}</Text>
            </View>
          </View>

        </View>

        {wrongAnswers.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>本轮错题</Text>
            <View style={styles.reviewList}>
              {wrongAnswers.slice(0, 6).map((item, index) => (
                <View key={item.questionId} style={styles.reviewCard}>
                  <Text style={styles.reviewIndex}>#{index + 1}</Text>
                  <Text style={styles.reviewStem}>{item.questionStem}</Text>
                  <Text style={styles.reviewMeta}>
                    正确答案：{formatAnswerText(currentQuestionForReview(item, questions), item.correctAnswers)}
                  </Text>
                  <Text style={styles.reviewMeta}>
                    你的答案：{formatAnswerText(currentQuestionForReview(item, questions), item.selectedAnswers)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.panel, styles.successPanel]}>
            <Text style={styles.panelTitle}>本轮全对</Text>
          </View>
        )}

        <View style={styles.actionGroup}>
          <Pressable
            onPress={handleRestartSameBank}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>再来一轮</Text>
          </Pressable>
          <Pressable
            onPress={handleChangeBank}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>更换题库</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!activeBank || !currentQuestion) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle eyebrow="答题模式" title="顺序练习" />

        {banks.length > 0 ? (
          <View style={styles.bankList}>
            {banks.map((bank) => (
              <Pressable
                key={bank.id}
                onPress={() => void handleStartBank(bank)}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.bankCard,
                  (pressed || isLoading) && styles.pressed,
                ]}
              >
                <View style={styles.bankHeader}>
                  <Text style={styles.bankName}>{bank.name}</Text>
                  <Text style={styles.bankSource}>{bank.source}</Text>
                </View>
                <Text style={styles.bankMeta}>
                  {bank.questionCount} 题 · {bank.questionTypes.join(' / ')}
                </Text>
                <Text style={styles.bankAction}>
                  {isLoading ? '加载中...' : '开始顺序练习'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有可作答的题库</Text>
            <Text style={styles.emptyText}>先回到首页导入 Excel，再进入答题模式开始练习。</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const progressText = `${currentIndex + 1} / ${questions.length}`;
  const correctCount = submittedAnswers.filter((item) => item.isCorrect).length;
  const requiresManualSubmit =
    currentQuestion.type === '多选' || currentQuestion.type === '填空';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle eyebrow="答题模式" title={activeBank.name} />

      <View style={styles.heroCard}>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>当前进度</Text>
            <Text style={styles.metricValue}>{progressText}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardSuccess]}>
            <Text style={styles.metricLabel}>已答对</Text>
            <Text style={styles.metricValue}>{correctCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>题型</Text>
            <Text style={styles.metricValue}>{currentQuestion.type}</Text>
          </View>
        </View>
      </View>

      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionMeta}>第 {currentIndex + 1} 题</Text>
          <Text style={styles.questionSource}>{currentQuestion.sourceSheet}</Text>
        </View>
        <Text style={styles.questionStem}>{currentQuestion.stem}</Text>

        {currentQuestion.type === '填空' ? (
          <View style={styles.fillPanel}>
            <TextInput
              value={draftTextAnswer}
              onChangeText={setDraftTextAnswer}
              editable={!currentRecord}
              placeholder="输入你的答案"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, currentRecord && styles.inputDisabled]}
            />
          </View>
        ) : (
          <View style={styles.optionList}>
            {currentQuestion.options.map((option) => {
              const isSelected = draftAnswers.includes(option.key);
              const isCorrectOption = currentRecord?.correctAnswers.includes(option.key) ?? false;
              const isWrongSelection =
                (currentRecord?.selectedAnswers.includes(option.key) ?? false) &&
                !isCorrectOption;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => void handlePickOption(option)}
                  disabled={Boolean(currentRecord) || isSyncingProgress}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    isCorrectOption && styles.optionCardCorrect,
                    isWrongSelection && styles.optionCardWrong,
                    pressed && !currentRecord && styles.pressed,
                  ]}
                >
                  <Text style={styles.optionKey}>{option.key}</Text>
                  <Text style={styles.optionText}>{option.text}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {currentRecord ? (
          <View style={[styles.feedbackCard, currentRecord.isCorrect ? styles.feedbackSuccess : styles.feedbackDanger]}>
            <Text style={styles.feedbackTitle}>{currentRecord.isCorrect ? '回答正确' : '回答错误'}</Text>
            <Text style={styles.feedbackText}>
              你的答案：{formatAnswerText(currentQuestion, currentRecord.selectedAnswers)}
            </Text>
            <Text style={styles.feedbackText}>
              正确答案：{formatAnswerText(currentQuestion, currentRecord.correctAnswers)}
            </Text>
            {currentQuestion.explanation ? (
              <Text style={styles.feedbackExplanation}>解析：{currentQuestion.explanation}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.actionGroup}>
        {currentRecord ? (
          <Pressable
            onPress={() => void handleAdvance()}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSaving) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? '保存结果中...'
                : currentIndex === questions.length - 1
                  ? '完成本轮并保存'
                  : '下一题'}
            </Text>
          </Pressable>
        ) : requiresManualSubmit ? (
          <Pressable
            onPress={() => void handleSubmitCurrent()}
            disabled={isSyncingProgress}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSyncingProgress) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSyncingProgress ? '保存中...' : '提交答案'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleChangeBank}
          disabled={isSaving || isSyncingProgress}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isSaving || isSyncingProgress) && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>返回题库列表并保留进度</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function buildSelectedAnswers(
  question: QuizQuestion,
  draftAnswers: string[],
  draftTextAnswer: string,
) {
  if (question.type === '填空') {
    return splitFillAnswers(draftTextAnswer);
  }

  return draftAnswers;
}

function buildQuestionsForSession(questions: QuizQuestion[], questionIds: string[]) {
  if (questionIds.length === 0) {
    return questions;
  }

  const byId = new Map(questions.map((question) => [question.id, question]));

  return questionIds
    .map((questionId) => byId.get(questionId) ?? null)
    .filter((question): question is QuizQuestion => Boolean(question));
}

function splitFillAnswers(value: string) {
  return value
    .split(/[\n/、,，;；|｜]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createAnswerRecord(
  question: QuizQuestion,
  selectedAnswers: string[],
) {
  return {
    questionId: question.id,
    questionType: question.type,
    questionStem: question.stem,
    selectedAnswers,
    correctAnswers: question.answers,
    isCorrect: isAnswerCorrect(question, selectedAnswers),
  };
}

function isAnswerCorrect(question: QuizQuestion, selectedAnswers: string[]) {
  if (question.type === '判断' || question.type === '单选') {
    return normalizeToken(selectedAnswers[0]) === normalizeToken(question.answers[0]);
  }

  if (question.type === '多选') {
    return compareUnorderedAnswers(selectedAnswers, question.answers);
  }

  return compareOrderedAnswers(selectedAnswers, question.answers);
}

function compareUnorderedAnswers(left: string[], right: string[]) {
  const leftTokens = Array.from(new Set(left.map(normalizeToken))).sort();
  const rightTokens = Array.from(new Set(right.map(normalizeToken))).sort();

  return JSON.stringify(leftTokens) === JSON.stringify(rightTokens);
}

function compareOrderedAnswers(left: string[], right: string[]) {
  const leftTokens = left.map(normalizeToken);
  const rightTokens = right.map(normalizeToken);

  return JSON.stringify(leftTokens) === JSON.stringify(rightTokens);
}

function normalizeToken(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function formatAnswerText(question: QuizQuestion | null, answers: string[]) {
  if (!question || question.type === '填空') {
    return answers.join(' / ');
  }

  return answers
    .map((answer) => {
      const option = question.options.find((item) => item.key === answer);
      return option ? `${option.key}. ${option.text}` : answer;
    })
    .join(' / ');
}

function getEmptyAnswerMessage(question: QuizQuestion) {
  if (question.type === '填空') {
    return '请先输入答案，再提交。';
  }

  return '请先选择答案，再提交。';
}

function currentQuestionForReview(record: QuizAnswerRecord, questions: QuizQuestion[]) {
  return questions.find((item) => item.id === record.questionId) ?? null;
}

function promptQuizSessionChoice(
  bankName: string,
  answeredQuestions: number,
  totalQuestions: number,
) {
  return new Promise<'resume' | 'restart' | 'cancel'>((resolve) => {
    let settled = false;
    const finish = (value: 'resume' | 'restart' | 'cancel') => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    Alert.alert(
      bankName,
      `检测到上次未完成的练习，已答 ${answeredQuestions}/${totalQuestions} 题。`,
      [
        { text: '继续上次练习', onPress: () => finish('resume') },
        { text: '重新开始', onPress: () => finish('restart') },
        { text: '取消', style: 'cancel', onPress: () => finish('cancel') },
      ],
      {
        cancelable: true,
        onDismiss: () => finish('cancel'),
      },
    );
  });
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 92,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metricCardPrimary: {
    backgroundColor: colors.brandSoft,
  },
  metricCardSuccess: {
    backgroundColor: colors.successSoft,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  bankList: {
    gap: spacing.md,
  },
  bankCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bankName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  bankSource: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  bankMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bankAction: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  questionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  questionSource: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  questionStem: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '800',
  },
  optionList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  optionCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  optionCardCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  optionCardWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  optionKey: {
    width: 22,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  optionText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  fillPanel: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  feedbackCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSoft,
  },
  feedbackDanger: {
    backgroundColor: colors.dangerSoft,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
  },
  feedbackExplanation: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  successPanel: {
    backgroundColor: colors.successSoft,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  panelDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  reviewList: {
    gap: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reviewIndex: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewStem: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
  },
  reviewMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  actionGroup: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.onBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
