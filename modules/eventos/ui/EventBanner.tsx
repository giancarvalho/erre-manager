// The live event on the hub and on the event screen (DESIGN §9.12 "Evento", §3.4): tinted with the event's
// color, text always on the text tokens. Ported in behavior from queridometro@7c5c5bf:
// src/components/group/events/{EventOpenBanner,EventApplicationsBanner,EventResultsBanner}.tsx.
import { useModuleHost } from '@erre/core/client';
import { Banner, Button } from '@erre/ui';

import type { EventSummary } from './data';

export function EventBanner({ event }: { event: EventSummary }) {
  const { navigate } = useModuleHost();
  const common = {
    tone: 'event' as const,
    ...(event.bannerRgb ? { eventRgb: event.bannerRgb } : {}),
    ...(event.description ? { description: event.description } : {}),
  };
  if (event.status === 'open')
    return (
      <Banner
        {...common}
        icon="🗳️"
        title={`Votação aberta: ${event.title}`}
        action={<Button variant="accent" label="Votar agora" onPress={() => navigate(`/eventos/${event.id}/votar`)} />}
      />
    );
  if (event.status === 'accepting_applications')
    return (
      <Banner
        {...common}
        icon="📝"
        title={`Aceitando inscrições: ${event.title}`}
        action={
          <Button
            variant="accent"
            label={event.participating ? 'Ver evento' : 'Participar'}
            onPress={() => navigate(`/eventos/${event.id}`)}
          />
        }
      />
    );
  return (
    <Banner
      {...common}
      icon="🏆"
      title={`Votação encerrada: ${event.title}`}
      action={
        <Button variant="accent" label="Ver resultados" onPress={() => navigate(`/eventos/${event.id}/resultados`)} />
      }
    />
  );
}
