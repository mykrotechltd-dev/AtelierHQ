import { useInfiniteQuery } from "@tanstack/react-query";

type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "Exhausted"
  | "Error";

/**
 * Adapter over useInfiniteQuery that mimics Convex's usePaginatedQuery shape
 * ({results, status, loadMore}) so paginated list pages need only swap their
 * import/query call, not their render logic.
 */
export function usePaginatedQuery<T>(
  queryKey: readonly unknown[],
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number,
): {
  results: T[];
  status: PaginationStatus;
  error: unknown;
  loadMore: () => void;
  retry: () => void;
} {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const items = await fetchPage(pageParam, pageSize);
      return {
        items,
        nextOffset: items.length < pageSize ? null : pageParam + pageSize,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  const results = query.data?.pages.flatMap((p) => p.items) ?? [];
  // isError must be checked before isLoading/hasNextPage: a failed fetch
  // still leaves isLoading false and hasNextPage falsy, which previously
  // fell through to "Exhausted" — indistinguishable from "no results".
  const status: PaginationStatus = query.isError
    ? "Error"
    : query.isLoading
      ? "LoadingFirstPage"
      : query.hasNextPage
        ? "CanLoadMore"
        : "Exhausted";

  return {
    results,
    status,
    error: query.error,
    loadMore: () => query.fetchNextPage(),
    retry: () => query.refetch(),
  };
}
