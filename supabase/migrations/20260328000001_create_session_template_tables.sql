-- =============================================================================
-- Migration: Create Session Template Tables
-- Description: Session templates, activity groups, and activities for
--              structured workout programming. Also adds the deferred FK
--              from workout_logs.session_template_id to session_templates.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. session_templates
--    A reusable workout template that prescribes activities and structure.
--    Invariant: name must be 1-200 characters.
-- ---------------------------------------------------------------------------
CREATE TABLE session_templates (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    name                TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description         TEXT,
    category            TEXT        NOT NULL CHECK (category IN (
                            'STRENGTH', 'CONDITIONING', 'SE', 'MIXED'
                        )),
    rest_between_groups JSONB,
    time_cap            JSONB,
    scoring             TEXT        NOT NULL DEFAULT 'NONE' CHECK (scoring IN (
                            'NONE', 'FOR_TIME', 'TIME', 'FOR_REPS',
                            'ROUNDS_PLUS_REPS', 'FOR_DISTANCE', 'LOAD'
                        )),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_templates IS 'Reusable workout templates prescribing structure and activities.';
COMMENT ON COLUMN session_templates.user_id IS 'Owning user. All templates are user-scoped.';
COMMENT ON COLUMN session_templates.category IS 'Template category: STRENGTH, CONDITIONING, SE (strength-endurance), or MIXED.';
COMMENT ON COLUMN session_templates.rest_between_groups IS 'JSONB Duration object: {"seconds": number}. Rest between activity groups.';
COMMENT ON COLUMN session_templates.time_cap IS 'JSONB Duration object: {"seconds": number}. Overall session time cap.';
COMMENT ON COLUMN session_templates.scoring IS 'Scoring mode for the session (e.g. FOR_TIME, FOR_REPS). Defaults to NONE.';

-- ---------------------------------------------------------------------------
-- 2. activity_groups
--    Ordered groups of activities within a session template (superset,
--    circuit, etc.). Ordinal is unique per template.
-- ---------------------------------------------------------------------------
CREATE TABLE activity_groups (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_template_id     UUID        NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
    group_type              TEXT        NOT NULL CHECK (group_type IN (
                                'STRAIGHT_SETS', 'SUPERSET', 'CIRCUIT', 'COMPLEX',
                                'EMOM', 'AMRAP', 'COUPLET'
                            )),
    ordinal                 INTEGER     NOT NULL CHECK (ordinal >= 1),
    rounds                  INTEGER     CHECK (rounds IS NULL OR rounds >= 1),
    rest_between_rounds     JSONB,
    rest_between_activities JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_template_id, ordinal)
);

COMMENT ON TABLE activity_groups IS 'Ordered groups of activities within a session template.';
COMMENT ON COLUMN activity_groups.group_type IS 'Structure type: STRAIGHT_SETS, SUPERSET, CIRCUIT, COMPLEX, EMOM, AMRAP, or COUPLET.';
COMMENT ON COLUMN activity_groups.ordinal IS 'Display/execution order within the session template. Unique per template.';
COMMENT ON COLUMN activity_groups.rounds IS 'Number of rounds for the group. NULL means single pass.';
COMMENT ON COLUMN activity_groups.rest_between_rounds IS 'JSONB Duration object: {"seconds": number}. Rest between rounds.';
COMMENT ON COLUMN activity_groups.rest_between_activities IS 'JSONB Duration object: {"seconds": number}. Rest between activities within the group.';

-- ---------------------------------------------------------------------------
-- 3. activities
--    Individual exercises within an activity group, each with a prescribed
--    set scheme stored as JSONB (discriminated union).
-- ---------------------------------------------------------------------------
CREATE TABLE activities (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_group_id   UUID        NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE,
    exercise_id         UUID        NOT NULL REFERENCES exercises(id),
    ordinal             INTEGER     NOT NULL CHECK (ordinal >= 1),
    set_scheme          JSONB       NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_group_id, ordinal)
);

COMMENT ON TABLE activities IS 'Prescribed exercises within an activity group, each with a JSONB set scheme.';
COMMENT ON COLUMN activities.exercise_id IS 'References exercises table. The exercise prescribed for this activity.';
COMMENT ON COLUMN activities.ordinal IS 'Display/execution order within the activity group. Unique per group.';
COMMENT ON COLUMN activities.set_scheme IS 'JSONB discriminated union of SetScheme types (FixedSets, PercentageSets, etc.).';
COMMENT ON COLUMN activities.notes IS 'Optional coaching notes or cues for this activity.';

-- ---------------------------------------------------------------------------
-- 4. Add deferred FK: workout_logs.session_template_id -> session_templates
--    This constraint was deferred in Phase 0 because session_templates did
--    not exist yet.
-- ---------------------------------------------------------------------------
ALTER TABLE workout_logs
    ADD CONSTRAINT workout_logs_session_template_fk
    FOREIGN KEY (session_template_id) REFERENCES session_templates(id);

-- ---------------------------------------------------------------------------
-- 5. Indices
-- ---------------------------------------------------------------------------
CREATE INDEX idx_session_templates_user ON session_templates(user_id);
CREATE INDEX idx_activity_groups_template ON activity_groups(session_template_id);
CREATE INDEX idx_activities_group ON activities(activity_group_id);
CREATE INDEX idx_activities_exercise ON activities(exercise_id);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------

-- session_templates: direct user_id check
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_templates_select"
    ON session_templates FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "session_templates_insert"
    ON session_templates FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_templates_update"
    ON session_templates FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "session_templates_delete"
    ON session_templates FOR DELETE
    USING (user_id = auth.uid());

-- activity_groups: ownership validated via join to session_templates
ALTER TABLE activity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_groups_select"
    ON activity_groups FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM session_templates
        WHERE session_templates.id = activity_groups.session_template_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activity_groups_insert"
    ON activity_groups FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM session_templates
        WHERE session_templates.id = activity_groups.session_template_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activity_groups_update"
    ON activity_groups FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM session_templates
        WHERE session_templates.id = activity_groups.session_template_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activity_groups_delete"
    ON activity_groups FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM session_templates
        WHERE session_templates.id = activity_groups.session_template_id
          AND session_templates.user_id = auth.uid()
    ));

-- activities: ownership validated via join through activity_groups -> session_templates
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select"
    ON activities FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM activity_groups
        JOIN session_templates ON session_templates.id = activity_groups.session_template_id
        WHERE activity_groups.id = activities.activity_group_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activities_insert"
    ON activities FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM activity_groups
        JOIN session_templates ON session_templates.id = activity_groups.session_template_id
        WHERE activity_groups.id = activities.activity_group_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activities_update"
    ON activities FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM activity_groups
        JOIN session_templates ON session_templates.id = activity_groups.session_template_id
        WHERE activity_groups.id = activities.activity_group_id
          AND session_templates.user_id = auth.uid()
    ));

CREATE POLICY "activities_delete"
    ON activities FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM activity_groups
        JOIN session_templates ON session_templates.id = activity_groups.session_template_id
        WHERE activity_groups.id = activities.activity_group_id
          AND session_templates.user_id = auth.uid()
    ));

-- ---------------------------------------------------------------------------
-- 7. Triggers: automatic updated_at
--    Reuses the update_updated_at_column() function from migration 0004.
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON session_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON activity_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
