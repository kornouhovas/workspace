---
status: accepted
---

# Run product policy in a separate local backend

Desktop launches a separate TypeScript backend process that owns SQLite and product rules, while React presents the interface through typed service contracts. This follows the selected bb service separation and creates a boundary reusable by later clients, at the cost of process supervision, IPC/transport and failure recovery compared with keeping all backend code in Electron main.

The first release remains local-only. Remote exposure requires a separate authenticated mode; a separate process by itself does not grant network access or settle the transport protocol.
