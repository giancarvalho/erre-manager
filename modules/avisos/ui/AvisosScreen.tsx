// Main screen of Mural de avisos (/avisos): the notices, newest first; a form for whoever can publish; deleting with
// confirmation. Only components and tokens of @erre/ui (docs/design/DESIGN.md): loading, empty and error states included.
import { ModuleApiError, useModuleHost } from '@erre/core/client';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  haptic,
  Screen,
  ScreenHeader,
  Skeleton,
  space,
  Text,
  TextField,
  useToast,
} from '@erre/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BODY_MAX, NewAvisoSchema, TITLE_MAX } from '../domain/schemas';
import { useAvisos, useDeleteAviso, usePublishAviso, type Aviso } from './data';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function AvisosScreen() {
  const host = useModuleHost();
  const avisos = useAvisos();
  const [deleting, setDeleting] = useState<Aviso | null>(null);
  const remove = useDeleteAviso();
  const toast = useToast();

  const header = (
    <>
      <Button label="← Início" variant="ghost" onPress={host.back} />
      <ScreenHeader
        overline="Mural de avisos"
        title="Avisos da comunidade"
        description="O que todo mundo precisa saber, num lugar só."
      />
    </>
  );
  if (avisos.isPending)
    return (
      <Screen>
        {header}
        <View style={styles.list} accessibilityLabel="Carregando" accessible>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      </Screen>
    );
  if (avisos.isError)
    return <ErrorState message={avisos.error.message} onRetry={() => void avisos.refetch()} onBack={host.back} />;

  const { canPublish } = avisos.data;
  return (
    <Screen>
      {header}
      {canPublish ? <PublishForm /> : null}
      {avisos.data.avisos.length === 0 ? (
        <EmptyState
          emoji="📌"
          message={canPublish ? 'Nenhum aviso ainda. Publique o primeiro.' : 'Nenhum aviso por enquanto.'}
        />
      ) : (
        <View style={styles.list}>
          {avisos.data.avisos.map((aviso) => (
            <AvisoCard key={aviso.id} aviso={aviso} onDelete={canPublish ? () => setDeleting(aviso) : undefined} />
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={deleting !== null}
        title="Apagar aviso?"
        message="Ele some do mural pra todo mundo da comunidade."
        confirmLabel="Apagar aviso"
        loadingLabel="Apagando…"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              haptic.impact();
              setDeleting(null);
              toast.show({ title: 'Aviso apagado.' });
            },
            onError: (err) => toast.show({ title: err.message, tone: 'error' }),
          })
        }
      />
    </Screen>
  );
}

function AvisoCard({ aviso, onDelete }: { aviso: Aviso; onDelete: (() => void) | undefined }) {
  const author = aviso.author?.displayName ?? 'Ex-membro';
  return (
    <Card>
      <View style={styles.card}>
        <View style={styles.byline}>
          {aviso.author ? (
            <Avatar name={aviso.author.displayName} variant={aviso.author.avatarVariant} size={32} />
          ) : null}
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {author}
            </Text>
            <Text variant="caption" tone="muted">
              {dateFormat.format(new Date(aviso.createdAt))}
            </Text>
          </View>
        </View>
        <Text variant="titleMd" accessibilityRole="header">
          {aviso.title}
        </Text>
        <Text tone="secondary">{aviso.body}</Text>
        {onDelete ? (
          <Button
            label="Apagar"
            variant="destructive"
            accessibilityHint={`Apaga o aviso "${aviso.title}" para todo mundo`}
            onPress={onDelete}
          />
        ) : null}
      </View>
    </Card>
  );
}

type FieldErrors = { title?: string | undefined; body?: string | undefined };

function PublishForm() {
  const publish = usePublishAviso();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sendError, setSendError] = useState<string | null>(null);

  function submit() {
    const parsed = NewAvisoSchema.safeParse({ title, body });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'title' || field === 'body') && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSendError(null);
    publish.mutate(parsed.data, {
      onSuccess: () => {
        setTitle('');
        setBody('');
        haptic.success();
        toast.show({ title: 'Aviso publicado. A comunidade foi avisada.' });
      },
      onError: (err) =>
        setSendError(err instanceof ModuleApiError ? err.message : 'Não deu pra publicar. Tente de novo.'),
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Título"
        value={title}
        onChangeText={setTitle}
        error={errors.title ?? null}
        maxLength={TITLE_MAX}
        placeholder="ex: Treino de sábado cancelado"
        returnKeyType="next"
      />
      <TextField
        label="Aviso"
        value={body}
        onChangeText={setBody}
        error={errors.body ?? sendError}
        help="Todo mundo da comunidade recebe uma notificação."
        maxLength={BODY_MAX}
        multiline
        numberOfLines={4}
      />
      <Button
        label="Publicar aviso"
        loadingLabel="Publicando…"
        loading={publish.isPending}
        variant="primary"
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3], marginTop: space[4] },
  form: { gap: space[3] },
  card: { gap: space[2] },
  byline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
});
