// Voting screen (DESIGN §9.3, §9.4, §9.7–9.9, §10.1). Ported in behavior from queridometro@7c5c5bf:
// src/app/group/[id]/vote/page.tsx, src/components/voting/{QuickFireGrid,EmojiSelector,EmojiLegend,
// AnonymousSubmitVotesBar}.tsx.
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
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';

import { filterVotesToCurrentMembers, filterVotesToKnownEmojis } from '../domain/filter-existing-votes';
import {
  ensureToken,
  fetchMyVotes,
  loadRememberedVotes,
  loadToken,
  rememberVotes,
  submitBallot,
  type StoredToken,
  type VoteMap,
} from './anon';
import {
  ErrometroError,
  roundKey,
  useErrometroClient,
  useRound,
  type EmojiOption,
  type Round,
  type Target,
} from './data';
import { ParticipationPanel } from './Participation';

type SortMode = 'alpha' | 'unvoted';
const SORT_OPTIONS = [
  { value: 'alpha', label: 'Alfabética' },
  { value: 'unvoted', label: 'Não votados' },
] as const;

const INTRO = 'Toque em um emoji para cada pessoa. Você pode mudar seus votos a qualquer momento antes do resultado.';

export function VoteScreen() {
  const round = useRound();
  const { community } = useModuleHost();
  if (round.isPending)
    return (
      <Screen>
        <ScreenHeader overline="Errômetro" title={community.name} description={INTRO} />
        <View style={styles.loading} accessibilityLabel="Carregando a votação" accessible>
          <Skeleton height={64} />
          <Skeleton height={220} />
          <Skeleton height={220} />
        </View>
      </Screen>
    );
  if (round.isError) return <ErrorState message={round.error.message} onRetry={() => void round.refetch()} />;
  if (round.data.participation.status !== 'approved')
    return (
      <Screen>
        <ScreenHeader overline="Errômetro" title={community.name} />
        <ParticipationPanel participation={round.data.participation} />
      </Screen>
    );
  return <Voting round={round.data} />;
}

/** Emoji button size that fits 3 per row in a card (DESIGN §9.4: 48, down to 40 with hitSlop in a dense grid). */
function useLayout() {
  const { width } = useWindowDimensions();
  const content = Math.min(width, layout.contentMaxWidth + 2 * layout.screenPadding) - 2 * layout.screenPadding;
  const columns = width >= 360 ? 2 : 1;
  const card = columns === 2 ? (content - space[3]) / 2 : content;
  const inner = card - 2 * space[3] - 4;
  const size = Math.floor(Math.max(EMOJI_BUTTON_MIN, Math.min(layout.minTouch, (inner - 2 * EMOJI_GRID_GAP) / 3)));
  return { columns, size };
}

