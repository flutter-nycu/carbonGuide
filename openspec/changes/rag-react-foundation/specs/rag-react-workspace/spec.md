## ADDED Requirements

### Requirement: Native React workspace
The workspace SHALL render seven RAG screens as React components within the authenticated admin dashboard.

#### Scenario: Navigate and return
- **WHEN** an administrator switches between RAG and push workspaces
- **THEN** React draft state is preserved until logout and the legacy DOM renderer is not mounted

### Requirement: Explicit test environment
RAG data access SHALL require explicit opt-in configuration matching the user-approved Supabase project.

#### Scenario: Missing or mismatched configuration
- **WHEN** RAG configuration is missing or mismatched
- **THEN** no RAG API request is sent and configuration guidance is displayed

### Requirement: Honest data and lifecycle states
Each screen SHALL display loading, empty, error, and role-appropriate states and SHALL NOT fabricate backend results.

#### Scenario: Backend capability is deferred
- **WHEN** a user visits trial questions or releases before those services exist
- **THEN** the page explains the next phase and does not simulate answers, evaluation passes, publication, or rollback

### Requirement: Persist editable drafts
Editors SHALL be able to persist QA, personas, and prompts; owners SHALL be able to save draft RAG settings subject to database authorization.

#### Scenario: Save fails
- **WHEN** the backend rejects a write
- **THEN** the entered draft remains available and an error is shown without claiming success
