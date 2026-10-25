import type { Tx } from '@erre/db';

/** What a module receives when the core changes a membership (same transaction as the change). */
export type MemberHookContext = { tx: Tx; communityId: string; userId: string; actorId: string };

/**
 * Join intent declared by a module (D-023, "um pedido só"): an invite may carry it, and when the request
 * is approved the core calls `onApproved` in the approval transaction, inside a savepoint. If it throws,
 * only the module's part is undone: the person still joins the community (ARQUITETURA §5.2).
 */
export type JoinIntent = {
  id: string;
  label: string;
  onApproved: (ctx: MemberHookContext) => Promise<void>;
};

/**
 * Called when a person stops being an approved member or a pending request is rejected (reject, remove,
 * leave), in the same transaction. A failure aborts the whole change: a removed person must not keep
 * module rights (legacy R-MEM-05 takes the voting along).
 */
export type MemberLeftHook = (ctx: MemberHookContext) => Promise<void>;

export type MembershipHooks = { intents: readonly JoinIntent[]; onMemberLeft: readonly MemberLeftHook[] };

export const NO_HOOKS: MembershipHooks = { intents: [], onMemberLeft: [] };
