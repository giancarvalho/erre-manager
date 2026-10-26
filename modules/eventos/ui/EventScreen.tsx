// One event (EVT-02 to EVT-06, EVT-11): the waiting room for members (sign up, see who's in, go vote) and, for
// whoever manages events, the draft, publishing, opening, closing and deleting. Ported in behavior from
// queridometro@7c5c5bf:src/app/group/[id]/events/[eventId]/page.tsx and the voting page's waiting state
// (vote/page.tsx), plus src/components/group/events/{PublishEventButton,StartVotingButton,
// CloseVotingEventButton,DeleteEventButton,EventShareButton}.tsx.
import { useModuleHost } from '@erre/core/client';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  haptic,
  Screen,
  ScreenHeader,
  Skeleton,
  space,
  Text,
  useToast,
  type AvatarVariant,
} from '@erre/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { STATUS_LABEL } from '../domain/presentation';
import { useEvent, useEventActions, type EventDetail, type LifecycleAction } from './data';
import { EventWizard } from './EventWizard';
import { formatDateTime } from './format';
import { shareText } from './share';

export function EventScreen({ id }: { id: string }) {
  const host = useModuleHost();
  const event = useEvent(id);
  const back = <Button label="← Eventos" variant="ghost" onPress={() => host.navigate('/eventos')} />;
  if (event.isPending)
    return (
      <Screen>
        {back}
        <View style={styles.sections} accessibilityLabel="Carregando o evento" accessible>
          <Skeleton height={48} />
          <Skeleton height={160} />
        </View>
      </Screen>
    );
  if (event.isError) return <ErrorState message={event.error.message} onRetry={() => void event.refetch()} />;
  return <EventBody detail={event.data} back={back} />;
}

const CONFIRM: Record<
  LifecycleAction,
  { title: string; message: string; label: string; loading: string; done: string }
> = {
  publicar: {
    title: 'Publicar o evento?',
    message:
      'Publicar trava os emojis e libera as inscrições pra comunidade. A votação em si só começa depois, quando você abrir ou no horário agendado.',
    label: 'Publicar evento',
    loading: 'Publicando…',
    done: 'Evento publicado. Bora chamar a galera.',
  },
  abrir: {
    title: 'Abrir a votação agora?',
    message: 'Quem se inscreveu já pode votar. Inscrições continuam abertas até o fechamento.',
    label: 'Abrir votação',
    loading: 'Abrindo…',
    done: 'Votação aberta.',
  },
  encerrar: {
    title: 'Fechar a votação agora?',
    message: 'Fechar congela o resultado com os votos de até agora. Não dá pra desfazer.',
    label: 'Fechar votação',
    loading: 'Fechando…',
    done: 'Votação fechada. O resultado saiu.',
  },
};

