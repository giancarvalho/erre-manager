// Voting in an event (EVT-07): categorical (one emoji per person, like the Errômetro) or scale (an intensity per
// axis and person). Anonymous on the wire like the Errômetro (DESIGN §10.1). Ported in behavior from
// queridometro@7c5c5bf:src/app/group/[id]/events/[eventId]/vote/page.tsx and src/components/voting/events/
// {EventQuickFireGrid,EventScaleQuickFireGrid,EventScaleIntensityPicker,AnonymousEventSubmitVotesBar,
// AnonymousEventScaleSubmitVotesBar}.tsx.
import { useModuleHost } from '@erre/core/client';
import {
  Accordion,
  Banner,
  Button,
  CopyableCode,
  EMOJI_BUTTON_MIN,
  EMOJI_GRID_GAP,
  EmojiButton,
  EmojiGrid,
  EmptyState,
  ErrorState,
  haptic,
  IntensityPicker,
  layout,
  ListScreen,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  space,
  StickyActionBar,
  Text,
  useToast,
  VoteTargetCard,
  type AvatarVariant,
} from '@erre/ui';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { EventVoteSubmission } from '../domain/ballot';
import { ensureToken, fetchMyVotes, loadToken, submitBallot, type StoredToken } from './anon';
import { EventosError, useEvent, useEventosClient, type EventDetail, type EventEmoji } from './data';
import { formatDateTime } from './format';

type Target = EventDetail['participants'][number];
type SortMode = 'alpha' | 'unvoted';
const SORT_OPTIONS = [
  { value: 'alpha', label: 'Alfabética' },
  { value: 'unvoted', label: 'Não votados' },
] as const;

const INTRO = {
  categorical: 'Toque em um emoji para cada pessoa. Você pode mudar seus votos a qualquer momento antes do fechamento.',
  scale: 'Dê uma nota por eixo pra cada pessoa. Você pode mudar suas notas a qualquer momento antes do fechamento.',
};

export function VoteScreen({ id }: { id: string }) {
  const host = useModuleHost();
  const event = useEvent(id);
  const back = <Button label="← Evento" variant="ghost" onPress={() => host.navigate(`/eventos/${id}`)} />;
  if (event.isPending)
    return (
      <Screen>
        {back}
        <View style={styles.loading} accessibilityLabel="Carregando a votação" accessible>
          <Skeleton height={64} />
          <Skeleton height={220} />
        </View>
      </Screen>
    );
  if (event.isError) return <ErrorState message={event.error.message} onRetry={() => void event.refetch()} />;
  const d = event.data;
  const blocked =
    d.event.status === 'closed'
      ? { title: 'Esse evento já encerrou.', action: 'Ver resultados', to: `/eventos/${id}/resultados` }
      : d.event.status !== 'open'
        ? {
            title: 'Esse evento ainda não abriu para votos.',
            description: d.event.scheduledOpenAt ? `Abre em ${formatDateTime(d.event.scheduledOpenAt)}.` : undefined,
            action: 'Ver evento',
            to: `/eventos/${id}`,
          }
        : !d.participating
          ? { title: 'Você ainda não participa desse evento.', action: 'Participar', to: `/eventos/${id}` }
          : null;
  if (blocked)
    return (
      <Screen>
        {back}
        <ScreenHeader overline="Evento" title={d.event.title} />
        <Banner
          tone="info"
          title={blocked.title}
          {...(blocked.description ? { description: blocked.description } : {})}
          action={<Button variant="secondary" label={blocked.action} onPress={() => host.navigate(blocked.to)} />}
        />
      </Screen>
    );
  return <Voting detail={d} back={back} />;
}

/** Emoji button size that fits 3 per row in a card (DESIGN §9.4: 48, down to 40 with hitSlop). */
function useGrid() {
  const { width } = useWindowDimensions();
  const content = Math.min(width, layout.contentMaxWidth + 2 * layout.screenPadding) - 2 * layout.screenPadding;
  const columns = width >= 360 ? 2 : 1;
  const card = columns === 2 ? (content - space[3]) / 2 : content;
  const inner = card - 2 * space[3] - 4;
  const size = Math.floor(Math.max(EMOJI_BUTTON_MIN, Math.min(layout.minTouch, (inner - 2 * EMOJI_GRID_GAP) / 3)));
  return { columns, size };
}

const pairKey = (targetId: string, emojiId: string) => `${targetId}|${emojiId}`;

