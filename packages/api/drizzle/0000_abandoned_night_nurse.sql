CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" text[] DEFAULT '{}',
	"mood" text,
	"people" text[] DEFAULT '{}',
	"embedding" vector(1536),
	"media" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX "entries_created_at_idx" ON "entries" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "entries_tags_idx" ON "entries" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "entries_people_idx" ON "entries" USING gin ("people");--> statement-breakpoint
CREATE INDEX "entries_fts_idx" ON "entries" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || "content"));--> statement-breakpoint
CREATE INDEX "entries_embedding_idx" ON "entries" USING hnsw ("embedding" vector_cosine_ops);