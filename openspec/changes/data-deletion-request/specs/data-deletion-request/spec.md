## ADDED Requirements

### Requirement: Public data deletion request
The support page SHALL provide a `delete-data` anchor and instructions to request deletion while retaining an account using the registered email, the existing support mailbox, and the subject 「CarbonGuide 資料刪除申請」. It SHALL state deletion scope, retained data, processing and retention periods, and that passwords are unnecessary. The privacy policy SHALL link to this flow.

#### Scenario: User retains account
- **WHEN** a user opens `/support.html#delete-data`
- **THEN** they can find the email request process and specify the data to delete and their intent to retain the account without logging in
