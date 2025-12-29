import { useState, useEffect } from 'react';
import { supabase, WebhookData } from '../lib/supabase';

export const useWebhookData = () => {
  const [data, setData] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: webhookData, error } = await supabase
        .from('webhook_data')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      setData(webhookData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('webhook_data')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_data',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { data, loading, error, refetch: fetchData };
};