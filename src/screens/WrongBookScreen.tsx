import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { SectionTitle } from '../components/SectionTitle';
import {
  listWrongBanks,
  listWrongQuestionsByBank,
  saveWrongQuestionResult,
} from '../db/quizDb';
import { colors, radius, spacing } from '../theme';
import type {
  QuestionOption,
  QuizQuestion,
  WrongBankSummary,
  WrongPracticeSummary,
  WrongQuestionRecord,
} from '../types';
import { useSQLiteContext } from '../vendor/expoSqlite';

type WrongAnswerRecord = {
  questionId: string;
  questionType: WrongQuestionRecord['type'];
  questionStem: string;
  selectedAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
  resolved: boolean;
};

export function WrongBookScreen() {
  const db = useSQLiteContext();
  const [wrongBanks, setWrongBanks] = useState<WrongBankSummary[]>([]);
  const [activeBank, setActiveBank] = useState<WrongBankSummary | null>(null);
  const [questions, setQuestions] = useState<WrongQuestionRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<string[]>([]);
  const [draftTextAnswer, setDraftTextAnswer] = useState('');
  const [submittedAnswers, setSubmittedAnswers] = useState<WrongAnswerRecord[]>([]);
  const [summary, setSummary] = useState<WrongPracticeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentRecord = currentQuestion
    ? submittedAnswers.find((item) => item.questionId === currentQuestion.id) ?? null
    : null;

  useEffect(() => {
    void refreshWrongBanks();
  }, []);

  const refreshWrongBanks = async () => {
    setIsLoading(true);

    try {
      const nextBanks = await listWrongBanks(db);
      setWrongBanks(nextBanks);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取错题列表失败。';
      Alert.alert('读取错题本失败', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBank = async (bank: WrongBankSummary) => {
    setIsLoading(true);

    try {
      const nextQuestions = await listWrongQuestionsByBank(db, bank.id);

      if (nextQuestions.length === 0) {
        await refreshWrongBanks();
        Alert.alert('没有错题', '这个题库当前已经没有待重做的错题。');
        return;
      }

      setActiveBank(bank);
      setQuestions(nextQuestions);
      setCurrentIndex(0);
      setDraftAnswers([]);
      setDraftTextAnswer('');
      setSubmittedAnswers([]);
      setSummary(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取错题失败。';
      Alert.alert('无法开始错题练习', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeBank = () => {
    setActiveBank(null);
    setQuestions([]);
    setCurrentIndex(0);
    setDraftAnswers([]);
    setDraftTextAnswer('');
    setSubmittedAnswers([]);
    setSummary(null);
    void refreshWrongBanks();
  };

  const handleRestartSameBank = () => {
    if (!activeBank) {
      return;
    }

    void handleStartBank(activeBank);
  };

  const handlePickOption = async (option: QuestionOption) => {
    if (!currentQuestion || currentRecord || isSyncing) {
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

  const handleSubmitCurrent = async () => {
    if (!currentQuestion || currentRecord || isSyncing) {
      return;
    }

    const selectedAnswers = buildSelectedAnswers(currentQuestion, draftAnswers, draftTextAnswer);

    if (selectedAnswers.length === 0) {
      Alert.alert('答案为空', getEmptyAnswerMessage(currentQuestion));
      return;
    }

    await submitAnswer(currentQuestion, selectedAnswers);
  };

  const submitAnswer = async (question: WrongQuestionRecord, selectedAnswers: string[]) => {
    if (!activeBank) {
      return;
    }

    const nextRecord = createAnswerRecord(question, selectedAnswers);
    const wrongAnswerRecord: WrongAnswerRecord = {
      ...nextRecord,
      resolved: nextRecord.isCorrect,
    };

    setIsSyncing(true);

    try {
      await saveWrongQuestionResult(db, {
        bankId: activeBank.id,
        questionId: question.id,
        selectedAnswers,
        correctAnswers: question.answers,
        isCorrect: nextRecord.isCorrect,
      });
      setSubmittedAnswers((previous) => [...previous, wrongAnswerRecord]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存错题结果失败。';
      Alert.alert('保存失败', message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdvance = () => {
    if (!activeBank || !currentRecord) {
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((previous) => previous + 1);
      setDraftAnswers([]);
      setDraftTextAnswer('');
      return;
    }

    const correctedQuestions = submittedAnswers.filter((item) => item.resolved).length;
    const remainingQuestions = submittedAnswers.length - correctedQuestions;

    setSummary({
      bankId: activeBank.id,
      bankName: activeBank.name,
      totalQuestions: questions.length,
      correctedQuestions,
      remainingQuestions,
      completedAt: new Date().toISOString(),
    });

    void refreshWrongBanks();
  };

  if (summary && activeBank) {
    const unresolvedRecords = submittedAnswers.filter((item) => !item.resolved);

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle eyebrow="错题结果" title={activeBank.name} />

        <View style={styles.heroCard}>
          <View style={styles.metricRow}>
            <View style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricLabel}>已移出</Text>
              <Text style={styles.metricValue}>{summary.correctedQuestions}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardDanger]}>
              <Text style={styles.metricLabel}>仍保留</Text>
              <Text style={styles.metricValue}>{summary.remainingQuestions}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>总题数</Text>
              <Text style={styles.metricValue}>{summary.totalQuestions}</Text>
            </View>
          </View>
        </View>

        {unresolvedRecords.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>仍在错题本</Text>
            <View style={styles.reviewList}>
              {unresolvedRecords.slice(0, 6).map((item, index) => (
                <View key={item.questionId} style={styles.reviewCard}>
                  <Text style={styles.reviewIndex}>#{index + 1}</Text>
                  <Text style={styles.reviewStem}>{item.questionStem}</Text>
                  <Text style={styles.reviewMeta}>
                    正确答案：{formatAnswerText(currentQuestionForReview(item.questionId, questions), item.correctAnswers)}
                  </Text>
                  <Text style={styles.reviewMeta}>
                    你的答案：{formatAnswerText(currentQuestionForReview(item.questionId, questions), item.selectedAnswers)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.panel, styles.successPanel]}>
            <Text style={styles.panelTitle}>这一轮已全部移出</Text>
          </View>
        )}

        <View style={styles.actionGroup}>
          <Pressable
            onPress={handleRestartSameBank}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>再练一轮</Text>
          </Pressable>
          <Pressable
            onPress={handleChangeBank}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>返回题库列表</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!activeBank || !currentQuestion) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle eyebrow="错题本" title="按题库重做" />

        {wrongBanks.length > 0 ? (
          <View style={styles.bankList}>
            {wrongBanks.map((bank) => (
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
                  {bank.wrongCount} 题待重做 · {bank.questionTypes.join(' / ')}
                </Text>
                <Text style={styles.bankAction}>
                  {isLoading ? '加载中...' : '开始重做'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>当前没有错题</Text>
            <Text style={styles.emptyText}>先去答题模式完成一轮，错题才会进入这里。</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const progressText = `${currentIndex + 1} / ${questions.length}`;
  const correctedCount = submittedAnswers.filter((item) => item.resolved).length;
  const requiresManualSubmit =
    currentQuestion.type === '多选' || currentQuestion.type === '填空';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle eyebrow="错题本" title={activeBank.name} />

      <View style={styles.heroCard}>
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>当前进度</Text>
            <Text style={styles.metricValue}>{progressText}</Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardPrimary]}>
            <Text style={styles.metricLabel}>已移出</Text>
            <Text style={styles.metricValue}>{correctedCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>错题次数</Text>
            <Text style={styles.metricValue}>{currentQuestion.wrongCount}</Text>
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
                  disabled={Boolean(currentRecord) || isSyncing}
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
          <View style={[styles.feedbackCard, currentRecord.resolved ? styles.feedbackSuccess : styles.feedbackDanger]}>
            <Text style={styles.feedbackTitle}>{currentRecord.resolved ? '已移出错题本' : '仍在错题本'}</Text>
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
            onPress={handleAdvance}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {currentIndex === questions.length - 1 ? '完成本轮' : '下一题'}
            </Text>
          </Pressable>
        ) : requiresManualSubmit ? (
          <Pressable
            onPress={() => void handleSubmitCurrent()}
            disabled={isSyncing}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSyncing) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSyncing ? '保存中...' : '提交答案'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleChangeBank}
          disabled={isSyncing}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isSyncing) && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>返回题库列表</Text>
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

function splitFillAnswers(value: string) {
  return value
    .split(/[\n/、,，;；|｜]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createAnswerRecord(question: QuizQuestion, selectedAnswers: string[]) {
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

function currentQuestionForReview(questionId: string, questions: WrongQuestionRecord[]) {
  return questions.find((item) => item.id === questionId) ?? null;
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
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  bankMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bankAction: {
    color: colors.warning,
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
    color: colors.warning,
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
    color: colors.warning,
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
