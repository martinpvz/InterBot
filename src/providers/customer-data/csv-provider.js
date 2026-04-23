import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.resolve(__dirname, '../../../data/asegurados.csv');

let records = [];
let recordsByPolicyNumber = new Map();
let recordsByNormalizedName = new Map();

function loadCustomerRecords() {
  if (!fs.existsSync(csvPath)) {
    logger.warn('No se encontro el CSV de asegurados', { csvPath });
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    logger.warn('El CSV de asegurados esta vacio', { csvPath });
    return;
  }

  const headers = parseCsvLine(lines[0]);

  records = lines
    .slice(1)
    .map((line) => buildRecord(headers, parseCsvLine(line)))
    .filter(Boolean);

  recordsByPolicyNumber = new Map();
  recordsByNormalizedName = new Map();

  for (const record of records) {
    indexRecord(recordsByPolicyNumber, normalizePolicyNumber(record.policyNumber), record);
    indexRecord(recordsByNormalizedName, normalizeName(record.fullName), record);
  }

  logger.info('Catalogo de asegurados cargado', {
    csvPath,
    totalRecords: records.length,
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function buildRecord(headers, values) {
  if (headers.length !== values.length) {
    return null;
  }

  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

  return {
    policyNumber: row.NumeroPoliza,
    gender: row.GeneroAsegurado,
    fullName: row.nombrecompleto,
    economicGroup: row.GrupoEconomico,
    insurer: row.dGrupoAseguradora,
    relationship: row.Parentesco_Descriptivo,
    age: row.EDAD ? Number(row.EDAD) : null,
  };
}

function indexRecord(indexMap, key, record) {
  if (!key) {
    return;
  }

  const existing = indexMap.get(key) ?? [];
  existing.push(record);
  indexMap.set(key, existing);
}

function normalizePolicyNumber(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function findCustomersByPolicyNumber(policyNumber) {
  return recordsByPolicyNumber.get(normalizePolicyNumber(policyNumber)) ?? [];
}

function findCustomersByFullName(fullName) {
  return recordsByNormalizedName.get(normalizeName(fullName)) ?? [];
}

function getCustomerCatalogStats() {
  return {
    totalRecords: records.length,
    loaded: records.length > 0,
  };
}

function getAllCustomerRecords() {
  return records;
}

loadCustomerRecords();

export {
  getAllCustomerRecords,
  findCustomersByFullName,
  findCustomersByPolicyNumber,
  getCustomerCatalogStats,
  normalizeName,
  normalizePolicyNumber,
};
