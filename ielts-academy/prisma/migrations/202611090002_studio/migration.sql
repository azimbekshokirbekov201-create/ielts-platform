-- Additive indexes only. Existing content without access_tier remains free.
-- Domain structures use the existing validated Entity(kind,id,data) model.
CREATE UNIQUE INDEX "promo_lookup_unique" ON "Entity"(json_extract("data",'$.lookup')) WHERE "kind"='promo_codes';
CREATE INDEX "subscription_user" ON "Entity"(json_extract("data",'$.user_id')) WHERE "kind"='subscriptions';
CREATE INDEX "content_creator" ON "Entity"(json_extract("data",'$.creator_id'));
