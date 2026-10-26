// Errômetro administration (errometro.moderar). Ported in behavior from queridometro@7c5c5bf:
// src/app/group/[id]/settings/page.tsx and src/components/group/{ReleaseCadenceForm,EmojiRosterForm,
// ReleaseNowButton,RecomputeAnyDayForm,AnnulVoteForm}.tsx. Destructive actions ask first (DESIGN §10.3).
import { useModuleHost } from '@erre/core/client';
import { EMOJI_OPTIONS, inferEmojiGlowColor, isSingleGrapheme, MAX_ACTIVE_EMOJIS } from '@erre/emoji';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ChipToggle,
  ConfirmDialog,
  ErrorState,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  space,
  Stepper,
  Text,
  TextField,
  useToast,
  type AvatarVariant,
} from '@erre/ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_PARTICIPANTS } from '../domain/limits';
import {
  useCadence,
  useEmojiConfig,
  useModerateParticipant,
  useParticipants,
  useRound,
  useRoundActions,
  useRounds,
  useSaveCadence,
  useSaveEmojis,
  type EmojiConfig,
} from './data';
import { roundDate } from './ResultsScreen';

export function AdminScreen() {
  const host = useModuleHost();
  const round = useRound();
  const back = <Button label="← Início" variant="ghost" onPress={host.back} />;
  const header = <ScreenHeader overline={host.community.name} title="Administrar Errômetro" />;
  if (round.isPending)
    return (
      <Screen>
        {back}
        {header}
        <Skeleton height={120} />
      </Screen>
    );
  if (round.isError) return <ErrorState message={round.error.message} onRetry={() => void round.refetch()} />;
  if (!round.data.canModerate)
    return (
      <Screen>
        {back}
        {header}
        <Banner tone="info" title="Só quem administra a comunidade mexe no Errômetro." />
      </Screen>
    );
  return (
    <Screen>
      {back}
      {header}
      <View style={styles.sections}>
        <Participants />
        <Rounds />
        <Annul />
        <Cadence />
        <Emojis />
      </View>
    </Screen>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleMd" accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text tone="muted">{description}</Text> : null}
      {children}
    </View>
  );
}

// ---- voters (ERR-02) ----

function Participants() {
  const list = useParticipants();
  const moderate = useModerateParticipant();
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (list.isPending) return <Skeleton height={96} />;
  if (list.isError) return <Banner tone="error" title={list.error.message} />;
  const rows = list.data.filter((p) => p.status === 'pending' || p.status === 'approved');
  const approved = rows.filter((p) => p.status === 'approved').length;
  const act = (userId: string, acao: 'aprovar' | 'rejeitar' | 'remover') => {
    setError(null);
    moderate.mutate({ userId, acao }, { onError: (e) => setError(e.message), onSettled: () => setRemoving(null) });
  };
  return (
    <Section title="Votantes" description={`${approved} de ${MAX_PARTICIPANTS} votantes.`}>
      {error ? <Banner tone="error" title={error} /> : null}
      {rows.length === 0 ? <Text tone="muted">Ninguém pediu pra votar ainda.</Text> : null}
      {rows.map((p) => (
        <Card key={p.userId}>
          <View style={styles.row}>
            <Avatar name={p.displayName} variant={p.avatarVariant as AvatarVariant} size={32} />
            <Text style={styles.flex} numberOfLines={1}>
              {p.displayName}
            </Text>
            {p.status === 'pending' ? <Badge label="Pedido" tone="warning" /> : null}
          </View>
          <View style={styles.actions}>
            {p.status === 'pending' ? (
              <>
                <Button
                  variant="secondary"
                  label={`Aprovar ${p.displayName}`}
                  onPress={() => act(p.userId, 'aprovar')}
                />
                <Button variant="ghost" label="Recusar" onPress={() => act(p.userId, 'rejeitar')} />
              </>
            ) : (
              <Button
                variant="destructive"
                label="Remover da votação"
                onPress={() => setRemoving({ userId: p.userId, name: p.displayName })}
              />
            )}
          </View>
        </Card>
      ))}
      <ConfirmDialog
        visible={removing !== null}
        title="Remover da votação?"
        message="A pessoa continua na comunidade, mas deixa de votar e de aparecer na votação. Ela pode pedir de novo."
        confirmLabel={`Remover ${removing?.name ?? ''}`}
        loadingLabel="Removendo…"
        loading={moderate.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && act(removing.userId, 'remover')}
      />
    </Section>
  );
}

