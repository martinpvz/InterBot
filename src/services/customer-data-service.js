import {
  getAllCustomerRecords,
  findCustomersByFullName,
  findCustomersByPolicyNumber,
  getCustomerCatalogStats,
  normalizeName,
  normalizePolicyNumber,
} from '../providers/customer-data/csv-provider.js';

function findCustomerMatch(input) {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return { type: 'empty', matches: [] };
  }

  const isPolicyLookup = looksLikePolicyNumber(trimmedInput);
  const exactMatches = isPolicyLookup
    ? findCustomersByPolicyNumber(trimmedInput)
    : findCustomersByFullName(trimmedInput);
  const matches = exactMatches.length > 0
    ? exactMatches
    : findPartialCustomerMatches(trimmedInput, isPolicyLookup ? 'policy_number' : 'full_name');

  return {
    type: isPolicyLookup ? 'policy_number' : 'full_name',
    matches,
    matchMode: exactMatches.length > 0 ? 'exact' : 'partial',
    normalizedInput: isPolicyLookup ? normalizePolicyNumber(trimmedInput) : trimmedInput,
  };
}

function looksLikePolicyNumber(value) {
  return /^[0-9|\s-]+$/.test(value);
}

function formatCustomerProfile(customer) {
  if (!customer) {
    return null;
  }

  return {
    policyNumber: customer.policyNumber,
    fullName: customer.fullName,
    firstName: extractFirstName(customer.fullName),
    gender: customer.gender,
    economicGroup: customer.economicGroup,
    insurer: customer.insurer,
    relationship: customer.relationship,
    age: customer.age,
  };
}

function findPartialCustomerMatches(input, lookupType) {
  const normalizedInput = lookupType === 'policy_number'
    ? normalizePolicyNumber(input)
    : normalizeName(input);

  if (
    (lookupType === 'policy_number' && normalizedInput.length < 4) ||
    (lookupType === 'full_name' && normalizedInput.length < 3)
  ) {
    return [];
  }

  const matches = lookupType === 'policy_number'
    ? getAllCustomerRecords().filter((customer) => normalizePolicyNumber(customer.policyNumber).includes(normalizedInput))
    : getAllCustomerRecords().filter((customer) => normalizeName(customer.fullName).includes(normalizedInput));

  return matches.slice(0, 25);
}

function refineCustomerMatchesByAge(matches, ageInput) {
  const age = Number(String(ageInput ?? '').trim());

  if (!Number.isInteger(age)) {
    return { valid: false, matches: [] };
  }

  return {
    valid: true,
    matches: matches.filter((customer) => customer.age === age),
  };
}

function refineCustomerMatchesByRelationship(matches, relationshipInput) {
  const normalizedRelationship = normalizeRelationship(relationshipInput);

  if (!normalizedRelationship) {
    return { valid: false, matches: [] };
  }

  return {
    valid: true,
    matches: matches.filter((customer) => normalizeRelationship(customer.relationship) === normalizedRelationship),
  };
}

function normalizeRelationship(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function extractFirstName(fullName) {
  return String(fullName ?? '')
    .trim()
    .split(/\s+/)[0] ?? '';
}

export {
  findCustomerMatch,
  formatCustomerProfile,
  getCustomerCatalogStats,
  refineCustomerMatchesByAge,
  refineCustomerMatchesByRelationship,
};
