---
status: accepted
---

# Track local folders without permanent identity markers

For the first local release, associate application project records with folders using paths and native filesystem identity, without adding permanent project-ID files to the folders. This preserves project folder contents but limits automatic recognition after operations that change filesystem identity, so ambiguous matches retain metadata and support manual reassociation.

Logical project records remain distinct from their filesystem locators. An unavailable root is a source-level state, not proof that its projects were deleted. Cross-computer replica identity requires a separate design before shared-folder collaboration; native filesystem IDs are not assumed portable across machines.
