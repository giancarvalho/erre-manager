import { Avatar, Button, ErrorState, LoadingState, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ROLE_LABEL, useCommunity, useCommunityDetails } from '@/lib/community';
import { useMyRequests } from '@/lib/members';
import { useMe, useSignOut } from '@/lib/session';

// Home (Sprint 6). Sprint 8 turns it into the community hub with one section per module (D-033).
export default function Home() {
  const { current, communities } = useCommunity();
  if (!current) return <NoCommunity />;
  return <CommunityHome id={current.id} many={communities.length > 1} />;
}

function NoCommunity() {
  return (
    <Screen>
      <ScreenHeader
        overline="Erre"
        title="Você ainda não está em nenhuma comunidade"
        description="Crie uma para chamar a galera, ou abra o link de convite que alguém te mandou."
      />
      <Button label="Criar comunidade" variant="primary" fullWidth onPress={() => router.push('/comunidades/nova')} />
      <PendingRequests />
      <Account />
    </Screen>
  );
}

function CommunityHome({ id, many }: { id: string; many: boolean }) {
  const details = useCommunityDetails(id);
  if (details.isPending) return <LoadingState />;
  if (details.isError)
    return <ErrorState message="Não deu pra abrir a comunidade." onRetry={() => details.refetch()} />;
  return (
    <Screen>
      <ScreenHeader
        overline="Comunidade"
        title={details.data.name}
        description="O que rola por aqui vai aparecer nesta tela."
      />
      <Text variant="caption" tone="muted" style={styles.role}>
        {`Seu papel: ${ROLE_LABEL[details.data.role]}`}
      </Text>
      <View style={styles.actions}>
        <Button label="Membros" variant="secondary" fullWidth onPress={() => router.push('/comunidade/membros')} />
        {details.data.permissions.includes('core.convites.gerenciar') ? (
          <Button
            label="Convidar pessoas"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/comunidade/convites')}
          />
        ) : null}
        {many ? (
          <Button
            label="Trocar de comunidade"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/comunidades')}
          />
        ) : null}
        <Button label="Criar outra comunidade" variant="ghost" onPress={() => router.push('/comunidades/nova')} />
      </View>
      <PendingRequests />
      <Account />
    </Screen>
  );
}

function PendingRequests() {
  const requests = useMyRequests();
  if (!requests.data?.length) return null;
  return (
    <View style={styles.pending}>
      <Text variant="overline" tone="muted" accessibilityRole="header">
        Aguardando aprovação
      </Text>
      {requests.data.map((r) => (
        <Text key={r.id} variant="body" tone="secondary">
          {r.name}
        </Text>
      ))}
    </View>
  );
}

function Account() {
  const me = useMe();
  const signOut = useSignOut();
  if (!me.data) return null;
  return (
    <View style={styles.account}>
      <View style={styles.row}>
        <Avatar name={me.data.displayName} variant={me.data.avatarVariant} />
        <View>
          <Text variant="label">{me.data.displayName}</Text>
          <Text variant="caption" tone="muted">
            {me.data.email}
          </Text>
        </View>
      </View>
      <Button
        label="Sair"
        loadingLabel="Saindo…"
        loading={signOut.isPending}
        variant="ghost"
        onPress={() => signOut.mutate(undefined, { onSettled: () => router.replace('/entrar') })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  role: { marginTop: -space[4], marginBottom: space[6] },
  actions: { gap: space[3] },
  account: { marginTop: space[10], gap: space[3] },
  pending: { marginTop: space[8], gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
});
