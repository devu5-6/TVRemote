import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../theme';
import {
  subscribeToToastDismiss,
  subscribeToToasts,
  type ToastPayload,
  type ToastVariant,
} from '../utils/toastBus';

const VARIANT_STYLE: Record<ToastVariant, { background: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { background: '#16233D', border: 'rgba(91, 141, 239, 0.45)', icon: 'information-circle' },
  success: { background: '#0F2E23', border: 'rgba(52, 225, 161, 0.45)', icon: 'checkmark-circle' },
  error: { background: '#331722', border: 'rgba(242, 99, 123, 0.45)', icon: 'alert-circle' },
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  info: colors.accent,
  success: colors.primary,
  error: colors.danger,
};

/**
 * Single-slot in-app toast banner. Mounted once near the app root.
 * durationMs 0 = sticky until dismissed programmatically (e.g. Wi‑Fi back on).
 */
export function ToastBanner() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastRef = useRef<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      toastRef.current = null;
      setToast(null);
    });
  };

  useEffect(() => {
    const unsubShow = subscribeToToasts((incoming) => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      toastRef.current = incoming;
      setToast(incoming);
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      if (incoming.durationMs > 0) {
        dismissTimer.current = setTimeout(dismiss, incoming.durationMs);
      }
    });

    const unsubDismiss = subscribeToToastDismiss((message) => {
      const current = toastRef.current;
      if (!current) return;
      if (message && current.message !== message) return;
      dismiss();
    });

    return () => {
      unsubShow();
      unsubDismiss();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!toast) return null;

  const variantStyle = VARIANT_STYLE[toast.variant];
  const isSticky = toast.durationMs <= 0;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { top: insets.top + spacing.sm }]}>
      <Animated.View
        style={[
          styles.banner,
          { backgroundColor: variantStyle.background, borderColor: variantStyle.border, opacity, transform: [{ translateY }] },
        ]}
      >
        <Pressable
          onPress={isSticky ? undefined : dismiss}
          disabled={isSticky}
          style={styles.pressableContent}
        >
          <Ionicons name={variantStyle.icon} size={20} color={VARIANT_ICON_COLOR[toast.variant]} />
          <Text style={styles.message} numberOfLines={3}>
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 100,
  },
  banner: {
    borderRadius: radii.md,
    borderWidth: 1,
    elevation: 8,
    marginHorizontal: spacing.lg,
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  pressableContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  message: {
    color: colors.textPrimary,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
