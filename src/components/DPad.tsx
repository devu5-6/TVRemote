import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { RemoteKey } from '../types/remote';
import { TipPressable } from './TipPressable';

const DIAMETER = 260;
const CENTER_SIZE = 92;
const ARM_SIZE = 76;

type DPadProps = {
  onKeyPress: (key: RemoteKey) => void;
};

export function DPad({ onKeyPress }: DPadProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.ring} />

      <TipPressable
        tip="Up"
        tipPlacement="bottom"
        wrapperStyle={[styles.arm, styles.armUp]}
        style={({ pressed }) => [styles.armHit, pressed && styles.armPressed]}
        onPress={() => onKeyPress('UP')}
        hitSlop={8}
      >
        <Ionicons name="chevron-up" size={26} color={colors.textPrimary} />
      </TipPressable>

      <TipPressable
        tip="Down"
        wrapperStyle={[styles.arm, styles.armDown]}
        style={({ pressed }) => [styles.armHit, pressed && styles.armPressed]}
        onPress={() => onKeyPress('DOWN')}
        hitSlop={8}
      >
        <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
      </TipPressable>

      <TipPressable
        tip="Left"
        wrapperStyle={[styles.arm, styles.armLeft]}
        style={({ pressed }) => [styles.armHit, pressed && styles.armPressed]}
        onPress={() => onKeyPress('LEFT')}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </TipPressable>

      <TipPressable
        tip="Right"
        wrapperStyle={[styles.arm, styles.armRight]}
        style={({ pressed }) => [styles.armHit, pressed && styles.armPressed]}
        onPress={() => onKeyPress('RIGHT')}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={26} color={colors.textPrimary} />
      </TipPressable>

      <TipPressable tip="OK" style={({ pressed }) => [pressed && styles.okPressed]} onPress={() => onKeyPress('OK')}>
        <LinearGradient colors={[colors.primary, '#1FBE86']} style={styles.okCenter}>
          <Text style={styles.okText}>OK</Text>
        </LinearGradient>
      </TipPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    height: DIAMETER,
    justifyContent: 'center',
    overflow: 'visible',
    width: DIAMETER,
    zIndex: 2,
  },
  ring: {
    borderColor: colors.border,
    borderRadius: DIAMETER / 2,
    borderWidth: 1,
    height: DIAMETER,
    position: 'absolute',
    width: DIAMETER,
  },
  arm: {
    height: ARM_SIZE,
    position: 'absolute',
    width: ARM_SIZE,
    zIndex: 3,
  },
  armHit: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  armUp: {
    top: 6,
  },
  armDown: {
    bottom: 6,
  },
  armLeft: {
    left: 6,
  },
  armRight: {
    right: 6,
  },
  armPressed: {
    opacity: 0.5,
  },
  okCenter: {
    alignItems: 'center',
    borderRadius: CENTER_SIZE / 2,
    elevation: 6,
    height: CENTER_SIZE,
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    width: CENTER_SIZE,
  },
  okPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  okText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
