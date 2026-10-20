-- Applied ONLY in qqehtphbpypcmxliaiqd. Never a Production migration.
CREATE TABLE security_compat.order_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES security_compat.orders(id),
 actor_id uuid NOT NULL,
 status text NOT NULL CHECK(status='shipped'),
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,status)
);
ALTER TABLE security_compat.order_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON security_compat.order_status_history FROM PUBLIC,anon,authenticated,service_role;
