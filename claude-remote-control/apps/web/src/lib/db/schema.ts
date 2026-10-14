import { pgTable, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Custom table for agent connections (in public schema)
// Auth tables (user, session, account) are managed by Neon Auth in neon_auth schema
export const agentConnection = pgTable(
  'agent_connection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // References neon_auth.user.id
    machineId: text('machine_id'), // Agent's machine UUID for push notifications lookup
    url: text('url').notNull(),
    name: text('name').notNull(),
    method: text('method').notNull().default('tailscale'),
    isCloud: boolean('is_cloud').default(false),
    cloudAgentId: text('cloud_agent_id'),
    color: text('color'), // Hex color code, e.g. '#f97316'
    authToken: text('auth_token'), // Bearer token the agent requires (entered by the user)
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_agent_connection_user').on(table.userId),
    index('idx_agent_connection_machine').on(table.machineId),
  ]
);

export type AgentConnection = typeof agentConnection.$inferSelect;
export type NewAgentConnection = typeof agentConnection.$inferInsert;

// User settings table for storing encrypted API keys and preferences
// Used for voice input (Groq API key) and other user-specific settings
export const userSettings = pgTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // References neon_auth.user.id
    key: text('key').notNull(), // Setting key (e.g., 'groq-api-key', 'voice-preferences')
    value: text('value').notNull(), // Encrypted value for sensitive data
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_user_settings_user').on(table.userId),
    uniqueIndex('idx_user_settings_user_key').on(table.userId, table.key),
  ]
);

export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;

// Push notification subscriptions for PWA background notifications
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // References neon_auth.user.id
    endpoint: text('endpoint').notNull(), // Push service endpoint URL
    p256dh: text('p256dh').notNull(), // Public key for encryption
    auth: text('auth').notNull(), // Auth secret
    userAgent: text('user_agent'), // Browser/device info
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_push_subscription_user').on(table.userId),
    uniqueIndex('idx_push_subscription_endpoint').on(table.endpoint),
  ]
);

export type PushSubscription = typeof pushSubscription.$inferSelect;
export type NewPushSubscription = typeof pushSubscription.$inferInsert;
