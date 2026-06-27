const mongoose = require('mongoose');
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;

function convertDateStringsToDates(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    obj.forEach(convertDateStringsToDates);
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
      obj[key] = new Date(value);
    } else if (Array.isArray(value)) {
      value.forEach(convertDateStringsToDates);
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      convertDateStringsToDates(value);
    }
  }

  return obj;
}

function convertObjectIdFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    obj.forEach(convertObjectIdFields);
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string' && OBJECTID_REGEX.test(value)) {
      const isIdField = key === '_id' || key.endsWith('_id') || key === 'id' || key === 'service_ticket';
      if (isIdField) {
        obj[key] = new mongoose.Types.ObjectId(value);
      }
    } else if (Array.isArray(value)) {
      value.forEach(convertObjectIdFields);
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
      convertObjectIdFields(value);
    }
  }

  return obj;
}

module.exports = { convertDateStringsToDates, convertObjectIdFields };
