# Device identity keys

Requires the multi-key backend API from [contract-manager PR #11](https://github.com/ibm-hyper-protect/contract-manager/pull/11), including owner key-history access during account setup. Deploy the backend and migration 021 before this UI. Older servers do not expose the required key-history routes; failures are displayed rather than interpreted as an empty account.

## First device

1. Log in and complete the required password change.
2. Open **Account Settings → Device keys** and select **Register device key**.
3. Optionally name the device and register its generated key. The private key is saved locally before the server request and activated only after its registration is confirmed in server history.

The first-ever registration needs no password confirmation. Any later registration, including recovery after all keys expire or are revoked, requires the current account password. If an active key exists, it must also authorize the request. The server enforces at most five active keys, each valid for 90 days.

## Another device

1. On a trusted device with an active key, choose **Export encrypted backup**. Use a separate passphrase of at least 12 characters.
2. Transfer the encrypted JSON file securely and communicate its passphrase separately. Anyone with both can use the key.
3. On the new device, log in to the same account and choose **Import backup**. Only a key confirmed active for that account can become the local signing key.
4. Register a new device key, confirming the current account password. The imported key authorizes registration, and this device then switches to its new key. The source device keeps its existing key.
5. Remove the transferred backup when it is no longer needed. Export a fresh backup of the new device key if your recovery policy calls for one.

If no trusted device or valid backup remains while the server still has active keys, an administrator must use **Users → Revoke All Active Keys** before recovery. This removes signing access from every device. Afterward, log in and register a new key with password confirmation.

## Replacement, revocation, and history

Registering a replacement does not revoke previous keys. Confirm the new key works, then revoke the old key explicitly to release its slot. **This device** identifies the locally selected key, which may be older than the account's newest key. A stored, active historical key can be selected with **Use on this device**.

Owners and administrators can view key history and revoke individual keys. Administrators cannot register keys on behalf of another account. Expired and revoked keys remain visible, and revocation does not invalidate historical audit signatures. The credential dashboard lists individual expired keys separately from accounts without any active key.

## Interrupted registration

A generated candidate is persisted without replacing the current key. A failed password check or request leaves both available. If the response is lost after server registration, **Refresh** or the next session recovers the candidate from server history. An unregistered candidate can be discarded only after a successful server check. Do not delete local key files to recover from a transient error.

New identity-key state uses Electron `safeStorage` and atomic files with owner-only permissions. An operating system credential store must be available; Linux's `basic_text` fallback is rejected. Existing single-key files are read and migrated without changing the key or its fingerprint; the original legacy file is retained for recovery. New private identity keys and imported backups stay in the main process. Backups use scrypt (N=32768, r=8, p=1) and AES-256-GCM.

Every signed HTTP request identifies the actual local key. Download receipts and section signatures pin their HTTP request to the same key, even if another operation changes the selected device key in the meantime.

## Verification

```bash
npm test
npm run build
```

The Node tests use temporary files and mocked Electron storage/dialog APIs, plus the real RSA-PSS, fingerprint, scrypt, and AES-GCM implementations. They cover legacy migration, durable candidates, atomic-write failures, encrypted backup round trips and tampering, request fingerprint selection, conditional registration, password failure, response-loss recovery, key limits, account versus device readiness, and receipt/request key consistency. They do not use real account keys or a production database.
