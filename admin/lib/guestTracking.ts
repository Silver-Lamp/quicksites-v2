export function incrementGuestActionCount(limit = 5): boolean {
  const key = 'guest-action-count';
  const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, count.toString());
  return count >= limit;
}

export function resetGuestActionCount() {
  localStorage.removeItem('guest-action-count');
}
