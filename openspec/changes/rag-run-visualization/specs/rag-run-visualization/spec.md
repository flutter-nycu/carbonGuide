## ADDED Requirements

### Requirement: Inspect each execution path
The RAG workspace SHALL link every application query, manual test and evaluation question to an authorized execution detail with trace identity, version context, observed steps, outcomes and elapsed time.

#### Scenario: A branch is skipped or reused
- **WHEN** a request bypasses generation or reuses prior retrieval
- **THEN** the UI shows skipped or reused nodes with a reason and does not invent durations, model requests or incurred charges

### Requirement: Transparent cost provenance
The UI SHALL distinguish observed provider usage, versioned monetary estimates, preflight reservations, unknown costs and reconciled billing. Shared preparation costs SHALL not be duplicated on each question or double-counted in parent and child spans.

#### Scenario: Provider usage or billing is unavailable
- **WHEN** a node has no usage or billing response
- **THEN** its cost is shown as unknown or estimated with provenance, never as confirmed zero or a confirmed charge

### Requirement: Safe diagnostic visibility
Authorized administrators SHALL inspect bounded redacted source/citation and error summaries without credentials, authorization headers, hidden model reasoning or unrestricted raw personal conversation exports.

#### Scenario: Generation or validation fails
- **WHEN** a provider request or citation check fails
- **THEN** the trace preserves the failed step and error code, and any manual retry is a separately identifiable attempt

### Requirement: Accessible execution detail
The workspace SHALL provide keyboard accessible node details and a chronological text view, including a mobile layout, without relying on color alone to communicate outcomes.

#### Scenario: The flow cannot fit a mobile screen
- **WHEN** the user opens execution detail on a narrow viewport
- **THEN** a vertical step list preserves order, state, timing and cost access
