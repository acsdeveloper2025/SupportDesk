import { describe, expect, it } from "vitest";

import {
  evaluateVisibilityRule,
  isFieldVisible,
  sanitizeAnswers,
  type ServiceFormField,
  type ServiceFormSchema,
  validateAnswers,
  validateFieldValue,
  validateFormSchema,
} from "./form-engine";

const schema: ServiceFormSchema = {
  fields: [
    {
      key: "software",
      label: "Software",
      type: "SELECT",
      required: true,
      options: ["word", "excel"],
    },
    {
      key: "license_count",
      label: "License count",
      type: "NUMBER",
      required: false,
      validation: { min: 1, max: 100 },
    },
    { key: "company_email", label: "Company email", type: "EMAIL", required: true },
    {
      key: "details",
      label: "Details",
      type: "TEXTAREA",
      required: false,
      visibleWhen: { fieldKey: "software", operator: "EQ", value: "word" },
    },
  ],
};

describe("validateFormSchema", () => {
  it("rejects schemas without fields", () => {
    expect(validateFormSchema({ fields: [] })).toHaveLength(1);
    expect(validateFormSchema({ fields: [] })[0]).toContain("at least one field");
  });

  it("rejects invalid field keys", () => {
    const errors = validateFormSchema({
      fields: [{ key: "Bad Key!", label: "Bad", type: "TEXT", required: false }],
    });
    expect(errors.some((error) => error.includes("must be lowercase alphanumeric"))).toBe(true);
  });

  it("rejects duplicate field keys", () => {
    const errors = validateFormSchema({
      fields: [
        { key: "a", label: "A", type: "TEXT", required: false },
        { key: "a", label: "B", type: "TEXT", required: false },
      ],
    });
    expect(errors.some((error) => error.includes("duplicate field key"))).toBe(true);
  });

  it("requires options for SELECT/RADIO/MULTI_SELECT fields", () => {
    const errors = validateFormSchema({
      fields: [{ key: "choice", label: "Choice", type: "SELECT", required: false }],
    });
    expect(errors.some((error) => error.includes("requires at least one option"))).toBe(true);
  });

  it("rejects visibleWhen referencing itself or unknown fields", () => {
    const errors = validateFormSchema({
      fields: [
        {
          key: "a",
          label: "A",
          type: "TEXT",
          required: false,
          visibleWhen: { fieldKey: "a", operator: "EQ", value: "x" },
        },
      ],
    });
    expect(errors.some((error) => error.includes("must reference another field key"))).toBe(true);

    const unknown = validateFormSchema({
      fields: [
        { key: "a", label: "A", type: "TEXT", required: false },
        {
          key: "b",
          label: "B",
          type: "TEXT",
          required: false,
          visibleWhen: { fieldKey: "zzz", operator: "EQ", value: "x" },
        },
      ],
    });
    expect(unknown.some((error) => error.includes("references unknown field"))).toBe(true);
  });

  it("rejects unsupported visibleWhen operators", () => {
    const errors = validateFormSchema({
      fields: [
        { key: "a", label: "A", type: "TEXT", required: false },
        {
          key: "b",
          label: "B",
          type: "TEXT",
          required: false,
          visibleWhen: { fieldKey: "a", operator: "GTE", value: 5 },
        },
      ],
    });
    expect(errors.some((error) => error.includes("operator 'GTE' not supported"))).toBe(true);
  });

  it("accepts a valid schema", () => {
    expect(validateFormSchema(schema)).toHaveLength(0);
  });
});

describe("evaluateVisibilityRule", () => {
  it("evaluates EQ and NEQ on scalar values", () => {
    expect(
      evaluateVisibilityRule(
        { fieldKey: "software", operator: "EQ", value: "word" },
        { software: "word" },
      ),
    ).toBe(true);
    expect(
      evaluateVisibilityRule(
        { fieldKey: "software", operator: "EQ", value: "word" },
        { software: "excel" },
      ),
    ).toBe(false);
    expect(
      evaluateVisibilityRule(
        { fieldKey: "software", operator: "NEQ", value: "word" },
        { software: "excel" },
      ),
    ).toBe(true);
  });

  it("returns false when the referenced answer is absent", () => {
    expect(
      evaluateVisibilityRule({ fieldKey: "software", operator: "EQ", value: "word" }, {}),
    ).toBe(false);
  });

  it("evaluates CONTAINS for arrays and strings", () => {
    expect(
      evaluateVisibilityRule(
        { fieldKey: "tags", operator: "CONTAINS", value: "urgent" },
        { tags: ["a", "urgent"] },
      ),
    ).toBe(true);
    expect(
      evaluateVisibilityRule(
        { fieldKey: "note", operator: "CONTAINS", value: "urgent" },
        { note: "this is urgent" },
      ),
    ).toBe(true);
    expect(
      evaluateVisibilityRule(
        { fieldKey: "note", operator: "CONTAINS", value: "urgent" },
        { note: "not really" },
      ),
    ).toBe(false);
  });

  it("evaluates GTE and LTE numerically", () => {
    expect(
      evaluateVisibilityRule({ fieldKey: "count", operator: "GTE", value: 5 }, { count: 7 }),
    ).toBe(true);
    expect(
      evaluateVisibilityRule({ fieldKey: "count", operator: "GTE", value: 5 }, { count: 3 }),
    ).toBe(false);
    expect(
      evaluateVisibilityRule({ fieldKey: "count", operator: "LTE", value: 5 }, { count: 3 }),
    ).toBe(true);
  });
});

