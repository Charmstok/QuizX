import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { HomeScreen } from './src/screens/HomeScreen';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { TabBar } from './src/components/TabBar';
import { mockBanks } from './src/data/mockBanks';
import type { StudyTab } from './src/types';
import { colors } from './src/theme';

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
  const [activeTab, setActiveTab] = useState<StudyTab>('home');

  const totalQuestions = mockBanks.reduce((sum, bank) => sum + bank.questionCount, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.content}>
          {activeTab === 'home' ? (
            <HomeScreen
              banks={mockBanks}
              totalQuestions={totalQuestions}
              onOpenTab={setActiveTab}
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
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
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
});
