import { getServerSupabase } from '@/lib/supabase/server';
import type { LineItemInput } from './types';

/**
 * Minimal bridge that reads your legacy "meals" rows and maps to Catalog-like items.
 * Adjust table/columns to match your current schema.
 */
export async function getMealAsLineItem(mealId: string): Promise<LineItemInput | null> {
  const supabase = await getServerSupabase({ serviceRole: true });
  const { data: meal } = await supabase
    .from('meals')
    .select('id,title,price_cents')
    .eq('id', mealId).single();
  if (!meal) return null;
  return {
    catalogItemId: `legacy:meal:${meal.id}`,
    title: meal.title,
    quantity: 1,
    unitAmount: meal.price_cents
  };
}
