'use client';

import { Fragment } from 'react';
import { z, ZodObject, ZodFirstPartyTypeKind } from 'zod';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import useTypedQueryParam from '@/hooks/useTypedQueryParam';

function FieldRenderer({
  keyPrefix,
  fieldKey,
  validator,
}: {
  keyPrefix: string;
  fieldKey: string;
  validator: any;
}) {
  const fullKey = keyPrefix ? `${keyPrefix}.${fieldKey}` : fieldKey;
  const type = validator._def.typeName;
  const enumValues = validator._def?.values;

  const isArray = type === ZodFirstPartyTypeKind.ZodArray;
  const innerType = isArray ? validator._def.type._def.typeName : null;

  let queryType: any = 'string';
  if (type === ZodFirstPartyTypeKind.ZodNumber || innerType === ZodFirstPartyTypeKind.ZodNumber)
    queryType = isArray ? 'number[]' : 'number';
  if (type === ZodFirstPartyTypeKind.ZodBoolean || innerType === ZodFirstPartyTypeKind.ZodBoolean)
    queryType = isArray ? 'boolean[]' : 'boolean';
  if (isArray) queryType = 'json[]';
  if (type === ZodFirstPartyTypeKind.ZodObject) queryType = 'json';

  const [value, setValue] = useTypedQueryParam(fullKey, isArray ? [] : {}, queryType);

  if (type === ZodFirstPartyTypeKind.ZodObject) {
    const nestedFields = Object.entries(validator.shape);
    return (
      <div className="border rounded p-4 space-y-2 bg-gray-50 dark:bg-gray-900">
        <FieldLabel className="text-xs uppercase tracking-wide text-muted-foreground">{fieldKey}</FieldLabel>
        {nestedFields.map(([nestedKey, nestedValidator]) => (
          <FieldRenderer
            key={nestedKey}
            keyPrefix={fullKey}
            fieldKey={nestedKey}
            validator={nestedValidator}
          />
        ))}
      </div>
    );
  }

  if (type === ZodFirstPartyTypeKind.ZodEnum && enumValues) {
    return (
      <div className="space-y-1">
        <FieldLabel>{fieldKey}</FieldLabel>
        <Select value={value as string} onValueChange={setValue}>
          <SelectTrigger id={fullKey} />
          <SelectContent>
            {enumValues.map((v: string) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === ZodFirstPartyTypeKind.ZodBoolean) {
    return (
      <div className="space-y-1">
        <FieldLabel htmlFor={fullKey}>{fieldKey}</FieldLabel>
        <Switch
          id={fullKey}
          checked={value === true || value === 'true'}
          onCheckedChange={(v: boolean) => setValue(v)}
        />
      </div>
    );
  }

  if (isArray) {
    const asString = Array.isArray(value) ? value.join(', ') : '';
    return (
      <div className="space-y-1">
        <FieldLabel htmlFor={fullKey}>{fieldKey}</FieldLabel>
        <Input
          id={fullKey}
          value={asString}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            setValue(parsed);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <FieldLabel htmlFor={fullKey}>{fieldKey}</FieldLabel>
      <Input
        id={fullKey}
        type={queryType}
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

export default function QueryParamEditor({ schema, slug }: { schema: z.ZodSchema; slug: string }) {
  const shape = (schema as ZodObject<any>).shape;
  const fields = Object.entries(shape);

  return (
    <div className="space-y-6">
      {fields.map(([key, validator]) => (
        <Fragment key={key}>
          <FieldRenderer keyPrefix="" fieldKey={key} validator={validator} />
        </Fragment>
      ))}
    </div>
  );
}
