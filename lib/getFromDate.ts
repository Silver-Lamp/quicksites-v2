// lib/getFromDate.ts
export function getFromDate(label: string): Date | null {
    const now = new Date();
  
    switch (label) {
      case 'Today': {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
  
      case 'Yesterday': {
        const from = new Date(now);
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        return from;
      }
  
      case 'Last 7 days': {
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        return from;
      }
  
      case 'Last 30 days': {
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        return from;
      }
  
      case 'This month': {
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
  
      case 'Last month': {
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }
  
      case 'This year': {
        return new Date(now.getFullYear(), 0, 1);
      }
  
      case 'All time':
      default:
        return null;
    }
  }
  export const dateFilterOptions = [
    'Today',
    'Yesterday',
    'Last 7 days',
    'Last 30 days',
    'This month',
    'Last month',
    'This year',
    'All time',
  ] as const;
  
  export type DateFilterOption = (typeof dateFilterOptions)[number];
    