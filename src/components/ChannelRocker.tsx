import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { TipPressable, pressedIconColor } from './TipPressable';

type ChannelRockerProps = {
  onChannelUp: () => void;
  onChannelDown: () => void;
};

export function ChannelRocker({ onChannelUp, onChannelDown }: ChannelRockerProps) {
  return (
    <View style={styles.shell}>
      <TipPressable
        tip="Next channel"
        tipPlacement="bottom"
        onPress={onChannelUp}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Next channel"
        style={[styles.zone, styles.topZone]}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-up" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.chLabel}>CH</Text>
      </View>

      <TipPressable
        tip="Previous channel"
        onPress={onChannelDown}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Previous channel"
        style={[styles.zone, styles.bottomZone]}
      >
        {({ pressed }) => (
          <Ionicons name="chevron-down" size={26} color={pressed ? pressedIconColor : colors.textPrimary} />
        )}
      </TipPressable>
    </View>
  );
}

const ROCKER_WIDTH = 56;
const ROCKER_HEIGHT = 200;
const ROCKER_RADIUS = 28;

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: ROCKER_RADIUS,
    borderWidth: 1,
    height: ROCKER_HEIGHT,
    justifyContent: 'space-between',
    overflow: 'visible',
    width: ROCKER_WIDTH,
    zIndex: 4,
  },
  zone: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: '100%',
    zIndex: 1,
  },
  topZone: {
    borderTopLeftRadius: ROCKER_RADIUS,
    borderTopRightRadius: ROCKER_RADIUS,
  },
  bottomZone: {
    borderBottomLeftRadius: ROCKER_RADIUS,
    borderBottomRightRadius: ROCKER_RADIUS,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
