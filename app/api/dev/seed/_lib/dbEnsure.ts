// _lib/dbEnsure.ts
import { randomUUID } from 'crypto';
import type { AnyClient } from './clients';
import { T_MERCHANTS, T_CHEFS } from './env';

export async function ensureMerchantForUser(db: AnyClient, userId: string, name: string) {
  {
    const { data, error } = await db.from(T_MERCHANTS).select('id').eq('user_id', userId).limit(1);
    if (!error && data?.[0]?.id) return data[0].id as string;
    if (error && !/does not exist|relation.*does not exist|could not find/i.test(`${error.message} ${error.details ?? ''}`)) {
      throw new Error(error.message);
    }
  }
  const payload = { id: randomUUID(), user_id: userId, name, display_name: name };
  const { error: ins } = await db.from(T_MERCHANTS).insert(payload);
  if (ins && !/duplicate key value/i.test(ins.message)) throw new Error(ins.message);
  const { data: again, error: err2 } = await db.from(T_MERCHANTS).select('id').eq('user_id', userId).limit(1);
  if (err2) throw new Error(err2.message);
  return again?.[0]?.id as string;
}

export async function ensureChefForUser(db: AnyClient, userId: string, merchantId: string, name: string) {
  {
    const { data, error } = await db.from(T_CHEFS).select('id, merchant_id').eq('user_id', userId).limit(1);
    if (!error && data?.[0]?.id) {
      const chefId = data[0].id as string;
      if (data[0].merchant_id !== merchantId) {
        await db.from(T_CHEFS).update({ merchant_id: merchantId }).eq('id', chefId);
      }
      return chefId;
    }
    if (error && !/does not exist|relation.*does not exist|could not find/i.test(`${error.message} ${error.details ?? ''}`)) {
      throw new Error(error.message);
    }
  }
  const payload = { id: randomUUID(), user_id: userId, merchant_id: merchantId, name };
  const { error: ins } = await db.from(T_CHEFS).insert(payload);
  if (ins && !/duplicate key value/i.test(ins.message)) throw new Error(ins.message);
  const { data: again, error: err2 } = await db.from(T_CHEFS).select('id').eq('user_id', userId).limit(1);
  if (err2) throw new Error(err2.message);
  return again?.[0]?.id as string;
}