/**
 * Optional catalog of runtime encryption certificates.
 * Leave this empty until certificates and platform metadata are obtained from
 * an authoritative source. Operators upload the certificate for their runtime.
 */
export const PLATFORMS = [];
const CERTIFICATES = [];

/**
 * Get all certificates for a specific platform
 * @param {string} platformId - The platform identifier
 * @returns {Array} Array of certificate objects for the platform
 */
export function getCertsByPlatform(platformId) {
  return CERTIFICATES.filter(cert => cert.platformId === platformId);
}

/**
 * Get a specific certificate by its ID
 * @param {string} certId - The certificate identifier
 * @returns {Object|undefined} The certificate object or undefined if not found
 */
export function getCertById(certId) {
  return CERTIFICATES.find(cert => cert.id === certId);
}

/**
 * Get all available certificates
 * @returns {Array} Array of all certificate objects
 */
export function getAllCertificates() {
  return CERTIFICATES;
}

/**
 * Check if a platform has any certificates
 * @param {string} platformId - The platform identifier
 * @returns {boolean} True if the platform has certificates
 */
export function hasCertificates(platformId) {
  return CERTIFICATES.some(cert => cert.platformId === platformId);
}


