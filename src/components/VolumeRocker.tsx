import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { TipPressable } from './TipPressable';

type VolumeRockerProps = {
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  /** Absolute volume level shown in the center (from the TV). */
  level?: number | null;
  /** 0–1 fill ratio from the TV volume level. */
  fillRatio?: number;
  muted?: boolean;
};

export function VolumeRocker({
  onVolumeUp,
  onVolumeDown,
  level = null,
  fillRatio = 0,
  muted = false,
}: VolumeRockerProps) {
  const clamped = muted ? 0 : Math.max(0, Math.min(1, fillRatio));
  const fillHeight = Math.round(clamped * ROCKER_HEIGHT);
  const displayLevel = muted ? 0 : level != null ? Math.round(level) : null;

  return (
    <View style={styles.shell}>
      <View style={styles.fillClip} pointerEvents="none">
        <View style={[styles.fill, { height: fillHeight }]} />
      </View>

      <TipPressable
        tip="Volume up"
        tipPlacement="bottom"
        onPress={onVolumeUp}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Volume up"
        style={({ pressed }) => [styles.zone, styles.topZone, pressed && styles.pressed]}
      >
        <Text style={styles.glyph}>+</Text>
      </TipPressable>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.volLabel}>VOL</Text>
        {displayLevel != null ? <Text style={styles.volValue}>{String(displayLevel)}</Text> : null}
      </View>

      <TipPressable
        tip="Volume down"
        onPress={onVolumeDown}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Volume down"
        style={({ pressed }) => [styles.zone, styles.bottomZone, pressed && styles.pressed]}
      >
        <Text style={styles.glyph}>−</Text>
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
  fillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ROCKER_RADIUS,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#87CEEB',
    bottom: 0,
    left: 0,
    opacity: 0.95,
    position: 'absolute',
    right: 0,
  },
  zone: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    zIndex: 1,
  },
  topZone: {
    paddingTop: 6,
  },
  bottomZone: {
    paddingBottom: 6,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  volLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  volValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    marginTop: 2,
  },
  pressed: {
    backgroundColor: 'rgba(135, 206, 235, 0.2)',
  },
  glyph: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 30,
  },
});