// ---- rounds: release now, recompute, hide (ERR-15, ERR-16, ERR-17) ----

function Rounds() {
  const rounds = useRounds();
  const actions = useRoundActions();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'release' | { hide: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => {
    if (!rounds.data) return [];
    const byPeriod = new Map<string, { period: string; hidden?: boolean; voteCount?: number; voterCount?: number }>();
    for (const c of rounds.data.closed) byPeriod.set(c.period, { period: c.period, hidden: c.hidden });
    for (const v of rounds.data.withVotes)
      byPeriod.set(v.period, {
        ...byPeriod.get(v.period),
        period: v.period,
        voteCount: v.voteCount,
        voterCount: v.voterCount,
      });
    return [...byPeriod.values()].sort((a, b) => b.period.localeCompare(a.period));
  }, [rounds.data]);
  const fail = (e: Error) => setError(e.message);

  return (
    <Section title="Rodadas" description="Liberar agora fecha a rodada atual e publica o resultado na hora.">
      {error ? <Banner tone="error" title={error} /> : null}
      <Button variant="secondary" label="Liberar resultado agora" onPress={() => setConfirm('release')} />
      {rounds.isPending ? <Skeleton height={64} /> : null}
      {list.map((r) => (
        <Card key={r.period}>
          <View style={styles.row}>
            <Text style={styles.flex}>{`Rodada de ${roundDate(r.period)}`}</Text>
            {r.hidden ? (
              <Badge label="Escondida" />
            ) : r.hidden === undefined ? (
              <Badge label="Aberta" tone="accent" />
            ) : null}
          </View>
          <Text variant="caption" tone="muted">
            {r.voteCount
              ? `${r.voteCount} ${r.voteCount === 1 ? 'voto' : 'votos'} de ${r.voterCount} ${r.voterCount === 1 ? 'pessoa' : 'pessoas'}`
              : 'Sem votos'}
          </Text>
          <View style={styles.actions}>
            <Button
              variant="ghost"
              label="Recalcular"
              loading={actions.recompute.isPending && actions.recompute.variables === r.period}
              loadingLabel="Recalculando…"
              onPress={() =>
                actions.recompute.mutate(r.period, {
                  onSuccess: () => toast.show({ title: 'Resultado recalculado.' }),
                  onError: fail,
                })
              }
            />
            {r.hidden === undefined ? null : r.hidden ? (
              <Button
                variant="ghost"
                label="Reexibir"
                onPress={() => actions.hide.mutate({ period: r.period, hidden: false }, { onError: fail })}
              />
            ) : (
              <Button variant="ghost" label="Esconder" onPress={() => setConfirm({ hide: r.period })} />
            )}
          </View>
        </Card>
      ))}
      <ConfirmDialog
        visible={confirm === 'release'}
        title="Liberar o resultado agora?"
        message="Isso encerra a rodada agora: os votos já dados viram o resultado (publicado na hora), e quem ainda não votou perde a chance de votar nela. Uma rodada nova começa em seguida."
        confirmLabel="Liberar resultado"
        loadingLabel="Liberando…"
        loading={actions.releaseNow.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          actions.releaseNow.mutate(undefined, {
            onSuccess: () => toast.show({ title: 'Resultado liberado.', description: 'Uma rodada nova já começou.' }),
            onError: fail,
            onSettled: () => setConfirm(null),
          })
        }
      />
      <ConfirmDialog
        visible={typeof confirm === 'object' && confirm !== null}
        title="Esconder esta rodada?"
        message="Ela some dos resultados pra todo mundo, como se não tivesse existido. Você pode reexibir depois."
        confirmLabel="Esconder rodada"
        loadingLabel="Escondendo…"
        loading={actions.hide.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          typeof confirm === 'object' &&
          confirm !== null &&
          actions.hide.mutate(
            { period: confirm.hide, hidden: true },
            { onError: fail, onSettled: () => setConfirm(null) },
          )
        }
      />
    </Section>
  );
}

