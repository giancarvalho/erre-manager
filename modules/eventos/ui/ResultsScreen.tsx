// Result of an event (EVT-10): trophies, the ranking (one per axis on a scale event) and sharing. Ported in
// behavior from queridometro@7c5c5bf:src/app/group/[id]/events/[eventId]/results/page.tsx and
// src/components/group/events/{EventResultsTrophyList,EventResultsRanking,EventResultsShareButton}.tsx.
import { useModuleHost } from '@erre/core/client';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  RankingRow,
  Screen,
  ScreenHeader,
  Skeleton,
  space,
  Text,
  TrophyMedallion,
  useToast,
  type AvatarVariant,
} from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import {
  categoricalRanking,
  scaleAxes,
  shareOptions,
  trophyViews,
  type EmojiInfo,
  type TrophyView,
} from '../domain/presentation';
import { buildEventShareMessage } from '../domain/share-message';
import { useEvent, useEventResults, type EventDetail, type EventResults } from './data';
import { formatDateTime, formatLongDate } from './format';
import { shareText } from './share';

export function ResultsScreen({ id }: { id: string }) {
  const host = useModuleHost();
  const event = useEvent(id);
  const back = <Button label="← Eventos" variant="ghost" onPress={() => host.navigate('/eventos')} />;
  if (event.isPending)
    return (
      <Screen>
        {back}
        <View style={styles.list} accessibilityLabel="Carregando os resultados" accessible>
          <Skeleton height={96} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      </Screen>
    );
  if (event.isError) return <ErrorState message={event.error.message} onRetry={() => void event.refetch()} />;
  if (event.data.event.status !== 'closed') return <NotYet detail={event.data} back={back} />;
  return <Closed id={id} back={back} />;
}

/** Before closing: why there is nothing yet and where to go (legacy messages). */
function NotYet({ detail, back }: { detail: EventDetail; back: React.ReactNode }) {
  const host = useModuleHost();
  const e = detail.event;
  const message =
    e.status === 'accepting_applications'
      ? 'Esse evento está aceitando inscrições: a votação ainda não começou.'
      : e.status === 'open'
        ? e.scheduledReleaseAt
          ? `Esse evento ainda está em votação. O resultado sai em ${formatDateTime(e.scheduledReleaseAt)}.`
          : 'Esse evento ainda está em votação. Quem administra libera o resultado quando quiser.'
        : 'Esse evento ainda não abriu para votos.';
  return (
    <Screen>
      {back}
      <ScreenHeader overline="Resultados" title={e.title} />
      <Banner
        tone="info"
        title={message}
        {...(e.status === 'open' && detail.participating
          ? {
              action: (
                <Button variant="secondary" label="Ir votar" onPress={() => host.navigate(`/eventos/${e.id}/votar`)} />
              ),
            }
          : {})}
      />
    </Screen>
  );
}

function Closed({ id, back }: { id: string; back: React.ReactNode }) {
  const results = useEventResults(id);
  if (results.isPending)
    return (
      <Screen>
        {back}
        <Skeleton height={96} />
      </Screen>
    );
  if (results.isError) return <ErrorState message={results.error.message} onRetry={() => void results.refetch()} />;
  const r = results.data;
  const roster: EmojiInfo[] = r.emojis;
  const emojis = new Map(roster.map((e) => [e.id, e]));
  const trophies = trophyViews(r.result, emojis, r.people);
  const empty = r.result.targets.length === 0;
  return (
    <Screen>
      {back}
      <ScreenHeader
        overline="Resultados"
        title={r.event.title}
        description={`Encerrado em ${formatDateTime(r.releasedAt)}.`}
      />
      <View style={styles.list}>
        {empty ? (
          <EmptyState emoji="🫥" message="Ninguém votou nesse evento." />
        ) : (
          <>
            <Trophies trophies={trophies} />
            <Ranking results={r} roster={roster} emojis={emojis} trophies={trophies} />
            <ShareButton results={r} roster={roster} />
          </>
        )}
      </View>
    </Screen>
  );
}

