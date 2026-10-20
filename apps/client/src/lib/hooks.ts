import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs, type Meta } from "./api";
import { useAuth } from "./auth";
import { useToast, errMsg } from "../components/ui";

/** Liste paginee scopee au commerce actif (la cle de cache inclut le commerce). */
export function useList<T>(key: string, path: string, params: Record<string, unknown> = {}, enabled = true) {
  const { activeId } = useAuth();
  const q = useQuery({
    queryKey: [key, activeId, path, params], enabled: enabled && !!activeId, placeholderData: keepPreviousData,
    queryFn: async () => { const r = await api<T[]>("GET", `${path}${qs(params)}`); return { items: r.data, meta: r.meta as Meta | undefined }; },
  });
  return { items: q.data?.items, meta: q.data?.meta, loading: q.isLoading, error: q.error, refetch: q.refetch, fetching: q.isFetching };
}
export function useData<T>(key: string, path: string, enabled = true) {
  const { activeId } = useAuth();
  return useQuery({ queryKey: [key, activeId, path], enabled: enabled && !!activeId, queryFn: async () => (await api<T>("GET", path)).data });
}
/** Mutation avec message d'erreur lisible et invalidation de caches. */
export function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, opts: { invalidate?: string[]; success?: string; onSuccess?: (r: R) => void } = {}) {
  const qc = useQueryClient(); const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => { for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: [k] }); if (opts.success) toast("success", opts.success); opts.onSuccess?.(r); },
    onError: (e) => toast("error", errMsg(e)),
  });
}
