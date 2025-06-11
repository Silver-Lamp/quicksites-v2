// hooks/useDashboardLayout.ts

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

type Block = { id: string; title: string };
type Settings = Record<string, Record<string, any>>;

export function useDashboardLayout(userId: string | null, dashboardId?: string) {
  const [order, setOrder] = useState<Block[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(dashboardId || null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch dashboards for the user
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from('dashboard_user_layouts')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        setDashboards(data || []);
        if (!activeDashboardId && data?.[0]) {
          setActiveDashboardId(data[0].dashboard_id);
        }
        setLoading(false);
      });
  }, [userId]);

  // Load selected layout
  useEffect(() => {
    if (!userId || !activeDashboardId) return;
    setLoading(true);
    supabase
      .from('dashboard_user_layouts')
      .select('layout, hidden, settings')
      .eq('user_id', userId)
      .eq('dashboard_id', activeDashboardId)
      .single()
      .then(({ data }) => {
        if (data?.layout) setOrder(data.layout);
        if (data?.hidden) setHidden(data.hidden);
        if (data?.settings) setSettings(data.settings);
        setLoaded(true);
        setLoading(false);
      });

    const channel = supabase
      .channel('dashboard_sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dashboard_user_layouts',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const updated = payload.new;
          if (updated.dashboard_id === activeDashboardId) {
            if (updated.layout) setOrder(updated.layout);
            if (updated.hidden) setHidden(updated.hidden);
            if (updated.settings) setSettings(updated.settings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeDashboardId]);

  const save = async (layout: Block[], hiddenList: string[], newSettings = settings) => {
    if (!userId || !activeDashboardId) return;
    setLoading(true);
    await supabase
      .from('dashboard_user_layouts')
      .upsert({
        user_id: userId,
        dashboard_id: activeDashboardId,
        layout,
        hidden: hiddenList,
        settings: newSettings,
        updated_at: new Date().toISOString(),
      });
    setOrder(layout);
    setHidden(hiddenList);
    setSettings(newSettings);
    setLoading(false);
  };

  const updateBlockSetting = (blockId: string, key: string, value: any) => {
    const newSettings = {
      ...settings,
      [blockId]: {
        ...(settings[blockId] || {}),
        [key]: value,
      },
    };
    save(order, hidden, newSettings);
  };
  const createDashboard = async (name: string) => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('dashboard_user_layouts')
      .insert({
        user_id: userId,
        name,
        layout: "DEFAULT_LAYOUT",
        hidden: [],
        settings: {},
      })
      .select()
      .single();
  
    if (data) {
      setDashboards((prev) => [...prev, data]);
      setActiveDashboardId(data.dashboard_id);
      setOrder(data.layout);
      setHidden([]);
      setSettings({});
      setLoading(false);
    }
  };
  
  return {
    order,
    hidden,
    settings,
    dashboards,
    activeDashboardId,
    setActiveDashboardId,
    loaded,
    save,
    updateBlockSetting,
    createDashboard,
    loading,
  };
}
