export type AccountExportUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

type ExportDatabase = { from: (table: string) => any };
type QuerySpec = { table: string; column: string; order: string[] };

const directQueries = {
  settings: { table: "user_settings", column: "user_id", order: ["user_id"] },
  orders: { table: "orders", column: "user_id", order: ["id"] },
  usageLogs: { table: "usage_logs", column: "user_id", order: ["id"] },
  productEvents: { table: "product_events", column: "user_id", order: ["id"] },
  chatTurns: { table: "chat_turns", column: "user_id", order: ["id"] },
  letters: { table: "letters", column: "user_id", order: ["id"] },
} satisfies Record<string, QuerySpec>;

const companionQueries = {
  companionProfiles: { table: "user_profiles", column: "companion_id", order: ["companion_id"] },
  memories: { table: "memory_summaries", column: "companion_id", order: ["id"] },
  memoryVersions: { table: "memory_versions", column: "companion_id", order: ["id"] },
  memoryEvidence: { table: "memory_evidence", column: "companion_id", order: ["memory_id", "revision", "message_id"] },
  relationshipEvents: { table: "relationship_events", column: "companion_id", order: ["id"] },
  dreams: { table: "dream_entries", column: "companion_id", order: ["id"] },
} satisfies Record<string, QuerySpec>;

async function selectOwnedRows(
  db: ExportDatabase,
  spec: QuerySpec,
  values: string[],
  pageSize: number,
): Promise<unknown[]> {
  if (!values.length) return [];
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = db.from(spec.table).select("*").in(spec.column, values);
    for (const column of spec.order) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not export ${spec.table}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/**
 * Uses a privileged database client because trusted-memory source tables are
 * intentionally not readable by browser roles. Every query must therefore be
 * explicitly scoped to the authenticated owner, their companions, or sessions.
 */
export async function buildAccountExport(
  db: ExportDatabase,
  user: AccountExportUser,
  pageSize = 1000,
) {
  if (!user.id) throw new Error("An authenticated user is required");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("Invalid export page size");

  const profileSpec = { table: "profiles", column: "id", order: ["id"] };
  const [profile, companions] = await Promise.all([
    selectOwnedRows(db, profileSpec, [user.id], pageSize),
    selectOwnedRows(db, { table: "companions", column: "user_id", order: ["id"] }, [user.id], pageSize),
  ]);
  const companionIds = companions.map((row) => String((row as { id: string }).id));
  const sessions = await selectOwnedRows(db, { table: "chat_sessions", column: "user_id", order: ["id"] }, [user.id], pageSize);
  const sessionIds = sessions.map((row) => String((row as { id: string }).id));

  const directEntries = await Promise.all(
    Object.entries(directQueries).map(async ([key, spec]) => [key, await selectOwnedRows(db, spec, [user.id], pageSize)] as const),
  );
  const companionEntries = await Promise.all(
    Object.entries(companionQueries).map(async ([key, spec]) => [key, await selectOwnedRows(db, spec, companionIds, pageSize)] as const),
  );
  const messages = await selectOwnedRows(
    db,
    { table: "chat_messages", column: "session_id", order: ["id"] },
    sessionIds,
    pageSize,
  );
  const direct = Object.fromEntries(directEntries) as { [K in keyof typeof directQueries]: unknown[] };
  const companionData = Object.fromEntries(companionEntries) as { [K in keyof typeof companionQueries]: unknown[] };

  return {
    format: "amara-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email || null,
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
    },
    data: {
      profile: profile[0] || null,
      ...direct,
      companions,
      chatSessions: sessions,
      chatMessages: messages,
      ...companionData,
    },
    notes: {
      locale: "JSON field names preserve the database schema for portability.",
      exclusions: "Administrator actions, payment webhook logs, internal scheduler state, and authentication credentials are excluded.",
    },
  };
}