function Voting({ round }: { round: Round }) {
  const host = useModuleHost();
  const client = useErrometroClient();
  const qc = useQueryClient();
  const toast = useToast();
  const { columns, size } = useLayout();
  const communityId = host.community.id;
  const period = round.period.label;

  // Nobody votes on themselves: their own card is left out (R-ANON-09).
  const targets = useMemo(() => round.targets.filter((t) => t.userId !== round.viewerId), [round]);
  const emojiIds = useMemo(() => round.emojis.map((e) => e.id), [round.emojis]);

  const [votes, setVotes] = useState<VoteMap>({});
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [token, setToken] = useState<StoredToken | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('alpha');
  const [unvotedSnapshot, setUnvotedSnapshot] = useState<Record<string, boolean>>({});
  const [showCode, setShowCode] = useState(false);

  // With a token on this device: my votes of this round. Without: what I sent last round, still valid.
  useEffect(() => {
    let active = true;
    void (async () => {
      setPhase('loading');
      const stored = await loadToken(host, communityId, period);
      let initial: VoteMap = {};
      if (stored) {
        initial = await fetchMyVotes(host, communityId, stored).catch(() => ({}));
      } else {
        initial = filterVotesToKnownEmojis(
          filterVotesToCurrentMembers(
            await loadRememberedVotes(host, communityId),
            targets.map((t) => ({ id: t.userId })),
          ),
          emojiIds,
        );
      }
      if (!active) return;
      setToken(stored);
      setVotes(initial);
      setPrefilled(!stored && Object.keys(initial).length > 0);
      setPhase('ready');
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the round changes
  }, [communityId, period]);

  const sorted = useMemo(() => {
    const byName = [...targets].sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    if (sort === 'alpha') return byName;
    // Frozen when "Não votados" is chosen, so a card doesn't jump away right after it gets a vote.
    return byName.sort(
      (a, b) => Number(unvotedSnapshot[a.userId] ?? false) - Number(unvotedSnapshot[b.userId] ?? false),
    );
  }, [targets, sort, unvotedSnapshot]);

  const count = Object.keys(votes).length;
  const toggle = (targetId: string, emojiId: string) =>
    setVotes((v) => {
      const next = { ...v };
      if (next[targetId] === emojiId) delete next[targetId];
      else next[targetId] = emojiId;
      return next;
    });

  async function submit() {
    setError(null);
    setSending(true);
    try {
      const ensured = await ensureToken(host, client, communityId, period);
      if (!ensured.ok) {
        if (ensured.alreadyIssued) setLocked(true);
        setError(ensured.error);
        haptic.error();
        return;
      }
      const res = await submitBallot(host, communityId, ensured.token, votes);
      await rememberVotes(host, communityId, votes);
      setToken(ensured.token);
      setPrefilled(false);
      haptic.success();
      toast.show({
        title: 'Votos enviados.',
        description: res.status === 'updated' ? 'Seus votos foram atualizados.' : 'Agora é esperar o resultado.',
      });
      AccessibilityInfo.announceForAccessibility('Votos enviados');
    } catch (err) {
      haptic.error();
      if (err instanceof ErrometroError && err.code === 'INVALID_TOKEN') {
        setError('A rodada mudou enquanto você votava. A tela foi atualizada: confira e envie de novo.');
        void qc.invalidateQueries({ queryKey: roundKey(communityId) });
      } else setError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  const hint =
    phase === 'loading'
      ? undefined
      : locked
        ? undefined
        : count === 0
          ? token
            ? 'Escolha novos emojis para substituir seus votos desta rodada.'
            : 'Escolha pelo menos um emoji para continuar.'
          : `${count} de ${targets.length} ${targets.length === 1 ? 'pessoa votada' : 'pessoas votadas'}`;

  const header = (
    <View style={styles.header}>
      <ScreenHeader overline="Errômetro" title={host.community.name} description={INTRO} />
      <Banner
        tone="highlight"
        icon="🕒"
        title={round.cadence.description}
        description={
          round.cadence.nextRelease
            ? `Próximo resultado: ${round.cadence.nextRelease.label}.`
            : 'Sem data marcada: quem administra libera o resultado.'
        }
      />
      <Legend emojis={round.emojis} />
      {locked ? null : token ? (
        <Banner
          tone="warning"
          title="Você já votou nesta rodada."
          description="Seus votos atuais já estão marcados. Toque em outro emoji para trocar."
        />
      ) : prefilled ? (
        <Banner
          tone="info"
          title="Pré-preenchido com seus votos da rodada passada."
          description="Confira e envie, ou mude o que quiser antes."
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
              setUnvotedSnapshot(Object.fromEntries(targets.map((t) => [t.userId, Boolean(votes[t.userId])])));
            setSort(mode);
          }}
        />
      </View>
    </View>
  );

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
            voted={Boolean(votes[item.userId])}
          >
            <EmojiGrid buttonSize={size}>
              {round.emojis.map((e) => (
                <EmojiButton
                  key={e.id}
                  size={size}
                  emoji={e.char}
                  label={`${e.label}${e.description ? `: ${e.description}` : ''}, para ${item.displayName}`}
                  selected={votes[item.userId] === e.id}
                  onPress={() => toggle(item.userId, e.id)}
                />
              ))}
            </EmojiGrid>
          </VoteTargetCard>
        </View>
      )}
      empty={
        <EmptyState emoji="🫥" message="Ainda não tem mais ninguém votando aqui. Chame a galera pra participar." />
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
                    Este é o código do seu voto. Só você tem ele. Se precisar anular seu voto, mande pra quem administra
                    a comunidade.
                  </Text>
                  <CopyableCode code={token.voterTag} />
                </View>
              ) : (
                <Text variant="caption" tone="muted">
                  Você ainda não tem um voto registrado neste aparelho nesta rodada.
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
          disabled={phase === 'loading' || count === 0 || locked}
          disabledReason={locked ? 'Cada pessoa vota uma vez por rodada.' : null}
          onPress={() => void submit()}
          {...(hint ? { hint } : {})}
        />
      }
    />
  );
}

/** "O que significa cada emoji?" (legacy EmojiLegend). */
function Legend({ emojis }: { emojis: EmojiOption[] }) {
  return (
    <Accordion title="O que significa cada emoji?" icon="📖">
      <View style={styles.legend}>
        {emojis.map((e) => (
          <Text key={e.id} tone="secondary">
            {`${e.char}  `}
            <Text style={styles.bold}>{e.label}</Text>
            {e.description ? `: ${e.description}` : ''}
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
  legend: { gap: space[2] },
  bold: { fontWeight: '500' },
  code: { alignItems: 'center', gap: space[2], marginTop: space[6] },
  codeBox: { alignSelf: 'stretch', gap: space[2] },
});
