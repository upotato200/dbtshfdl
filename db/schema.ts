import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const rooms = pgTable(
  "rooms",
  {
    code: varchar("code", { length: 6 }).primaryKey(),
    state: jsonb("state").notNull(),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("rooms_updated_at_idx").on(table.updatedAt)],
);
