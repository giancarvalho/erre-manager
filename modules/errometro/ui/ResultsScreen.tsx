// Results of the closed rounds (R-RES-06, R-RES-07). Ported in behavior from queridometro@7c5c5bf:
// src/app/results/page.tsx (real-group branch) and src/components/results/*.
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
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { buildShareMessage } from '../domain/share-message';
import { CommentThread } from './CommentThread';
import { useResults, useRound, type Results } from './data';

/** "2 de novembro de 2026" for a round label (the day the round closes). */
export function roundDate(period: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${period}T12:00:00.000Z`),
  );
}

export function ResultsScreen({ initialPeriod }: { initialPeriod?: string | undefined }) {
  const host = useModuleHost();
  const [period, setPeriod] = useState<string | undefined>(initialPeriod);
  const results = useResults(period);
  const round = useRound();
  const header = (
    <>
      <Button label="← Início" variant="ghost" onPress={host.back} />
      <ScreenHeader overline={host.community.name} title="Resultados" />
    </>
  );

  if (results.isPending || round.isPending)
    return (
      <Screen>
        {header}
        <View style={styles.list} accessibilityLabel="Carregando os resultados" accessible>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </View>
      </Screen>
    );
  if (results.isError) return <ErrorState message={results.error.message} onRetry={() => void results.refetch()} />;
  if (round.isError) return <ErrorState message={round.error.message} onRetry={() => void round.refetch()} />;

  const r = results.data;
  const canModerate = round.data.canModerate;
  const next = round.data.cadence.nextRelease;

  if (!r.period)
    return (
      <Screen>
        {header}
        <View style={styles.list}>
          {canModerate && (r.hiddenCount ?? 0) > 0 ? (
            <Banner
              tone="info"
              title="Todas as rodadas fechadas estão escondidas."
              description="Só quem administra sabe disso: pra quem participa, a tela é igual à de quem nunca teve resultado."
              action={
                <Button
                  variant="secondary"
                  label="Reexibir na administração"
                  onPress={() => host.navigate('/errometro/admin')}
                />
              }
            />
          ) : null}
          <EmptyState
            emoji="📊"
            message={
              next
                ? `Nenhum resultado disponível ainda. O próximo sai ${next.label}.`
                : 'Nenhum resultado disponível ainda. Quem administra libera quando quiser.'
            }
          />
        </View>
      </Screen>
    );

  return (
    <Screen>
      {header}
      <View style={styles.list}>
        <DayNav results={r} onChange={setPeriod} />
        <RoundTrophies results={r} />
        {r.ranking.every((e) => e.total === 0) ? (
          <Text tone="muted" style={styles.center}>
            Nenhum voto registrado nesta rodada.
          </Text>
        ) : null}
        {r.ranking.map((entry, i) => (
          <View key={entry.member.userId} style={styles.entry}>
            <RankingRow
              index={i}
              position={i + 1}
              name={entry.member.displayName}
              variant={entry.member.avatarVariant as AvatarVariant}
              total={entry.total}
              trophy={entry.trophies.wins.length > 0}
              chips={entry.byEmoji.map((e) => ({ emoji: e.char, count: e.count, label: e.emojiId }))}
              trophies={[
                ...entry.trophies.wins.map((w) => trophyChip(r, w.emojiId, 'gold')),
                ...entry.trophies.nearMisses.map((n) => trophyChip(r, n.emojiId, 'silver')),
              ]}
            />
            <CommentThread
              targetId={entry.member.userId}
              targetName={entry.member.displayName}
              period={r.period!}
              count={r.commentCounts[entry.member.userId] ?? 0}
              viewerId={round.data.viewerId}
              canModerate={canModerate}
            />
          </View>
        ))}
        <ShareButton results={r} />
        {next ? (
          <Text variant="caption" tone="muted" style={styles.center}>
            {`Próximo resultado: ${next.label}.`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function trophyChip(r: Results, emojiId: string, tone: 'gold' | 'silver') {
  const t = r.trophies.find((x) => x.emojiId === emojiId);
  return { emoji: t?.char ?? '🏆', name: t?.trophyName ?? 'Troféu', tone };
}

/** Previous / next closed round (legacy ResultsDayNav). Days come newest first. */
function DayNav({ results, onChange }: { results: Results; onChange: (p: string) => void }) {
  const i = results.days.indexOf(results.period!);
  const older = results.days[i + 1];
  const newer = results.days[i - 1];
  return (
    <View style={styles.nav}>
      <Button
        variant="ghost"
        label="‹ Anterior"
        disabled={!older}
        onPress={() => older && onChange(older)}
        accessibilityHint="Rodada anterior"
      />
      <Text variant="label" style={styles.navLabel} accessibilityRole="header">
        {`Rodada de ${roundDate(results.period!)}`}
      </Text>
      <Button
        variant="ghost"
        label="Próxima ›"
        disabled={!newer}
        onPress={() => newer && onChange(newer)}
        accessibilityHint="Rodada seguinte"
      />
    </View>
  );
}

/** Trophy medals of the round (DESIGN §9.14): gold for each winner. */
function RoundTrophies({ results }: { results: Results }) {
  const winners = results.trophies.filter((t) => t.winnerTargetId);
  if (winners.length === 0) return null;
  const nameOf = (id: string) => results.ranking.find((e) => e.member.userId === id)?.member.displayName ?? '';
  return (
    <View style={styles.trophies}>
      <Text variant="overline" tone="muted">
        Troféus da rodada
      </Text>
      <View style={styles.medals}>
        {winners.map((t) => (
          <View key={t.emojiId} style={styles.medal}>
            <TrophyMedallion emoji={t.char} label={`${t.trophyName}: ${nameOf(t.winnerTargetId!)}`} size={64} />
            <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.center}>
              {nameOf(t.winnerTargetId!)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Compartilhar resultado": native share sheet, or the clipboard on the web without share. */
function ShareButton({ results }: { results: Results }) {
  const host = useModuleHost();
  const toast = useToast();
  async function share() {
    const message = buildShareMessage({
      rows: results.ranking.map((e) => ({
        name: e.member.displayName,
        emojis: e.byEmoji.map((b) => ({ char: b.char, count: b.count })),
        trophies: e.trophies.wins.map((w) => {
          const t = results.trophies.find((x) => x.emojiId === w.emojiId);
          return { char: t?.char ?? '🏆', trophyName: t?.trophyName ?? 'Troféu' };
        }),
      })),
      viewingDay: results.period!,
      shareUrl: `${host.webUrl}/errometro/resultados?comunidade=${host.community.id}`,
    });
    try {
      const nav = globalThis.navigator as (Navigator & { share?: unknown }) | undefined;
      if (Platform.OS !== 'web' || typeof nav?.share === 'function') await Share.share({ message });
      else {
        await Clipboard.setStringAsync(message);
        toast.show({ title: 'Resultado copiado.', description: 'Cola no grupo do WhatsApp.' });
      }
    } catch {
      toast.show({ title: 'Não deu pra compartilhar.', tone: 'error' });
    }
  }
  return <Button variant="secondary" label="Compartilhar resultado" onPress={() => void share()} />;
}

const styles = StyleSheet.create({
  list: { gap: space[3], marginTop: space[4] },
  entry: { gap: space[1] },
  center: { textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  navLabel: { flex: 1, textAlign: 'center' },
  trophies: { gap: space[3] },
  medals: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  medal: { width: 88, alignItems: 'center', gap: space[1] },
});
