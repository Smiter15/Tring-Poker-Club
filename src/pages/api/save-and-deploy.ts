import { createClient } from '@supabase/supabase-js';

// const supabase = createClient(
//   import.meta.env.PUBLIC_SUPABASE_URL,
//   import.meta.env.PUBLIC_PUBLIC_SUPABASE_KEY,
// );

export const saveAndDeploy: any = async (data: any) => {
  console.log('Saving game data and triggering deploy...', data);

  const { gameData } = data;
  console.log('gameData', gameData);

  console.log(
    'Triggering Netlify deploy hook...',
    import.meta.env.PUBLIC_NETLIFY_BUILD_HOOK,
  );

  const hookRes = await fetch(import.meta.env.NETLIFY_BUILD_HOOK, {
    method: 'POST',
  });

  console.log('Deploy hook response:', hookRes);

  if (!hookRes.ok) {
    console.error('Deploy hook failed:', await hookRes.text());
    return new Response('Failed to trigger deploy', { status: 502 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
