// Mural de avisos: what the module declares to the core (ARQUITETURA §5). Pure metadata, read by the API and the app.
import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'avisos',
  name: 'Mural de avisos',
  icon: 'megaphone',
  permissions: [
    // Each permission starts with "avisos."; defaultRoles is who gets it in a new community.
    { id: 'avisos.ver', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    // Publishing pushes everyone, so it goes to the roles already trusted with the community's tone; moderadores
    // included because they already look after what is said there. Whoever publishes can also delete any notice.
    { id: 'avisos.publicar', defaultRoles: ['owner', 'admin', 'moderador'] },
  ],
  // Entry shown below the module's section in the community hub.
  menu: [{ label: 'Mural de avisos', route: '/avisos' }],
  notifications: [{ id: 'avisos.novo', label: 'Aviso novo no mural', defaultEnabled: true }],
});