function EventBody({ detail, back }: { detail: EventDetail; back: React.ReactNode }) {
  const host = useModuleHost();
  const toast = useToast();
  const actions = useEventActions(detail.event.id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<LifecycleAction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { event, emojis, participants, participating, canEdit, canModerate, canVote } = detail;
  const live = event.status === 'accepting_applications' || event.status === 'open';
  const link = `${host.webUrl}/eventos/${event.id}?comunidade=${host.community.id}`;

  function run(action: LifecycleAction) {
    setError(null);
    actions.transition.mutate(action, {
      onSuccess: () => {
        setConfirm(null);
        haptic.success();
        toast.show({ title: CONFIRM[action].done });
      },
      onError: (err) => {
        setConfirm(null);
        setError(err.message);
      },
    });
  }

  async function shareLink() {
    try {
      if ((await shareText(`Vota aí: ${event.title} — ${link}`)) === 'copied') toast.show({ title: 'Link copiado.' });
    } catch {
      toast.show({ title: 'Não deu pra compartilhar.', tone: 'error' });
    }
  }

  const when =
    event.status === 'accepting_applications' && event.scheduledOpenAt
      ? `A votação abre em ${formatDateTime(event.scheduledOpenAt)}.`
      : event.status === 'open' && event.scheduledReleaseAt
        ? `Fecha em ${formatDateTime(event.scheduledReleaseAt)}.`
        : event.status === 'open'
          ? 'Fechamento manual: quem administra fecha quando quiser.'
          : event.status === 'closed' && event.closedAt
            ? `Fechado em ${formatDateTime(event.closedAt)}.`
            : event.releaseMode === 'scheduled' && event.scheduledOpenAt && event.scheduledReleaseAt
              ? `Agendado: abre em ${formatDateTime(event.scheduledOpenAt)} e fecha em ${formatDateTime(event.scheduledReleaseAt)}.`
              : 'Liberação manual: a votação abre e fecha quando quem administra quiser.';

  return (
    <Screen>
      {back}
      <ScreenHeader
        overline="Evento"
        title={event.title}
        {...(event.description ? { description: event.description } : {})}
      />
      <View style={styles.badges}>
        <Badge
          label={STATUS_LABEL[event.status]}
          tone={event.status === 'open' ? 'accent' : event.status === 'accepting_applications' ? 'warning' : 'neutral'}
        />
        <Badge label={event.votingType === 'scale' ? 'Escala' : 'Categórico'} />
      </View>
      <Text tone="secondary">{when}</Text>
      {error ? <Banner tone="error" title={error} /> : null}

      <View style={styles.sections}>
        {/* ---- what a member does here ---- */}
        {live && canVote ? (
          participating ? (
            event.status === 'open' ? (
              <Button
                variant="primary"
                label="Votar agora"
                onPress={() => host.navigate(`/eventos/${event.id}/votar`)}
              />
            ) : (
              <Banner
                tone="event"
                {...(event.bannerRgb ? { eventRgb: event.bannerRgb } : {})}
                icon="✅"
                title="Você já está confirmado!"
                description="Você entra na votação quando ela abrir."
              />
            )
          ) : (
            <View style={styles.section}>
              <Text tone="muted">Quem participa vota e aparece pra receber votos. Ninguém vê quem votou o quê.</Text>
              <Button
                variant="primary"
                label="Participar do evento"
                loading={actions.signUp.isPending}
                loadingLabel="Entrando…"
                onPress={() =>
                  actions.signUp.mutate(undefined, {
                    onSuccess: () => {
                      haptic.success();
                      toast.show({ title: 'Você está no evento.' });
                    },
                    onError: (err) => setError(err.message),
                  })
                }
              />
            </View>
          )
        ) : null}
        {event.status === 'closed' ? (
          <Button
            variant="primary"
            label="Ver resultados"
            onPress={() => host.navigate(`/eventos/${event.id}/resultados`)}
          />
        ) : null}

        {/* ---- who's in ---- */}
        {event.status !== 'draft' ? (
          <View style={styles.section}>
            <Text variant="titleMd" accessibilityRole="header">
              {participants.length === 0
                ? 'Ninguém se inscreveu ainda'
                : `${participants.length} ${participants.length === 1 ? 'pessoa inscrita' : 'pessoas inscritas'}`}
            </Text>
            <View style={styles.people}>
              {participants.map((p) => (
                <Pressable
                  key={p.userId}
                  accessibilityRole="button"
                  accessibilityLabel={p.displayName}
                  accessibilityHint="Abre o perfil"
                  onPress={() => host.openMember(p.userId)}
                  style={styles.person}
                >
                  <Avatar name={p.displayName} variant={p.avatarVariant as AvatarVariant} size={32} />
                  <Text numberOfLines={1}>{p.displayName}</Text>
                </Pressable>
              ))}
            </View>
            {live ? <Button variant="secondary" label="Compartilhar link" onPress={() => void shareLink()} /> : null}
          </View>
        ) : null}

        {/* ---- the roster ---- */}
        <View style={styles.section}>
          <Text variant="titleMd" accessibilityRole="header">
            {event.votingType === 'scale' ? 'Eixos' : 'Emojis'}
          </Text>
          {emojis.length === 0 ? (
            <Text tone="muted">Nenhum emoji ainda. Edite o rascunho pra escolher.</Text>
          ) : (
            emojis.map((e) => (
              <Text key={e.id} tone="secondary">
                {`${e.char}  ${e.label}${e.scaleMax !== null ? ` · até ${e.scaleMax}` : ''}`}
              </Text>
            ))
          )}
        </View>

        {/* ---- managing ---- */}
        {canEdit ? <Button variant="secondary" label="Editar rascunho" onPress={() => setEditing(true)} /> : null}
        {canModerate && event.status !== 'closed' ? (
          <Card>
            <View style={styles.section}>
              <Text variant="label">Administrar</Text>
              {event.status === 'draft' ? (
                <>
                  <Text variant="caption" tone="muted">
                    {emojis.length === 0
                      ? 'Escolha pelo menos um emoji antes de publicar.'
                      : 'Publica o link: a galera já pode se inscrever. A votação começa depois.'}
                  </Text>
                  <Button
                    variant="primary"
                    label="Publicar evento"
                    disabled={emojis.length === 0}
                    disabledReason={emojis.length === 0 ? 'Escolha pelo menos um emoji antes de publicar.' : null}
                    onPress={() => setConfirm('publicar')}
                  />
                </>
              ) : event.status === 'accepting_applications' ? (
                <Button variant="secondary" label="Abrir votação agora" onPress={() => setConfirm('abrir')} />
              ) : (
                <Button variant="secondary" label="Fechar votação agora" onPress={() => setConfirm('encerrar')} />
              )}
            </View>
          </Card>
        ) : null}
        {canModerate ? (
          <View style={styles.section}>
            <Text variant="overline" tone="muted">
              Zona de perigo
            </Text>
            <Button variant="destructive" label="Excluir evento" onPress={() => setDeleting(true)} />
          </View>
        ) : null}
      </View>

      {confirm ? (
        <ConfirmDialog
          visible
          title={CONFIRM[confirm].title}
          message={CONFIRM[confirm].message}
          confirmLabel={CONFIRM[confirm].label}
          loadingLabel={CONFIRM[confirm].loading}
          loading={actions.transition.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(confirm)}
        />
      ) : null}
      <ConfirmDialog
        visible={deleting}
        title="Excluir o evento?"
        message="Ele some da lista, do início e dos resultados, pra todo mundo. Não dá pra desfazer."
        confirmLabel="Excluir evento"
        loadingLabel="Excluindo…"
        loading={actions.remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          actions.remove.mutate(undefined, {
            onSuccess: () => {
              haptic.impact();
              toast.show({ title: 'Evento excluído.' });
              host.navigate('/eventos');
            },
            onError: (err) => {
              setDeleting(false);
              setError(err.message);
            },
          })
        }
      />
      {editing ? (
        <EventWizard
          initial={{ event, emojis }}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            toast.show({ title: 'Rascunho salvo.' });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: space[2], marginBottom: space[2] },
  sections: { gap: space[6], marginTop: space[6] },
  section: { gap: space[3] },
  people: { gap: space[2] },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48 },
});
