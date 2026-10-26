// The event's emojis (categorical) or axes (scale), step 2 of the wizard (EVT-03). Ported in behavior from
// queridometro@7c5c5bf:src/components/group/events/EventEmojiRosterForm.tsx.
import { EMOJI_OPTIONS, inferEmojiGlowColor, isSingleGrapheme, MAX_DESCRIPTION_LENGTH } from '@erre/emoji';
import { Badge, Button, Card, ChipToggle, space, Stepper, Text, TextField } from '@erre/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_ACTIVE_EMOJIS, MAX_SCALE_AXES, MAX_SCALE_MAX, MIN_SCALE_MAX } from '../domain/limits';
import type { VotingType } from '../domain/snapshot';

/** One roster row as the editor holds it: what the API takes plus what the row shows. */
export type RosterEntry =
  | { isCustom: false; emojiId: string; char: string; label: string; scaleMax?: number }
  | {
      isCustom: true;
      emojiId?: string;
      char: string;
      label: string;
      trophyName: string;
      description?: string;
      glowRgb?: string;
      scaleMax?: number;
    };

/** The default ceiling of a new axis (legacy form). */
const DEFAULT_SCALE_MAX = 5;

export function RosterEditor({
  votingType,
  entries,
  onChange,
}: {
  votingType: VotingType;
  entries: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
}) {
  const scale = votingType === 'scale';
  const limit = scale ? MAX_SCALE_AXES : MAX_ACTIVE_EMOJIS;
  const full = entries.length >= limit;
  const [draft, setDraft] = useState({ char: '', label: '', trophyName: '', description: '' });
  const [draftError, setDraftError] = useState<string | null>(null);
  const used = new Set(entries.map((e) => e.emojiId).filter(Boolean));
  const withMax = <T extends RosterEntry>(e: T): T => (scale ? { ...e, scaleMax: e.scaleMax ?? DEFAULT_SCALE_MAX } : e);

  const move = (i: number, d: number) => {
    const next = [...entries];
    const [item] = next.splice(i, 1);
    next.splice(i + d, 0, item!);
    onChange(next);
  };

  function addCustom() {
    const char = draft.char.trim();
    if (!isSingleGrapheme(char)) return setDraftError('O emoji precisa ser um único emoji (nada de texto colado).');
    if (!draft.label.trim() || draft.label.trim().length > 40)
      return setDraftError('Nome do emoji precisa ter entre 1 e 40 caracteres.');
    if (!draft.trophyName.trim() || draft.trophyName.trim().length > 60)
      return setDraftError('Nome do troféu precisa ter entre 1 e 60 caracteres.');
    setDraftError(null);
    // Glow color measured once on the web (canvas); native keeps the default (D-042).
    onChange([
      ...entries,
      withMax({
        isCustom: true,
        char,
        label: draft.label.trim(),
        trophyName: draft.trophyName.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        glowRgb: inferEmojiGlowColor(char),
      }),
    ]);
    setDraft({ char: '', label: '', trophyName: '', description: '' });
  }

  return (
    <View style={styles.box}>
      <Text tone="muted">
        {scale
          ? `De 1 a ${MAX_SCALE_AXES} eixos. Cada um tem seu próprio teto de intensidade (de ${MIN_SCALE_MAX} a ${MAX_SCALE_MAX}).`
          : `De 1 a ${MAX_ACTIVE_EMOJIS} emojis, na ordem em que aparecem na votação.`}
      </Text>
      {entries.length === 0 ? (
        <Text variant="caption" tone="muted">
          {scale
            ? 'Nenhum eixo ainda: adicione pelo menos um abaixo.'
            : 'Nenhum emoji ainda: adicione pelo menos um abaixo.'}
        </Text>
      ) : null}
      {entries.map((e, i) => (
        <Card key={e.emojiId ?? `novo-${i}`}>
          <View style={styles.row}>
            <Text variant="titleMd" style={styles.emoji}>
              {e.char}
            </Text>
            <Text style={styles.flex} numberOfLines={1}>
              {e.label}
            </Text>
            {e.isCustom ? <Badge label="Criado aqui" /> : null}
          </View>
          {scale ? (
            <Stepper
              label={`Intensidade máxima de ${e.label}`}
              value={e.scaleMax ?? DEFAULT_SCALE_MAX}
              min={MIN_SCALE_MAX}
              max={MAX_SCALE_MAX}
              onChange={(scaleMax) => onChange(entries.map((x, j) => (j === i ? { ...x, scaleMax } : x)))}
            />
          ) : null}
          <View style={styles.actions}>
            <Button variant="ghost" label="Subir" disabled={i === 0} onPress={() => move(i, -1)} />
            <Button variant="ghost" label="Descer" disabled={i === entries.length - 1} onPress={() => move(i, 1)} />
            <Button
              variant="ghost"
              label={`Tirar ${e.label}`}
              onPress={() => onChange(entries.filter((_, j) => j !== i))}
            />
          </View>
        </Card>
      ))}
      <Text variant="overline" tone="muted">
        Adicionar do catálogo
      </Text>
      <View style={styles.chips}>
        {EMOJI_OPTIONS.filter((o) => !used.has(o.id)).map((o) => (
          <ChipToggle
            key={o.id}
            label={o.char}
            accessibilityLabel={`Adicionar ${o.label}`}
            selected={false}
            onPress={() =>
              !full && onChange([...entries, withMax({ isCustom: false, emojiId: o.id, char: o.char, label: o.label })])
            }
          />
        ))}
      </View>
      {full ? (
        <Text variant="caption" tone="muted">
          {scale ? `No máximo ${MAX_SCALE_AXES} eixos.` : `No máximo ${MAX_ACTIVE_EMOJIS} emojis.`}
        </Text>
      ) : null}
      <Card>
        <View style={styles.box}>
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
            help='Ex.: "Troféu Mais Sortudo"'
            onChangeText={(trophyName) => setDraft((d) => ({ ...d, trophyName }))}
          />
          <TextField
            label="Descrição (opcional)"
            value={draft.description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            help="Aparece pra quem for votar."
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
            disabledReason={
              full ? (scale ? `No máximo ${MAX_SCALE_AXES} eixos.` : `No máximo ${MAX_ACTIVE_EMOJIS} emojis.`) : null
            }
            onPress={addCustom}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  emoji: { lineHeight: 30 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
