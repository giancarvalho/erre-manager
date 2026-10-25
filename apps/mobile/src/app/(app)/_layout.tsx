import { ErrorState, LoadingState } from '@erre/ui';
import { Redirect, Stack, usePathname } from 'expo-router';

import { CommunityProvider, useMyCommunities } from '@/lib/community';
import { useMe } from '@/lib/session';

/** Everything in (app) needs a session; the name must be confirmed before anything else (CORE-04). */
export default function AppLayout() {
  const me = useMe();
  const pathname = usePathname();

  if (me.isPending) return <LoadingState label="Carregando sua conta…" />;
  if (me.isError) return <ErrorState message="Não deu pra carregar sua conta." onRetry={() => me.refetch()} />;
  if (!me.data) return <Redirect href={`/entrar?next=${encodeURIComponent(pathname)}` as never} />;
  if (!me.data.nameConfirmed) {
    return <Redirect href={`/onboarding/nome?next=${encodeURIComponent(pathname)}` as never} />;
  }
  return <WithCommunities />;
}

function WithCommunities() {
  const list = useMyCommunities();
  if (list.isPending) return <LoadingState label="Carregando suas comunidades…" />;
  if (list.isError)
    return <ErrorState message="Não deu pra carregar suas comunidades." onRetry={() => list.refetch()} />;
  return (
    <CommunityProvider communities={list.data}>
      <Stack screenOptions={{ headerShown: false }} />
    </CommunityProvider>
  );
}
