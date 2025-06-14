import { ReactNode } from 'react';

export type DomainEntry = {
    city: ReactNode;
    state: ReactNode;
    template_id: ReactNode;
    is_claimed: any;
    id: string;
    domain: string;
    template_name: string;
    published: boolean;
    created_at: string; // or Date if you parse it
  };
  