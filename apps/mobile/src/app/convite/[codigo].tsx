import { Button, Card, ErrorState, LoadingState, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { myCommunitiesKey } from '@/lib/community';
import { useInvitePreview, useJoin } from '@/lib/members';
import { useMe } from '@/lib/session';
import { writePref } from '@/lib/storage';

// Invite landing (CORE-08): works without a session; asking to join needs one. Always pending (D-023).
export default function InviteScreen() {
  const { codigo = '' } = useLocalSearchParams<{ codigo: string }>();
  const preview = useInvitePreview(codigo);
  const me = useMe();
  const join = useJoin(codigo);
  const qc = useQueryClient();

  if (preview.isPending || me.isPending) return <LoadingState label="Abrindo o convite…" />;
  if (preview.isError) {
    const message =
      preview.error instanceof ApiError && preview.error.status === 404
        ? preview.error.message
        : 'Não deu pra abrir o convite.';
    return (
      <ErrorState
        message={message}
        {...(preview.error instanceof ApiError && preview.error.status === 404
          ? {}
          : { onRetry: () => preview.refetch() })}
      />
    );
  }

  const { community, intent, myStatus } = preview.data;
  const status = join.data?.status ?? myStatus;
  const signedIn = !!me.data;

  async function open() {
    writePref('erre:community', community.id);
    await qc.invalidateQueries({ queryKey: myCommunitiesKey });
    router.replace('/');
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Convite"
        title={community.name}
        description={
          intent
            ? `${intent.label}. Quem administra a comunidade aprova o pedido.`
            : 'Peça para entrar. Quem administra a comunidade aprova o pedido.'
        }
      />
      <View style={styles.body}>
        {!signedIn ? (
          <Button
            label="Entrar para pedir"
            variant="primary"
            fullWidth
            onPress={() => router.push(`/entrar?next=${encodeURIComponent(`/convite/${codigo}`)}` as never)}
          />
        ) : status === 'approved' ? (
          <>
            <Text variant="body" tone="muted">
              Você já faz parte dessa comunidade.
            </Text>
            <Button label="Abrir comunidade" variant="primary" fullWidth onPress={open} />
          </>
        ) : status === 'pending' ? (
          <>
            <Card>
              <Text variant="label">Pedido enviado</Text>
              <Text variant="body" tone="muted">
                Agora é esperar quem administra a comunidade aprovar. Você vai ver a comunidade no início quando entrar.
              </Text>
            </Card>
            <Button label="Ir para o início" variant="secondary" fullWidth onPress={() => router.replace('/')} />
          </>
        ) : (
          <>
            {status === 'rejected' || status === 'removed' ? (
              <Text variant="body" tone="muted">
                Você já esteve nessa comunidade. Dá pra pedir de novo.
              </Text>
            ) : null}
            <Button
              label="Pedir para entrar"
              loadingLabel="Enviando…"
              loading={join.isPending}
              variant="primary"
              fullWidth
              onPress={() => join.mutate()}
            />
            {join.isError ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {join.error instanceof ApiError ? join.error.message : 'Não deu pra enviar. Tente de novo.'}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: space[4] } });