// ---- annul by code (ERR-18) ----

function Annul() {
  const { annul } = useRoundActions();
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const clean = code.trim().toLowerCase();
  const invalid = /^[0-9a-f]{64}$/.test(clean) ? null : 'O código tem 64 letras e números.';
  return (
    <Section
      title="Anular voto"
      description="Quando alguém tem problema com o voto, a pessoa pode te mandar o código dela. Anular apaga os votos desse código, e ela não vota de novo nesta rodada."
    >
      <TextField
        label="Código do voto"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        error={code.length > 0 ? invalid : null}
      />
      {message ? <Banner tone={message.tone} title={message.text} /> : null}
      <Button
        variant="destructive"
        label="Anular voto"
        disabled={invalid !== null}
        disabledReason={code.length === 0 ? 'Cole o código que a pessoa mandou.' : null}
        onPress={() => setConfirm(true)}
      />
      <ConfirmDialog
        visible={confirm}
        title="Anular este voto?"
        message="Os votos desse código são apagados e não voltam. A pessoa não recebe outro voto nesta rodada."
        confirmLabel="Anular voto"
        loadingLabel="Anulando…"
        loading={annul.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          annul.mutate(clean, {
            onSuccess: ({ deletedCount }) => {
              setMessage(
                deletedCount === 0
                  ? { tone: 'error', text: 'Nenhum voto encontrado com esse código.' }
                  : {
                      tone: 'info',
                      text: `${deletedCount} ${deletedCount === 1 ? 'voto anulado' : 'votos anulados'}.`,
                    },
              );
              if (deletedCount > 0) setCode('');
            },
            onError: (e) => setMessage({ tone: 'error', text: e.message }),
            onSettled: () => setConfirm(false),
          })
        }
      />
    </Section>
  );
}

// ---- cadence (ERR-11) ----

const WEEKDAYS = [
  { value: 1, short: 'Seg', full: 'Segunda-feira' },
  { value: 2, short: 'Ter', full: 'Terça-feira' },
  { value: 3, short: 'Qua', full: 'Quarta-feira' },
  { value: 4, short: 'Qui', full: 'Quinta-feira' },
  { value: 5, short: 'Sex', full: 'Sexta-feira' },
  { value: 6, short: 'Sáb', full: 'Sábado' },
  { value: 7, short: 'Dom', full: 'Domingo' },
] as const;

