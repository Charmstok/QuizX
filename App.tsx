import { ActivityIndicator, Alert, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { TabBar } from './src/components/TabBar';
import { listQuestionBanks, migrateDbIfNeeded, saveImportPreview } from './src/db/quizDb';
import { pickAndParseLocalExcel } from './src/importer/localExcelImport';
import { HomeScreen } from './src/screens/HomeScreen';
import { ImportPreviewScreen } from './src/screens/ImportPreviewScreen';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { colors, radius, spacing } from './src/theme';
import type { ImportPreview, QuestionBank, StudyTab } from './src/types';
import { SQLiteProvider, useSQLiteContext } from './src/vendor/expoSqlite';

const TAB_CONFIG: Record<
  Exclude<StudyTab, 'home'>,
  { title: string; description: string; checklist: string[] }
> = {
  quiz: {
    title: '答题模式',
    description: '后续会在这里接入顺序刷题、随机刷题、提交答案与即时判分。',
    checklist: ['题库选择', '单题作答', '答案判定', '答题记录入库'],
  },
  recite: {
    title: '背诵模式',
    description: '后续会在这里接入看题记忆、展开答案、标记掌握程度等轻量学习流程。',
    checklist: ['只看题干', '点击显示答案', '标记会/模糊/不会', '复习状态更新'],
  },
  wrong: {
    title: '错题本',
    description: '后续会在这里接入错题筛选、重做和恢复掌握状态等功能。',
    checklist: ['错题列表', '按题库筛选', '再次作答', '错题移出'],
  },
};

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
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

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

  const handleImportLocal = async () => {
    setBusyLabel('正在读取本地 Excel...');

    try {
      const nextPreview = await pickAndParseLocalExcel();

      if (!nextPreview) {
        return;
      }

      setPreview(nextPreview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '文件解析失败，请确认选择的是可读取的 Excel。';
      Alert.alert('导入失败', message);
    } finally {
      setBusyLabel(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) {
      return;
    }

    setBusyLabel('正在写入 SQLite...');

    try {
      const savedBank = await saveImportPreview(db, preview);
      await refreshBanks();
      setPreview(null);
      setActiveTab('home');
      Alert.alert('导入完成', `题库“${savedBank.name}”已写入 SQLite，共 ${savedBank.questionCount} 题。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '题库写入失败。';
      Alert.alert('导入失败', message);
    } finally {
      setBusyLabel(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.content}>
          {preview ? (
            <ImportPreviewScreen
              preview={preview}
              isSaving={busyLabel === '正在写入 SQLite...'}
              onConfirm={handleConfirmImport}
              onRepick={handleImportLocal}
              onCancel={() => setPreview(null)}
            />
          ) : activeTab === 'home' ? (
            <HomeScreen
              banks={banks}
              totalQuestions={totalQuestions}
              isImporting={Boolean(busyLabel)}
              onOpenTab={setActiveTab}
              onImportLocal={handleImportLocal}
            />
          ) : (
            <PlaceholderScreen
              title={TAB_CONFIG[activeTab].title}
              description={TAB_CONFIG[activeTab].description}
              checklist={TAB_CONFIG[activeTab].checklist}
              onBackHome={() => setActiveTab('home')}
            />
          )}
        </View>

        {!preview ? <TabBar activeTab={activeTab} onChange={setActiveTab} /> : null}

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
