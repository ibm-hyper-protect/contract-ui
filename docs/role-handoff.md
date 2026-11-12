# Build role handoff

Build progress offers Continue as the next required role only when your account has that role and a matching assignment on this build. The action refreshes the build stage and assignments before switching, preserves the open build and selects its next-step tab. The normal header role selector retains its existing navigation behavior.

This is a navigation shortcut, not a permission grant. Another user’s assignment, an administrator role alone, unknown/legacy/terminal stages or failed assignment checks do not enable a handoff. Server-side authorization still decides whether a subsequent submission is permitted.
