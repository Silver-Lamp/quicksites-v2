// Usage: tsx scripts/query-inspector.ts '?config=...&filters=...'
import { parse } from 'querystring';
import { queryParamSchemas } from '@/admin/lib/queryParamSchemas';

const input = process.argv[2] || '';
const parsed = parse(input.replace(/^\?/, ''));

console.log('\n🔍 Query Param Inspector\n');

Object.entries(parsed).forEach(([key, value]) => {
  const isRegistered = key in queryParamSchemas;
  const registeredType = isRegistered
    ? typeof queryParamSchemas[key as keyof typeof queryParamSchemas]
    : null;

  console.log(
    `• ${key}: ${Array.isArray(value) ? 'string[]' : 'string'} ${
      isRegistered ? `✅ schema: ${registeredType}` : '❌ no schema'
    }`
  );
});
