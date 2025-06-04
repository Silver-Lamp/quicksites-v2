export function saveDraft(templateId: string, data: any) {
  const key = `draft-${templateId}`;
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  } catch (err) {
    console.warn('Failed to save draft:', err);
  }
}

export function shouldAutosave(templateId: string): boolean {
  const key = `autosave-paused-${templateId}`;
  return localStorage.getItem(key) !== 'true';
}

export function getAutosaveStatus(templateId: string): string {
  return shouldAutosave(templateId) ? 'active' : 'paused';
}
