'use server';
import { getLatestDraws } from '@/lib/db';

export async function checkWinningTickets() {
  const latest645 = getLatestDraws('645', 1);
  const latest655 = getLatestDraws('655', 1);

  return {
    '645': latest645.length > 0 ? latest645[0] : null,
    '655': latest655.length > 0 ? latest655[0] : null
  };
}
