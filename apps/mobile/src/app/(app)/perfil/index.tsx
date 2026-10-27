import { AVATAR_VARIANTS, DisplayNameSchema, type AvatarVariant } from '@erre/core/client';
import {
  Avatar,
  Banner,
  Button,
  ErrorState,
  LoadingState,
  radius,
  Screen,
  ScreenHeader,
  space,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@erre/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { useCommunity } from '@/lib/community';
import { downloadMyData } from '@/lib/privacy';
import { ProfileSections } from '@/lib/profile';
import { useInstallState } from '@/lib/pwa';
import { useMe, useSignOut, useUpdateProfile } from '@/lib/session';

// My profile (CORE-15): name, avatar color, my trophies in this community, preferences and installing the app.
// Ported in behavior from queridometro@7c5c5bf:src/app/profile/page.tsx and src/components/profile/ProfileForm.tsx.
export default function ProfileScreen() {
  const me = useMe();
  if (me.isPending) return <LoadingState label="Carregando seu perfil…" />;
  if (me.isError || !me.data)
    return <ErrorState message="Não deu pra carregar seu perfil." onRetry={() => me.refetch()} />;
  return <Profile me={me.data} />;
}

const COLOR_NAMES: Record<AvatarVariant, string> = {
  indigo: 'Anil',
  violet: 'Violeta',
  emerald: 'Esmeralda',
  amber: 'Âmbar',
  sky: 'Céu',
  rose: 'Rosa',
  slate: 'Ardósia',
  teal: 'Turquesa',
};

function Profile({ me }: { me: NonNullable<ReturnType<typeof useMe>['data']> }) {
  const update = useUpdateProfile();
  const signOut = useSignOut();
  const toast = useToast();
  const { current } = useCommunity();
  const { colors } = useTheme();
  const [name, setName] = useState(me.displayName);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function saveName() {
    const parsed = DisplayNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Nome inválido.');
    setError(null);
    try {
      await update.mutateAsync({ displayName: name.trim() });
      toast.show({ title: 'Perfil salvo.' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não deu pra salvar. Tente de novo.');
    }
  }

  return (
    <Screen>
      <Button
        label="← Início"
        variant="ghost"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={styles.head}>
        <Avatar name={me.displayName} variant={me.avatarVariant} size={64} />
        <View style={styles.flex}>
          <ScreenHeader overline="Perfil" title={me.displayName} description={me.email} />
        </View>
      </View>

      <View style={styles.section}>
        <TextField
          label="Seu nome"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          error={error}
          help="De 2 a 32 caracteres. É assim que você aparece pra comunidade."
          autoComplete="name"
          textContentType="nickname"
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => void saveName()}
        />
        <Button
          label="Salvar nome"
          variant="secondary"
          loading={update.isPending}
          loadingLabel="Salvando…"
          onPress={() => void saveName()}
        />
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="muted">
          Cor do avatar
        </Text>
        <View accessibilityRole="radiogroup" style={styles.colors}>
          {AVATAR_VARIANTS.map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={COLOR_NAMES[v]}
              aria-checked={me.avatarVariant === v}
              onPress={() =>
                update.mutate(
                  { avatarVariant: v },
                  { onError: () => toast.show({ title: 'Não deu pra trocar a cor.', tone: 'error' }) },
                )
              }
              style={[
                styles.color,
                { borderColor: me.avatarVariant === v ? colors.accent.ring : colors.border.subtle },
              ]}
            >
              <Avatar name={me.displayName} variant={v} size={40} />
            </Pressable>
          ))}
        </View>
      </View>

      {current ? (
        <View style={styles.section}>
          <Text variant="titleMd" accessibilityRole="header">
            {`Seus troféus em ${current.name}`}
          </Text>
          <ProfileSections communityId={current.id} userId={me.id} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="overline" tone="muted">
          Preferências
        </Text>
        <Button label="Notificações" variant="secondary" onPress={() => router.push('/notificacoes')} />
        <Button label="Aparência" variant="secondary" onPress={() => router.push('/perfil/aparencia')} />
        <Install />
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="muted">
          Seus dados
        </Text>
        <Text variant="caption" tone="muted">
          Tudo o que o app guarda sobre você, num arquivo. Seus votos não entram: ninguém, nem o app, sabe quem votou o
          quê. Para apagar sua conta, fale com quem administra o app.
        </Text>
        <Button
          label="Baixar meus dados"
          variant="secondary"
          loading={exporting}
          loadingLabel="Preparando…"
          onPress={() => {
            setExporting(true);
            downloadMyData()
              .catch(() => toast.show({ title: 'Não deu pra baixar seus dados.', tone: 'error' }))
              .finally(() => setExporting(false));
          }}
        />
      </View>

      <Button
        label="Sair"
        loadingLabel="Saindo…"
        loading={signOut.isPending}
        variant="ghost"
        onPress={() => signOut.mutate(undefined, { onSettled: () => router.replace('/entrar') })}
      />
    </Screen>
  );
}

/** "Instalar o app" on the web (DESIGN §10.8). */
function Install() {
  const state = useInstallState();
  if (state.kind === 'prompt')
    return <Button label="Instalar o app" variant="secondary" onPress={() => void state.install()} />;
  if (state.kind === 'ios')
    return (
      <Banner
        tone="info"
        icon="📲"
        title="Instale o app no iPhone"
        description="No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Assim as notificações funcionam."
      />
    );
  return null;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  flex: { flex: 1 },
  section: { gap: space[3], marginTop: space[8] },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // 40 avatar + 2 × (4 padding + 2 ring) = 52: past the 48 touch target (DESIGN §9.1).
  color: { padding: space[1], borderRadius: radius.full, borderWidth: 2 },
});