function Cadence() {
  const cadence = useCadence();
  const save = useSaveCadence();
  const toast = useToast();
  const [mode, setMode] = useState<'custom' | 'manual'>('custom');
  const [days, setDays] = useState<number[]>([1]);
  const [hour, setHour] = useState(12);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Starts from the saved cadence; legacy "daily"/"weekly" show as the equivalent set of days.
  useEffect(() => {
    const c = cadence.data?.config;
    if (!c) return;
    setHour(c.releaseHour);
    if (c.frequency === 'manual') setMode('manual');
    else {
      setMode('custom');
      setDays(
        c.frequency === 'custom'
          ? [...(c.releaseWeekdays ?? [1])]
          : c.frequency === 'weekly'
            ? [c.releaseWeekday ?? 1]
            : [1, 2, 3, 4, 5, 6, 7],
      );
    }
  }, [cadence.data]);

  if (cadence.isPending) return <Skeleton height={160} />;
  if (cadence.isError) return <Banner tone="error" title={cadence.error.message} />;

  const config =
    mode === 'manual'
      ? ({ frequency: 'manual', releaseHour: hour } as const)
      : ({ frequency: 'custom', releaseHour: hour, releaseWeekdays: [...days].sort((a, b) => a - b) } as const);

  function submit() {
    setError(null);
    save.mutate(config, {
      onSuccess: (r) =>
        toast.show({
          title: 'Cadência atualizada.',
          ...(r.roundClosedEarly
            ? { description: 'A rodada atual foi encerrada e o resultado até agora foi publicado.' }
            : {}),
        }),
      onError: (e) => setError(e.message),
      onSettled: () => setConfirm(false),
    });
  }

  return (
    <Section title="Quando o resultado sai" description={`Agora: ${cadence.data.description}.`}>
      <SegmentedControl
        label="Tipo de cadência"
        options={[
          { value: 'custom', label: 'Dias da semana' },
          { value: 'manual', label: 'Manual' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'custom' ? (
        <>
          <View style={styles.chips} accessibilityLabel="Dias">
            {WEEKDAYS.map((d) => (
              <ChipToggle
                key={d.value}
                label={d.short}
                accessibilityLabel={d.full}
                selected={days.includes(d.value)}
                onPress={() => setDays((v) => (v.includes(d.value) ? v.filter((x) => x !== d.value) : [...v, d.value]))}
              />
            ))}
          </View>
          <Stepper
            label="Hora"
            value={hour}
            min={0}
            max={23}
            format={(h) => `${String(h).padStart(2, '0')}:00`}
            onChange={setHour}
          />
        </>
      ) : (
        <Text tone="muted">Sem data marcada: você libera o resultado quando quiser.</Text>
      )}
      {error ? <Banner tone="error" title={error} /> : null}
      <Button
        variant="secondary"
        label="Salvar cadência"
        disabled={mode === 'custom' && days.length === 0}
        disabledReason={mode === 'custom' && days.length === 0 ? 'Marque pelo menos um dia.' : null}
        onPress={() => setConfirm(true)}
      />
      <ConfirmDialog
        visible={confirm}
        title="Trocar a cadência?"
        message="Se a cadência mudar, a rodada atual acaba na hora: os votos já dados viram o resultado dela (publicado antes do previsto), e quem ainda não votou perde a chance. Uma rodada nova começa já na cadência nova."
        confirmLabel="Salvar cadência"
        loadingLabel="Salvando…"
        loading={save.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </Section>
  );
}

// ---- emojis (ERR-12) ----

type Entry =
  | { isCustom: false; emojiId: string; char: string; label: string }
  | {
      isCustom: true;
      emojiId?: string;
      char: string;
      label: string;
      trophyName: string;
      description?: string;
      glowRgb?: string;
    };

function toEntries(config: EmojiConfig): Entry[] {
  return config.active.map((o) =>
    o.isCustom
      ? {
          isCustom: true,
          emojiId: o.id,
          char: o.char,
          label: o.label,
          trophyName: o.trophyName,
          ...(o.description ? { description: o.description } : {}),
          glowRgb: o.glowRgb,
        }
      : { isCustom: false, emojiId: o.id, char: o.char, label: o.label },
  );
}

function Emojis() {
  const config = useEmojiConfig();
  const save = useSaveEmojis();
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ char: '', label: '', trophyName: '', description: '' });
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (config.data) setEntries(toEntries(config.data));
  }, [config.data]);

  if (config.isPending) return <Skeleton height={200} />;
  if (config.isError) return <Banner tone="error" title={config.error.message} />;

  const activeIds = new Set(entries.map((e) => e.emojiId).filter(Boolean));
  const catalogToAdd = EMOJI_OPTIONS.filter((o) => !activeIds.has(o.id));
  const customToAdd = config.data.inactiveCustom.filter((o) => !activeIds.has(o.id));
  const full = entries.length >= MAX_ACTIVE_EMOJIS;

  const move = (i: number, d: number) =>
    setEntries((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(i + d, 0, item!);
      return next;
    });

  function addCustom() {
    const char = draft.char.trim();
    if (!isSingleGrapheme(char)) return setDraftError('O emoji precisa ser um único emoji (nada de texto colado).');
    if (!draft.label.trim() || draft.label.trim().length > 40)
      return setDraftError('Nome do emoji precisa ter entre 1 e 40 caracteres.');
    if (!draft.trophyName.trim() || draft.trophyName.trim().length > 60)
      return setDraftError('Nome do troféu precisa ter entre 1 e 60 caracteres.');
    setDraftError(null);
    // Glow color measured once on the web (canvas); native keeps the default (D-042).
    setEntries((list) => [
      ...list,
      {
        isCustom: true,
        char,
        label: draft.label.trim(),
        trophyName: draft.trophyName.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        glowRgb: inferEmojiGlowColor(char),
      },
    ]);
    setDraft({ char: '', label: '', trophyName: '', description: '' });
  }

  function submit() {
    setError(null);
    save.mutate(
      entries.map((e) =>
        e.isCustom
          ? {
              isCustom: true as const,
              ...(e.emojiId ? { emojiId: e.emojiId } : {}),
              char: e.char,
              label: e.label,
              trophyName: e.trophyName,
              ...(e.description ? { description: e.description } : {}),
              ...(e.glowRgb ? { glowRgb: e.glowRgb } : {}),
            }
          : { isCustom: false as const, emojiId: e.emojiId },
      ),
      {
        onSuccess: () => toast.show({ title: 'Emojis atualizados.' }),
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Section
      title="Emojis"
      description={`De 1 a ${MAX_ACTIVE_EMOJIS} emojis, na ordem em que aparecem na votação. Emoji criado aqui nunca é apagado: ao tirar, ele fica guardado pros troféus antigos.`}
    >
      {entries.map((e, i) => (
        <Card key={e.emojiId ?? `novo-${i}`}>
          <View style={styles.row}>
            <Text style={styles.emoji}>{e.char}</Text>
            <Text style={styles.flex} numberOfLines={1}>
              {e.label}
            </Text>
            {e.isCustom ? <Badge label="Criado aqui" /> : null}
          </View>
          <View style={styles.actions}>
            <Button variant="ghost" label="Subir" disabled={i === 0} onPress={() => move(i, -1)} />
            <Button variant="ghost" label="Descer" disabled={i === entries.length - 1} onPress={() => move(i, 1)} />
            <Button
              variant="ghost"
              label={`Tirar ${e.label}`}
              disabled={entries.length <= 1}
              onPress={() => setEntries((list) => list.filter((_, j) => j !== i))}
            />
          </View>
        </Card>
      ))}
      {catalogToAdd.length + customToAdd.length > 0 ? (
        <View style={styles.section}>
          <Text variant="overline" tone="muted">
            Adicionar
          </Text>
          <View style={styles.chips}>
            {catalogToAdd.map((o) => (
              <ChipToggle
                key={o.id}
                label={o.char}
                accessibilityLabel={`Adicionar ${o.label}`}
                selected={false}
                onPress={() =>
                  !full &&
                  setEntries((list) => [...list, { isCustom: false, emojiId: o.id, char: o.char, label: o.label }])
                }
              />
            ))}
            {customToAdd.map((o) => (
              <ChipToggle
                key={o.id}
                label={o.char}
                accessibilityLabel={`Adicionar ${o.label}`}
                selected={false}
                onPress={() =>
                  !full &&
                  setEntries((list) => [
                    ...list,
                    {
                      isCustom: true,
                      emojiId: o.id,
                      char: o.char,
                      label: o.label,
                      trophyName: o.trophyName,
                      ...(o.description ? { description: o.description } : {}),
                      glowRgb: o.glowRgb,
                    },
                  ])
                }
              />
            ))}
          </View>
        </View>
      ) : null}
      <Card>
        <View style={styles.section}>
          <Text variant="label">Criar emoji novo</Text>
          <TextField label="Emoji" value={draft.char} onChangeText={(char) => setDraft((d) => ({ ...d, char }))} />
          <TextField
            label="Nome do emoji"
            value={draft.label}
            maxLength={40}
            onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
          />
          <TextField
            label="Nome do troféu"
            value={draft.trophyName}
            maxLength={60}
            help='Ex.: "Troféu Rei dos Asnos"'
            onChangeText={(trophyName) => setDraft((d) => ({ ...d, trophyName }))}
          />
          <TextField
            label="Descrição (opcional)"
            value={draft.description}
            maxLength={140}
            help="Aparece em “O que significa cada emoji?”."
            onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
          />
          {draftError ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {draftError}
            </Text>
          ) : null}
          <Button
            variant="secondary"
            label="Adicionar emoji"
            disabled={full}
            disabledReason={full ? `No máximo ${MAX_ACTIVE_EMOJIS} emojis.` : null}
            onPress={addCustom}
          />
        </View>
      </Card>
      {error ? <Banner tone="error" title={error} /> : null}
      <Button
        variant="primary"
        label="Salvar emojis"
        loading={save.isPending}
        loadingLabel="Salvando…"
        onPress={submit}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space[8], marginTop: space[6] },
  section: { gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  emoji: { lineHeight: 30 },
});
