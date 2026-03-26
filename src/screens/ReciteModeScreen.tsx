import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { SectionTitle } from '../components/SectionTitle';
import {
  createReciteSession,
  discardReciteSession,
  getInProgressReciteSession,
  listQuestionsByBank,
  listReciteProgressByBank,
  submitReciteFeedback,
} from '../db/quizDb';
import { colors, radius, spacing } from '../theme';
import type {
  QuestionBank,
  QuizQuestion,
  ReciteFeedback,
  ReciteProgressRecord,
  ReciteSessionProgress,
  ReciteSessionSummary,
} from '../types';
import { useSQLiteContext } from '../vendor/expoSqlite';

type ReciteModeScreenProps = {
  banks: QuestionBank[];
};

export function ReciteModeScreen({ banks }: ReciteModeScreenProps) {
  const db = useSQLiteContext();
  const [activeBank, setActiveBank] = useState<QuestionBank | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [progressByQuestionId, setProgressByQuestionId] = useState<Record<string, ReciteProgressRecord>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedQuestions, setReviewedQuestions] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [fuzzyCount, setFuzzyCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [summary, setSummary] = useState<ReciteSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentProgress = currentQuestion ? progressByQuestionId[currentQuestion.id] ?? null : null;

  const handleStartBank = async (bank: QuestionBank) => {
    setIsLoading(true);

    try {
      const [nextQuestions, progressRecords] = await Promise.all([
        listQuestionsByBank(db, bank.id),
        listReciteProgressByBank(db, bank.id),
      ]);
      const nextProgressByQuestionId = createProgressMap(progressRecords);

      if (nextQuestions.length === 0) {
        Alert.alert('题库为空', '这个题库还没有可背诵的题目，请先导入完整题库。');
        return;
      }

      let existingSession = await getInProgressReciteSession(db, bank.id);
      const existingSessionQuestions = existingSession
        ? buildQuestionsForSession(nextQuestions, existingSession.questionIds)
        : [];
      const existingSessionQuestionCount =
        existingSessionQuestions.length > 0 ? existingSessionQuestions.length : nextQuestions.length;

      if (
        existingSession &&
        existingSession.questionIds.length > 0 &&
        existingSessionQuestions.length === 0
      ) {
        await discardReciteSession(db, existingSession.id);
        existingSession = null;
      }

      if (
        existingSession &&
        (existingSession.reviewedQuestions >= existingSessionQuestionCount ||
          existingSession.currentIndex >= existingSessionQuestionCount)
      ) {
        await discardReciteSession(db, existingSession.id);
        existingSession = null;
      }

      if (existingSession) {
        setIsLoading(false);
        const action = await promptReciteSessionChoice(
          bank.name,
          existingSession.reviewedQuestions,
          nextQuestions.length,
        );

        if (action === 'cancel') {
          return;
        }

        setIsLoading(true);

        if (action === 'resume') {
          applySessionState(
            bank,
            existingSessionQuestions,
            existingSession,
            nextProgressByQuestionId,
          );
          return;
        }

        await discardReciteSession(db, existingSession.id);
      }

      const nextQueue = buildReciteQueue(nextQuestions, nextProgressByQuestionId);

      const createdSession = await createReciteSession(db, {
        bank,
        totalQuestions: nextQueue.length,
        questionIds: nextQueue.map((item) => item.id),
      });

      applySessionState(bank, nextQueue, createdSession, nextProgressByQuestionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取题目失败。';
      Alert.alert('无法开始背诵', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevealAnswer = () => {
    if (!currentQuestion || isSaving) {
      return;
    }

    setIsAnswerVisible(true);
  };

  const handleSubmitFeedback = async (feedback: ReciteFeedback) => {
    if (!activeBank || !activeSessionId || !startedAt || !currentQuestion || !isAnswerVisible || isSaving) {
      return;
    }

    const nextReviewedQuestions = reviewedQuestions + 1;
    const nextKnownCount = knownCount + (feedback === 'known' ? 1 : 0);
    const nextFuzzyCount = fuzzyCount + (feedback === 'fuzzy' ? 1 : 0);
    const nextUnknownCount = unknownCount + (feedback === 'unknown' ? 1 : 0);
    const isLastQuestion = currentIndex === questions.length - 1;

    setIsSaving(true);

    try {
      const result = await submitReciteFeedback(db, {
        sessionId: activeSessionId,
        bank: activeBank,
        questionId: currentQuestion.id,
        feedback,
        totalQuestions: questions.length,
        reviewedQuestions: nextReviewedQuestions,
        currentIndex: currentIndex + 1,
        knownCount: nextKnownCount,
        fuzzyCount: nextFuzzyCount,
        unknownCount: nextUnknownCount,
        startedAt,
        completeSession: isLastQuestion,
      });
      setProgressByQuestionId((previous) => ({
        ...previous,
        [result.progress.questionId]: result.progress,
      }));

      if (result.summary) {
        setReviewedQuestions(nextReviewedQuestions);
        setKnownCount(nextKnownCount);
        setFuzzyCount(nextFuzzyCount);
        setUnknownCount(nextUnknownCount);
        setIsAnswerVisible(false);
        setSummary(result.summary);
        return;
      }

      if (!result.session) {
        throw new Error('背诵进度未返回。');
      }

      setReviewedQuestions(result.session.reviewedQuestions);
      setCurrentIndex(result.session.currentIndex);
      setKnownCount(result.session.knownCount);
      setFuzzyCount(result.session.fuzzyCount);
      setUnknownCount(result.session.unknownCount);
      setIsAnswerVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存背诵进度失败。';
      Alert.alert('保存进度失败', message);
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
    setActiveSessionId(null);
    setQuestions([]);
    setProgressByQuestionId({});
    setCurrentIndex(0);
    setReviewedQuestions(0);
    setKnownCount(0);
    setFuzzyCount(0);
    setUnknownCount(0);
    setStartedAt(null);
    setIsAnswerVisible(false);
    setSummary(null);
  };

  const applySessionState = (
    bank: QuestionBank,
    nextQuestions: QuizQuestion[],
    session: ReciteSessionProgress,
    nextProgressByQuestionId: Record<string, ReciteProgressRecord>,
  ) => {
    setActiveBank(bank);
    setActiveSessionId(session.id);
    setQuestions(nextQuestions);
    setProgressByQuestionId(nextProgressByQuestionId);
    setCurrentIndex(Math.min(session.currentIndex, Math.max(nextQuestions.length - 1, 0)));
    setReviewedQuestions(Math.min(session.reviewedQuestions, nextQuestions.length));
    setKnownCount(session.knownCount);
    setFuzzyCount(session.fuzzyCount);
    setUnknownCount(session.unknownCount);
    setStartedAt(session.startedAt);
    setIsAnswerVisible(false);
    setSummary(null);
  };

  if (summary && activeBank) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle eyebrow="背诵结果" title={activeBank.name} />

        <View style={styles.heroCard}>
          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricLabel}>总题数</Text>
              <Text style={styles.metricValue}>{summary.totalQuestions}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardSuccess]}>
              <Text style={styles.metricLabel}>记住了</Text>
              <Text style={styles.metricValue}>{summary.knownCount}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardWarning]}>
              <Text style={styles.metricLabel}>有点模糊</Text>
              <Text style={styles.metricValue}>{summary.fuzzyCount}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardDanger]}>
              <Text style={styles.metricLabel}>还不会</Text>
              <Text style={styles.metricValue}>{summary.unknownCount}</Text>
            </View>
          </View>
        </View>

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
        <SectionTitle eyebrow="背诵模式" title="背诵练习" />

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
                  {isLoading ? '加载中...' : '开始背诵'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有可背诵的题库</Text>
            <Text style={styles.emptyText}>先回到首页导入 Excel，再进入背诵模式。</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const progressText = `${currentIndex + 1} / ${questions.length}`;
  const shouldShowAnswerDetails =
    currentQuestion.type === '填空' || Boolean(currentQuestion.explanation);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle eyebrow="背诵模式" title={activeBank.name} />

      <View style={styles.heroCard}>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>当前进度</Text>
            <Text style={styles.metricValue}>{progressText}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardSuccess]}>
            <Text style={styles.metricLabel}>记住了</Text>
            <Text style={styles.metricValue}>{knownCount}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardWarning]}>
            <Text style={styles.metricLabel}>有点模糊</Text>
            <Text style={styles.metricValue}>{fuzzyCount}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardDanger]}>
            <Text style={styles.metricLabel}>还不会</Text>
            <Text style={styles.metricValue}>{unknownCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionMeta}>第 {currentIndex + 1} 题</Text>
          <Text style={styles.questionSource}>{currentQuestion.sourceSheet}</Text>
        </View>
        <Text style={styles.questionStem}>{currentQuestion.stem}</Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusChip, styles.statusChipPrimary]}>
            <Text style={styles.statusChipText}>
              {formatMasteryLabel(currentProgress)}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {currentProgress ? `${currentProgress.reviewCount} 次` : '0 次'}
            </Text>
          </View>
          {currentProgress?.lastResult ? (
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>{formatFeedbackLabel(currentProgress.lastResult)}</Text>
            </View>
          ) : null}
        </View>

        {currentQuestion.type !== '填空' && currentQuestion.options.length > 0 ? (
          <View style={styles.optionList}>
            {currentQuestion.options.map((option) => {
              const isCorrectOption =
                isAnswerVisible && currentQuestion.answers.includes(option.key);

              return (
                <View
                  key={option.key}
                  style={[
                    styles.optionCard,
                    isCorrectOption && styles.optionCardCorrect,
                  ]}
                >
                  <Text style={styles.optionKey}>{option.key}</Text>
                  <Text style={styles.optionText}>{option.text}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {isAnswerVisible && shouldShowAnswerDetails ? (
          <View style={styles.answerPanel}>
            {currentQuestion.type === '填空' ? (
              <View style={styles.answerBlock}>
                <Text style={styles.answerLabel}>答案</Text>
                <Text style={styles.answerText}>
                  {formatAnswerText(currentQuestion, currentQuestion.answers)}
                </Text>
              </View>
            ) : null}

            {currentQuestion.explanation ? (
              <View style={styles.answerBlock}>
                <Text style={styles.answerLabel}>解析</Text>
                <Text style={styles.answerText}>{currentQuestion.explanation}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.actionGroup}>
        {!isAnswerVisible ? (
          <Pressable
            onPress={handleRevealAnswer}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSaving) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>显示答案</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => void handleSubmitFeedback('known')}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.successButton,
                (pressed || isSaving) && styles.pressed,
              ]}
            >
              <Text style={styles.successButtonText}>
                {isSaving ? '保存中...' : '记住了'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSubmitFeedback('fuzzy')}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.warningButton,
                (pressed || isSaving) && styles.pressed,
              ]}
            >
              <Text style={styles.warningButtonText}>有点模糊</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSubmitFeedback('unknown')}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.dangerButton,
                (pressed || isSaving) && styles.pressed,
              ]}
            >
              <Text style={styles.dangerButtonText}>还不会</Text>
            </Pressable>
          </>
        )}

        <Pressable
          onPress={handleChangeBank}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isSaving) && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>返回题库列表并保留进度</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
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

