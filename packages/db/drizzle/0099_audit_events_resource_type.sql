-- A trail read by resource_type alone (the Audit page offers the type
-- without an id) had no index that ended in the listing's order: the first
-- page walked every newer row of the tenant looking for the type, and a later
-- one sorted all the type's rows. This one ends in (occurred_at, id) like the
-- other filters' do, so a page stops at LIMIT whatever the type's share.
CREATE INDEX audit_events_resource_type
  ON audit_events (tenant_id, resource_type, occurred_at DESC, id DESC);
