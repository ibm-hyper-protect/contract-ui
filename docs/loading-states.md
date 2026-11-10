# Loading states

`src/components/LoadingState.jsx` renders an operation-specific SVG with a visible
status message. Keep Carbon table skeletons for initial tabular-data fetches,
including Build Management, User Management and System Logs. Use `size="page"`
for non-tabular initial page fetches, the default section size for longer
operations, and `size="inline"` beside existing forms or content.

```jsx
{loading && (
  <LoadingState
    variant="archive-pack"
    description="Loading YAML template…"
    size="inline"
  />
)}
```

| Graphic | Current use |
| --- | --- |
| `connection` | Application configuration hydration and signing in |
| `analytics` | Initial analytics and Home overview fetches |
| `event-stream` | Audit trail fetches |
| `contract-assembly` | Section submission, finalisation, contract loading and saving |
| `key-material` | Build key status, passwords and contract integrity |
| `layer-stack` | Workload/environment context and finalisation prerequisites |
| `archive-pack` | Loading YAML templates and uploading attestation evidence |
| `table-scan` | Build assignee lookup in the create-build form |
| `signature-trace` | Build signing key registration and attestation verification |
| `task-routing` | Assignment context and confirmation actions |

All ten assets are local SVG/CSS files with transparent backgrounds and no
scripts, remote resources, runtime dependencies or application data. The component
imports trusted bundled SVG source as text and encodes it as an isolated SVG
image; it never inserts SVG markup into the renderer DOM. Fixed `data-theme` and
`data-motion` attributes select Carbon's theme and the live reduced-motion
preference. Explicit preferences avoid Chromium's inconsistent propagation of
media queries into image documents. The standalone SVGs also support native
`prefers-color-scheme` and `prefers-reduced-motion` queries.

The image is decorative (`alt=""`, `aria-hidden="true"`). A single visible
operation label is announced by the enclosing polite status region. CSS animation
does not update the accessibility tree or move focus. The animation is
indeterminate: it does not imply a percentage, successful encryption, validation
or completion. Mount it only while the corresponding request or operation is
pending. Keep errors and success feedback separate, and preserve action guards.
Carbon's native modal footer feedback remains in transactional dialogs. Short file
reads and account device-key controls retain native Carbon feedback, keeping this
change compatible with the separate device-key management rework.

The startup animation lasts until configuration hydration completes, including
the existing fallback on read failure. The former random progress percentage and
artificial startup delay have been removed. Build Management now receives the
initial build-fetch state and displays its table skeleton; background refreshes
retain existing content.

To review, delay requests in the browser's Network tools and visit Analytics,
User Management, System Logs, Build Management, Account Settings and each build
tab. Check that indicators disappear on both success and failure, background
refresh retains content, forms prevent duplicate submission, switching Carbon
themes changes the illustrations, and reduced motion gives a static image.
File-reading indicators can be brief with small local files. Run `npm run build`
to verify the application and its asset imports.
