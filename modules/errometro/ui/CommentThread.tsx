// Comments on a person's result in a round. Ported in behavior from
// queridometro@7c5c5bf:src/components/results/CommentThread.tsx: open on demand, write, edit your own,
// delete your own (moderators delete any), with confirmation.
import { Button, ConfirmDialog, space, Text, TextField } from '@erre/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCommentActions, useComments, type Comment } from './data';

const MAX = 280;

export function CommentThread({
  targetId,
  targetName,
  period,
  count,
  viewerId,
  canModerate,
}: {
  targetId: string;
  targetName: string;
  period: string;
  count: number;
  viewerId: string;
  canModerate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const comments = useComments(targetId, period, open);
  const actions = useCommentActions(targetId, period);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = count === 0 ? 'Comentar' : count === 1 ? '1 comentário' : `${count} comentários`;
  const trimmed = text.trim();
  const invalid =
    trimmed.length === 0 ? 'Escreva alguma coisa.' : trimmed.length > MAX ? `Máximo de ${MAX} caracteres.` : null;

  async function send() {
    setError(null);
    try {
      if (editing) await actions.edit.mutateAsync({ id: editing.id, text: trimmed });
      else await actions.add.mutateAsync(trimmed);
      setText('');
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra salvar. Tente de novo.');
    }
  }

  return (
    <View style={styles.box}>
      <Button
        variant="ghost"
        label={open ? 'Esconder comentários' : label}
        accessibilityHint={`Comentários sobre ${targetName}`}
        onPress={() => setOpen((o) => !o)}
      />
      {open ? (
        <View style={styles.box}>
          {comments.isPending ? (
            <Text variant="caption" tone="muted">
              Carregando…
            </Text>
          ) : comments.isError ? (
            <Text variant="caption" tone="danger">
              {comments.error.message}
            </Text>
          ) : comments.data.length === 0 ? (
            <Text variant="caption" tone="muted">
              Ninguém comentou ainda.
            </Text>
          ) : (
            comments.data.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Text variant="caption" tone="muted">
                  {c.updatedAt ? `${c.authorName} · editado` : c.authorName}
                </Text>
                <Text tone="secondary">{c.text}</Text>
                <View style={styles.actions}>
                  {c.authorId === viewerId ? (
                    <Button
                      variant="ghost"
                      label="Editar"
                      onPress={() => {
                        setEditing(c);
                        setText(c.text);
                      }}
                    />
                  ) : null}
                  {c.authorId === viewerId || canModerate ? (
                    <Button variant="ghost" label="Apagar" onPress={() => setDeleting(c)} />
                  ) : null}
                </View>
              </View>
            ))
          )}
          <TextField
            label={editing ? 'Editar comentário' : `Comentar sobre ${targetName}`}
            value={text}
            onChangeText={setText}
            maxLength={MAX + 20}
            multiline
            help={`${trimmed.length} de ${MAX}`}
            error={error}
          />
          <View style={styles.actions}>
            {editing ? (
              <Button
                variant="secondary"
                label="Cancelar"
                onPress={() => {
                  setEditing(null);
                  setText('');
                }}
              />
            ) : null}
            <Button
              variant="secondary"
              label={editing ? 'Salvar comentário' : 'Enviar comentário'}
              loading={actions.add.isPending || actions.edit.isPending}
              loadingLabel="Salvando…"
              disabled={invalid !== null}
              disabledReason={text.length > 0 ? invalid : null}
              onPress={() => void send()}
            />
          </View>
        </View>
      ) : null}
      <ConfirmDialog
        visible={deleting !== null}
        title="Apagar comentário?"
        message="O comentário some pra todo mundo. Não dá pra desfazer."
        confirmLabel="Apagar comentário"
        loadingLabel="Apagando…"
        loading={actions.remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          actions.remove.mutate(deleting.id, {
            onSettled: () => setDeleting(null),
            onError: (err) => setError(err.message),
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[2] },
  comment: { gap: space[1] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
