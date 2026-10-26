// Events of the community (EVT-01): every member sees the published ones; whoever creates or moderates also sees
// drafts and creates new ones. Ported in behavior from queridometro@7c5c5bf:src/app/group/[id]/events/page.tsx.
import { useModuleHost } from '@erre/core/client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  space,
  Text,
  type BadgeTone,
} from '@erre/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { EventStatus } from '../domain/lifecycle';
import { sortEvents, STATUS_LABEL } from '../domain/presentation';
import { useEvents, type EventSummary } from './data';
import { EventWizard } from './EventWizard';
import { formatDateTime } from './format';

const STATUS_TONE: Record<EventStatus, BadgeTone> = {
  draft: 'neutral',
  accepting_applications: 'warning',
  open: 'accent',
  closed: 'neutral',
};

/** "Escala · fecha em 10/05/2026 às 20:00". */
function detail(e: EventSummary): string {
  const type = e.votingType === 'scale' ? 'Escala' : 'Categórico';
  if (e.status === 'accepting_applications' && e.releaseMode === 'scheduled' && e.scheduledOpenAt)
    return `${type} · abre em ${formatDateTime(e.scheduledOpenAt)}`;
  if (e.status === 'open' && e.releaseMode === 'scheduled' && e.scheduledReleaseAt)
    return `${type} · fecha em ${formatDateTime(e.scheduledReleaseAt)}`;
  if (e.status === 'closed' && e.closedAt) return `${type} · fechado em ${formatDateTime(e.closedAt)}`;
  return type;
}

export function EventsScreen() {
  const host = useModuleHost();
  const events = useEvents();
  const [creating, setCreating] = useState(false);
  const header = (
    <>
      <Button label="← Início" variant="ghost" onPress={host.back} />
      <ScreenHeader
        overline="Eventos"
        title="Votações únicas"
        description="Além do Errômetro de sempre, votações que valem uma vez só."
      />
    </>
  );
  if (events.isPending)
    return (
      <Screen>
        {header}
        <View style={styles.list} accessibilityLabel="Carregando os eventos" accessible>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      </Screen>
    );
  if (events.isError) return <ErrorState message={events.error.message} onRetry={() => void events.refetch()} />;
  const { canCreate, canModerate } = events.data;
  const list = sortEvents(events.data.events);
  const open = (e: EventSummary) =>
    host.navigate(e.status === 'closed' && !canModerate ? `/eventos/${e.id}/resultados` : `/eventos/${e.id}`);
  return (
    <Screen>
      {header}
      {canCreate ? <Button variant="primary" label="Novo evento" onPress={() => setCreating(true)} /> : null}
      {list.length === 0 ? (
        <EmptyState emoji="🎉" message={canCreate ? 'Nenhum evento criado ainda.' : 'Nenhum evento por aqui ainda.'} />
      ) : (
        <View style={styles.list}>
          {list.map((e) => (
            <Card key={e.id} onPress={() => open(e)} accessibilityLabel={`${e.title}, ${STATUS_LABEL[e.status]}`}>
              <View style={styles.row}>
                <Text variant="label" numberOfLines={1} style={styles.flex}>
                  {e.title}
                </Text>
                <Badge label={STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />
              </View>
              <Text variant="caption" tone="muted">
                {detail(e)}
                {e.participating ? ' · você participa' : ''}
              </Text>
            </Card>
          ))}
        </View>
      )}
      {creating ? (
        <EventWizard
          onClose={() => setCreating(false)}
          onDone={(id) => {
            setCreating(false);
            host.navigate(`/eventos/${id}`);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3], marginTop: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
});
