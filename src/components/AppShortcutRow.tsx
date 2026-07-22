import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { APP_SHORTCUTS } from '../constants/appShortcuts';
import { colors, radii, spacing } from '../theme';
import type { AppShortcut } from '../types/remote';
import { TipPressable } from './TipPressable';

type AppShortcutRowProps = {
  onLaunch: (app: AppShortcut) => void;
};

export function AppShortcutRow({ onLaunch }: AppShortcutRowProps) {
  return (
    <View style={styles.row}>
      {APP_SHORTCUTS.map((app) => (
        <TipPressable
          key={app.id}
          tip={app.label}
          onPress={() => onLaunch(app)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${app.color}1F`, borderColor: `${app.color}55` }]}>
            <MaterialCommunityIcons
              name={app.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={22}
              color={app.color}
            />
          </View>
          <Text style={styles.label}>{app.label}</Text>
        </TipPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'visible',
    zIndex: 2,
  },
  button: {
    alignItems: 'center',
    gap: 6,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
