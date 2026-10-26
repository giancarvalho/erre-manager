import { defineManifest } from '@erre/core/manifest';

export default defineManifest({
  id: 'errometro',
  name: 'Errômetro',
  icon: 'trophy',
  permissions: [
    { id: 'errometro.ver', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    { id: 'errometro.votar', defaultRoles: ['owner', 'admin', 'moderador', 'membro'] },
    // owner/admin administer everything in the community, the Errômetro included (D-023, answer to P-002).
    { id: 'errometro.moderar', defaultRoles: ['owner', 'admin'] },
  ],
  menu: [
    { label: 'Votar', route: '/errometro' },
    { label: 'Resultados', route: '/errometro/resultados' },
  ],
  notifications: [
    { id: 'errometro.resultado_pronto', label: 'Resultado do Errômetro saiu', defaultEnabled: true },
    { id: 'errometro.lembrete_fechamento', label: 'Faltam 3h para fechar a rodada', defaultEnabled: true },
  ],
  joinIntents: [{ id: 'errometro.participar', label: 'Entrar e participar do Errômetro' }],
});
