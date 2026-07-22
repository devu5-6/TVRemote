import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../theme';

type StatusPillProps = {
  label: string;
  active: boolean;
};

export function StatusPill({ label, active }: StatusPillProps) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <View style={[styles.dot, active && styles.dotActive]} />
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillActive: {
    backgroundColor: 'rgba(52, 225, 161, 0.12)',
    borderColor: 'rgba(52, 225, 161, 0.4)',
  },
  dot: {
    backgroundColor: colors.textMuted,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  textActive: {
    color: colors.primary,
  },
});
