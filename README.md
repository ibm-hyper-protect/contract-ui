# Contract UI

A secure desktop application for collaborative construction of IBM Confidential Computing contracts with role-based access control, cryptographic signing, and attestation capabilities.

## Overview

The IBM Confidential Computing Contract UI is an Electron-based desktop application that enables multiple personas (Solution Providers, Data Owners, Environment Operators, Auditors) to collaboratively build, sign, and verify confidential computing contracts. The application provides a secure environment for managing cryptographic keys, signing contract sections, and maintaining audit trails.

## Features

### Core Capabilities
- **Role-Based Access Control**: Support for multiple personas including Admin, Solution Provider, Data Owner, Auditor, Environment Operator, and Viewer
- **Collaborative Contract Building**: Multi-user workflow for constructing contracts with section-based assignments
- **Cryptographic Operations**: RSA-4096 key pair generation, AES-256 encryption, and digital signatures
- **Attestation Evidence**: Support for attestation key management and evidence verification
- **Audit Trail**: Comprehensive logging of all contract operations and user actions
- **Export & Verification**: Contract export with signature verification capabilities

### Security Features
- **Key Management**: Secure storage and rotation of cryptographic keys
- **Digital Signatures**: Sign contract sections with RSA-4096 private keys
- **Encryption**: AES-256 encryption for sensitive data
- **Password Management**: Secure credential storage with strength validation
- **API Token Management**: Secure handling of authentication tokens

### User Interface
- **IBM Carbon Design System**: Modern, accessible UI built with Carbon React components
- **Dark/Light Theme**: Theme switching support
- **Keyboard Shortcuts**: Comprehensive keyboard navigation
- **Command Palette**: Quick access to application features
- **Responsive Design**: Optimized for desktop environments

## Technology Stack

### Frontend
- **React 19.2.4**: UI framework
- **IBM Carbon React 1.104.1**: Design system and components
- **IBM Carbon Charts 1.27.3**: Data visualization
- **React Router DOM 7.1.3**: Client-side routing
- **Zustand 5.0.2**: State management
- **Sass 1.99.0**: Styling

### Desktop Framework
- **Electron 41.1.1**: Cross-platform desktop application framework
- **Vite 8.0.3**: Build tool and development server

### Build & Packaging
- **electron-builder 26.8.1**: Application packaging and distribution
- **Vite Plugin React 6.0.1**: React integration for Vite

## Prerequisites

- **Node.js**: >= 25.9.0
- **npm**: >= 11.12.1
- **Operating System**: Linux, Windows, or macOS

## Installation

### Clone the Repository
```bash
git clone <repository-url>
cd persona-based-contract-generator-app
```

### Install Dependencies
```bash
npm install
```

## Development

### Start Development Server
Run the Vite development server and Electron in development mode:
```bash
npm run dev
```

This command:
1. Starts Vite dev server on `http://localhost:5173`
2. Waits for the server to be ready
3. Launches Electron in development mode

### Start Vite Only
To run only the Vite development server:
```bash
npm start
```

## Building

### Build Web Assets
Compile the React application for production:
```bash
npm run build
```

This creates optimized production files in the `dist/` directory.

**Note**: The packaging commands automatically run `npm run build` first, so you don't need to build manually before packaging.

### Package Application

#### All Platforms
```bash
npm run package
```

This command will:
1. Clean previous builds
2. Build web assets with Vite
3. Package the Electron application

#### Platform-Specific Builds

**macOS**
```bash
npm run package:mac
```

Automatically builds web assets, then generates:
- DMG installer (x64 and arm64)
- ZIP archive (x64 and arm64)

**Windows**
```bash
npm run package:win
```

Automatically builds web assets, then generates:
- NSIS installer (x64 and ia32)
- Portable executable (x64)

**Linux**
```bash
npm run package:linux
```

Automatically builds web assets, then generates:
- AppImage (x64) - Universal Linux package
- DEB package (x64) - Debian/Ubuntu
- RPM package (x64) - Red Hat/Fedora/CentOS

**Installing Linux Packages:**
```bash
# AppImage (recommended - no installation needed)
chmod +x dist-electron/IBM-CC-Contract-UI-*.AppImage
./dist-electron/IBM-CC-Contract-UI-*.AppImage

# DEB package
sudo dpkg -i dist-electron/IBM-CC-Contract-UI-*.deb

# RPM package
sudo rpm -i dist-electron/IBM-CC-Contract-UI-*.rpm
```

