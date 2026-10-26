## ADDED Requirements
### Requirement: Owner trace history
The workspace SHALL read trace history through the existing owner-restricted RPCs and paginate by timestamp and ID, with at most 25 rows per page.
#### Scenario: Owner opens history
- **WHEN** an owner opens interaction history
- **THEN** unexpired historical traces are listed with outcome, test key, prompt version and measured duration
- **AND** selecting a row loads its ordered spans and charges on demand
#### Scenario: Permission or lifecycle changes
- **WHEN** the workspace loses owner access or unmounts
- **THEN** trace contents are removed and pending results cannot restore them
#### Scenario: Missing detail or request failure
- **WHEN** detail is missing, expired, inaccessible or a request fails
- **THEN** the UI explains that condition without claiming a successful empty result and offers a return or retry action

### Requirement: Honest process and cost display
The workspace SHALL distinguish executed, reused, skipped, failed and interrupted spans and separately display reserved, estimated and billed USD amounts.
#### Scenario: Historical evaluation is inspected
- **WHEN** a historical evaluation is selected
- **THEN** its ordered nodes, reason codes, timing scope, retention, model usage and costs can be inspected
- **AND** reused steps have no invented duration or new charge
- **AND** null amounts display unknown rather than zero
- **AND** ordinal connections are described as recorded sequence, not inferred dependency
#### Scenario: Responsive inspection
- **WHEN** a user uses a narrow viewport or keyboard
- **THEN** all nodes and details remain reachable without page-level horizontal overflow
- **AND** selection and focus are visibly indicated
