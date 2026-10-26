// Sharing from the event screens: the native share sheet, or the clipboard on the web without Web Share.
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/** Returns 'copied' when the text went to the clipboard (the caller tells the person). */
export async function shareText(message: string): Promise<'shared' | 'copied'> {
  const nav = globalThis.navigator as (Navigator & { share?: unknown }) | undefined;
  if (Platform.OS !== 'web' || typeof nav?.share === 'function') {
    await Share.share({ message });
    return 'shared';
  }
  await Clipboard.setStringAsync(message);
  return 'copied';
}