Built applications are output to the `dist-electron/` directory.

## Project Structure

```
persona-based-contract-generator-app/
├── main/                          # Electron main process
│   ├── index.js                   # Main process entry point
│   ├── preload.js                 # Preload script for IPC
│   └── crypto/                    # Cryptographic operations
│       ├── contractCli.js         # Contract CLI integration
│       ├── encryptor.js           # Encryption utilities
│       ├── keyManager.js          # Key generation and management
│       ├── keyStorage.js          # Secure key storage
│       └── signer.js              # Digital signature operations
├── src/                           # React application source
│   ├── App.jsx                    # Main application component
│   ├── main.jsx                   # React entry point
│   ├── index.scss                 # Global styles
│   ├── components/                # Reusable UI components
│   │   ├── AppShell.jsx           # Application layout
│   │   ├── DesktopTitleBar.jsx    # Custom title bar
│   │   ├── CommandPalette.jsx     # Command palette
│   │   ├── ToastManager.jsx       # Notification system
│   │   ├── ErrorBoundary.jsx      # Error handling
│   │   └── ...                    # Additional components
│   ├── views/                     # Application views/pages
│   │   ├── Home.jsx               # Dashboard
│   │   ├── Login.jsx              # Authentication
│   │   ├── BuildManagement.jsx    # Contract builds
│   │   ├── BuildDetails.jsx       # Build details
│   │   ├── UserManagement.jsx     # User administration
│   │   ├── AdminAnalytics.jsx     # Analytics dashboard
│   │   ├── SystemLogs.jsx         # Audit logs
│   │   └── AccountSettings.jsx    # User settings
│   ├── services/                  # Business logic and API
│   │   ├── apiClient.js           # HTTP client
│   │   ├── authService.js         # Authentication
│   │   ├── buildService.js        # Build management
│   │   ├── cryptoService.js       # Crypto operations bridge
│   │   ├── assignmentService.js   # Assignment management
│   │   ├── sectionService.js      # Section management
│   │   ├── verificationService.js # Signature verification
│   │   └── ...                    # Additional services
│   ├── store/                     # Zustand state management
│   │   ├── authStore.js           # Authentication state
│   │   ├── buildStore.js          # Build state
│   │   ├── userStore.js           # User state
│   │   ├── themeStore.js          # Theme state
│   │   ├── uiStore.js             # UI state
│   │   └── mockData.js            # Mock data for development
│   ├── hooks/                     # Custom React hooks
│   │   ├── useFormValidation.js   # Form validation
│   │   └── useKeyboardShortcuts.js # Keyboard shortcuts
│   ├── utils/                     # Utility functions
│   │   ├── constants.js           # Application constants
│   │   ├── formatters.js          # Data formatters
│   │   ├── roles.js               # Role utilities
│   │   ├── validation.js          # Validation helpers
│   │   └── validators.js          # Validator functions
│   └── styles/                    # Style files
│       └── modern-theme.scss      # Theme definitions
├── dist/                          # Built web assets (generated)
├── dist-electron/                 # Packaged applications (generated)
├── electron-builder.json          # Electron builder configuration
├── vite.config.js                 # Vite configuration
├── package.json                   # Project dependencies
└── README.md                      # This file
```

## Configuration

### Electron Builder
Configuration is defined in `electron-builder.json`:
- Application ID: `com.ibm.ccrt.contract-builder`
- Product Name: IBM CC Contract Builder
- Output directory: `dist-electron/`
- Compression: Maximum
- ASAR packaging: Enabled

### Vite
Configuration is defined in `vite.config.js`:
- Base path: `./` (for Electron compatibility)
- React plugin enabled

## Roles and Permissions

### Admin
- Full system access
- User management
- System configuration
- Analytics and reporting

### Solution Provider
- Create and manage builds
- Define contract sections
- Assign tasks to other roles
- View build statistics

### Data Owner
- Contribute data-related sections
- Sign assigned sections
- View assigned builds

### Environment Operator
- Configure environment sections
- Manage deployment parameters
- Sign environment configurations

