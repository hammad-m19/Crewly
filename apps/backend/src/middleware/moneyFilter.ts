import { Response, NextFunction } from 'express';
import { MONEY_VISIBLE_ROLES, MONEY_FIELDS, Role } from '@crewly/shared';
import { AuthRequest } from './auth';

/**
 * Money filter middleware — strips financial fields from API responses
 * for users who are NOT Owner or Accountant.
 *
 * ⚠️  CRITICAL: This operates at the RESPONSE level, intercepting res.json()
 * to strip fields per-record. This means it works correctly even when a
 * Site Supervisor's sync pull includes Project records (they get the project
 * context but NOT the budget/budgetHistory fields).
 *
 * This is API-level enforcement, not just UI hiding.
 */
export const moneyFilter = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next();
    return;
  }

  // If user is allowed to see money data, pass through unchanged
  if (MONEY_VISIBLE_ROLES.includes(req.user.role)) {
    next();
    return;
  }

  // Intercept res.json() to strip money fields from the response body
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    if (body && typeof body === 'object') {
      const stripped = stripMoneyFields(body);
      return originalJson(stripped);
    }
    return originalJson(body);
  };

  next();
};

/** Leave BSON / Date / Buffer alone — recursive key walk corrupts them. */
function isLeafObject(value: object): boolean {
  if (value instanceof Date || Buffer.isBuffer(value)) return true;
  const anyVal = value as { _bsontype?: string; toHexString?: () => string; constructor?: { name?: string } };
  if (anyVal._bsontype === 'ObjectId') return true;
  if (typeof anyVal.toHexString === 'function') return true;
  if (anyVal.constructor?.name === 'ObjectId') return true;
  return false;
}

function serializeLeaf(value: object): unknown {
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  const anyVal = value as { toHexString?: () => string; toString?: () => string };
  if (typeof anyVal.toHexString === 'function') return anyVal.toHexString();
  return String(value);
}

/**
 * Recursively strip money-related fields from an object or array.
 * Handles nested structures: arrays of records, sync response format
 * (changes.projects.created[...]), individual objects, etc.
 */
function stripMoneyFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (isLeafObject(obj)) {
    return serializeLeaf(obj);
  }

  // Handle arrays — strip from each element
  if (Array.isArray(obj)) {
    return obj.map((item) => stripMoneyFields(item));
  }

  // Handle plain objects
  const result: Record<string, unknown> = {};
  const source = obj as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    // Skip money fields at any nesting level
    if ((MONEY_FIELDS as readonly string[]).includes(key)) {
      continue;
    }

    const value = source[key];

    // Recurse into nested objects/arrays (for sync responses, nested records, etc.)
    if (value && typeof value === 'object') {
      result[key] = stripMoneyFields(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
