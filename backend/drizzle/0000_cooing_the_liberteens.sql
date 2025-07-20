CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default_user' NOT NULL,
	"message" text NOT NULL,
	"response" text NOT NULL,
	"message_embedding" vector(384),
	"entities" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memory_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default_user' NOT NULL,
	"summary" text NOT NULL,
	"conversation_count" serial NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
