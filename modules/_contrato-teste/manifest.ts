import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'contratoteste',
  name: 'Contrato (teste)',
  icon: 'flask',
  permissions: [
    { id: 'contratoteste.ver', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    { id: 'contratoteste.editar', defaultRoles: ['owner', 'admin'] },
  ],
  menu: [{ label: 'Teste', route: '/contratoteste' }],
  notifications: [{ id: 'contratoteste.aviso', label: 'Aviso de teste', defaultEnabled: true }],
  joinIntents: [{ id: 'contratoteste.participar', label: 'Entrar e participar do teste' }],
});
