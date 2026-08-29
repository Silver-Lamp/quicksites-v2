// app/admin/business-plan/deck/page.tsx
// Redirect — the deck moved to /business-plan/deck with the plan itself. See ../page.tsx.
import { redirect } from 'next/navigation';

export default function AdminBusinessPlanDeckRedirect() {
  redirect('/business-plan/deck');
}
