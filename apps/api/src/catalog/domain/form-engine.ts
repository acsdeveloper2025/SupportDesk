export const SERVICE_FORM_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "RADIO",
  "CHECKBOX",
  "EMAIL",
  "URL",
  "FILE",
] as const;

export type ServiceFormFieldType = (typeof SERVICE_FORM_FIELD_TYPES)[number];

export const CONDITIONAL_OPERATORS = ["EQ", "NEQ", "CONTAINS", "GTE", "LTE"] as const;

export type ConditionalOperator = (typeof CONDITIONAL_OPERATORS)[number];

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  maxFiles?: number;
  maxFileSizeBytes?: number;
}

export interface ConditionalVisibility {
  fieldKey: string;
  operator: ConditionalOperator;
  value: unknown;
}

export interface ServiceFormField {
  key: string;
  label: string;
  type: ServiceFormFieldType;
  helpText?: string;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
  visibleWhen?: ConditionalVisibility;
}

export interface ServiceFormSchema {
  fields: ServiceFormField[];
}

export interface FieldError {
  key: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

const OPTION_FIELD_TYPES: ReadonlySet<ServiceFormFieldType> = new Set([
  "SELECT",
  "MULTI_SELECT",
  "RADIO",
]);

const OPTION_OPERATORS: ReadonlySet<ConditionalOperator> = new Set(["EQ", "NEQ"]);

/** Structural validation of a form schema definition (used at create/update time). */
export function validateFormSchema(schema: ServiceFormSchema): string[] {
  const errors: string[] = [];
  if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) {
    return ["form schema must define at least one field"];
  }

  const keys = new Set<string>();
  for (const field of schema.fields) {
    if (!field.key || typeof field.key !== "string") {
      errors.push("every field requires a key");
      continue;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(field.key)) {
      errors.push(`field key '${field.key}' must be lowercase alphanumeric starting with a letter`);
    }
    if (keys.has(field.key)) {
      errors.push(`duplicate field key '${field.key}'`);
    }
    keys.add(field.key);

    if (!field.label || typeof field.label !== "string") {
      errors.push(`field '${field.key}' requires a label`);
    }
    if (!SERVICE_FORM_FIELD_TYPES.includes(field.type)) {
      errors.push(`field '${field.key}' has unsupported type '${String(field.type)}'`);
    }
    if (
      OPTION_FIELD_TYPES.has(field.type) &&
      (!Array.isArray(field.options) || field.options.length === 0)
    ) {
      errors.push(`field '${field.key}' of type ${field.type} requires at least one option`);
    }
    if (
      field.type !== "SELECT" &&
      field.type !== "MULTI_SELECT" &&
      field.type !== "RADIO" &&
      Array.isArray(field.options)
    ) {
      errors.push(`field '${field.key}' of type ${field.type} must not define options`);
    }

    if (field.visibleWhen) {
      const rule = field.visibleWhen;
      if (typeof rule.fieldKey !== "string" || rule.fieldKey === field.key) {
        errors.push(`field '${field.key}' visibleWhen must reference another field key`);
      }
      if (!OPTION_OPERATORS.has(rule.operator) && rule.operator !== "CONTAINS") {
        errors.push(`field '${field.key}' visibleWhen operator '${rule.operator}' not supported`);
      }
      if (rule.value === undefined || rule.value === null || rule.value === "") {
        errors.push(`field '${field.key}' visibleWhen requires a non-empty value`);
      }
    }
  }

  for (const field of schema.fields) {
    if (field.visibleWhen && !keys.has(field.visibleWhen.fieldKey)) {
      errors.push(
        `field '${field.key}' visibleWhen references unknown field '${field.visibleWhen.fieldKey}'`,
      );
    }
  }

  return errors;
}

function normalizeComparisonValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim();
  }
  return value;
}

/** Evaluates a single conditional visibility rule against the submitted answers. */
export function evaluateVisibilityRule(
  rule: ConditionalVisibility,
  answers: Record<string, unknown>,
): boolean {
  const actual = answers[rule.fieldKey];
  if (actual === undefined || actual === null) {
    return false;
  }

  const actualNorm = normalizeComparisonValue(actual);
  const expectedNorm = normalizeComparisonValue(rule.value);

  switch (rule.operator) {
    case "EQ":
      return actualNorm === expectedNorm;
    case "NEQ":
      return actualNorm !== expectedNorm;
    case "CONTAINS": {
      if (Array.isArray(actualNorm)) {
        return (actualNorm as unknown[]).some(
          (item) => normalizeComparisonValue(item) === expectedNorm,
        );
      }
      return String(actualNorm).includes(String(expectedNorm));
    }
    case "GTE":
      return toComparableNumber(actualNorm) >= toComparableNumber(expectedNorm);
    case "LTE":
      return toComparableNumber(actualNorm) <= toComparableNumber(expectedNorm);
    default:
      return false;
  }
}

function toComparableNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/** A field is visible when it has no visibleWhen rule or the rule evaluates true. */
export function isFieldVisible(field: ServiceFormField, answers: Record<string, unknown>): boolean {
  if (!field.visibleWhen) {
    return true;
  }
  return evaluateVisibilityRule(field.visibleWhen, answers);
}

/** Validates submitted answers against the schema, considering only visible fields. */
export function validateAnswers(
  schema: ServiceFormSchema,
  answers: Record<string, unknown>,
): ValidationResult {
  const errors: FieldError[] = [];
  const fieldByKey = new Map(schema.fields.map((field) => [field.key, field]));

  for (const key of Object.keys(answers)) {
    if (!fieldByKey.has(key)) {
      errors.push({ key, message: `unknown field '${key}' in answers` });
    }
  }

  for (const field of schema.fields) {
    if (!isFieldVisible(field, answers)) {
      continue;
    }

    const value = answers[field.key];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors.push({ key: field.key, message: `'${field.label}' is required` });
      continue;
    }
    if (isEmpty) {
      continue;
    }

    const ruleErrors = validateFieldValue(field, value);
    errors.push(...ruleErrors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateFieldValue(field: ServiceFormField, value: unknown): FieldError[] {
  const errors: FieldError[] = [];
  const validation = field.validation ?? {};

  switch (field.type) {
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "URL": {
      const text = String(value);
      if (validation.minLength !== undefined && text.length < validation.minLength) {
        errors.push({
          key: field.key,
          message: `'${field.label}' must be at least ${validation.minLength} characters`,
        });
      }
      if (validation.maxLength !== undefined && text.length > validation.maxLength) {
        errors.push({
          key: field.key,
          message: `'${field.label}' must be at most ${validation.maxLength} characters`,
        });
      }
      if (field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        errors.push({ key: field.key, message: `'${field.label}' must be a valid email address` });
      }
      if (field.type === "URL" && !/^https?:\/\/\S+$/i.test(text)) {
        errors.push({ key: field.key, message: `'${field.label}' must be a valid http(s) URL` });
      }
      if (validation.pattern) {
        try {
          if (!new RegExp(validation.pattern).test(text)) {
            errors.push({
              key: field.key,
              message: `'${field.label}' does not match the required format`,
            });
          }
        } catch {
          // invalid regexp at schema time is caught by validateFormSchema callers
        }
      }
      break;
    }
    case "NUMBER": {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors.push({ key: field.key, message: `'${field.label}' must be a number` });
        break;
      }
      if (validation.min !== undefined && number < validation.min) {
        errors.push({
          key: field.key,
          message: `'${field.label}' must be at least ${validation.min}`,
        });
      }
      if (validation.max !== undefined && number > validation.max) {
        errors.push({
          key: field.key,
          message: `'${field.label}' must be at most ${validation.max}`,
        });
      }
      break;
    }
    case "DATE": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        errors.push({ key: field.key, message: `'${field.label}' must be a valid date` });
      }
      break;
    }
    case "SELECT":
    case "RADIO": {
      if (!field.options?.includes(String(value))) {
        errors.push({ key: field.key, message: `'${field.label}' has an invalid option` });
      }
      break;
    }
    case "MULTI_SELECT": {
      if (!Array.isArray(value)) {
        errors.push({ key: field.key, message: `'${field.label}' must be an array of options` });
        break;
      }
      const options = field.options ?? [];
      const invalid = (value as unknown[]).some((item) => !options.includes(String(item)));
      if (invalid) {
        errors.push({ key: field.key, message: `'${field.label}' contains invalid options` });
      }
      break;
    }
    case "CHECKBOX": {
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        errors.push({ key: field.key, message: `'${field.label}' must be a boolean` });
      }
      break;
    }
    case "FILE": {
      const files = Array.isArray(value) ? value : [value];
      if (validation.maxFiles !== undefined && files.length > validation.maxFiles) {
        errors.push({
          key: field.key,
          message: `'${field.label}' allows at most ${validation.maxFiles} files`,
        });
      }
      break;
    }
    default:
      break;
  }

  return errors;
}

/** Filters answers down to fields defined in the schema, preserving visibility order. */
export function sanitizeAnswers(
  schema: ServiceFormSchema,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const known = new Set(schema.fields.map((field) => field.key));
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (known.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
