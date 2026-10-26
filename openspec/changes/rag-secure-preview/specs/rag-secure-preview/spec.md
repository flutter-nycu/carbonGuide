## ADDED Requirements
### Requirement: Preview upload excludes local sensitive artifacts
The release SHALL contain reviewed source and synthetic fixtures only. Environment secrets, local evidence, screenshots and raw RAG documents SHALL NOT be committed or uploaded. Browser bundles SHALL contain only approved public connection values.
#### Scenario: Artifact contains a server key
- **WHEN** the release or built-output scan finds a server credential or forbidden artifact
- **THEN** the deployment SHALL stop until the artifact is excluded or the leak is corrected
### Requirement: Hosting preserves authorization and consumption limits
Preview SHALL remain protected by Vercel Authentication. Supabase SHALL independently require the existing owner before allocating model budget. The deployment SHALL NOT raise or reset the current pilot quota or enable public RAG.
#### Scenario: Unauthenticated visitor attempts a paid request
- **WHEN** a visitor without valid authorization calls the model endpoint directly
- **THEN** access is rejected before model invocation or reservation
### Requirement: Verification targets the deployed artifact
The deployment SHALL be identified by its commit and Preview URL. Hosted authentication, response headers and output boundaries SHALL be checked. Existing local or mocked checks SHALL NOT be reported as authenticated hosted acceptance.
#### Scenario: OAuth requires user interaction
- **WHEN** the hosted flow reaches an authentication step the agent cannot complete
- **THEN** the agent SHALL preserve deployment protection, give the exact handoff, and report authenticated validation as pending
