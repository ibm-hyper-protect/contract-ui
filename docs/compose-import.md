# Workload import and environment volumes

In **Add workload**, choose **Import Docker Compose / Podman Play** and select the definition format. Add up to 32 YAML files, each up to 1 MB and at most 5 MB together. Additional selections append files in selection order. Each selected file can be removed; removing all files disables review. A failed selection preserves the earlier files.

## Docker Compose

Upload self-contained definitions with distinct services and named entries. The app combines them into one `docker-compose.yaml` in a tar.gz archive and adds its Base64 representation to `compose.archive`. A single file preserves the original UTF-8 content. Multiple files with conflicting definitions are rejected: resolve overrides explicitly with `docker compose -f base.yaml -f override.yaml config` and import that output.

Every service must use an image already in a registry. Resolve interpolation and inline environment values first. The importer rejects build, env_file, label_file, extends, include, external configs/secrets/volumes and relative local bind paths. It does not read referenced files or execute Docker, Podman or shell commands. Absolute bind paths refer to the guest.

## Podman Play

Select **Podman Play** and upload v1 Pod and ConfigMap manifests. Multi-document YAML and multiple files are supported. Each document becomes an entry in `play.resources`, in file/document order. No tar.gz or manual Base64 conversion is needed. Duplicate kind/namespace/name combinations and unsupported kinds are rejected. Include the ConfigMaps referenced by the Pods. Existing raw workload uploads still support `play.archive`, `play.resources` and `play.templates`.

## Persistent volumes

For either workload format, optionally add ext4 persistent volumes with unique names, absolute guest mount paths and workload seeds. The fields support adding and removing rows. The YAML editor opens before any submission; the normal backend validation and certificate/review/submit steps remain in place.

In **Add environment**, first upload, paste or apply a template, then choose **Configure environment volumes**. Add the matching workload volume names and the environment persona's own seeds. Environment volumes have no mount or filesystem fields. Existing logging, registry credentials, environment variables and complete-contract workload data are preserved. Review changes in the YAML editor before applying them.

Seeds are never generated, copied between personas or trimmed. Existing data requires retaining both original seeds. Configure only the declarations actually present in the workload. Backend section-schema and complete-contract pair validation remain authoritative. These helpers prepare YAML; they do not create disks or deploy a workload.

Run `node --test tests` for importer and preparation checks, `npm test` for IPC/service checks, and `npm run build` for the production renderer build.