describe("isFieldVisible", () => {
  it("keeps fields without a rule visible", () => {
    expect(isFieldVisible(schema.fields[0]!, {})).toBe(true);
  });

  it("hides conditional fields when the rule does not match", () => {
    expect(isFieldVisible(schema.fields[3]!, { software: "word" })).toBe(true);
    expect(isFieldVisible(schema.fields[3]!, { software: "excel" })).toBe(false);
  });
});

describe("validateAnswers", () => {
  it("rejects unknown answer keys", () => {
    const result = validateAnswers(schema, {
      software: "word",
      company_email: "a@b.com",
      hack: "x",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.key === "hack")).toBe(true);
  });

  it("enforces required fields", () => {
    const result = validateAnswers(schema, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.key === "software")).toBe(true);
    expect(result.errors.some((error) => error.key === "company_email")).toBe(true);
  });

  it("validates types and constraints", () => {
    const result = validateAnswers(schema, {
      software: "word",
      license_count: 999,
      company_email: "not-an-email",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message.includes("at most 100"))).toBe(true);
    expect(result.errors.some((error) => error.message.includes("valid email"))).toBe(true);
  });

  it("does not require hidden fields", () => {
    const result = validateAnswers(schema, { software: "excel", company_email: "a@b.com" });
    expect(result.valid).toBe(true);
  });

  it("validates SELECT options", () => {
    const result = validateAnswers(schema, { software: "photoshop", company_email: "a@b.com" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.key === "software")).toBe(true);
  });

  it("passes a fully valid answer set", () => {
    const result = validateAnswers(schema, {
      software: "word",
      license_count: 5,
      company_email: "a@b.com",
      details: "notes",
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateFieldValue", () => {
  it("validates number bounds", () => {
    expect(validateFieldValue(schema.fields[1]!, 150)).toHaveLength(1);
    expect(validateFieldValue(schema.fields[1]!, 50)).toHaveLength(0);
  });

  it("validates email format", () => {
    expect(validateFieldValue(schema.fields[2]!, "bad")).toHaveLength(1);
    expect(validateFieldValue(schema.fields[2]!, "good@example.com")).toHaveLength(0);
  });

  it("validates MULTI_SELECT arrays against options", () => {
    const multi: ServiceFormField = {
      key: "m",
      label: "M",
      type: "MULTI_SELECT",
      required: false,
      options: ["a", "b"],
    };
    expect(validateFieldValue(multi, ["a"])).toHaveLength(0);
    expect(validateFieldValue(multi, ["a", "zzz"])).toHaveLength(1);
  });

  it("validates checkbox booleans", () => {
    const checkbox: ServiceFormField = { key: "c", label: "C", type: "CHECKBOX", required: false };
    expect(validateFieldValue(checkbox, true)).toHaveLength(0);
    expect(validateFieldValue(checkbox, "yes")).toHaveLength(1);
  });

  it("validates URL format", () => {
    const url: ServiceFormField = { key: "u", label: "U", type: "URL", required: false };
    expect(validateFieldValue(url, "https://example.com")).toHaveLength(0);
    expect(validateFieldValue(url, "not-a-url")).toHaveLength(1);
  });

  it("enforces min/max length on text fields", () => {
    const text: ServiceFormField = {
      key: "t",
      label: "T",
      type: "TEXT",
      required: false,
      validation: { minLength: 3, maxLength: 5 },
    };
    expect(validateFieldValue(text, "ab")).toHaveLength(1);
    expect(validateFieldValue(text, "abcdef")).toHaveLength(1);
    expect(validateFieldValue(text, "abc")).toHaveLength(0);
  });
});

describe("sanitizeAnswers", () => {
  it("drops unknown keys", () => {
    expect(sanitizeAnswers(schema, { software: "word", hack: "x" })).toEqual({ software: "word" });
  });

  it("keeps known keys unchanged", () => {
    expect(sanitizeAnswers(schema, { software: "word", company_email: "a@b.com" })).toEqual({
      software: "word",
      company_email: "a@b.com",
    });
  });
});
