import { Button, Screen, ScreenHeader, space, SwitchRow, Text } from '@erre/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/lib/api';
import { isPushOn, pushUnavailableReason, turnPushOff, turnPushOn } from '@/lib/push';

type Preference = { type: string; label: string; module: string; enabled: boolean };

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const device = useQuery({
    queryKey: ['push', 'device'],
    queryFn: async () => ({ on: await isPushOn(), unavailable: await pushUnavailableReason() }),
  });
  const prefs = useQuery({
    queryKey: ['push', 'prefs'],
    queryFn: () => api<Preference[]>('/v1/notification-preferences'),
  });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);

  const toggleDevice = useMutation({
    mutationFn: (on: boolean) => (on ? turnPushOn() : turnPushOff()),
    onSuccess: (result) => {
      setDeviceError(result.ok ? null : result.reason);
      void qc.invalidateQueries({ queryKey: ['push', 'device'] });
    },
  });
  const togglePref = useMutation({
    mutationFn: (p: { type: string; enabled: boolean }) =>
      api('/v1/notification-preferences', { method: 'PUT', body: p }),
    onMutate: (p) => {
      setPrefError(null);
      qc.setQueryData<Preference[]>(['push', 'prefs'], (prev) =>
        prev?.map((x) => (x.type === p.type ? { ...x, enabled: p.enabled } : x)),
      );
    },
    onError: () => {
      setPrefError('Não deu pra salvar. Tente de novo.');
      void qc.invalidateQueries({ queryKey: ['push', 'prefs'] });
    },
  });

  return (
    <Screen>
      <Button label="← Início" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader overline="Perfil" title="Notificações" description="Escolha o que você quer receber." />
      <View style={styles.section}>
        <Text variant="overline" tone="muted" accessibilityRole="header">
          Neste aparelho
        </Text>
        <SwitchRow
          label="Receber notificações"
          description="Vale só para este aparelho ou navegador."
          value={device.data?.on ?? false}
          disabled={device.isPending || toggleDevice.isPending}
          disabledReason={device.data?.on ? null : (device.data?.unavailable ?? null)}
          onValueChange={(on) => toggleDevice.mutate(on)}
        />
        {deviceError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {deviceError}
          </Text>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text variant="overline" tone="muted" accessibilityRole="header">
          O que avisar
        </Text>
        {prefs.isPending ? (
          <Text tone="muted">Carregando…</Text>
        ) : prefs.isError ? (
          <Button label="Tentar de novo" onPress={() => prefs.refetch()} />
        ) : prefs.data.length === 0 ? (
          <Text tone="muted">Nenhum tipo de notificação por enquanto.</Text>
        ) : (
          prefs.data.map((p) => (
            <SwitchRow
              key={p.type}
              label={p.label}
              value={p.enabled}
              onValueChange={(enabled) => togglePref.mutate({ type: p.type, enabled })}
            />
          ))
        )}
        {prefError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {prefError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: space[3], marginBottom: space[8] } });
