-- Optional sample rows for local development.
INSERT INTO "slot_000001"."messages" ("name", "email", "message") VALUES
  ('Ada Reyes', 'ada@example.com', 'We would like to talk about a courtyard house in Marfa.'),
  ('Jonas Lindqvist', NULL, 'Is the studio taking on small gallery retrofits this year?')
ON CONFLICT DO NOTHING;
