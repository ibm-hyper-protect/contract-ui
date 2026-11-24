# Personal Secret Store and runtime flow

All roles except Viewer can create and manage their own encrypted secrets and
personal groups. Ownership follows the account, so changing personas does not
create another store. Administrators have no access to other people's entries.
There is no sharing flow, recipient directory or stored-value reveal operation.

Groups pin specific secret versions. The newest complete group revision is
selected initially; older revisions remain selectable. Rotating a catalog secret
never silently changes a saved group or build reference. Groups may contain up to
64 versions; a runtime build permits at most eight requests after expansion.

## Build → Assignments → Runtime secrets

1. The assigned **Environment Operator** selects the destination CCRV runtime:
   protected image source and SHA-256, public SE header and independently obtained
   header digest, permitted destination-machine HKDs and runtime encryption
   certificate. Personal target profiles can be reused. The Manager host is not
   inferred to be the destination.
2. The assigned **Solution Provider** declares logical names, consumers and uses:
   retrievable plain/AES/AES-XTS/HMAC/EC, or Association resource binding.
3. Each assigned **source owner** selects only their own fixed versions or group
   revision, maps them to requirements, and signs approval of that exact target,
   version, type and consumer. Empty approval removes that owner's contributions
   before workload submission. The build shows the actual approving account and
   the server-recorded approval time for each requirement; private aliases remain
   visible only to their owner.
4. The assigned **Auditor** reviews the target's provenance and public certificate
   fingerprints. The trusted worker validates public artifacts with pvsecret.
   The Auditor then triggers preparation after all owner approvals are present.
5. The worker publishes real **UV secret IDs**, which the workload can reference.
   These differ from catalog UUIDs and contract `index-N` labels. Repeating an
   unchanged preparation preserves the stored request bytes and IDs.
6. Workload submission freezes the manifest. The section form automatically uses
   the approved runtime encryption certificate and CCRV Podman Play template and
   validation. The Data Owner's environment retains logging, registry credentials,
   variables and volumes; the Manager adds the approved encrypted requests and
   public `<LOGICAL_NAME>_SECRET_ID` variables automatically, all in the Environment
   section. Its template already includes these IDs. Conflicting IDs are rejected;
   no catalog value is exported as an environment variable. Workload templates
   contain the application definition without generated secret configuration.
7. The existing Auditor finalization and Environment Operator download/receipt
   workflow completes the encrypted contract.

Target, version, consumer or type changes invalidate preparation. After workload
submission create a new build for changes. Revoked identity keys, inactive users,
removed roles/assignments and unavailable sources block further processing.
Legacy unapproved source references must be mapped or removed before submission.

A store role alone does not confer build authority. An Administrator needs an
additional held and assigned workflow role to contribute. Viewer has no store
or secret-binding access. Several users can hold the same workflow role on a build. Each owner still selects only their own private versions; any assigned auditor can perform the next auditor step. This does not create an approval quorum.

## Deployment target field reference

Every field in **Deployment target** has an information button. Hover over it or
focus it with the keyboard for **What to enter** and **Where to get it**. Escape
closes the hint. File-upload hints do not open the file picker.

| Field | Input and source |
| --- | --- |
| Personal target profiles | Choose your own saved revision, or create a new one. Appears after you have saved a target. |
| Target name | Choose a recognizable destination label yourself. |
| CCRV runtime version | Protected runtime release version from the runtime provider’s release notes or image metadata. |
| Protected runtime image source | Trusted release URL or artifact reference supplied by the runtime provider or destination operator. This identifies the protected boot image. |
| Runtime image SHA-256 | Expected checksum of that exact boot image from a trusted release manifest; verify the image file against it. Accepts 64 lowercase hexadecimal characters with an optional `sha256:` prefix. |
| Public SE header | Public Secure Execution header from that exact runtime image, supplied by the runtime provider or destination platform operator; at most 64 KiB. |
| Expected SE-header SHA-256 | Independently trusted expected header checksum from the provider or a separate trusted channel; 64 lowercase hexadecimal characters without a prefix. Merely hashing an untrusted upload does not verify provenance. |
| Permitted destination-machine HKDs | 1–16 current public host key documents from the destination hardware administrator. Name files `HKD-MODEL-PLANTSERIAL.crt` (also `.cer`/`.pem`); preserve both certificates in hybrid documents. |
| Runtime contract-encryption certificate | Current public PEM certificate distributed for the selected runtime release. HKDs and logging certificates have different purposes. Never upload private keys. |
| Execution mode | Choose Native for real target artifacts or explicit development simulation for the software flow. Simulation also requires worker opt-in. Native artifact preparation does not demonstrate hardware Add/Retrieve support. |
| Target capability report (optional JSON) | Destination-guest observations supplied by its operator: `add`, `list`, `lock`, `retrieve`, `secret_types`, `recorded_at` (RFC 3339), `evidence`. Native reports must be no older than seven days at preparation. An absent report leaves hardware support unverified; an operator report is not hardware attestation. |

The platform is currently fixed to CCRV. Use artifacts for the actual destination,
even when the Manager runs on a different machine. Uploads contain public
artifacts; secret values belong in the personal Secret Store.

## Security and runtime support

The Electron main process seals values using fresh AES-256-GCM keys wrapped with
the pinned worker RSA-4096 key. The renderer implements no cryptography. File
imports are read by the main process; binary bytes and whitespace are preserved.
The desktop requires explicit fingerprint trust and HTTPS or a loopback tunnel.
Existing OS credential-store failures remain fail-closed.

Native preparation requires current verified HKDs and worker-side host-key trust/CRLs.
Creating a request offline is not proof that destination hardware accepted it.
Known unsupported target capabilities are rejected; missing hardware evidence is
shown as **Not tested on target**. `SIMULATION` requires an explicit target choice
and explicit worker opt-in, and remains visibly marked as development use.
No native failure silently falls back to software.

The tested Z16 cannot perform retrievable Add/Retrieve. A compatible guest kernel,
Ultravisor and runtime are needed for native operation. The optional
`secret-consumer` helper refuses unsupported native retrieval and can deliver a
pinned retrievable value to workload memory over a private Unix socket. The UV
store is per guest; socket/device isolation must be configured for each consumer.
Association secrets are external-resource bindings, not plaintext retrieval.

See the Manager's [runtime flow guide](https://github.com/ibm-hyper-protect/contract-manager/blob/main/docs/secret-flow.md)
for migration 022 (multiple assignees) and migrations 023–025 (secrets), worker configuration, the pinned contract-go dependency,
API/error codes and deployment prerequisites. This feature does not add direct
cloud/on-premise deployment connectors.
