import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '../theme';
import { TipPressable, pressedIconColor } from './TipPressable';

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

  const idleColor = isPrimary ? colors.onPrimary : isDanger ? colors.danger : colors.textPrimary;

  return (
    <View style={styles.wrapper}>
      <TipPressable
        tip={tipLabel}
        onPress={onPress}
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          isPrimary && styles.buttonPrimary,
          isDanger && styles.buttonDanger,
          style,
        ]}
      >
        {({ pressed }) => (
          <Ionicons name={icon} size={size * 0.42} color={pressed ? pressedIconColor : idleColor} />
        )}
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
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export const buttonRadius = radii.pill;
