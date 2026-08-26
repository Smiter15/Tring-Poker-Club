export const saveAndDeploy = async (data: { gameData?: number }) => {
  console.log('Saving game data and triggering deploy...', data);

  const hookRes = await fetch(import.meta.env.NETLIFY_BUILD_HOOK, {
    method: 'POST',
  });

  if (!hookRes.ok) {
    console.error('Deploy hook failed:', await hookRes.text());
    return new Response('Failed to trigger deploy', { status: 502 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
