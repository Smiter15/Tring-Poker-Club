import { supabase } from '../../db/supabase';

export class AdminError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}

export async function login(password: string) {
  const { data, error } = await supabase.rpc('club_admin_login', {
    p_password: password,
  });
  if (error) throw new Error('Could not unlock club admin. Please try again.');
  if (data.error) throw new Error(data.error);
  return data as { token: string; expiresAt: string };
}

export async function adminAction(
  token: string,
  action: string,
  payload: unknown = {},
) {
  const { data, error } = await Promise.resolve(
    supabase.rpc('club_admin_action', {
      p_token: token,
      p_action: action,
      p_payload: payload,
    }),
  ).catch(() => {
    throw new AdminError(
      'The connection was interrupted. Retry the same request to confirm what was saved.',
      true,
    );
  });
  if (error) {
    if (error.code === '28000')
      throw new Error(
        'Your session has expired. Unlock results entry again; your draft is saved.',
      );
    if (error.code === '23505')
      throw new Error(
        'That season and game number already exist. Open the existing game to correct it.',
      );
    if (error.code === '40001')
      throw new Error(
        'Someone changed this game. Refresh the game list and review their latest results before trying again.',
      );
    throw new AdminError(
      error.message || 'The request could not be completed. Please try again.',
      !error.code,
    );
  }
  return data;
}
