export type SmartLinkItem = {
    id?: string;
    type: 'template' | 'snapshot';
    label?: string;
    query?: Record<string, string | number | boolean>;
    theme?: 'primary' | 'muted' | 'danger' | 'outline';
  };
  