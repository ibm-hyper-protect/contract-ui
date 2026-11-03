/** Accept raw YAML and the base64-encoded UTF-8 payload used by older servers. */
export function decodeContractContent(content) {
  if (typeof content !== 'string' || !content.trim()) return '';
  const value = content.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0)
    return content;
  try {
    const bytes = Uint8Array.from(atob(value), (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return content;
  }
}

/** Refuse an empty export before opening the save dialog or acknowledging it. */
export function getContractContent(data) {
  const content = decodeContractContent(
    data?.contract_yaml ?? data?.contract ?? data?.user_data,
  );
  if (!content.trim())
    throw new Error(
      'The server returned an empty contract. Try loading it again.',
    );
  return content;
}

export function getContractSize(content) {
  return `${(new TextEncoder().encode(content).length / 1024).toFixed(1)} KB`;
}
