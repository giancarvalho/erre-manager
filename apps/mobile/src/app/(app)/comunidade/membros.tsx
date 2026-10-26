import type { JoinRequest, Member } from '@erre/core/client';
import {
  Avatar,
  Button,
  Card,
  ConfirmCard,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  space,
  Text,
} from '@erre/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { ROLE_LABEL, useCommunity, useCommunityDetails } from '@/lib/community';
import { useLeave, useMembers, useModerate, useRequests } from '@/lib/members';
import { useMe } from '@/lib/session';

export default function MembersScreen() {
  const { current } = useCommunity();
  const details = useCommunityDetails(current?.id);
  if (!current) return null;
  if (details.isPending) return <LoadingState />;
  if (details.isError)
    return <ErrorState message="Não deu pra abrir a comunidade." onRetry={() => details.refetch()} />;
  const manager = details.data.permissions.includes('core.membros.gerenciar');
  return <Members communityId={current.id} name={current.name} manager={manager} />;
}

function Members({ communityId, name, manager }: { communityId: string; name: string; manager: boolean }) {
  const members = useMembers(communityId);
  const requests = useRequests(communityId, manager);
  const moderate = useModerate(communityId);
  const leave = useLeave(communityId);
  const me = useMe();
  const [confirm, setConfirm] = useState<{ kind: 'remove'; member: Member } | { kind: 'leave' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'approve' | 'reject' | 'remove', userId: string) {
    setError(null);
    try {
      await moderate.mutateAsync({ action, userId });
      setConfirm(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não deu certo. Tente de novo.');
    }
  }

  return (
    <Screen>
      <Button label="← Início" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader overline={name} title="Membros" description="Quem faz parte da comunidade." />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {manager ? (
        <Section title="Pedidos para entrar">
          {requests.isPending ? (
            <Text tone="muted">Carregando…</Text>
          ) : requests.data && requests.data.length > 0 ? (
            requests.data.map((r) => <RequestRow key={r.userId} request={r} busy={moderate.isPending} onAct={act} />)
          ) : (
            <Text tone="muted">Nenhum pedido agora.</Text>
          )}
        </Section>
      ) : null}

      <Section title={members.data ? `${members.data.length} membros` : 'Membros'}>
        {members.isPending ? (
          <Text tone="muted">Carregando…</Text>
        ) : members.isError ? (
          <Button label="Tentar de novo" onPress={() => members.refetch()} />
        ) : (
          members.data.map((m) => (
            <View key={m.userId} style={styles.gap}>
              <Card>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${m.displayName}, ${ROLE_LABEL[m.role]}`}
                    accessibilityHint="Abre o perfil"
                    onPress={() => router.push(`/comunidade/membro/${m.userId}` as never)}
                    style={[styles.row, styles.flex]}
                  >
                    <Avatar name={m.displayName} variant={m.avatarVariant} />
                    <View style={styles.flex}>
                      <Text variant="label" numberOfLines={1}>
                        {m.displayName}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {ROLE_LABEL[m.role]}
                      </Text>
                    </View>
                  </Pressable>
                  {manager && m.role !== 'owner' && m.userId !== me.data?.id ? (
                    <Button label="Remover" variant="ghost" onPress={() => setConfirm({ kind: 'remove', member: m })} />
                  ) : null}
                </View>
              </Card>
              {confirm?.kind === 'remove' && confirm.member.userId === m.userId ? (
                <ConfirmCard
                  message={`${m.displayName} perde o acesso à comunidade. Pode pedir para entrar de novo.`}
                  confirmLabel={`Remover ${m.displayName}`}
                  loadingLabel="Removendo…"
                  loading={moderate.isPending}
                  onConfirm={() => act('remove', m.userId)}
                  onCancel={() => setConfirm(null)}
                />
              ) : null}
            </View>
          ))
        )}
      </Section>

      <View style={styles.leave}>
        {confirm?.kind === 'leave' ? (
          <ConfirmCard
            message={`Você perde o acesso a ${name} até pedir de novo e ser aprovado.`}
            confirmLabel={`Sair de ${name}`}
            loadingLabel="Saindo…"
            loading={leave.isPending}
            onConfirm={async () => {
              setError(null);
              try {
                await leave.mutateAsync();
                router.replace('/');
              } catch (err) {
                setConfirm(null);
                setError(err instanceof ApiError ? err.message : 'Não deu pra sair. Tente de novo.');
              }
            }}
            onCancel={() => setConfirm(null)}
          />
        ) : (
          <Button label="Sair da comunidade" variant="destructive" onPress={() => setConfirm({ kind: 'leave' })} />
        )}
      </View>
    </Screen>
  );
}

function RequestRow({
  request,
  busy,
  onAct,
}: {
  request: JoinRequest;
  busy: boolean;
  onAct: (action: 'approve' | 'reject', userId: string) => void;
}) {
  return (
    <Card>
      <View style={styles.gap}>
        <View style={styles.row}>
          <Avatar name={request.displayName} variant={request.avatarVariant} />
          <Text variant="label" style={styles.flex} numberOfLines={1}>
            {request.displayName}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={`Aprovar ${request.displayName}`}
            variant="secondary"
            disabled={busy}
            onPress={() => onAct('approve', request.userId)}
          />
          <Button label="Recusar" variant="ghost" disabled={busy} onPress={() => onAct('reject', request.userId)} />
        </View>
      </View>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.gap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3], marginBottom: space[8] },
  gap: { gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  error: { marginBottom: space[4] },
  leave: { marginTop: space[4] },
});
