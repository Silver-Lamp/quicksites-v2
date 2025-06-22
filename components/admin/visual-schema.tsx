// components/VisualSchema.tsx
import { useState } from 'react';
import {
  z,
  ZodTypeAny,
  ZodObject,
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodDefault,
} from 'zod';

interface VisualSchemaProps {
  schema: ZodTypeAny;
  onDeployClick?: (data: Record<string, any>) => void;
}

function renderType(schema: ZodTypeAny): string {
  if (schema instanceof ZodDefault) return `${renderType(schema._def.innerType)} (default)`;
  if (schema instanceof ZodString) return 'string';
  if (schema instanceof ZodNumber) return 'number';
  if (schema instanceof ZodBoolean) return 'boolean';
  if (schema instanceof ZodEnum) return `enum [${schema._def.values.join(', ')}]`;
  if (schema instanceof ZodLiteral) return `literal (${JSON.stringify(schema._def.value)})`;
  if (schema instanceof ZodArray) return `array of ${renderType(schema._def.type)}`;
  if (schema instanceof ZodObject) return 'object';
  return 'unknown';
}

function ExampleValue(schema: ZodTypeAny): any {
  if (schema instanceof ZodDefault) return ExampleValue(schema._def.innerType);
  if (schema instanceof ZodString) return 'example string';
  if (schema instanceof ZodNumber) return 123;
  if (schema instanceof ZodBoolean) return true;
  if (schema instanceof ZodEnum) return schema._def.values[0];
  if (schema instanceof ZodLiteral) return schema._def.value;
  if (schema instanceof ZodArray) return [ExampleValue(schema._def.type)];
  if (schema instanceof ZodObject) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(schema.shape)) {
      result[key] = ExampleValue(val as ZodTypeAny);
    }
    return result;
  }
  return null;
}

function SchemaField({ name, schema }: { name: string; schema: ZodTypeAny }) {
  const [expanded, setExpanded] = useState(true);
  const isObject = schema instanceof ZodObject;
  const isArrayOfObject = schema instanceof ZodArray && schema._def.type instanceof ZodObject;
  const nestedSchema = isObject ? schema : isArrayOfObject ? schema._def.type : null;
  const description = schema.description || '';
  const defaultValue = schema instanceof ZodDefault ? schema._def.defaultValue() : undefined;

  return (
    <div className="ml-4 border-l pl-4 my-1">
      <div
        className="text-sm cursor-pointer hover:underline"
        onClick={() => nestedSchema && setExpanded(!expanded)}
      >
        <strong>{name}</strong>: {renderType(schema)}
        <span className="ml-2 text-gray-500">e.g., {JSON.stringify(ExampleValue(schema))}</span>
        {defaultValue !== undefined && (
          <span className="ml-2 text-blue-500">(default: {JSON.stringify(defaultValue)})</span>
        )}
      </div>
      {description && <div className="text-xs text-gray-600 italic ml-2">{description}</div>}
      {nestedSchema && expanded && <div>{renderObject(nestedSchema)}</div>}
    </div>
  );
}

function renderObject(schema: ZodObject<any>): React.ReactNode[] {
  const shape = schema.shape;
  return Object.entries(shape).map(([key, value]) => (
    <SchemaField key={key} name={key} schema={value as ZodTypeAny} />
  ));
}

export default function VisualSchema({ schema, onDeployClick }: VisualSchemaProps) {
  if (!(schema instanceof z.ZodObject))
    return <p className="text-sm text-gray-600">Not an object schema.</p>;
  const example = ExampleValue(schema);

  return (
    <div className="text-sm font-mono bg-gray-50 p-4 rounded border space-y-4">
      {renderObject(schema)}
      {onDeployClick && (
        <button
          onClick={() => onDeployClick(example)}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm"
        >
          🚀 Deploy to QuickSites
        </button>
      )}
    </div>
  );
}
