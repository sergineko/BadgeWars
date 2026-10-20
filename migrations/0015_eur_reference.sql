-- Preserve historical fixed-currency topups; new purchases use one EUR product.
ALTER TABLE bw_topups ADD COLUMN pricing_model TEXT NOT NULL DEFAULT 'fixed' CHECK(pricing_model IN('fixed','eur_fx_v1'));
ALTER TABLE bw_orders ADD COLUMN charged_currency TEXT;
ALTER TABLE bw_orders ADD COLUMN charged_total INTEGER;
ALTER TABLE bw_orders ADD COLUMN charged_tax INTEGER;
ALTER TABLE bw_orders ADD COLUMN refund_basis_currency TEXT;
ALTER TABLE bw_orders ADD COLUMN refund_basis_total INTEGER;
CREATE TRIGGER bw_topup_pricing_identity BEFORE UPDATE OF pricing_model ON bw_topups
WHEN NEW.pricing_model<>OLD.pricing_model BEGIN SELECT RAISE(ABORT,'immutable_topup_pricing'); END;
