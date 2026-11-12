# Compose workload import

In Add workload, choose Import Docker Compose, upload a .yaml/.yml definition (up to 1 MB), and optionally add any number of ext4 persistent volumes. Each volume has its own unique name, absolute guest mount and existing workload seed. Use Add volume / Remove volume to manage the list; no volumes are included when the option is disabled. Review workload YAML opens the existing editor; Apply YAML and the existing certificate/review/submit steps still apply.

Every service must use an image already in a registry. Resolve interpolation and inline environment values first. The importer rejects build, env_file, label_file, extends, include, external configs/secrets/volumes and relative local bind paths. It does not read referenced files or execute Compose. Absolute binds refer to the guest. For multi-file deployments, prepare a complete contract archive yourself. It performs import checks, not a complete Compose or runtime validation.

For existing data preserve both original volume seeds; the importer never generates or replaces them. The environment section must supply its own seed under the same volume name. The tar.gz and Base64 output are not encryption; normal section submission performs encryption.

Duplicate volume names and guest mount paths are rejected before YAML is generated. Each workload volume needs a matching name in the environment section with its own environment seed. Workload seeds are preserved byte for byte, including surrounding whitespace. Compose named volumes are not automatically converted into encrypted runtime mounts; bind application storage to the configured guest paths.
