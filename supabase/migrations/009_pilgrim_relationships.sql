-- =============================================
-- Migration 009: Pilgrim Relationships and Mahram
-- =============================================

-- Add relationship_type and is_mahram fields to pilgrims table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pilgrims') THEN
    -- Add relationship_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pilgrims' AND column_name = 'relationship_type') THEN
      ALTER TABLE pilgrims 
        ADD COLUMN relationship_type TEXT CHECK (relationship_type IN ('family', 'married', 'friends')) DEFAULT 'family';
    END IF;
    
    -- Add is_mahram column (indicates if this pilgrim can share room with opposite gender in mixed groups)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pilgrims' AND column_name = 'is_mahram') THEN
      ALTER TABLE pilgrims 
        ADD COLUMN is_mahram BOOLEAN DEFAULT false;
    END IF;
    
    -- Add index for relationship_type for better query performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pilgrims_relationship_type') THEN
      CREATE INDEX idx_pilgrims_relationship_type ON pilgrims(relationship_type);
    END IF;
    
    -- Add index for is_mahram
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pilgrims_is_mahram') THEN
      CREATE INDEX idx_pilgrims_is_mahram ON pilgrims(is_mahram);
    END IF;
  END IF;
END $$;
