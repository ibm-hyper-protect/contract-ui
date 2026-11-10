# Compose workload import

In Add workload, choose Import Docker Compose, upload a .yaml/.yml definition (up to 1 MB), and optionally supply an ext4 volume name, absolute guest mount and existing workload seed. Review workload YAML opens the existing editor; Apply YAML and the existing certificate/review/submit steps still apply.

Every service must use an image already in a registry. Resolve interpolation and inline environment values first. The importer rejects build, env_file, label_file, extends, include, external configs/secrets/volumes and relative local bind paths. It does not read referenced files or execute Compose. Absolute binds refer to the guest. For multi-file deployments, prepare a complete contract archive yourself. It performs import checks, not a complete Compose or runtime validation.

For existing data preserve both original volume seeds; the importer never generates or replaces them. The environment section must supply its own seed under the same volume name. The tar.gz and Base64 output are not encryption; normal section submission performs encryption.
