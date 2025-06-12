import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

export default function StartCampaign() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState((router.query.city as string) || '');
  const [state, setState] = useState((router.query.state as string) || '');
  const [lead1, setLead1] = useState('');
  const [lead2, setLead2] = useState('');
  const [alt1, setAlt1] = useState('');
  const [alt2, setAlt2] = useState('');
  const [startsAt, setStartsAt] = useState(dayjs().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(dayjs().add(3, 'day').toISOString().slice(0, 16));
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase
      .from('leads')
      .select('id, business_name, address_city')
      .then(({ data }) => {
        if (!city) setLeads(data || []);
        else if (!city) {
        setLeads(data || []);
      } else {
        const filtered = (data || []).filter(l => l.address_city?.toLowerCase() === city.toLowerCase());
        setLeads(filtered);
        if (filtered.length >= 2) {
          setLead1(filtered[0].id);
          setLead2(filtered[1].id);
        }
      }
      });

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email || '');
    });
  }, [city]);

  const start = async (e: any) => {
    e.preventDefault();
    const { data, error } = await supabase.from('campaigns').insert([
      {
        name,
        city,
        state,
        starts_at: startsAt,
        ends_at: endsAt,
        lead_ids: [lead1, lead2],
        alt_domains: [alt1, alt2],
        created_by: email
      }
    ]).select().single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from('leads')
      .update({ campaign_id: data.id })
      .in('id', [lead1, lead2]);

    await supabase.from('user_action_logs').insert([
      {
        action_type: 'campaign_created',
        triggered_by: email,
        notes: `Created campaign: ${name}`
      }
    ]);

    router.push('/campaigns');
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Start New Campaign</h1>
      <form onSubmit={start} className="space-y-4 max-w-lg">
        <input
          placeholder="Campaign Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          required
        />
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          required
        />
        <input
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          required
        />
        <div className="flex gap-4">
          <div className="flex flex-col flex-1">
            <select value={lead1} onChange={(e) => setLead1(e.target.value)} required className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 mb-1">
              <option value="">Select Lead 1</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.business_name}</option>)}
            </select>
            <input
              placeholder="Alt Domain 1"
              value={alt1}
              onChange={(e) => setAlt1(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1"
              required
            />
          </div>
          <div className="flex flex-col flex-1">
            <select value={lead2} onChange={(e) => setLead2(e.target.value)} required className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 mb-1">
              <option value="">Select Lead 2</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.business_name}</option>)}
            </select>
            <input
              placeholder="Alt Domain 2"
              value={alt2}
              onChange={(e) => setAlt2(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1"
              required
            />
          </div>
        </div>
        <div className="flex gap-4">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
          />
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
          />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" type="submit">
          Launch Campaign
        </button>
      </form>
    </div>
  );
}
