// Create or edit an event draft (EVT-02, EVT-03): a sheet with 4 steps (DESIGN §9.10, §10.4): the event, its
// emojis or axes, how it opens and closes, the banner color. Each step is checked with the same domain rules
// the API applies. Ported in behavior from queridometro@7c5c5bf:src/components/group/events/
// {CreateVotingEventForm,EventDraftSettingsForm,ReleaseModeFields,EventEmojiRosterForm}.tsx.
import { Banner, Button, Card, SegmentedControl, Sheet, space, Text, TextField } from '@erre/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { buildEventEmojiRows } from '../domain/emoji-config';
import { validateReleaseFields, type ReleaseMode } from '../domain/lifecycle';
import { MAX_EVENT_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '../domain/limits';
import type { VotingType } from '../domain/snapshot';
import { useCreateEvent, useSaveDraft, type EventEmoji, type EventView, type RosterEntries } from './data';
import { parseLocalDateTime, toLocalFields } from './format';
import { RosterEditor, type RosterEntry } from './RosterEditor';

const STEPS = 4;

const TYPES: { value: VotingType; title: string; description: string }[] = [
  {
    value: 'categorical',
    title: 'Categórico',
    description: 'Cada pessoa dá um emoji por participante. Quem tiver mais votos num emoji leva o troféu.',
  },
  {
    value: 'scale',
    title: 'Escala',
    description: 'Cada pessoa dá uma nota (de 1 até o teto) em cada eixo. Quem tiver a maior média leva o troféu.',
  },
];

const RELEASE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Agendado' },
] as const;

/** Banner colors to choose from ("R G B"). Only tint background, border and icon (DESIGN §3.4). */
const COLORS: { rgb: string; name: string }[] = [
  { rgb: '139 92 246', name: 'Violeta' },
  { rgb: '236 72 153', name: 'Rosa' },
  { rgb: '244 63 94', name: 'Vermelho' },
  { rgb: '249 115 22', name: 'Laranja' },
  { rgb: '234 179 8', name: 'Amarelo' },
  { rgb: '34 197 94', name: 'Verde' },
  { rgb: '59 130 246', name: 'Azul' },
];

function toEntries(emojis: EventEmoji[]): RosterEntry[] {
  return emojis.map((e) => {
    const scaleMax = e.scaleMax !== null ? { scaleMax: e.scaleMax } : {};
    return e.isCustom
      ? {
          isCustom: true,
          emojiId: e.id,
          char: e.char,
          label: e.label,
          trophyName: e.trophyName,
          ...(e.description ? { description: e.description } : {}),
          glowRgb: e.glowRgb,
          ...scaleMax,
        }
      : { isCustom: false, emojiId: e.id, char: e.char, label: e.label, ...scaleMax };
  });
}

/** What the API takes (without the display fields). */
function toRequest(entries: RosterEntry[], votingType: VotingType): RosterEntries {
  const scaleMax = (e: RosterEntry) =>
    votingType === 'scale' && e.scaleMax !== undefined ? { scaleMax: e.scaleMax } : {};
  return entries.map((e) =>
    e.isCustom
      ? {
          isCustom: true as const,
          ...(e.emojiId ? { emojiId: e.emojiId } : {}),
          char: e.char,
          label: e.label,
          trophyName: e.trophyName,
          ...(e.description ? { description: e.description } : {}),
          ...(e.glowRgb ? { glowRgb: e.glowRgb } : {}),
          ...scaleMax(e),
        }
      : { isCustom: false as const, emojiId: e.emojiId, ...scaleMax(e) },
  );
}

