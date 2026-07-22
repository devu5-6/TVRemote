import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '../theme';
import { TipPressable } from './TipPressable';

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  tip?: string;
  onPress: () => void;
  size?: number;
  variant?: 'default' | 'primary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  label,
  tip,
  onPress,
  size = 56,
  variant = 'default',
  style,
}: IconButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const tipLabel = tip ?? label ?? icon;

  return (
    <View style={styles.wrapper}>
      <TipPressable
        tip={tipLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          isPrimary && styles.buttonPrimary,
          isDanger && styles.buttonDanger,
          pressed && styles.buttonPressed,
          style,
        ]}
      >
        <Ionicons
          name={icon}
          size={size * 0.42}
          color={isPrimary ? colors.onPrimary : isDanger ? colors.danger : colors.textPrimary}
        />
      </TipPressable>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: 'rgba(242, 99, 123, 0.12)',
    borderColor: 'rgba(242, 99, 123, 0.35)',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export const buttonRadius = radii.pill;
