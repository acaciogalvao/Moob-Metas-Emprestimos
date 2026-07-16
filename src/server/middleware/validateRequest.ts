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
}

export type Schema = Record<string, FieldRule>;

// ─── Core validator ───────────────────────────────────────────────

function validateFields(
  source: Record<string, unknown>,
  schema: Schema,
  label: string
): string[] {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = source[field];
    const missing =
      value === undefined || value === null || value === "";

    if (missing) {
      if (rules.required) {
        errors.push(`${label} '${field}' é obrigatório`);
      }
      continue;
    }

    // Type check
    if (rules.type) {
      const actual = Array.isArray(value) ? "array" : typeof value;
      if (actual !== rules.type) {
        errors.push(
          `${label} '${field}' deve ser do tipo ${rules.type} (recebido: ${actual})`
        );
        continue; // Skip further checks if type is wrong
      }
    }

    // Numeric bounds
    if (typeof value === "number") {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${label} '${field}' deve ser ≥ ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${label} '${field}' deve ser ≤ ${rules.max}`);
      }
    }

    // String / array length
    if (typeof value === "string" || Array.isArray(value)) {
      const len = (value as string | unknown[]).length;
      if (rules.minLength !== undefined && len < rules.minLength) {
        errors.push(
          `${label} '${field}' deve ter no mínimo ${rules.minLength} caractere(s)`
        );
      }
      if (rules.maxLength !== undefined && len > rules.maxLength) {
        errors.push(
          `${label} '${field}' deve ter no máximo ${rules.maxLength} caractere(s)`
        );
      }
    }

    // Regex pattern
    if (rules.pattern && typeof value === "string") {
      if (!rules.pattern.test(value)) {
        errors.push(`${label} '${field}' tem formato inválido`);
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

/** Validates `req.body` against the given schema. */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
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

/** Validates `req.params` against the given schema. */
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

/** Validates `req.query` (string values) against the given schema. */
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

// ─── Common shared rules ──────────────────────────────────────────

/** MongoDB ObjectId / custom string ID — max 128 chars, no whitespace */
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
    v === "P1" || v === "P2" ? null : "Payer deve ser 'P1' ou 'P2'",
};
