import { z } from 'zod';

// Null → empty string
export const stringOrEmpty = z.preprocess((val) => (val == null ? '' : val), z.string());

// Null → optional nullable string
export const nullableString = z.string().nullable().optional();

// Null → '' then must be a valid URL
export const urlOrEmpty = z.preprocess((val) => (val == null ? '' : val), z.string().url());

// Null → empty object for optional object shapes
export const objectOrEmpty = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((val) => (val === null ? {} : val), z.object(shape));

// Null → empty array of strings
export const stringArrayOrEmpty = z.preprocess(
  (val) => (val == null ? [] : val),
  z.array(z.string())
);

// Null → empty array of any (for nested blocks etc.)
export const arrayOrEmpty = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((val) => (val == null ? [] : val), z.array(item));

// Validate lowercase slug
export const slugField = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase and hyphen-separated',
  });

// Validate emails (with null → '')
export const emailOrEmpty = z.preprocess(
  (val) => (val == null ? '' : val),
  z.string().email('Must be a valid email')
);

// U.S. phone (basic)
export const phoneOrEmpty = z.preprocess(
  (val) => (val == null ? '' : val),
  z
    .string()
    .min(7)
    .regex(/^[0-9+()\-\s]+$/, {
      message: 'Phone must be a valid number',
    })
);
