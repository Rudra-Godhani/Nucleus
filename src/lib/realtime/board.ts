import { createClient } from "@/lib/supabase/client";

/**
 * The board's live channel — the app's second data path.
 *
 * `src/lib/data/*` is the first: REST, on the server, `import "server-only"`. This
 * one is a websocket, in the browser, so it cannot live there. It gets its own
 * directory rather than a quiet exception inside the data layer, so that "where can
 * Supabase be touched from" still has a short and honest answer: here, and in
 * lib/data. ESLint keeps every other file out of both.
 *
 * What arrives here is a notification, not data. The payload carries the changed
 * issue row, and it is deliberately thrown away: acting on it would mean a second
 * copy of "how an issue becomes a card" living in the browser, drifting from the one
 * on the server. Instead the caller re-fetches, and the server component that
 * already knows how to build a board builds it again. One source of truth, at the
 * cost of a round trip nobody will notice.
 */

export type BoardChange = "INSERT" | "UPDATE" | "DELETE";

/**
 * Listen for changes to a project's issues. Returns an unsubscribe function.
 *
 * The channel is PRIVATE, which is what makes Realtime run RLS on
 * `realtime.messages` before letting this user join. Drop `private: true` and the
 * channel becomes readable by anyone who can name the topic — the project id, which
 * is in the URL. See the realtime_board migration and supabase/tests/007.
 */
export function subscribeToBoard(
  projectId: string,
  onChange: (change: BoardChange) => void,
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`project:${projectId}`, { config: { private: true } })
    .on("broadcast", { event: "INSERT" }, () => onChange("INSERT"))
    .on("broadcast", { event: "UPDATE" }, () => onChange("UPDATE"))
    .on("broadcast", { event: "DELETE" }, () => onChange("DELETE"));

  // `setAuth()` hands Realtime the signed-in user's JWT, and it must land BEFORE
  // subscribe(): a private channel is authorized at join time, so joining without a
  // token is simply refused. It is async, and this function is not — hence the
  // `cancelled` flag, which covers the case where the component unmounts while the
  // token is still in flight and there is no channel to leave yet.
  let cancelled = false;

  void supabase.realtime.setAuth().then(() => {
    if (!cancelled) channel.subscribe();
  });

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}
