# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

We recommend always using the latest release to ensure you have the latest security updates.

## Reporting a Vulnerability

The `contract-ui` team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### Please DO NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Instead, Please:

**Report security vulnerabilities via GitHub Security Advisories:**

1. Go to the [Security tab](https://github.com/ibm-hyper-protect/contract-ui/security) of this repository
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

**Or, report via email:**

Contact the Security maintainers listed in [MAINTAINERS.md](MAINTAINERS.md) directly with details about the vulnerability.

### What to Include in Your Report

To help us understand and address the issue quickly, please include:

- **Description** — A clear description of the vulnerability
- **Impact** — What an attacker could achieve by exploiting this vulnerability
- **Reproduction Steps** — Detailed steps to reproduce the issue
- **Affected Versions** — Which versions of the application are affected
- **Proposed Fix** — If you have suggestions for how to fix the issue (optional)
- **Your Contact Information** — So we can follow up with questions

### What to Expect

When you report a security vulnerability, here's what will happen:

1. **Acknowledgment** — We will acknowledge receipt of your vulnerability report within 3 business days

2. **Initial Assessment** — We will investigate and confirm the vulnerability within 5 business days

3. **Updates** — We will keep you informed about our progress addressing the issue

4. **Fix Development** — We will develop and test a fix for the vulnerability

5. **Release** — We will:
   - Release a patched version
   - Publish a security advisory
   - Credit you for the discovery (unless you prefer to remain anonymous)

### Timeline

We aim to:

- Acknowledge reports within **3 business days**
- Provide an initial assessment within **5 business days**
- Release a fix within **30 days** for high-severity issues
- Release a fix within **90 days** for medium/low-severity issues

These timelines may vary depending on the complexity of the issue.

## Security Best Practices

When using `contract-ui`, we recommend:

### For End Users

1. **Keep Updated**
   - Regularly update to the latest version of `contract-ui`
   - Monitor security advisories for this project

2. **Protect Sensitive Data**
   - Never commit private keys, certificates, or credentials to version control
   - Use the application's built-in secure key storage mechanisms
   - Ensure encryption certificates are obtained from trusted sources

3. **Application Integrity**
   - Download application binaries only from official GitHub releases
   - Verify SHA256 checksums of downloaded packages where provided

4. **Network Security**
   - Use HTTPS when connecting to the contract API backend
   - Do not disable certificate validation in any environment

5. **Key Management**
   - Store private keys with appropriate file-system permissions (`chmod 600`)
   - Regularly rotate credentials via the built-in Credential Rotation feature
   - Never share or export private keys over insecure channels

### For Contributors

1. **Code Review**
   - All code changes require review before merging
   - Pay special attention to cryptographic operations in `main/crypto/`

2. **IPC Security**
   - Maintain context isolation — never disable it
   - All renderer-to-main IPC messages must be validated in the preload script
   - Private key material must never cross the IPC boundary to the renderer

3. **Dependency Management**
   - Regularly audit dependencies for known vulnerabilities
   - Keep dependencies up to date via Renovate

4. **Secrets in Tests**
   - Never use real credentials in test code or mock data
   - Use randomly generated, non-sensitive test fixtures

## Known Security Considerations

### Cryptographic Operations

This application performs cryptographic operations including:

- **RSA-4096 key pair generation** — Performed exclusively in the Electron main process
- **AES-256 encryption** — For sensitive contract data at rest
- **Digital signatures** — For contract section signing
- **Password-based key derivation** — For key export protection

### Private Key Storage

The application stores private keys using OS-level key storage:

- Keys are never exposed to the renderer process
- Keys are protected by OS-level access controls
- Password-protected key export is supported for portability

### Electron Security

- **Context Isolation**: Enabled — renderer cannot access Node.js or Electron APIs directly
- **Node Integration in Renderer**: Disabled
- **Remote Module**: Disabled
- **IPC Validation**: All IPC messages validated in the preload script

## Vulnerability Disclosure Policy

We believe in coordinated vulnerability disclosure:

1. **Report** — Security researchers report vulnerabilities privately
2. **Fix** — We develop and test a fix
3. **Release** — We release the patched version
4. **Disclose** — We publish a security advisory with credit to the researcher
5. **Public** — Full details are disclosed after users have had time to update

We will not take legal action against security researchers who:
- Make a good faith effort to avoid privacy violations and data destruction
- Report vulnerabilities privately and give us reasonable time to respond
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue

## Security Updates

Stay informed about security updates:

- **GitHub Security Advisories** — Watch this repository for security advisories
- **Releases** — Check the [Releases page](https://github.com/ibm-hyper-protect/contract-ui/releases) for security patches
- **Changelog** — Review [CHANGELOG.md](CHANGELOG.md) for security-related changes

## Questions?

If you have questions about this security policy or the security of this project:

1. Review this document thoroughly
2. Check existing [security advisories](https://github.com/ibm-hyper-protect/contract-ui/security/advisories)
3. Contact the maintainers listed in [MAINTAINERS.md](MAINTAINERS.md)

---

Thank you for helping keep `contract-ui` and our users safe!
