import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazily-created anon client. Creating it eagerly at module scope made
// `next build` prerendering crash when env vars are absent (e.g. Vercel builds
// that start before environment variables are saved).
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

/**
 * Browser/anon Supabase client (RLS applies). Lazy proxy so importing this
 * module never touches env vars until first actual use.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient() as any;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
