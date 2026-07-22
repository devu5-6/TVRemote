import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

type ActivityBarProps = {
  message: string;
  busy?: boolean;
};

export function ActivityBar({ message, busy }: ActivityBarProps) {
  return (
    <View style={styles.bar}>
      {busy ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
      )}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.textMuted,
    fontSize: 12.5,
    textAlign: 'center',
  },
});
