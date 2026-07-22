import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii } from '../theme';

type PressState = { pressed: boolean };

type TipPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  tip: string;
  children: ReactNode | ((state: PressState) => ReactNode);
  style?: StyleProp<ViewStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
  tipPlacement?: 'top' | 'bottom';
  /** When false, only children handle pressed visuals (default true). */
  showPressedOverlay?: boolean;
};

/** How long the grey “clicked” look stays after a quick tap. */
const PRESS_FLASH_MS = 180;

/** High-contrast grey used while a control is pressed. */
export const pressedIconColor = '#9AA3B5';

/** Solid-enough grey wash that fills the whole control. */
export const pressedFillColor = 'rgba(154, 163, 181, 0.42)';

export function TipPressable({
  tip,
  children,
  style,
  wrapperStyle,
  tipPlacement = 'top',
  showPressedOverlay = true,
  onLongPress,
  onPressIn,
  onPressOut,
  delayLongPress = 350,
  ...pressableProps
}: TipPressableProps) {
  const [tipVisible, setTipVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const clearTipTimer = () => {
    if (tipHideTimer.current) {
      clearTimeout(tipHideTimer.current);
      tipHideTimer.current = null;
    }
  };

  const clearFlashTimer = () => {
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    clearFlashTimer();
    setPressed(true);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    clearFlashTimer();
    // Keep the grey look briefly so quick taps are still visible.
    flashTimer.current = setTimeout(() => setPressed(false), PRESS_FLASH_MS);
    clearTipTimer();
    tipHideTimer.current = setTimeout(() => setTipVisible(false), 120);
    onPressOut?.(event);
  };

  const showTip = (event: GestureResponderEvent) => {
    clearTipTimer();
    setTipVisible(true);
    onLongPress?.(event);
  };

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      {tipVisible ? (
        <View
          pointerEvents="none"
          style={[styles.tipRail, tipPlacement === 'bottom' ? styles.tipRailBottom : styles.tipRailTop]}
        >
          <View style={styles.tipBubble}>
            <Text style={styles.tipText} numberOfLines={1}>
              {tip}
            </Text>
          </View>
        </View>
      ) : null}
      <Pressable
        {...pressableProps}
        delayLongPress={delayLongPress}
        onLongPress={showTip}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.pressable, style]}
      >
        {typeof children === 'function' ? children({ pressed }) : children}
        {showPressedOverlay && pressed ? (
          <View pointerEvents="none" style={styles.pressedOverlay} />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 1,
  },
  pressable: {
    overflow: 'hidden',
    position: 'relative',
  },
  pressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: pressedFillColor,
  },
  tipRail: {
    alignItems: 'center',
    left: -80,
    position: 'absolute',
    right: -80,
    zIndex: 20,
  },
  tipRailTop: {
    bottom: '100%',
    marginBottom: 8,
  },
  tipRailBottom: {
    marginTop: 8,
    top: '100%',
  },
  tipBubble: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    elevation: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tipText: {
    color: colors.background,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
