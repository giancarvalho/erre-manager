import {
  Accordion,
  Avatar,
  AVATAR_VARIANT_NAMES,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmojiButton,
  EmptyState,
  ErrorState,
  IconButton,
  RankingRow,
  ReservedContent,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  Skeleton,
  space,
  StickyActionBar,
  SwitchRow,
  Text,
  TextField,
  ThemePicker,
  TrophyMedallion,
  useToast,
  type TextVariant,
} from '@erre/ui';
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// Component gallery (PLANO Sprint 10, task 7). Off in production builds: only with EXPO_PUBLIC_DEV_GALLERY=1.
export const GALLERY_ENABLED = process.env.EXPO_PUBLIC_DEV_GALLERY === '1';

const EMOJIS = [
  { id: 'coracao', char: '❤️', label: 'Coração: querido' },
  { id: 'cobra', char: '🐍', label: 'Cobra: falso, age pelas costas' },
  { id: 'planta', char: '🪴', label: 'Planta: existe, mas ninguém percebe' },
];
const TYPE: TextVariant[] = ['display', 'titleLg', 'titleMd', 'bodyLg', 'body', 'label', 'caption', 'overline', 'mono'];

export default function GalleryRoute() {
  if (!GALLERY_ENABLED) return <Redirect href="/" />;
  return <Gallery />;
}

