import { ActivityIndicator, Alert, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { TabBar } from './src/components/TabBar';
import {
  annotateImportPreviewDuplicates,
  listQuestionBanks,
  migrateDbIfNeeded,
  saveImportPreview,
} from './src/db/quizDb';
import { useAndroidBackHandler } from './src/hooks/useAndroidBackHandler';
import {
  pickAndParseLocalExcelBatch,
  pickAndParseWeChatExcelBatch,
} from './src/importer/localExcelImport';
import { BankDetailScreen } from './src/screens/BankDetailScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ImportPreviewScreen } from './src/screens/ImportPreviewScreen';
import { QuizModeScreen } from './src/screens/QuizModeScreen';
import { ReciteModeScreen } from './src/screens/ReciteModeScreen';
import { WrongBookScreen } from './src/screens/WrongBookScreen';
import { colors, radius, spacing } from './src/theme';
import type { BankSource, ImportPreview, QuestionBank, StudyTab } from './src/types';
import { SQLiteProvider, useSQLiteContext } from './src/vendor/expoSqlite';

export default function App() {
  return (
    <SQLiteProvider databaseName="quizx.db" onInit={migrateDbIfNeeded}>
      <AppShell />
    </SQLiteProvider>
  );
}

function AppShell() {
  const db = useSQLiteContext();
  const [activeTab, setActiveTab] = useState<StudyTab>('home');
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [importQueue, setImportQueue] = useState<ImportPreview[]>([]);
  const [importBatchProgress, setImportBatchProgress] = useState<{
    total: number;
    imported: number;
    skipped: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const preview = importQueue[0] ?? null;
  const totalQuestions = banks.reduce((sum, bank) => sum + bank.questionCount, 0);

  const refreshBanks = async () => {
    setIsRefreshing(true);

    try {
      const nextBanks = await listQuestionBanks(db);
      setBanks(nextBanks);
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取 SQLite 失败。';
      Alert.alert('读取题库失败', message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshBanks();
  }, []);

  useAndroidBackHandler(
    () => {
      if (busyLabel) {
        return true;
      }

      if (preview) {
        clearImportQueue();
        return true;
      }

      if (activeTab === 'home' && selectedBank) {
        setSelectedBank(null);
        return true;
      }

      if (activeTab !== 'home') {
        setActiveTab('home');
        setSelectedBank(null);
        return true;
      }

      return false;
    },
    [activeTab, busyLabel, preview, selectedBank],
  );

  const handleImportBySource = async (source: BankSource) => {
    setBusyLabel(source === '微信 Excel' ? '正在读取微信 Excel...' : '正在读取本地 Excel...');

    try {
      const batchResult =
        source === '微信 Excel'
          ? await pickAndParseWeChatExcelBatch()
          : await pickAndParseLocalExcelBatch();

      if (!batchResult) {
        return;
      }

      const nextQueue = await hydrateImportQueue(batchResult.previews);

      if (nextQueue.length > 0) {
        setImportQueue(nextQueue);
        setImportBatchProgress({
          total: nextQueue.length,
          imported: 0,
          skipped: 0,
        });
        setActiveTab('home');
        setSelectedBank(null);
      }

      if (batchResult.failures.length > 0) {
        Alert.alert(
          nextQueue.length > 0
            ? source === '微信 Excel'
              ? '部分微信文件未加入导入队列'
              : '部分文件未加入导入队列'
            : '导入失败',
          formatBatchFailures(batchResult.failures),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '文件解析失败，请确认选择的是可读取的 Excel。';
      Alert.alert('导入失败', message);
    } finally {
      setBusyLabel(null);
    }
  };

  const handleImportLocal = async () => {
    await handleImportBySource('本地 Excel');
  };

  const handleImportWechat = async () => {
    await handleImportBySource('微信 Excel');
  };

  const handleRepickImport = () => {
    if (!preview) {
      void handleImportLocal();
      return;
    }

    Alert.alert(
      preview.source === '微信 Excel' ? '重新从微信选择文件' : '重新选择文件',
      '重新选择后会替换当前导入队列，尚未导入的文件不会保留。',
      [
        {
          text: '继续当前队列',
          style: 'cancel',
        },
        {
          text: '重新选择',
          style: 'destructive',
          onPress: () => {
            void handleImportBySource(preview.source);
          },
        },
      ],
    );
  };

  const handleConfirmImport = async () => {
    if (!preview) {
      return;
    }

    if (preview.duplicateSummary.exactMatchedBank) {
      handleSkipCurrentPreview();
      return;
    }

    setBusyLabel('正在写入 SQLite...');

    try {
      const savedBank = await saveImportPreview(db, preview);
      await refreshBanks();
      await advanceImportQueue({
        importedDelta: 1,
        skippedDelta: 0,
        importedBankName: savedBank.name,
        importedQuestionCount: savedBank.questionCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '题库写入失败。';
      Alert.alert('导入失败', message);
    } finally {
      setBusyLabel(null);
    }
  };

  const handleChangeTab = (tab: StudyTab) => {
    setActiveTab(tab);

    if (tab !== 'home') {
      setSelectedBank(null);
    }
  };

  function clearImportQueue() {
    setImportQueue([]);
    setImportBatchProgress(null);
  }

  async function hydrateImportQueue(previews: ImportPreview[]) {
    const nextQueue: ImportPreview[] = [];

    for (const item of previews) {
      nextQueue.push(await annotateImportPreviewDuplicates(db, item));
    }

    return nextQueue;
  }

  async function advanceImportQueue({
    importedDelta,
    skippedDelta,
    importedBankName,
    importedQuestionCount,
    skipReason,
  }: {
    importedDelta: number;
    skippedDelta: number;
    importedBankName?: string;
    importedQuestionCount?: number;
    skipReason?: 'duplicate' | 'manual';
  }) {
    const remainingQueue = importQueue.slice(1);
    const hydratedQueue = await hydrateImportQueue(remainingQueue);
    const nextProgress = {
      total: importBatchProgress?.total ?? importQueue.length,
      imported: (importBatchProgress?.imported ?? 0) + importedDelta,
      skipped: (importBatchProgress?.skipped ?? 0) + skippedDelta,
    };

    setImportQueue(hydratedQueue);

    if (hydratedQueue.length > 0) {
      setImportBatchProgress(nextProgress);
      return;
    }

    clearImportQueue();
    setActiveTab('home');

    if (nextProgress.total > 1) {
      Alert.alert(
        '批量导入完成',
        `共处理 ${nextProgress.total} 个文件，导入 ${nextProgress.imported} 个题库，跳过 ${nextProgress.skipped} 个文件。`,
      );
      return;
    }

    if (importedBankName && importedQuestionCount !== undefined) {
      Alert.alert('导入完成', `题库“${importedBankName}”已写入 SQLite，共 ${importedQuestionCount} 题。`);
      return;
    }

    Alert.alert(
      skipReason === 'duplicate' ? '已跳过重复文件' : '已跳过当前文件',
      skipReason === 'duplicate'
        ? '当前文件与已有题库内容完全一致，默认没有再次入库。'
        : '当前文件没有写入 SQLite，已返回题库首页。',
    );
  }

  function handleSkipCurrentPreview() {
    if (!preview) {
      return;
    }

    void advanceImportQueue({
      importedDelta: 0,
      skippedDelta: 1,
      skipReason: preview.duplicateSummary.exactMatchedBank ? 'duplicate' : 'manual',
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.content}>
          {preview ? (
            <ImportPreviewScreen
              preview={preview}
              isSaving={busyLabel === '正在写入 SQLite...'}
              currentIndex={(importBatchProgress?.imported ?? 0) + (importBatchProgress?.skipped ?? 0) + 1}
              totalCount={importBatchProgress?.total ?? importQueue.length}
              onConfirm={handleConfirmImport}
              onRepick={handleRepickImport}
              onSkipCurrent={handleSkipCurrentPreview}
              onCancelBatch={clearImportQueue}
            />
          ) : activeTab === 'home' ? (
            selectedBank ? (
              <BankDetailScreen bank={selectedBank} onBack={() => setSelectedBank(null)} />
            ) : (
              <HomeScreen
                banks={banks}
                totalQuestions={totalQuestions}
                isImporting={Boolean(busyLabel)}
                onOpenTab={handleChangeTab}
                onOpenBankDetail={setSelectedBank}
                onImportLocal={handleImportLocal}
                onImportWechat={handleImportWechat}
              />
            )
          ) : activeTab === 'quiz' ? (
            <QuizModeScreen banks={banks} />
          ) : activeTab === 'recite' ? (
            <ReciteModeScreen banks={banks} />
          ) : (
            <WrongBookScreen />
          )}
        </View>

        {!preview ? <TabBar activeTab={activeTab} onChange={handleChangeTab} /> : null}

        {busyLabel || isRefreshing ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.overlayText}>
                {busyLabel ?? '正在同步 SQLite 题库...'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function formatBatchFailures(
  failures: {
    fileName: string;
    message: string;
  }[],
) {
  const visibleFailures = failures
    .slice(0, 3)
    .map((failure) => `${failure.fileName}：${failure.message}`)
    .join('\n');

  if (failures.length <= 3) {
    return visibleFailures;
  }

  return `${visibleFailures}\n还有 ${failures.length - 3} 个文件未展开。`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 33, 47, 0.12)',
    paddingHorizontal: spacing.lg,
  },
  overlayCard: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  overlayText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
