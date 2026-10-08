---
status: accepted
---

# Separate the local database from shared-folder exchange

Each computer keeps its working database locally; opt-in collaboration exchanges logical changes and reconstructable snapshots through a hidden folder delivered by an external synchronization service or network share. Participants can edit independently, so compatible edits merge and conflicting same-field alternatives are retained for review rather than silently overwritten.

This costs an application-level merge and recovery protocol, but avoids treating a live SQLite file as a multi-computer synchronization format. The protocol, conflict representation, compaction and identity model remain open; Automerge is a candidate, not an adopted dependency. A remotely hosted service is a separate later capability.
