import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { APP_SHORTCUTS } from '../constants/appShortcuts';
import { colors, radii, spacing } from '../theme';
import type { AppShortcut } from '../types/remote';
import { TipPressable, pressedIconColor } from './TipPressable';

type AppShortcutRowProps = {
  onLaunch: (app: AppShortcut) => void;
};

export function AppShortcutRow({ onLaunch }: AppShortcutRowProps) {
  return (
    <View style={styles.row}>
      {APP_SHORTCUTS.map((app) => (
        <TipPressable
          key={app.id}
          tip={app.id === 'multi-screen' ? 'Multi-Screen Share' : app.label}
          onPress={() => onLaunch(app)}
          style={styles.button}
          wrapperStyle={styles.buttonSlot}
          showPressedOverlay={false}
        >
          {({ pressed }) => (
            <>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: pressed ? 'rgba(154, 163, 181, 0.42)' : `${app.color}1F`,
                    borderColor: pressed ? colors.border : `${app.color}55`,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={app.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={22}
                  color={pressed ? pressedIconColor : app.color}
                />
              </View>
              <Text style={[styles.label, pressed && styles.labelPressed]}>{app.label}</Text>
            </>
          )}
        </TipPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Equal columns so icon centers stay evenly spaced regardless of label length.
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    overflow: 'visible',
    width: '100%',
    zIndex: 2,
  },
  buttonSlot: {
    flex: 1,
    minWidth: 0,
  },
  button: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
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
    textAlign: 'center',
  },
  labelPressed: {
    color: pressedIconColor,
  },
});
