import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudyTab } from '../types';
import { colors, radius, spacing } from '../theme';

const TABS: Array<{ key: StudyTab; label: string }> = [
  { key: 'home', label: '首页' },
  { key: 'quiz', label: '答题' },
  { key: 'recite', label: '背诵' },
  { key: 'wrong', label: '错题本' },
];

type TabBarProps = {
  activeTab: StudyTab;
  onChange: (tab: StudyTab) => void;
};

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <View style={styles.wrapper}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.activeTab,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  activeTab: {
    backgroundColor: colors.brandSoft,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  activeLabel: {
    color: colors.brand,
  },
});

