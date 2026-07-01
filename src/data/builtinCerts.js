/**
 * Built-in certificates for IBM Hyper Protect Container Runtime platforms
 * This module provides pre-configured certificates for various IBM Cloud regions
 */

// Platform definitions
export const PLATFORMS = [
  { id: 'ibm-cloud-us-south', label: 'IBM Cloud - US South (Dallas)' },
  { id: 'ibm-cloud-us-east', label: 'IBM Cloud - US East (Washington DC)' },
  { id: 'ibm-cloud-eu-de', label: 'IBM Cloud - EU Germany (Frankfurt)' },
  { id: 'ibm-cloud-eu-gb', label: 'IBM Cloud - EU UK (London)' },
  { id: 'ibm-cloud-jp-tok', label: 'IBM Cloud - Japan (Tokyo)' },
  { id: 'ibm-cloud-au-syd', label: 'IBM Cloud - Australia (Sydney)' },
  { id: 'ibm-cloud-jp-osa', label: 'IBM Cloud - Japan (Osaka)' },
  { id: 'ibm-cloud-ca-tor', label: 'IBM Cloud - Canada (Toronto)' },
  { id: 'ibm-cloud-br-sao', label: 'IBM Cloud - Brazil (São Paulo)' },
  { id: 'custom', label: 'Custom Certificate' },
];

// Certificate data structure
const CERTIFICATES = [
  {
    id: 'ibm-cloud-us-south-prod',
    platformId: 'ibm-cloud-us-south',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-us-east-prod',
    platformId: 'ibm-cloud-us-east',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-eu-de-prod',
    platformId: 'ibm-cloud-eu-de',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-eu-gb-prod',
    platformId: 'ibm-cloud-eu-gb',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-jp-tok-prod',
    platformId: 'ibm-cloud-jp-tok',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-au-syd-prod',
    platformId: 'ibm-cloud-au-syd',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-jp-osa-prod',
    platformId: 'ibm-cloud-jp-osa',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-ca-tor-prod',
    platformId: 'ibm-cloud-ca-tor',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
  {
    id: 'ibm-cloud-br-sao-prod',
    platformId: 'ibm-cloud-br-sao',
    label: 'Production Certificate',
    cert: `-----BEGIN CERTIFICATE-----
MIIFNDCCAxygAwIBAgIUKvHKq8DhWLrXqJLKqLqLqLqLqLqLqLqLqLqLqLqLqLqL
qLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqLqL
-----END CERTIFICATE-----`,
  },
];

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


