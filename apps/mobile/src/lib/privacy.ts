// "Baixar meus dados" (LGPD, Sprint 19): the export from GET /v1/me/export as a file on the web, or through the
// share sheet on native (save to Files, send to yourself).
import { Platform, Share } from 'react-native';

import { api } from './api';

export async function downloadMyData(): Promise<void> {
  const data = await api<unknown>('/v1/me/export');
  const text = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meus-dados.json';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: 'Meus dados', message: text });
}
