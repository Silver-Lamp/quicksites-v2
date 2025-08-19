// app/admin/meals/page.tsx
import MealsAutofillPanel from '@/components/admin/meals/meals-autofill-panel';

export default function AdminMealsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Meals</h1>
      <MealsAutofillPanel />
    </div>
  );
}
