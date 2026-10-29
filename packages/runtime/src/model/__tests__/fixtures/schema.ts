// packages/runtime/src/model/__tests__/fixtures/schema.ts
/**
 * Test helpers: reads the JSON schema and the example files of `schema/`
 * and compiles the schema with Ajv (draft 2020-12, strict mode).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';

/** `schema/` folder at the repository root. */
export const SCHEMA_DIR = resolve(__dirname, '../../../../../../schema');

export const EXAMPLE_NAMES = ['minimal', 'tween-and-static', 'folders'] as const;
export type ExampleName = (typeof EXAMPLE_NAMES)[number];

export function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(SCHEMA_DIR, relativePath), 'utf8'));
}

export function readSchema(): Record<string, unknown> {
  const schema = readJson('timeline.schema.json');
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new Error('timeline.schema.json must contain an object');
  }
  return { ...schema };
}

export function readExample(name: ExampleName): unknown {
  return readJson(`examples/${name}.json`);
}

/** Compiles the schema in strict mode, reporting all errors. */
export function compileSchema(): ValidateFunction {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  return ajv.compile(readSchema());
}