function formatFeedbackLabel(feedback: ReciteFeedback) {
  if (feedback === 'known') {
    return '记住了';
  }

  if (feedback === 'fuzzy') {
    return '有点模糊';
  }

  return '还不会';
}

function formatMasteryLabel(progress: ReciteProgressRecord | null) {
  if (!progress) {
    return '首次';
  }

  if (progress.masteryLevel <= 0) {
    return '待加强';
  }

  if (progress.masteryLevel === 1) {
    return '入门';
  }

  if (progress.masteryLevel === 2) {
    return '熟悉';
  }

  return '稳固';
}

function createProgressMap(records: ReciteProgressRecord[]) {
  return records.reduce<Record<string, ReciteProgressRecord>>((result, record) => {
    result[record.questionId] = record;
    return result;
  }, {});
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

function buildReciteQueue(
  questions: QuizQuestion[],
  progressByQuestionId: Record<string, ReciteProgressRecord>,
) {
  return [...questions].sort((left, right) => {
    const leftProgress = progressByQuestionId[left.id];
    const rightProgress = progressByQuestionId[right.id];
    const priorityDiff = getRecitePriority(leftProgress) - getRecitePriority(rightProgress);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const reviewCountDiff = (leftProgress?.reviewCount ?? 0) - (rightProgress?.reviewCount ?? 0);

    if (reviewCountDiff !== 0) {
      return reviewCountDiff;
    }

    return left.sortOrder - right.sortOrder;
  });
}

function getRecitePriority(progress?: ReciteProgressRecord) {
  if (!progress) {
    return 1;
  }

  if (progress.masteryLevel <= 0) {
    return 0;
  }

  if (progress.masteryLevel === 1) {
    return 2;
  }

  if (progress.masteryLevel === 2) {
    return 3;
  }

  return 4;
}

function promptReciteSessionChoice(
  bankName: string,
  reviewedQuestions: number,
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
      `检测到未完成的背诵进度，已学习 ${reviewedQuestions}/${totalQuestions} 题。`,
      [
        { text: '接着背', onPress: () => finish('resume') },
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
  metricCardWarning: {
    backgroundColor: colors.warningSoft,
  },
  metricCardDanger: {
    backgroundColor: colors.dangerSoft,
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
    color: colors.success,
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  statusChipPrimary: {
    backgroundColor: colors.brandSoft,
    borderColor: '#BCD1FF',
  },
  statusChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  answerPanel: {
    gap: spacing.md,
  },
  answerBlock: {
    gap: spacing.xs,
  },
  answerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  answerText: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
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
  optionCardCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
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
  successButton: {
    backgroundColor: '#F1FAF5',
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#9DCEB5',
  },
  successButtonText: {
    color: '#1F7A57',
    fontSize: 15,
    fontWeight: '700',
  },
  warningButton: {
    backgroundColor: '#FFF8EE',
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E3BE8E',
  },
  warningButtonText: {
    color: '#A96718',
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    backgroundColor: '#FFF5F6',
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E4B0B7',
  },
  dangerButtonText: {
    color: '#B24A53',
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