function Voting({ detail, back }: { detail: EventDetail; back: React.ReactNode }) {
  const host = useModuleHost();
  const client = useEventosClient();
  const toast = useToast();
  const grid = useGrid();
  const communityId = host.community.id;
  const { event, emojis } = detail;
  const scale = event.votingType === 'scale';

  // Nobody votes on themselves: their own card is left out (R-ANON-09).
  const targets = useMemo(() => detail.participants.filter((p) => p.userId !== detail.viewerId), [detail]);

  /** Categorical: targetId → emojiId. Scale: "targetId|emojiId" → value. */
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [token, setToken] = useState<StoredToken | null>(null);
  const [locked, setLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('alpha');
  const [unvotedSnapshot, setUnvotedSnapshot] = useState<Record<string, boolean>>({});
  const [showCode, setShowCode] = useState(false);

  // With a token on this device: my votes in this event, read back by the code only this device knows.
  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await loadToken(host, communityId, event.id);
      const mine = stored ? await fetchMyVotes(host, communityId, event.id, stored).catch(() => []) : [];
      if (!active) return;
      setToken(stored);
      setChoice(Object.fromEntries(mine.filter((v) => v.value === null).map((v) => [v.targetId, v.emojiId])));
      setRatings(
        Object.fromEntries(
          mine.flatMap((v) => (v.value === null ? [] : [[pairKey(v.targetId, v.emojiId), v.value] as const])),
        ),
      );
      setPhase('ready');
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per event
  }, [communityId, event.id]);

  const votedFor = (targetId: string) =>
    scale ? emojis.some((e) => ratings[pairKey(targetId, e.id)] !== undefined) : choice[targetId] !== undefined;

  const sorted = useMemo(() => {
    const byName = [...targets].sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    if (sort === 'alpha') return byName;
    // Frozen when "Não votados" is chosen, so a card doesn't jump away right after it gets a vote.
    return byName.sort(
      (a, b) => Number(unvotedSnapshot[a.userId] ?? false) - Number(unvotedSnapshot[b.userId] ?? false),
    );
  }, [targets, sort, unvotedSnapshot]);

  const votedCount = targets.filter((t) => votedFor(t.userId)).length;
  const rows: EventVoteSubmission[] = scale
    ? Object.entries(ratings).map(([key, value]) => {
        const [targetId, emojiId] = key.split('|') as [string, string];
        return { targetId, emojiId, value };
      })
    : Object.entries(choice).map(([targetId, emojiId]) => ({ targetId, emojiId }));

  async function submit() {
    setError(null);
    setSending(true);
    try {
      const ensured = await ensureToken(host, client, communityId, event.id);
      if (!ensured.ok) {
        if (ensured.alreadyIssued) setLocked(true);
        setError(ensured.error);
        haptic.error();
        return;
      }
      const res = await submitBallot(host, communityId, event.id, ensured.token, rows);
      setToken(ensured.token);
      haptic.success();
      toast.show({
        title: res.status === 'updated' ? 'Votos atualizados!' : 'Votos registrados!',
        description: 'Agora é esperar o resultado.',
      });
      AccessibilityInfo.announceForAccessibility('Votos enviados');
    } catch (err) {
      haptic.error();
      if (err instanceof EventosError && err.code === 'EVENT_NOT_OPEN')
        setError('A votação desse evento fechou enquanto você votava.');
      else setError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  const hint =
    phase === 'loading' || locked
      ? undefined
      : rows.length === 0
        ? token
          ? 'Escolha de novo para substituir seus votos neste evento.'
          : scale
            ? 'Dê pelo menos uma nota para continuar.'
            : 'Escolha pelo menos um emoji para continuar.'
        : `${votedCount} de ${targets.length} ${targets.length === 1 ? 'pessoa votada' : 'pessoas votadas'}`;

  const header = (
    <View style={styles.header}>
      {back}
      <ScreenHeader overline="Evento" title={event.title} description={INTRO[event.votingType]} />
      {event.scheduledReleaseAt ? (
        <Banner
          tone="event"
          {...(event.bannerRgb ? { eventRgb: event.bannerRgb } : {})}
          icon="🕒"
          title={`Fecha em ${formatDateTime(event.scheduledReleaseAt)}.`}
        />
      ) : null}
      <Legend emojis={emojis} scale={scale} />
      {locked ? null : token ? (
        <Banner
          tone="warning"
          title="Você já votou neste evento."
          description="Seus votos atuais já estão marcados. Mude o que quiser e atualize."
        />
      ) : null}
      {error ? <Banner tone="error" title={error} /> : null}
      <View style={styles.sortRow}>
        <Text variant="overline" tone="muted">
          Votação
        </Text>
        <SegmentedControl
          label="Ordenar lista de votação"
          options={SORT_OPTIONS}
          value={sort}
          onChange={(mode) => {
            if (mode === 'unvoted')
              setUnvotedSnapshot(Object.fromEntries(targets.map((t) => [t.userId, votedFor(t.userId)])));
            setSort(mode);
          }}
        />
      </View>
    </View>
  );

  const columns = scale ? 1 : grid.columns;
  return (
    <ListScreen<Target>
      header={header}
      data={sorted}
      numColumns={columns}
      keyExtractor={(t) => t.userId}
      renderItem={({ item }) => (
        <View style={columns === 2 ? styles.half : styles.full}>
          <VoteTargetCard
            name={item.displayName}
            avatarVariant={item.avatarVariant as AvatarVariant}
            voted={votedFor(item.userId)}
          >
            {scale ? (
              <View style={styles.axes}>
                {emojis.map((e) => (
                  <View key={e.id} style={styles.axis}>
                    <Text variant="caption" tone="muted">
                      {`${e.label} · até ${e.scaleMax ?? 1}`}
                    </Text>
                    <IntensityPicker
                      emoji={e.char}
                      label={e.label}
                      max={e.scaleMax ?? 1}
                      target={item.displayName}
                      value={ratings[pairKey(item.userId, e.id)]}
                      onChange={(value) =>
                        setRatings((r) => {
                          const next = { ...r };
                          if (value === undefined) delete next[pairKey(item.userId, e.id)];
                          else next[pairKey(item.userId, e.id)] = value;
                          return next;
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : (
              <EmojiGrid buttonSize={grid.size}>
                {emojis.map((e) => (
                  <EmojiButton
                    key={e.id}
                    size={grid.size}
                    emoji={e.char}
                    label={`${e.label}${e.description ? `: ${e.description}` : ''}, para ${item.displayName}`}
                    selected={choice[item.userId] === e.id}
                    onPress={() =>
                      setChoice((v) => {
                        const next = { ...v };
                        if (next[item.userId] === e.id) delete next[item.userId];
                        else next[item.userId] = e.id;
                        return next;
                      })
                    }
                  />
                ))}
              </EmojiGrid>
            )}
          </VoteTargetCard>
        </View>
      )}
      empty={
        <EmptyState emoji="🫥" message="Ainda não tem mais ninguém nesse evento. Chame a galera pra participar." />
      }
      listFooter={
        phase === 'ready' ? (
          <View style={styles.code}>
            <Button
              variant="ghost"
              label={showCode ? 'Esconder código do voto' : 'Problemas com seu voto?'}
              onPress={() => setShowCode((s) => !s)}
            />
            {showCode ? (
              token ? (
                <View style={styles.codeBox}>
                  <Text variant="caption" tone="muted">
                    Este é o código do seu voto. Só você tem ele, e ele fica só neste aparelho.
                  </Text>
                  <CopyableCode code={token.voterTag} />
                </View>
              ) : (
                <Text variant="caption" tone="muted">
                  Você ainda não tem um voto registrado neste aparelho neste evento.
                </Text>
              )
            ) : null}
          </View>
        ) : undefined
      }
      footer={
        <StickyActionBar
          label={token ? 'Atualizar votos' : 'Enviar votos'}
          loading={sending}
          loadingLabel="Enviando…"
          disabled={phase === 'loading' || rows.length === 0 || locked}
          disabledReason={locked ? 'Cada pessoa vota uma vez por evento.' : null}
          onPress={() => void submit()}
          {...(hint ? { hint } : {})}
        />
      }
    />
  );
}

/** "O que significa cada emoji?". */
function Legend({ emojis, scale }: { emojis: EventEmoji[]; scale: boolean }) {
  return (
    <Accordion title={scale ? 'O que significa cada eixo?' : 'O que significa cada emoji?'} icon="📖">
      <View style={styles.legend}>
        {emojis.map((e) => (
          <Text key={e.id} tone="secondary">
            {`${e.char}  `}
            <Text style={styles.bold}>{e.label}</Text>
            {e.description ? `: ${e.description}` : ''}
            {scale && e.scaleMax !== null ? ` (de 1 a ${e.scaleMax})` : ''}
          </Text>
        ))}
      </View>
    </Accordion>
  );
}

const styles = StyleSheet.create({
  loading: { gap: space[3], marginTop: space[6] },
  header: { gap: space[4], marginBottom: space[3] },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    marginTop: space[2],
  },
  half: { flex: 1, maxWidth: '50%' },
  full: { flex: 1 },
  axes: { gap: space[3], alignSelf: 'stretch' },
  axis: { gap: space[1] },
  legend: { gap: space[2] },
  bold: { fontWeight: '500' },
  code: { alignItems: 'center', gap: space[2], marginTop: space[6] },
  codeBox: { alignSelf: 'stretch', gap: space[2] },
});
