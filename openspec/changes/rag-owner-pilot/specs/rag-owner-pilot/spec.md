## ADDED Requirements
### Requirement: Owner pilot remains bounded and isolated
Only the existing owner SHALL submit a pilot question. The pilot SHALL expire and use at most three reserved requests at USD 0.03 each. It SHALL use a pinned immutable candidate receipt, without enabling the public service or creating a release.
#### Scenario: Duplicate or concurrent request
- **WHEN** a request UUID is repeated or concurrent attempts race
- **THEN** only one reservation may be created and only its first accepted execution may call a model
- **AND** mismatched request content is rejected; terminal or uncertain requests are never automatically retried
### Requirement: Each model call is journaled before sending
The service SHALL persist the executed step and fee reservation before external requests, record provider-reported usage when available, and distinguish unknown bills from zero. A crash SHALL leave inspectable metadata and keep the reservation.
#### Scenario: Provider or persistence failure
- **WHEN** a model request or its journal completion fails
- **THEN** the service returns a safe failure, never automatically retries, and does not erase the reservation or falsely claim zero cost
### Requirement: Only validated candidate evidence is returned
Questions SHALL be bounded UTF-8 text. Provider outputs SHALL match the answer contract and citations SHALL reference retrieved chunks with verifiable quotes. Source text and model text SHALL be treated as untrusted text.
#### Scenario: Citation invented by model
- **WHEN** a model returns an unknown chunk or a quote absent from the evidence
- **THEN** the answer is withheld and the validation failure is recorded
### Requirement: Real reads and transient answer have honest scope
The owner UI SHALL show actual progress, evidence and cost basis; raw questions/answers SHALL NOT be persisted by this feature. History SHALL hide expired metadata. Fresh OAuth, hosted Preview and publication SHALL NOT be claimed without evidence.
#### Scenario: Response lost after completion
- **WHEN** a client does not receive the response
- **THEN** it can inspect the same request's metadata without another paid call and is told that the answer was not stored
