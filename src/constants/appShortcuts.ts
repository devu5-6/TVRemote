import type { AppShortcut } from '../types/remote';

/** Safe launch URI for a package ID on Google TV. Never send bare packages. */
export function marketLaunchLink(packageName: string): string {
  return `market://launch?id=${packageName.trim()}`;
}

// The TV's remote service passes app_link to Intent.parseUri().
// On Changhong / AI PONT Google TV:
// - Bare package names drop the remote session (reconnect toast).
// - Raw #Intent;… links can also drop the session.
// - market://launch?id=<package> launches an installed app by ID.
// Multi-Screen Share's package varies by OEM and is learned at runtime
// from the TV's current_app event (guessing shows "item not found").
export const APP_SHORTCUTS: AppShortcut[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    appLink: 'vnd.youtube://',
    icon: 'youtube',
    color: '#FF0000',
  },
  {
    id: 'prime-video',
    label: 'Prime Video',
    appLink: 'https://app.primevideo.com',
    icon: 'play-circle',
    color: '#00A8E1',
  },
  {
    id: 'netflix',
    label: 'Netflix',
    appLink: 'https://www.netflix.com/title',
    icon: 'netflix',
    color: '#E50914',
  },
  {
    id: 'multi-screen',
    label: 'Share',
    // Placeholder only — runtime uses the learned package via marketLaunchLink.
    appLink: marketLaunchLink('com.changhong.dmr'),
    icon: 'cast',
    color: '#5B8DEF',
  },
];

/** True if a running package looks like Multi-Screen / cast / Miracast. */
export function looksLikeMultiScreenPackage(packageName: string): boolean {
  const p = packageName.trim().toLowerCase();
  if (!p || p.includes('tvcenter') || p.includes('tvinput') || p.includes('passthrough')) {
    return false;
  }
  return (
    p.includes('eshare') ||
    p.includes('multiscreen') ||
    p.includes('multi_screen') ||
    p.includes('screenshare') ||
    p.includes('screen_share') ||
    p.includes('screencast') ||
    p.includes('miracast') ||
    p.includes('screensynergy') ||
    p.includes('mscreensynergy') ||
    p.includes('howtocast') ||
    p.includes('.dmr') ||
    /(^|\.)(cast|wfd|wifidisplay)($|\.)/.test(p)
  );
}

/** Default Files / USB browser packages on Android / Google TV. */
export const FILE_MANAGER_PACKAGE_CANDIDATES = [
  'com.android.documentsui',
  'com.google.android.documentsui',
  'com.mediatek.filemanager',
  'com.softwinner.TvdFileManager',
  'com.droidlogic.app.FileBrower',
  'com.homwee.filemanager',
  'next.app.tv.filemanager',
];

/** True if a running package looks like a file manager / USB browser. */
export function looksLikeFileManagerPackage(packageName: string): boolean {
  const p = packageName.trim().toLowerCase();
  if (!p) return false;
  return (
    p.includes('documentsui') ||
    p.includes('filemanager') ||
    p.includes('file_manager') ||
    p.includes('filebrowser') ||
    p.includes('file_browser') ||
    p.includes('fileexplorer') ||
    p.includes('file_explorer') ||
    p.includes('anexplorer') ||
    p.includes('tvdfilemanager') ||
    (p.includes('file') && (p.includes('manager') || p.includes('browser') || p.includes('explorer')))
  );
}
