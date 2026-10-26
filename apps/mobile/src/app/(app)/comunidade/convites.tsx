import { Button, Card, ConfirmCard, LoadingState, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { useCommunity } from '@/lib/community';
import { inviteLink, useCreateInvite, useInvites, useRevokeInvite } from '@/lib/members';
import { useEnabledManifests } from '@/lib/modules';

async function shareLink(link: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ url: link });
        return 'shared';
      }
      await nav?.clipboard?.writeText(link);
      return 'copied';
    }
    await Share.share({ message: link });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export default function InvitesScreen() {
  const { current } = useCommunity();
  if (!current) return null;
  return <Invites communityId={current.id} name={current.name} />;
}

function Invites({ communityId, name }: { communityId: string; name: string }) {
  const invites = useInvites(communityId);
  const create = useCreateInvite(communityId);
  const revoke = useRevokeInvite(communityId);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Join intents of the enabled modules (D-023): one request gets the person into the community and the module.
  const intents = (useEnabledManifests().data ?? []).flatMap((m) => m.joinIntents);
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  // Like the legacy invite link (join + vote), a module's intent comes selected when there is one.
  const intent = chosen === undefined ? (intents[0]?.id ?? null) : chosen;
  const intentLabel = (id: string | null) =>
    intents.find((i) => i.id === id)?.label ??
    (id ? 'Entrar com a participação num módulo' : 'Só entrar na comunidade');

  if (invites.isPending) return <LoadingState />;
  const list = invites.data ?? [];

  return (
    <Screen>
      <Button label="← Início" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader
        overline={name}
        title="Convidar pessoas"
        description="Mande o link. Quem abrir pede para entrar, e você aprova em Membros."
      />
      <View style={styles.list}>
        {list.map((inv) => {
          const link = inviteLink(inv.code);
          return (
            <View key={inv.id} style={styles.list}>
              <Card>
                <View style={styles.gap}>
                  <Text variant="overline" tone="muted">
                    {intentLabel(inv.intent)}
                  </Text>
                  <Text variant="mono" selectable accessibilityLabel="Link de convite">
                    {link}
                  </Text>
                  <View style={styles.actions}>
                    <Button
                      label="Compartilhar link"
                      variant="secondary"
                      onPress={async () => {
                        const r = await shareLink(link);
                        setFeedback(
                          r === 'copied'
                            ? 'Link copiado.'
                            : r === 'failed'
                              ? 'Não deu pra compartilhar. Copie o link acima.'
                              : null,
                        );
                      }}
                    />
                    <Button label="Desativar" variant="ghost" onPress={() => setConfirm(inv.id)} />
                  </View>
                </View>
              </Card>
              {confirm === inv.id ? (
                <ConfirmCard
                  message="Quem tiver esse link não vai conseguir mais pedir para entrar. Os pedidos já feitos continuam."
                  confirmLabel="Desativar link"
                  loadingLabel="Desativando…"
                  loading={revoke.isPending}
                  onConfirm={async () => {
                    await revoke.mutateAsync(inv.id).catch(() => setFeedback('Não deu pra desativar. Tente de novo.'));
                    setConfirm(null);
                  }}
                  onCancel={() => setConfirm(null)}
                />
              ) : null}
            </View>
          );
        })}
        {list.length === 0 ? <Text tone="muted">Nenhum link ativo.</Text> : null}
        {feedback ? (
          <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
            {feedback}
          </Text>
        ) : null}
        {intents.length > 0 ? (
          <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="O que o link faz">
            <Text variant="overline" tone="muted">
              O que o link faz
            </Text>
            {[null, ...intents.map((i) => i.id)].map((id) => (
              <Card
                key={id ?? 'none'}
                selected={intent === id}
                onPress={() => setChosen(id)}
                accessibilityLabel={intentLabel(id)}
              >
                <Text>{intentLabel(id)}</Text>
              </Card>
            ))}
          </View>
        ) : null}
        <Button
          label={list.length ? 'Criar outro link' : 'Criar link de convite'}
          loadingLabel="Criando…"
          loading={create.isPending}
          variant="primary"
          fullWidth
          onPress={() =>
            create.mutate(intent, { onError: () => setFeedback('Não deu pra criar o link. Tente de novo.') })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  gap: { gap: space[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
});
