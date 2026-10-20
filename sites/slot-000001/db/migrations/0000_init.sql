-- Meridian Studio (slot 1) — initial schema.
-- Every object is created inside this slot's own PostgreSQL schema.
CREATE SCHEMA IF NOT EXISTS "slot_000001";

CREATE TABLE IF NOT EXISTS "slot_000001"."messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(80) NOT NULL,
  "email" varchar(120),
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
