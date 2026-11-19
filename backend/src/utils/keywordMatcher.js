'use strict';

function normalizeKeywordText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function plainKeyword(record) {
  return record?.get ? record.get({ plain: true }) : record;
}

function matchingKeyword(text, keywords = []) {
  const normalizedText = normalizeKeywordText(text);
  if (!normalizedText) return null;
  const paddedText = ` ${normalizedText} `;
  const candidates = keywords
    .map(plainKeyword)
    .filter((record) => record && typeof record.palabra === 'string' && record.tema_asociado !== undefined)
    .map((record) => ({ ...record, normalizedTerm: normalizeKeywordText(record.palabra) }))
    .filter((record) => record.normalizedTerm && paddedText.includes(` ${record.normalizedTerm} `))
    .sort((left, right) => right.normalizedTerm.length - left.normalizedTerm.length || Number(left.id || 0) - Number(right.id || 0));
  return candidates[0] || null;
}

function matchingKeywordsByCategory(text, keywords = []) {
  const normalizedText = normalizeKeywordText(text);
  if (!normalizedText) return [];
  const paddedText = ` ${normalizedText} `;
  return keywords
    .map(plainKeyword)
    .filter((record) => record && typeof record.palabra === 'string')
    .map((record) => ({ ...record, normalizedTerm: normalizeKeywordText(record.palabra) }))
    .filter((record) => record.normalizedTerm && paddedText.includes(` ${record.normalizedTerm} `));
}

module.exports = { normalizeKeywordText, matchingKeyword, matchingKeywordsByCategory, plainKeyword };
