## ADDED Requirements
### Requirement: Verified candidate import
The importer SHALL accept only the bounded completed Gemini preparation whose dataset, source checks, input hashes, embedding profile and vector dimensions match the current verified source artifacts.
#### Scenario: Verified existing preparation
- **WHEN** the operator exports the completed two-document experiment
- **THEN** the export contains stable IDs, 24 or fewer reviewed-page candidate chunks, stored 768-dimensional vectors and a content-addressed receipt
- **AND** no API key, local absolute path, query text or new model request is included
#### Scenario: Altered preparation
- **WHEN** source, vector, profile or content integrity fails
- **THEN** export fails before producing an import package

### Requirement: Atomic unpublished persistence
The database SHALL preserve existing OpenAI profiles, validate each embedding against its profile and input hash, and store the imported sample as sealed candidate content awaiting human review.
#### Scenario: Repeat or conflict
- **WHEN** an identical package is imported again
- **THEN** no duplicate document, chunk or vector is written
- **AND** a conflicting receipt or incomplete transaction cannot silently overwrite content
#### Scenario: Access and publication
- **WHEN** a non-admin or anonymous caller reads candidate content
- **THEN** no candidate content is exposed
- **AND** browser roles cannot perform ingestion writes
- **AND** import does not create a knowledge release, approve content or enable the answer service

### Requirement: Online readiness evidence
The implementation SHALL distinguish live authenticated reads, stored-vector retrieval, model experiments and hosted deployment.
#### Scenario: Real session reads the sample
- **WHEN** the existing owner opens documents or interaction history
- **THEN** the UI renders actual Supabase results and labels candidate status
- **AND** the closeout identifies remaining gates for small online question tests and public rollout
