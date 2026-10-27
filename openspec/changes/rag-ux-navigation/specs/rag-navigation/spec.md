## ADDED Requirements

### Requirement: Visible detail navigation
Selecting an item SHALL expose its detail in the current viewport without requiring scrolling past the list. Detail SHALL have an accessible name, keyboard dismissal, a persistent close control and return focus to the originating control without losing list position.

#### Scenario: Inspect a document in a long list
- **WHEN** an administrator opens a document from a long result list
- **THEN** its title, version selector and content are displayed in a scrollable dialog
- **AND** closing restores the original list position and control focus

### Requirement: Readable saved interactions
Owner interaction history SHALL include versioned requests and display their stored question and answer, citations, processing outcome and recorded costs. Reading history SHALL NOT create a model call or consume a question quota.

#### Scenario: Open a completed v1 question
- **WHEN** the owner opens a saved answered request
- **THEN** the stored question and response are visible with the original trace and costs
- **AND** the request is not resubmitted

#### Scenario: Details expired or unavailable
- **WHEN** retained metadata has no readable question/answer detail
- **THEN** the UI explains the missing or expired content without inventing it

#### Scenario: Unauthorized role
- **WHEN** an editor or viewer visits private interaction history
- **THEN** no private request list or detail is loaded

#### Scenario: Rapid selection or dismissal
- **WHEN** a user changes or closes a detail while its read is pending
- **THEN** the late result does not replace another selection or reopen the closed detail
