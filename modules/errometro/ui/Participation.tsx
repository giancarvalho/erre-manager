// Participation states (DESIGN §10.2): not asked, pending, queued by the 50-voter cap, rejected, removed.
// Shown in the hub section and on the voting screen for someone who doesn't vote yet.
import { Button, space, Text } from '@erre/ui';
import { StyleSheet, View } from 'react-native';

import { useRequestParticipation, type Participation } from './data';

export function participationText(p: Participation): string {
  switch (p.status) {
    case 'approved':
      return 'Você participa da votação desta comunidade.';
    case 'pending':
      return p.full
        ? `Pedido na fila: o Errômetro já tem ${p.limit} votantes. Você entra quando abrir uma vaga.`
        : 'Pedido enviado. Falta a aprovação de quem administra a comunidade.';
    case 'rejected':
      return 'Seu pedido pra votar não foi aprovado. Se quiser, peça de novo.';
    case 'removed':
      return 'Você não participa mais da votação. Se quiser voltar, peça de novo.';
    default:
      return 'Você ainda não participa da votação desta comunidade.';
  }
}

/** Text of the state and, when it makes sense, the "Quero participar do Errômetro" button. */
export function ParticipationPanel({ participation }: { participation: Participation }) {
  const request = useRequestParticipation();
  const canAsk = participation.status !== 'approved' && participation.status !== 'pending';
  return (
    <View style={styles.box}>
      <Text tone="muted">{participationText(participation)}</Text>
      {canAsk ? (
        <Button
          label="Quero participar do Errômetro"
          variant="secondary"
          loading={request.isPending}
          loadingLabel="Enviando…"
          onPress={() => request.mutate()}
        />
      ) : null}
      {request.error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {request.error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: space[3] } });
