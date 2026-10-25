import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, ScreenHeader, SegmentedControl, StickyActionBar, VoteCard, type EmojiOption } from '@/components/ui';
import { runBlindSignatureSelfTest } from '@/lib/self-test';
import { useTheme } from '@/theme/theme';
import { space, type, type AvatarVariant } from '@/theme/tokens';

const EMOJIS: EmojiOption[] = [
  { id: 'asno', char: '🦄', label: 'Asno: erra com convicção' },
  { id: 'biscoito', char: '🍪', label: 'Biscoito: mendiga atenção' },
  { id: 'bocao', char: '🫦', label: 'Bocão: sexy, caliente' },
  { id: 'bolo', char: '🎂', label: 'Bolo: anima o rolê e não aparece' },
  { id: 'cobra', char: '🐍', label: 'Cobra: falso, age pelas costas' },
  { id: 'coracao', char: '❤️', label: 'Coração: querido' },
  { id: 'coracao-partido', char: '💔', label: 'Coração partido: me decepcionou' },
  { id: 'mala', char: '💼', label: 'Mala: inconveniente, chato' },
  { id: 'mentiroso', char: '🤥', label: 'Mentiroso: nem ele acredita' },
  { id: 'planta', char: '🪴', label: 'Planta: existe, mas ninguém percebe' },
  { id: 'vomito', char: '🤢', label: 'Vômito: tenho nojo' },
];

const MEMBERS: { id: string; name: string; variant: AvatarVariant }[] = [
  { id: 'a', name: 'Alice', variant: 'emerald' },
  { id: 'b', name: 'Bruno', variant: 'violet' },
  { id: 'c', name: 'Camila', variant: 'indigo' },
  { id: 'd', name: 'Diego', variant: 'amber' },
  { id: 'e', name: 'Elisa', variant: 'sky' },
  { id: 'f', name: 'Fabio', variant: 'rose' },
];

export default function VoteScreen() {
  const { colors } = useTheme();
  const [order, setOrder] = useState<'az' | 'pending'>('az');
  const [votes, setVotes] = useState<Record<string, string>>({});
  const selfTest = useMemo(() => runBlindSignatureSelfTest(), []);
  const votedCount = Object.keys(votes).length;
  const members = order === 'az' ? MEMBERS : [...MEMBERS].sort((x, y) => Number(x.id in votes) - Number(y.id in votes));

  return (
    <Screen
      footer={
        <StickyActionBar
          label="Enviar votos"
          disabled={votedCount === 0}
          hint={votedCount === 0 ? 'Escolha pelo menos um emoji para continuar.' : `${votedCount} de ${MEMBERS.length} pessoas votadas`}
          onPress={() => router.push('/resultados')}
        />
      }
    >
      <ScreenHeader overline="Errômetro" title="Turma do vôlei" description="Toque em um emoji para cada pessoa. Você pode mudar seus votos até o resultado sair." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[4] }}>
        <Button label="Resultados" onPress={() => router.push('/resultados')} />
        <Button label="Aparência" variant="ghost" onPress={() => router.push('/aparencia')} />
      </View>
      <Text testID="self-test" style={[type.caption, { color: selfTest.ok ? colors.success.text : colors.danger.text, marginBottom: space[4] }]}>
        {`Assinatura cega: ${selfTest.ok ? 'OK' : 'FALHOU'} em ${selfTest.ms} ms (${selfTest.detail})`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] }}>
        <Text style={[type.overline, { color: colors.text.muted }]}>Votação</Text>
        <SegmentedControl
          label="Ordenar pessoas"
          value={order}
          onChange={setOrder}
          options={[
            { value: 'az', label: 'Alfabética' },
            { value: 'pending', label: 'Não votados' },
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {members.map((m) => (
          <VoteCard
            key={m.id}
            name={m.name}
            variant={m.variant}
            emojis={EMOJIS}
            selected={votes[m.id] ?? null}
            onSelect={(id) =>
              setVotes((prev) => {
                const next = { ...prev };
                if (id === null) delete next[m.id];
                else next[m.id] = id;
                return next;
              })
            }
          />
        ))}
      </View>
    </Screen>
  );
}
