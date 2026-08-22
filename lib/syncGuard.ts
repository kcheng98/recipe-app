/**
 * Guards every place cloud data could silently replace local data.
 *
 * This exists because of a real incident: two devices signed in around the
 * same time, before either had ever pushed data to Supabase. Both raced to
 * create the account's very first cloud row — one with real recipes, one
 * empty. Only one insert could win, and the LOSER's code used to just
 * adopt whatever won, no matter what it contained — silently overwriting a
 * real recipe library (and its own local cache) with nothing.
 *
 * The rule going forward: no code path may automatically replace local
 * data with incoming (cloud/remote) data if that would mean going from
 * "has real content" to "empty or meaningfully less content." Any such
 * transition must pause and ask a human, instead of resolving itself.
 */
export function isSuspiciousDataLoss(localCount: number, remoteCount: number): boolean {
  if (localCount === 0) return false; // nothing here to lose
  return remoteCount < localCount * 0.5;
}
