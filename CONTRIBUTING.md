# Contributing to contract-ui

Thank you for considering contributing to `contract-ui`! We appreciate your time and effort in helping improve this project. This guide will help you understand our development process and how to contribute effectively.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Questions](#questions)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers listed in [MAINTAINERS.md](MAINTAINERS.md).

## How Can I Contribute?

### Reporting Bugs

We use GitHub issue templates to ensure we collect all necessary information. To report a bug:

1. **Check for existing issues**: Search [existing issues](https://github.com/ibm-hyper-protect/contract-ui/issues) to avoid duplicates
2. **Use the bug report template**: Click [here](https://github.com/ibm-hyper-protect/contract-ui/issues/new?template=bug_report.yml) or select "Bug Report" when creating a new issue
3. **Fill out all required fields**: The template will guide you through providing:
   - Bug description and impact
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (app version, OS, Node.js version, etc.)

**Important**: For security vulnerabilities, **do NOT create a public issue**. Instead, report them via [GitHub Security Advisories](https://github.com/ibm-hyper-protect/contract-ui/security/advisories/new) or follow our [Security Policy](SECURITY.md).

### Suggesting Enhancements

To suggest a new feature or enhancement:

1. **Check for existing requests**: Search [existing issues](https://github.com/ibm-hyper-protect/contract-ui/issues) to see if it's already been suggested
2. **Use the feature request template**: Click [here](https://github.com/ibm-hyper-protect/contract-ui/issues/new?template=feature_request.yml) or select "Feature Request" when creating a new issue
3. **Provide detailed information**: The template will guide you through:
   - Problem statement and motivation
   - Proposed solution
   - Alternatives considered
   - Use cases and examples

### Asking Questions

If you have questions about using the application:

1. **Check the documentation first**: Review the [README](README.md)
2. **Search existing Q&A**: Look through [closed issues](https://github.com/ibm-hyper-protect/contract-ui/issues?q=is%3Aissue+label%3Aquestion) with the "question" label
3. **Use GitHub Discussions**: For general questions, use [GitHub Discussions](https://github.com/ibm-hyper-protect/contract-ui/discussions)
4. **Create a question issue**: If needed, use our [question template](https://github.com/ibm-hyper-protect/contract-ui/issues/new?template=question.yml)

### Code Contributions

We actively welcome your pull requests! However, please follow this process:

1. **Open an issue first** - Before submitting a pull request, open an issue describing:
   - What bug you're fixing or feature you're adding
   - Why it should be fixed or added
   - How you plan to implement it

   This helps us discuss the approach early and avoid duplicated or unnecessary work.

   **Pull requests without a linked issue may be closed.**

2. **Get feedback** - Wait for maintainer feedback on your issue before starting work.

3. **Fork and create a branch** - Once approved, fork the repo and create a feature branch.

4. **Implement your changes** - Follow our coding standards and best practices.

5. **Submit a pull request** - Reference the original issue in your PR description.

## Getting Started

### Prerequisites

- **Node.js >= 25.9.0**
- **npm >= 11.12.1**
- **Git** - For version control

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/contract-ui.git
   cd contract-ui
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ibm-hyper-protect/contract-ui.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Verify your setup**:
   ```bash
   npm run build
   ```

## Development Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our [coding standards](#coding-standards)

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Build to verify changes compile**:
   ```bash
   npm run build
   ```

5. **Commit your changes** with [proper commit messages](#commit-messages)

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** from your fork to the main repository

## Coding Standards

### JavaScript / React Style Guide

- Use **ES6+** features throughout
- Use **functional components** with hooks — no class components
- Follow **React best practices** and the patterns already established in the codebase
- Use **Carbon Design System** components from `@carbon/react` for all UI elements
- Keep components **focused and single-purpose**
- Write **self-documenting code** — use clear variable and function names
- Add comments for complex logic — explain the *why*, not the *what*
- Handle errors explicitly; never silently swallow exceptions

### State Management

- Use **Zustand** for global application state
- Keep state minimal and normalized
- Use derived state where possible — avoid storing computed values

### Accessibility

- All UI components must be keyboard-navigable
- Use semantic HTML and ARIA roles where applicable
- Maintain WCAG AA compliance for color contrast

### Security

- All cryptographic operations must be performed in the **Electron main process**
- Never expose private keys or sensitive material to the renderer process
- Validate all IPC messages in the preload script

### Documentation

- Update **README.md** for significant new features or changes to build/packaging
- Add JSDoc comments to new utility functions and services
- Include practical usage examples in documentation where helpful

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification. Commit messages are validated automatically on pull requests.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation-only changes
- `refactor:` — Code changes that neither fix a bug nor add a feature
- `perf:` — Performance improvements
- `test:` — Adding or updating tests
- `chore:` — Changes to build process, dependencies, tooling, etc.
- `ci:` — CI/CD configuration changes
- `build:` — Changes affecting the build system or external dependencies
- `revert:` — Reverting a previous commit

### Examples

```
feat(ui): add command palette keyboard shortcut overlay

fix(crypto): resolve key rotation failure for RSA-4096 keys

docs: update installation instructions for Linux AppImage

chore!: bump minimum Node.js version to 25.9.0
```

### Guidelines

- **Use imperative mood** — "add feature" not "added feature"
- **Keep subject line under 72 characters**
- **Separate subject from body with a blank line**
- **Use body to explain what and why, not how**
- **Reference issues** (e.g., "Fixes #123")
- Append `!` after type/scope to indicate a breaking change

## Pull Request Process

### Before Submitting

- [ ] Link to the related issue in your PR description
- [ ] Ensure the build passes (`npm run build`)
- [ ] Update documentation if needed
- [ ] Follow the commit message conventions
- [ ] Rebase your branch on the latest `main` if needed

### Review Process

1. **Automated checks** — CI must pass before review
2. **Maintainer review** — See [MAINTAINERS.md](MAINTAINERS.md) for current reviewers
3. **Address feedback** — Make requested changes promptly
4. **Approval** — At least one maintainer must approve
5. **Merge** — Maintainers will squash-merge your PR

### After Your PR is Merged

- Delete your feature branch
- Update your local repository:
  ```bash
  git checkout main
  git pull upstream main
  ```

## Questions?

If you have questions about contributing:

1. Check the [README](README.md)
2. Search [existing issues](https://github.com/ibm-hyper-protect/contract-ui/issues)
3. Open a new issue with the `question` label
4. Reach out to the maintainers listed in [MAINTAINERS.md](MAINTAINERS.md)

## License

By contributing to `contract-ui`, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to contract-ui! Your efforts help make this project better for everyone.
