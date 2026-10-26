import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'eventos',
  name: 'Eventos',
  icon: 'calendar',
  permissions: [
    { id: 'eventos.ver', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    { id: 'eventos.votar', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    // In the legacy only the group's creator managed events; owner/admin administer the community (D-023).
    // criar: create and edit drafts (fields and roster). moderar: publish, open, close, delete (D-047).
    { id: 'eventos.criar', defaultRoles: ['owner', 'admin'] },
    { id: 'eventos.moderar', defaultRoles: ['owner', 'admin'] },
  ],
  menu: [{ label: 'Eventos', route: '/eventos' }],
  notifications: [{ id: 'eventos.resultado_pronto', label: 'Resultado de evento saiu', defaultEnabled: true }],
  // Approving the community request also signs the person up for the live event (P-014 B, D-047).
  joinIntents: [{ id: 'eventos.participar', label: 'Entrar e participar do evento em andamento' }],
});