### Auditor
- View all contracts and audit trails
- Verify signatures
- Generate compliance reports
- Read-only access to builds

### Viewer
- Read-only access
- View public contracts
- No modification permissions

## Security Considerations

### Cryptographic Operations
- All cryptographic operations are performed in the Electron main process
- Private keys are never exposed to the renderer process
- RSA-4096 for asymmetric operations
- AES-256 for symmetric encryption

### Key Storage
- Keys are stored securely using OS-level key storage mechanisms
- Support for key rotation and credential management
- Password-protected key export

### IPC Security
- Context isolation enabled
- Preload script for secure IPC communication
- Validation of all IPC messages

## Development Guidelines

### Code Style
- Use ES6+ features
- Follow React best practices
- Use functional components with hooks
- Implement proper error boundaries

### State Management
- Use Zustand for global state
- Keep state minimal and normalized
- Use derived state where possible

### Component Structure
- Keep components focused and single-purpose
- Use Carbon components for consistency
- Implement proper accessibility features

## Performance Optimization

### Build Performance
The application is configured for optimal build performance:

**Compression Settings:**
- Uses `normal` compression instead of `maximum` for faster builds
- ASAR packaging enabled for better startup performance
- Parallel builds supported

**Vite Optimizations:**
- Code splitting with manual chunks for vendor libraries
- ESBuild minification for faster builds
- Pre-bundled dependencies for faster dev server startup
- Sourcemaps disabled in production builds

**Tips for Faster Builds:**
```bash
# Use platform-specific builds instead of building all platforms
npm run package:linux   # Only Linux
npm run package:win     # Only Windows
npm run package:mac     # Only macOS

# For development, use the dev server (much faster)
npm run dev
```

### Application Startup Performance
To improve application startup time:

1. **First Launch**: Initial startup may be slower due to:
   - OS security checks (especially on macOS)
   - First-time cache generation
   - Dependency initialization

2. **Subsequent Launches**: Should be significantly faster due to:
   - Cached resources
   - Pre-compiled code
   - OS trust establishment

3. **Optimization Tips:**
   - Close unnecessary background applications
   - Ensure sufficient RAM (8GB recommended)
   - Use SSD storage for better I/O performance
   - Keep the application updated

## Troubleshooting

### Development Server Issues
If the development server fails to start:
1. Check if port 5173 is already in use
2. Clear node_modules and reinstall dependencies
3. Verify Node.js and npm versions meet requirements

### Build Failures
If packaging fails:
1. Ensure all dependencies are installed
2. Run `npm run build` first to verify web assets compile
3. Check electron-builder logs in `dist-electron/`

### Electron Issues
If Electron fails to launch:
1. Clear Electron cache: `rm -rf ~/.cache/electron`
2. Reinstall Electron: `npm install electron --force`
3. Check console for IPC errors

## CI/CD

The project includes GitHub Actions workflows for automated testing and building:

### Test Workflow
Runs on every push and pull request:
- Installs dependencies
- Runs linting checks
- Executes test suite
- Validates build process

### Release Workflow
Triggered on version tags (v*):
- Builds for Linux, Windows, and macOS
- Creates platform-specific binaries
- Uploads artifacts to GitHub Releases
- Generates release notes with checksums

**Creating a Release:**

1. Update version in `package.json`:
```bash
npm version patch  # for 1.0.0 -> 1.0.1
# or
npm version minor  # for 1.0.0 -> 1.1.0
# or
npm version major  # for 1.0.0 -> 2.0.0
```

2. Push the tag to GitHub:
```bash
git push origin main --tags
```

3. GitHub Actions will automatically:
   - Build binaries for all platforms
   - Generate SHA256 checksums
   - Create a GitHub Release
   - Upload all artifacts

**Manual Release Trigger:**
You can also manually trigger the release workflow from the GitHub Actions tab.

See `.github/workflows/` for workflow configurations.

## License

Apache-2.0

## Contributing

Contributions are welcome. Please ensure:
- Code follows project style guidelines
- All tests pass
- Documentation is updated
- Commit messages are descriptive

## Support

For issues and questions:
- Open an issue on GitHub
- Review existing documentation
- Check troubleshooting section

## Acknowledgments

Built with:
- IBM Carbon Design System
- Electron Framework
- React and Vite
- Open source community contributions
