import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { supabase } from '@/admin/lib/supabaseClient.js';
import { useLeads } from '@/hooks/useLeads.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function useCampaignForm(city: string, state: string) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameWasManuallySet, setNameWasManuallySet] = useState(false);
  const [alt1, setAlt1] = useState('');
  const [alt2, setAlt2] = useState('');
  const [startsAt, setStartsAt] = useState(dayjs().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(dayjs().add(3, 'day').toISOString().slice(0, 16));
  const [silentMode, setSilentMode] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { leads, loading: leadsLoading } = useLeads({ city, state, industry: 'towing' });

  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  function toggleLead(id: string) {
    setSelectedLeads((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  useEffect(() => {
    if (!nameWasManuallySet && city && selectedLeads.length >= 2 && startsAt) {
      const a = leads.find((l) => l.id === selectedLeads[0])?.business_name?.split(' ')[0] || 'A';
      const b = leads.find((l) => l.id === selectedLeads[1])?.business_name?.split(' ')[0] || 'B';
      const category = 'Towing';
      const date = dayjs(startsAt).format('YYYY-MM-DD');
      setName(`${city} ${category}: ${a} vs ${b} ${date}`);
    }
  }, [city, selectedLeads, nameWasManuallySet, startsAt]);

  useEffect(() => {
    if (selectedLeads.length >= 2) {
      const leadA = leads.find((l) => l.id === selectedLeads[0]);
      const leadB = leads.find((l) => l.id === selectedLeads[1]);

      if (leadA && !alt1) setAlt1(slugify(leadA.business_name || '') + '.com');
      if (leadB && !alt2) setAlt2(slugify(leadB.business_name || '') + '.com');
    }
  }, [selectedLeads, leads]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || '');
    });
  }, []);

  function validateFields(): boolean {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = 'Campaign name is required.';
    if (selectedLeads.length < 2) errors.leads = 'Select at least 2 leads.';
    if (dayjs(startsAt).isAfter(dayjs(endsAt)))
      errors.dates = 'Start date must be before end date.';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const submit = async (mode: 'draft' | 'submit' = 'submit') => {
    setError(null);
    if (!validateFields()) return;

    const status = mode === 'draft' ? 'draft' : 'active';

    const { data, error: insertError } = await supabase
      .from('campaigns')
      .insert([
        {
          name,
          city,
          state,
          starts_at: startsAt,
          ends_at: endsAt,
          lead_ids: selectedLeads,
          alt_domains: [alt1, alt2],
          created_by: email,
          status,
        },
      ])
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (mode === 'submit') {
      await supabase.from('leads').update({ campaign_id: data.id }).in('id', selectedLeads);

      if (!silentMode) {
        await supabase.from('user_action_logs').insert([
          {
            action_type: 'campaign_created',
            triggered_by: email,
            notes: `Created campaign: ${name}`,
          },
        ]);
      }

      router.push(`/admin/campaigns?new=${data.id}`);
    } else {
      router.push(`/admin/start-campaign?draftId=${data.id}`);
    }
  };

  return {
    name,
    setName,
    nameWasManuallySet,
    setNameWasManuallySet,
    alt1,
    alt2,
    setAlt1,
    setAlt2,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    silentMode,
    setSilentMode,
    email,
    error,
    validationErrors,
    submit,
    leads,
    selectedLeads,
    toggleLead,
    leadsLoading,
  };
}
