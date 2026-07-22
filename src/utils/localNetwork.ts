import * as Network from 'expo-network';

export const WIFI_OFF_MESSAGE = 'Please connect to a wifi network';

/** True when the phone has Wi‑Fi or Ethernet — needed to reach a LAN TV. */
export function hasLocalNetwork(state: Network.NetworkState): boolean {
  if (state.isConnected !== true) return false;
  return (
    state.type === Network.NetworkStateType.WIFI ||
    state.type === Network.NetworkStateType.ETHERNET
  );
}

/**
 * Wi‑Fi / Ethernet only. Do not treat mobile data as online — a successful
 * cellular route is useless for talking to a TV on the LAN, and probing
 * 8.8.8.8 over LTE previously made us think we were "online" with Wi‑Fi off.
 */
export async function getHasLocalNetwork(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return hasLocalNetwork(state);
  } catch {
    return false;
  }
}
