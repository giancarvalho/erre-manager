// Installing the web app (CORE-20, DESIGN §10.8): Android/Chrome offers the install prompt; iOS Safari only lets
// people add it from the share menu, so we explain how. Nothing on native, nothing once installed.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type InstallState = { kind: 'none' } | { kind: 'prompt'; install: () => Promise<void> } | { kind: 'ios' };

function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function useInstallState(): InstallState {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => Platform.OS !== 'web' || standalone());
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  if (installed) return { kind: 'none' };
  if (event)
    return {
      kind: 'prompt',
      install: async () => {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') setInstalled(true);
        setEvent(null);
      },
    };
  return isIosSafari() ? { kind: 'ios' } : { kind: 'none' };
}
