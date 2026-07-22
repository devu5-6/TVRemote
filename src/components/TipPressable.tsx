import { useRef, useState, type ReactNode } from 'react';
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

type TipPressableProps = PressableProps & {
  tip: string;
  children: ReactNode;
  wrapperStyle?: StyleProp<ViewStyle>;
  tipPlacement?: 'top' | 'bottom';
};

export function TipPressable({
  tip,
  children,
  wrapperStyle,
  tipPlacement = 'top',
  onLongPress,
  onPressOut,
  delayLongPress = 350,
  ...pressableProps
}: TipPressableProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const showTip = (event: GestureResponderEvent) => {
    clearHideTimer();
    setVisible(true);
    onLongPress?.(event);
  };

  const hideTip = (event: GestureResponderEvent) => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setVisible(false), 120);
    onPressOut?.(event);
  };

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      {visible ? (
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
        onPressOut={hideTip}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 1,
  },
  // Wide rail so the bubble isn't squeezed to the button's narrow width.
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
