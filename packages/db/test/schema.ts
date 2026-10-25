import { text, uuid } from 'drizzle-orm/pg-core';

import { createTenantTable } from '../src/tenant';

export const testTenantItems = createTenantTable('test_tenant_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
});