export function EventWizard({
  initial,
  onClose,
  onDone,
}: {
  /** The draft being edited; absent to create a new event. */
  initial?: { event: EventView; emojis: EventEmoji[] };
  onClose: () => void;
  onDone: (eventId: string) => void;
}) {
  const editing = initial !== undefined;
  const create = useCreateEvent();
  const save = useSaveDraft(initial?.event.id ?? '');
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(initial?.event.title ?? '');
  const [description, setDescription] = useState(initial?.event.description ?? '');
  const [votingType, setVotingType] = useState<VotingType>(initial?.event.votingType ?? 'categorical');
  const [entries, setEntries] = useState<RosterEntry[]>(initial ? toEntries(initial.emojis) : []);
  const [releaseMode, setReleaseMode] = useState<ReleaseMode>(initial?.event.releaseMode ?? 'manual');
  const [openAt, setOpenAt] = useState(toLocalFields(initial?.event.scheduledOpenAt ?? null));
  const [closeAt, setCloseAt] = useState(toLocalFields(initial?.event.scheduledReleaseAt ?? null));
  const [bannerRgb, setBannerRgb] = useState<string | null>(initial?.event.bannerRgb ?? null);
  const [error, setError] = useState<string | null>(null);

  const scheduled = () => ({
    open: parseLocalDateTime(openAt.date, openAt.time),
    close: parseLocalDateTime(closeAt.date, closeAt.time),
  });

  /** The problem with the current step, or null (same messages as the API). */
  function problem(): string | null {
    if (step === 1) {
      const t = title.trim();
      if (t.length === 0 || t.length > MAX_TITLE_LENGTH)
        return `Título precisa ter entre 1 e ${MAX_TITLE_LENGTH} caracteres.`;
      if (description.trim().length > MAX_EVENT_DESCRIPTION_LENGTH)
        return `Descrição precisa ter no máximo ${MAX_EVENT_DESCRIPTION_LENGTH} caracteres.`;
    }
    if (step === 2) {
      const built = buildEventEmojiRows(votingType, toRequest(entries, votingType));
      if (!built.ok) return built.error;
    }
    if (step === 3 && releaseMode === 'scheduled') {
      const { open, close } = scheduled();
      if ((openAt.date || openAt.time) && !open) return 'Data de abertura inválida. Use dd/mm/aaaa e hh:mm.';
      if ((closeAt.date || closeAt.time) && !close) return 'Data de fechamento inválida. Use dd/mm/aaaa e hh:mm.';
      return validateReleaseFields('scheduled', open, close, new Date());
    }
    return null;
  }

  function next() {
    const p = problem();
    setError(p);
    if (p) return;
    if (step < STEPS) return setStep(step + 1);
    void finish();
  }

  async function finish() {
    const { open, close } = scheduled();
    const dates = releaseMode === 'scheduled' ? { scheduledOpenAt: open!, scheduledReleaseAt: close! } : {};
    const roster = toRequest(entries, votingType);
    try {
      if (editing) {
        await save.mutateAsync({
          patch: {
            title,
            description: description.trim() ? description : null,
            releaseMode,
            scheduledOpenAt: dates.scheduledOpenAt ?? null,
            scheduledReleaseAt: dates.scheduledReleaseAt ?? null,
            bannerRgb,
          },
          entries: roster,
        });
        onDone(initial.event.id);
      } else {
        const created = await create.mutateAsync({
          event: { title, ...(description.trim() ? { description } : {}), votingType, releaseMode, ...dates },
          entries: roster,
          bannerRgb,
        });
        onDone(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.');
    }
  }

  const titles = ['O evento', votingType === 'scale' ? 'Eixos' : 'Emojis', 'Abertura e fechamento', 'Cor do banner'];
  const busy = create.isPending || save.isPending;
  return (
    <Sheet
      visible
      onClose={onClose}
      overline={`${editing ? 'Editar evento' : 'Novo evento'} · passo ${step} de ${STEPS}`}
      title={titles[step - 1]!}
      actions={
        <>
          <Button
            variant="secondary"
            label={step === 1 ? 'Cancelar' : 'Voltar'}
            onPress={() => (step === 1 ? onClose() : (setError(null), setStep(step - 1)))}
          />
          <Button
            variant="primary"
            label={step < STEPS ? 'Próximo' : editing ? 'Salvar rascunho' : 'Criar rascunho'}
            loading={busy}
            loadingLabel="Salvando…"
            onPress={next}
          />
        </>
      }
    >
      {step === 1 ? (
        <>
          <TextField
            label="Título"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Ex: Amigo Secreto 2026"
            onChangeText={setTitle}
          />
          <TextField
            label="Descrição (opcional)"
            value={description}
            maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
            placeholder="Do que se trata esse evento?"
            multiline
            onChangeText={setDescription}
          />
          <Text variant="overline" tone="muted">
            Tipo de votação
          </Text>
          {editing ? (
            <Text tone="secondary">
              {`${TYPES.find((t) => t.value === votingType)!.title}. O tipo não muda depois de criar o evento.`}
            </Text>
          ) : (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {TYPES.map((t) => (
                <Card
                  key={t.value}
                  selected={votingType === t.value}
                  accessibilityLabel={t.title}
                  onPress={() => {
                    if (t.value !== votingType) setEntries([]);
                    setVotingType(t.value);
                  }}
                >
                  <Text variant="label">{t.title}</Text>
                  <Text variant="caption" tone="muted">
                    {t.description}
                  </Text>
                </Card>
              ))}
              <Text variant="caption" tone="muted">
                Não dá pra trocar depois de criar o evento.
              </Text>
            </View>
          )}
        </>
      ) : null}
      {step === 2 ? <RosterEditor votingType={votingType} entries={entries} onChange={setEntries} /> : null}
      {step === 3 ? (
        <>
          <SegmentedControl
            label="Como o evento abre e fecha"
            options={RELEASE_OPTIONS}
            value={releaseMode}
            onChange={setReleaseMode}
          />
          {releaseMode === 'manual' ? (
            <Text tone="muted">Sem data prevista: você abre e fecha a votação quando quiser.</Text>
          ) : (
            <>
              <Text tone="muted">A votação abre e fecha sozinha nesses horários (do seu aparelho).</Text>
              <DateTimeFields label="Abre em" value={openAt} onChange={setOpenAt} />
              <DateTimeFields label="Fecha em" value={closeAt} onChange={setCloseAt} />
            </>
          )}
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Text tone="muted">
            O banner do evento no início da comunidade ganha essa cor. A cor só muda enquanto é rascunho.
          </Text>
          <View accessibilityRole="radiogroup" style={styles.colors}>
            <ColorChoice
              name="Cor padrão"
              rgb={null}
              selected={bannerRgb === null}
              onPress={() => setBannerRgb(null)}
            />
            {COLORS.map((c) => (
              <ColorChoice
                key={c.rgb}
                name={c.name}
                rgb={c.rgb}
                selected={bannerRgb === c.rgb}
                onPress={() => setBannerRgb(c.rgb)}
              />
            ))}
          </View>
          <Banner
            tone="event"
            {...(bannerRgb ? { eventRgb: bannerRgb } : {})}
            icon="🗳️"
            title={`Votação aberta: ${title.trim() || 'Seu evento'}`}
            description="Assim o banner aparece pra comunidade."
          />
        </>
      ) : null}
      {error ? <Banner tone="error" title={error} /> : null}
    </Sheet>
  );
}

function DateTimeFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { date: string; time: string };
  onChange: (v: { date: string; time: string }) => void;
}) {
  return (
    <View style={styles.dateRow}>
      <View style={styles.date}>
        <TextField
          label={`${label} (data)`}
          value={value.date}
          placeholder="dd/mm/aaaa"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          onChangeText={(date) => onChange({ ...value, date })}
        />
      </View>
      <View style={styles.time}>
        <TextField
          label={`${label} (hora)`}
          value={value.time}
          placeholder="hh:mm"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          onChangeText={(time) => onChange({ ...value, time })}
        />
      </View>
    </View>
  );
}

function ColorChoice({
  name,
  rgb,
  selected,
  onPress,
}: {
  name: string;
  rgb: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.colorItem}>
      <Card selected={selected} onPress={onPress} accessibilityLabel={name}>
        <Banner tone="event" {...(rgb ? { eventRgb: rgb } : {})} title={name} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  options: { gap: space[3] },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  colorItem: { width: '48%' },
  dateRow: { flexDirection: 'row', gap: space[3] },
  date: { flex: 3 },
  time: { flex: 2 },
});
