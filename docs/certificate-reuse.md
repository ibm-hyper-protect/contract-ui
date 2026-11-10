# Public runtime certificate reuse

After selecting a trusted custom certificate, choose Remember selected certificate for this build. In a later section, inspect its subject, expiry and SHA-256 fingerprint, then explicitly choose Use remembered certificate. Manual upload remains available.

Only public X.509 certificate material is retained, in memory for at most 20 builds. Choices are scoped to backend, account and build and cleared on logout, token change or backend change. They do not survive an app restart and are not shared with another user or device.

Electron main parses the certificate, computes its fingerprint and checks current validity and RSA key size before remembering or using it. This does not establish trust in an uploaded certificate; obtain it from your trusted runtime provider and match its platform/version. A fingerprint identifies content, not authenticity. Backend validation, signed requests, role assignments and encryption behavior remain unchanged. No private keys, section encryption secrets or passphrases are cached by this feature.
