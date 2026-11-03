# Security Specification & Verification

## 1. Data Invariants
- Users can only read and write their own profile document (`/users/{userId}` where `userId == request.auth.uid`).
- Users cannot elevate their own role to 'admin' upon registration or update.
- Documents (`/documents/{documentId}`) can only be created with `ownerId == request.auth.uid`, and only the owner can read, update, or delete their document.
- Document ownership (`ownerId`) and creation timestamp (`createdAt`) are immutable after document creation.
- Activity logs (`/activity_logs/{logId}`) can be written by authenticated users where `incoming().userId == request.auth.uid`, or by guests with `incoming().userId == 'anonymous'`. Activity logs are append-only (cannot be updated or deleted by normal users).
- Traffic stats (`/traffic_stats/{statId}`) can be read by authenticated users for analytics dashboard view, and updated/incremented by verified app sessions.
- Default-deny catch-all rule exists for all unmatched collections and subpaths.

## 2. The "Dirty Dozen" Threat Payloads
1. **User Profile Hijack**: Creating `/users/{otherUid}` with `request.auth.uid != otherUid` -> EXPECT DENIED.
2. **Privilege Escalation**: Normal user updating their profile with `role: "admin"` -> EXPECT DENIED.
3. **Ghost Fields Injection**: Sending user document with unexpected shadow fields `isVip: true` -> EXPECT DENIED.
4. **Document Theft / Spoofed Owner**: Creating `/documents/doc123` with `ownerId: "someone_else"` -> EXPECT DENIED.
5. **Document Ownership Reassignment**: Updating an existing document with a changed `ownerId` -> EXPECT DENIED.
6. **Cross-User Document Read**: User B reading `/documents/doc123` belonging to User A -> EXPECT DENIED.
7. **Cross-User Document Delete**: User B deleting `/documents/doc123` belonging to User A -> EXPECT DENIED.
8. **Malicious Oversized Document ID**: Injecting path with > 128 characters or special characters in `{documentId}` -> EXPECT DENIED.
9. **Tampered Log Author**: Authenticated User submitting activity log with another user's UID -> EXPECT DENIED.
10. **Activity Log Mutation**: Attempting to update or tamper with an existing `/activity_logs/{logId}` entry -> EXPECT DENIED.
11. **Activity Log Deletion**: Attempting to delete activity logs to cover tracks -> EXPECT DENIED.
12. **Blanket Query Scraping**: Attempting an unconstrained collection list query on `/documents` without filtering by `ownerId == request.auth.uid` -> EXPECT DENIED.
