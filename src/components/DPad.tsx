import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { RemoteKey } from '../types/remote';
import { TipPressable, pressedIconColor } from './TipPressable';

const DIAMETER = 260;
const CENTER_SIZE = 92;
const ARM_SIZE = 76;
const RING_BORDER = 2;
const DPAD_GRAY = '#1A2338';

type DPadProps = {
  onKeyPress: (key: RemoteKey) => void;
};

export function DPad({ onKeyPress }: DPadProps) {
  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[colors.primary, colors.accent, '#A78BFA', colors.danger, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ringGradient}
      >
        <View style={styles.ringInner} />
      </LinearGradient>

      <TipPressable
        tip="Up"
        tipPlacement="bottom"
        wrapperStyle={[styles.arm, styles.armUp]}
        style={styles.armHit}
        onPress={() => onKeyPress('UP')}
        hitSlop={8}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-up" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>

      <TipPressable
        tip="Down"
        wrapperStyle={[styles.arm, styles.armDown]}
        style={styles.armHit}
        onPress={() => onKeyPress('DOWN')}
        hitSlop={8}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-down" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>

      <TipPressable
        tip="Left"
        wrapperStyle={[styles.arm, styles.armLeft]}
        style={styles.armHit}
        onPress={() => onKeyPress('LEFT')}
        hitSlop={8}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-back" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>

      <TipPressable
        tip="Right"
        wrapperStyle={[styles.arm, styles.armRight]}
        style={styles.armHit}
        onPress={() => onKeyPress('RIGHT')}
        hitSlop={8}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-forward" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>

      <TipPressable tip="OK" onPress={() => onKeyPress('OK')} style={styles.okHit}>
        {({ pressed }) => (
          <LinearGradient
            colors={pressed ? ['#6B7280', '#4B5563'] : [colors.primary, '#1FBE86']}
            style={styles.okCenter}
          >
            <Text style={[styles.okText, pressed && styles.okTextPressed]}>OK</Text>
          </LinearGradient>
        )}
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
  ringGradient: {
    borderRadius: DIAMETER / 2,
    height: DIAMETER,
    padding: RING_BORDER,
    position: 'absolute',
    width: DIAMETER,
  },
  ringInner: {
    backgroundColor: DPAD_GRAY,
    borderRadius: (DIAMETER - RING_BORDER * 2) / 2,
    flex: 1,
  },
  arm: {
    height: ARM_SIZE,
    position: 'absolute',
    width: ARM_SIZE,
    zIndex: 3,
  },
  armHit: {
    alignItems: 'center',
    borderRadius: ARM_SIZE / 2,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  armUp: {
    left: (DIAMETER - ARM_SIZE) / 2,
    top: 10,
  },
  armDown: {
    bottom: 10,
    left: (DIAMETER - ARM_SIZE) / 2,
  },
  armLeft: {
    left: 10,
    top: (DIAMETER - ARM_SIZE) / 2,
  },
  armRight: {
    right: 10,
    top: (DIAMETER - ARM_SIZE) / 2,
  },
  okHit: {
    borderRadius: CENTER_SIZE / 2,
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
  okText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  okTextPressed: {
    color: '#D1D5DB',
  },
});
