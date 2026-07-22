import type { AppShortcut } from '../types/remote';

// The TV's remote service passes app_link straight to Android's
// Intent.parseUri(), so it must be a real URI (deep link), not a bare package
// name - bare package names made some TVs (observed on a Changhong Google TV)
// drop the whole remote connection instead of launching anything. These deep
// links are the ones documented/verified by the Home Assistant Android TV
// Remote integration for launching each app's TV client.
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
];
