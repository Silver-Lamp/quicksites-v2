// lib/templates/persistServices.ts
export async function persistServices(templateId: string, services: string[]) {
    const res = await fetch(`/api/templates/${templateId}/services`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return (json.services ?? []) as string[];
  }
  