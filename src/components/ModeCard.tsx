import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

type ModeCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  accent: string;
  onPress: () => void;
};

export function ModeCard({
  title,
  description,
  actionLabel,
  accent,
  onPress,
}: ModeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: accent, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={[styles.action, { color: accent }]}>{actionLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  accent: {
    width: 42,
    height: 6,
    borderRadius: 999,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 42,
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
  },
});