export function Gallery() {
  const toast = useToast();
  const [emoji, setEmoji] = useState<string | null>('cobra');
  const [segment, setSegment] = useState<'alfa' | 'pendentes'>('alfa');
  const [card, setCard] = useState('a');
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  return (
    <Screen
      footer={
        <StickyActionBar
          label="Enviar votos"
          hint="3 de 12 pessoas votadas"
          onPress={() => toast.show({ title: 'Votos enviados. Bora.' })}
        />
      }
    >
      <ScreenHeader
        overline="Desenvolvimento"
        title="Galeria de componentes"
        description="Todos os componentes de @erre/ui, nos dois temas."
      />

      <Section title="Aparência">
        <ThemePicker />
      </Section>

      <Section title="Tipografia">
        {TYPE.map((v) => (
          <Text key={v} variant={v}>{`${v}: Erra com convicção`}</Text>
        ))}
        <Text tone="muted">muted</Text>
        <Text tone="accent">accent</Text>
        <Text tone="danger">danger</Text>
        <Text tone="warning">warning</Text>
        <Text tone="success">success</Text>
      </Section>

      <Section title="Botões">
        <Button label="Criar comunidade" variant="primary" fullWidth />
        <Button label="Ir votar e liberar" variant="accent" />
        <Button label="Continuar com Google" variant="secondary" />
        <Button label="Ver como funciona ›" variant="ghost" />
        <Button label="Remover Ana" variant="destructive" />
        <Button label="Enviar votos" loadingLabel="Enviando…" loading variant="primary" />
        <Button label="Enviar votos" disabledReason="Escolha pelo menos um emoji para continuar." variant="primary" />
        <View style={styles.row}>
          <IconButton glyph="✕" label="Fechar" onPress={() => undefined} />
          <IconButton glyph="⋯" label="Mais opções" onPress={() => undefined} />
          <IconButton glyph="‹" label="Voltar" onPress={() => undefined} disabled />
        </View>
      </Section>

      <Section title="Campos">
        <TextField
          label="Nome da comunidade"
          placeholder="ex: minha-bagunca"
          help="Letras minúsculas, números e hífens."
        />
        <TextField
          label="Com erro"
          value="Minha Bagunça"
          error={fieldError}
          onFocus={() => setFieldError(null)}
          onBlur={() => setFieldError('Use só letras minúsculas, números e hífens.')}
        />
        <Button
          label="Mostrar erro"
          variant="secondary"
          onPress={() => setFieldError('Use só letras minúsculas, números e hífens.')}
        />
        <SwitchRow label="Resultado liberado" description="Quando a rodada fecha." value={on} onValueChange={setOn} />
        <SwitchRow
          label="Receber notificações"
          value={false}
          onValueChange={() => undefined}
          disabledReason="Este navegador não aceita notificações."
        />
      </Section>

      <Section title="Cards">
        <Card>
          <Text>Card simples</Text>
        </Card>
        <Card onPress={() => undefined}>
          <Text>Card tocável ›</Text>
        </Card>
        <View accessibilityRole="radiogroup" style={styles.stack}>
          {['a', 'b'].map((k) => (
            <Card key={k} selected={card === k} onPress={() => setCard(k)} accessibilityLabel={`Opção ${k}`}>
              <Text variant="label">{k === 'a' ? 'Clássico' : 'Personalizado'}</Text>
              {k === 'a' ? <Badge label="Recomendado" tone="accent" /> : null}
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Emojis, avatares e selos">
        <View style={styles.row}>
          {EMOJIS.map((e) => (
            <EmojiButton
              key={e.id}
              emoji={e.char}
              label={e.label}
              selected={emoji === e.id}
              onPress={() => setEmoji(emoji === e.id ? null : e.id)}
            />
          ))}
        </View>
        <View style={styles.row}>
          {AVATAR_VARIANT_NAMES.map((v) => (
            <Avatar key={v} name={v} variant={v} size={32} />
          ))}
        </View>
        <View style={styles.row}>
          <Avatar name="Ana" variant="teal" size={40} />
          <Avatar name="Bruno" variant="violet" size={64} />
        </View>
        <View style={styles.row}>
          <Badge label="Destaque" tone="accent" />
          <Badge label="Neutro" />
          <Badge label="Aviso" tone="warning" />
          <Badge label="Erro" tone="danger" />
        </View>
      </Section>

      <Section title="Navegação e revelação">
        <SegmentedControl
          label="Ordem"
          options={[
            { value: 'alfa', label: 'Alfabética' },
            { value: 'pendentes', label: 'Não votados' },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <Accordion title="O que significa cada emoji?" icon="📖">
          {EMOJIS.map((e) => (
            <Text key={e.id} tone="secondary">{`${e.char} ${e.label}`}</Text>
          ))}
        </Accordion>
      </Section>

      <Section title="Banners">
        <Banner title="Informação" description="Contexto neutro." />
        <Banner tone="warning" title="Faltam 3h pra fechar" description="Vote antes de segunda, 12h." />
        <Banner tone="error" title="Não deu pra enviar" description="Confira sua internet e tente de novo." />
        <Banner
          tone="highlight"
          icon="✨"
          title="Rodada liberada"
          description="Os resultados saíram."
          action={<Button label="Ver resultado" variant="accent" />}
        />
        <Banner
          tone="event"
          eventRgb="236 72 153"
          icon="🎉"
          title="Festa de sábado"
          description="Votação aberta até domingo."
        />
      </Section>

      <Section title="Camadas">
        <View style={styles.row}>
          <Button
            label="Mostrar aviso"
            variant="secondary"
            onPress={() =>
              toast.show({ title: 'Conta criada. Bora votar.', description: 'Dá pra mudar o nome no perfil.' })
            }
          />
          <Button
            label="Mostrar erro"
            variant="secondary"
            onPress={() => toast.show({ title: 'Não deu pra salvar', tone: 'error' })}
          />
        </View>
        <View style={styles.row}>
          <Button label="Abrir sheet" variant="secondary" onPress={() => setSheet(true)} />
          <Button label="Confirmar exclusão" variant="destructive" onPress={() => setDialog(true)} />
        </View>
      </Section>

      <Section title="Troféus e ranking">
        <View style={styles.row}>
          <TrophyMedallion emoji="🐍" label="Troféu Cobra" />
          <TrophyMedallion emoji="🪴" tone="silver" label="Quase troféu Planta" />
        </View>
        <RankingRow
          position={1}
          name="Ana"
          variant="teal"
          total={9}
          trophy
          chips={[
            { emoji: '🐍', count: 5, label: 'cobra' },
            { emoji: '❤️', count: 4, label: 'coração' },
          ]}
        />
        <RankingRow
          position={2}
          name="Bruno"
          variant="violet"
          total={7}
          index={1}
          chips={[{ emoji: '🪴', count: 7, label: 'planta' }]}
        />
        <RankingRow
          position={4}
          name="Camila"
          variant="indigo"
          total={2}
          index={2}
          chips={[{ emoji: '❤️', count: 2, label: 'coração' }]}
        />
      </Section>

      <Section title="Estados">
        <View style={styles.stack}>
          <Skeleton width="60%" height={20} />
          <Skeleton height={56} />
          <View style={styles.row}>
            <Skeleton width={40} height={40} round />
            <Skeleton width="50%" />
          </View>
        </View>
        <EmptyState emoji="🗓️" message="Nenhum evento ainda." actionLabel="Criar evento" onAction={() => undefined} />
        <View style={styles.errorBox}>
          <ErrorState message="Não deu pra carregar." onRetry={() => undefined} />
        </View>
        <ReservedContent
          title="Resultados reservados"
          description="Vote pra ver quem levou o quê."
          actionLabel="Ir votar e liberar"
          onAction={() => undefined}
        >
          <RankingRow
            position={1}
            name="Ana"
            variant="teal"
            total={9}
            chips={[{ emoji: '🐍', count: 5, label: 'cobra' }]}
          />
          <RankingRow
            position={2}
            name="Bruno"
            variant="violet"
            total={7}
            chips={[{ emoji: '🪴', count: 7, label: 'planta' }]}
          />
        </ReservedContent>
      </Section>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        overline="Ritual de iniciação · Passo 1 de 4"
        title="Como funciona"
        actions={
          <>
            <Button label="Voltar" variant="secondary" onPress={() => setSheet(false)} />
            <Button label="Continuar" variant="primary" onPress={() => setSheet(false)} />
          </>
        }
      >
        <Text tone="secondary">
          Toda semana, cada pessoa escolhe emojis para os outros. Ninguém vê quem votou o quê.
        </Text>
      </Sheet>
      <ConfirmDialog
        visible={dialog}
        title="Remover Ana?"
        message="Ana perde o acesso à comunidade. Pode pedir para entrar de novo."
        confirmLabel="Remover Ana"
        onConfirm={() => setDialog(false)}
        onCancel={() => setDialog(false)}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3], marginBottom: space[10] },
  stack: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  errorBox: { height: 180 },
});
