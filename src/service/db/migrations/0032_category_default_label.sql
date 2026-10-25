-- Preserve legacy Category defaults and authored labels; fresh folder-first
-- sources select the localized Status default without storing authored text.
ALTER TABLE category_properties ADD COLUMN default_label TEXT NOT NULL DEFAULT 'category'
  CHECK (default_label IN ('category', 'status'));