function Trophies({ trophies }: { trophies: TrophyView[] }) {
  if (trophies.length === 0)
    return <Text tone="muted">Ninguém levou troféu: é preciso pelo menos 3 votos, e empate não conta.</Text>;
  return (
    <View style={styles.section}>
      <Text variant="titleMd" accessibilityRole="header">
        Troféus deste evento
      </Text>
      <View style={styles.medals}>
        {trophies.map((t) => {
          const who = t.winner
            ? t.winner.person.displayName
            : `Empate: ${t.tied.map((p) => p.displayName).join(' e ')}`;
          return (
            <View key={t.emoji.id} style={styles.medal}>
              <TrophyMedallion
                emoji={t.emoji.char}
                tone={t.winner ? 'gold' : 'silver'}
                size={64}
                label={`${t.emoji.trophyName}: ${who}, ${t.magnitude}`}
              />
              <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.center}>
                {t.emoji.trophyName}
              </Text>
              <Text variant="label" numberOfLines={2} style={styles.center}>
                {who}
              </Text>
              <Text variant="caption" tone="muted">
                {t.magnitude}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Ranking({
  results,
  roster,
  emojis,
  trophies,
}: {
  results: EventResults;
  roster: EmojiInfo[];
  emojis: Map<string, EmojiInfo>;
  trophies: TrophyView[];
}) {
  const won = (targetId: string, emojiId?: string) =>
    trophies
      .filter((t) => t.winner?.targetId === targetId && (emojiId === undefined || t.emoji.id === emojiId))
      .map((t) => ({ emoji: t.emoji.char, name: t.emoji.trophyName, tone: 'gold' as const }));
  if (results.result.votingType === 'scale')
    return (
      <>
        {scaleAxes(results.result, roster, results.people).map((axis) => (
          <View key={axis.emoji.id} style={styles.section}>
            <Text variant="titleMd" accessibilityRole="header">
              {`${axis.emoji.char} ${axis.emoji.label}`}
            </Text>
            {axis.rows.map((row, i) => (
              <RankingRow
                key={row.targetId}
                index={i}
                position={i + 1}
                name={row.person.displayName}
                variant={row.person.avatarVariant as AvatarVariant}
                total={row.voteCount}
                valueLabel={row.label}
                chips={[]}
                trophy={won(row.targetId, axis.emoji.id).length > 0}
                trophies={won(row.targetId, axis.emoji.id)}
              />
            ))}
          </View>
        ))}
      </>
    );
  return (
    <View style={styles.section}>
      <Text variant="titleMd" accessibilityRole="header">
        Ranking
      </Text>
      {categoricalRanking(results.result, emojis, results.people).map((row, i) => (
        <RankingRow
          key={row.targetId}
          index={i}
          position={i + 1}
          name={row.person.displayName}
          variant={row.person.avatarVariant as AvatarVariant}
          total={row.total}
          chips={row.byEmoji.map((e) => ({
            emoji: e.char,
            count: e.count,
            label: emojis.get(e.emojiId)?.label ?? e.emojiId,
          }))}
          trophy={won(row.targetId).length > 0}
          trophies={won(row.targetId)}
        />
      ))}
    </View>
  );
}

/** "Compartilhar resultado": trophies, ranking and the link, in the legacy format. */
function ShareButton({ results, roster }: { results: EventResults; roster: EmojiInfo[] }) {
  const host = useModuleHost();
  const toast = useToast();
  async function share() {
    const message = buildEventShareMessage(
      shareOptions({
        title: results.event.title,
        closedAtLabel: formatLongDate(results.releasedAt),
        resultsUrl: `${host.webUrl}/eventos/${results.event.id}/resultados?comunidade=${host.community.id}`,
        result: results.result,
        roster,
        people: results.people,
      }),
    );
    try {
      if ((await shareText(message)) === 'copied')
        toast.show({ title: 'Resultado copiado.', description: 'Cola no grupo do WhatsApp.' });
    } catch {
      toast.show({ title: 'Não deu pra compartilhar.', tone: 'error' });
    }
  }
  return <Button variant="secondary" label="Compartilhar resultado" onPress={() => void share()} />;
}

const styles = StyleSheet.create({
  list: { gap: space[6], marginTop: space[4] },
  section: { gap: space[3] },
  medals: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  medal: { width: 96, alignItems: 'center', gap: space[1] },
  center: { textAlign: 'center' },
});
