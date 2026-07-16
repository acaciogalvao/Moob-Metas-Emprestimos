import { Request, Response, NextFunction } from "express";

// ─── Rule types ───────────────────────────────────────────────────

type FieldType = "string" | "number" | "boolean" | "array" | "object";

export interface FieldRule {
  /** Field must be present and non-empty */
  required?: boolean;
  /** Expected JS type (uses Array.isArray for "array") */
  type?: FieldType;
  /** Numeric minimum (inclusive) */
  min?: number;
  /** Numeric maximum (inclusive) */
  max?: number;
  /** Minimum string / array length */
  minLength?: number;
  /** Maximum string / array length */
  maxLength?: number;
  /** Regex the string value must satisfy */
  pattern?: RegExp;
  /** Custom validator — return an error string or null */
  custom?: (value: unknown) => string | null;
  /** Skip sanitization for this field (e.g. base64 payloads) */
  noSanitize?: boolean;
}

export type Schema = Record<string, FieldRule>;

// ─── Sanitization ─────────────────────────────────────────────────

/**
 * Cleans a string value:
 *  - Trims leading/trailing whitespace
 *  - Strips `<script>` tags and inline event handlers (basic XSS guard)
 *  - Removes `javascript:` URI schemes
 *  - Truncates to `maxLength` if provided (prevents oversized payloads reaching the DB)
 */
function sanitizeString(value: string, maxLength?: number): string {
  let s = value.trim();
  // Strip <script>…</script> blocks (case-insensitive, multiline)
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Strip inline event attributes (onclick=, onload=, etc.)
  s = s.replace(/\bon\w+\s*=\s*["']?[^"'>]*/gi, "");
  // Strip javascript: URIs
  s = s.replace(/javascript\s*:/gi, "");
  // Truncate if oversized (fail-safe — route schema should also enforce maxLength)
  if (maxLength !== undefined && s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

/**
 * Sanitizes a single value according to its rules.
 * Returns the sanitized value (or the original if no transformation applies).
 */
function sanitizeValue(value: unknown, rules: FieldRule): unknown {
  if (rules.noSanitize) return value;
  if (typeof value === "string") return sanitizeString(value, rules.maxLength);
  if (typeof value === "number") {
    // Guard against NaN / Infinity leaking in as number literals
    if (!Number.isFinite(value)) return 0;
    // Round to 2 decimal places for monetary fields (min/max hints suggest money)
    if (rules.min !== undefined && rules.min > 0 && rules.max !== undefined) {
      return Math.round(value * 100) / 100;
    }
  }
  return value;
}

/**
 * Recursively sanitizes all string values in an object.
 * Used by `sanitizeBody` to clean the entire request body.
 */
function sanitizeObject(
  source: Record<string, unknown>,
  schema: Schema
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...source };
  for (const [field, rules] of Object.entries(schema)) {
    if (field in result) {
      result[field] = sanitizeValue(result[field], rules);
    }
  }
  return result;
}

// ─── Core validator ───────────────────────────────────────────────

function validateFields(
  source: Record<string, unknown>,
  schema: Schema,
  label: string
): string[] {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = source[field];
    const missing = value === undefined || value === null || value === "";

    if (missing) {
      if (rules.required) {
        errors.push(`O campo '${field}' é obrigatório e não pode estar vazio`);
      }
      continue;
    }

    // Type check
    if (rules.type) {
      const actual = Array.isArray(value) ? "array" : typeof value;
      if (actual !== rules.type) {
        const typeLabel: Record<FieldType, string> = {
          string: "texto",
          number: "número",
          boolean: "verdadeiro/falso",
          array: "lista",
          object: "objeto",
        };
        errors.push(
          `O campo '${field}' deve ser ${typeLabel[rules.type] ?? rules.type} (recebido: ${actual})`
        );
        continue;
      }
    }

    // Numeric bounds
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        errors.push(`O campo '${field}' deve ser um número válido (não pode ser Infinito ou NaN)`);
      } else {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(
            `O campo '${field}' deve ser no mínimo ${rules.min} (recebido: ${value})`
          );
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(
            `O campo '${field}' deve ser no máximo ${rules.max} (recebido: ${value})`
          );
        }
      }
    }

    // String / array length
    if (typeof value === "string" || Array.isArray(value)) {
      const len = (value as string | unknown[]).length;
      if (rules.minLength !== undefined && len < rules.minLength) {
        errors.push(
          `O campo '${field}' deve ter no mínimo ${rules.minLength} caractere(s) (recebido: ${len})`
        );
      }
      if (rules.maxLength !== undefined && len > rules.maxLength) {
        errors.push(
          `O campo '${field}' excede o tamanho máximo de ${rules.maxLength} caractere(s)`
        );
      }
    }

    // Regex pattern
    if (rules.pattern && typeof value === "string") {
      if (!rules.pattern.test(value)) {
        errors.push(`O campo '${field}' tem um formato inválido`);
      }
    }

    // Custom validator
    if (rules.custom) {
      const msg = rules.custom(value);
      if (msg) errors.push(msg);
    }
  }

  return errors;
}

// ─── Middleware factories ─────────────────────────────────────────

/**
 * Sanitizes `req.body` fields in-place according to the schema,
 * then validates them. Runs sanitization before validation so that
 * validators receive the cleaned values.
 */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize in-place (mutates req.body only for schema-declared fields)
    req.body = sanitizeObject(req.body as Record<string, unknown>, schema);

    const errors = validateFields(
      req.body as Record<string, unknown>,
      schema,
      "Campo"
    );
    if (errors.length > 0) {
      return res.status(400).json({ error: "Dados inválidos", details: errors });
    }
    next();
  };
}

/** Validates `req.params` against the given schema (params are not sanitized — they're URL-encoded). */
export function validateParams(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validateFields(
      req.params as Record<string, unknown>,
      schema,
      "Parâmetro"
    );
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ error: "Parâmetros inválidos", details: errors });
    }
    next();
  };
}

/** Validates `req.query` against the given schema. */
export function validateQuery(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validateFields(
      req.query as Record<string, unknown>,
      schema,
      "Query"
    );
    if (errors.length > 0) {
      return res.status(400).json({ error: "Query inválida", details: errors });
    }
    next();
  };
}

// ─── Shared rules ─────────────────────────────────────────────────

/** MongoDB / custom string ID — max 128 chars, no whitespace */
export const idRule: FieldRule = {
  required: true,
  type: "string",
  maxLength: 128,
  pattern: /^\S+$/,
};

/** Positive monetary amount */
export const amountRule: FieldRule = {
  required: true,
  type: "number",
  min: 0.01,
  max: 1_000_000,
};

/** Payer identifier */
export const payerRule: FieldRule = {
  required: true,
  type: "string",
  custom: (v) =>
    v === "P1" || v === "P2"
      ? null
      : "O campo 'payerId' deve ser 'P1' ou 'P2'",
};
