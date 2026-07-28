CREATE TABLE "rooms" (
	"code" varchar(6) PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rooms_updated_at_idx" ON "rooms" USING btree ("updated_at");