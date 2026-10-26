import { Avatar, Button, ErrorState, LoadingState, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ROLE_LABEL, useCommunity } from '@/lib/community';
import { useMembers } from '@/lib/members';
import { ProfileSections } from '@/lib/profile';
import { useMe } from '@/lib/session';

// Member page (CORE-14): name, avatar, role and every module's profile section in this community. Ported in
// behavior from queridometro@7c5c5bf:src/app/group/[id]/member/[userId]/page.tsx.
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current } = useCommunity();
  const members = useMembers(current?.id ?? '');
  const me = useMe();
  const back = (
    <Button
      label="← Voltar"
      variant="ghost"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
  if (!current) return null;
  if (members.isPending) return <LoadingState />;
  if (members.isError)
    return <ErrorState message="Não deu pra carregar os membros." onRetry={() => members.refetch()} />;
  const member = members.data.find((m) => m.userId === id);
  if (!member)
    return (
      <Screen>
        {back}
        <ScreenHeader
          overline={current.name}
          title="Membro não encontrado"
          description="Essa pessoa não está mais na comunidade."
        />
      </Screen>
    );
  const isMe = me.data?.id === member.userId;
  return (
    <Screen>
      {back}
      <View style={styles.head}>
        <Avatar name={member.displayName} variant={member.avatarVariant} size={64} />
        <View style={styles.flex}>
          <Text variant="overline" tone="muted">
            {current.name}
          </Text>
          <Text variant="titleLg" accessibilityRole="header" numberOfLines={2}>
            {member.displayName}
          </Text>
          <Text variant="caption" tone="muted">
            {ROLE_LABEL[member.role]}
          </Text>
        </View>
      </View>
      {isMe ? <Button label="Editar meu perfil" variant="secondary" onPress={() => router.push('/perfil')} /> : null}
      <View style={styles.sections}>
        <ProfileSections communityId={current.id} userId={member.userId} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[4], marginBottom: space[6] },
  flex: { flex: 1, gap: space[1] },
  sections: { marginTop: space[6] },
});
