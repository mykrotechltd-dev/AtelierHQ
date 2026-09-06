import { useInfiniteQuery } from "@tanstack/react-query";

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "Exhausted";

/**
 * Adapter over useInfiniteQuery that mimics Convex's usePaginatedQuery shape
 * ({results, status, loadMore}) so paginated list pages need only swap their
 * import/query call, not their render logic.
 */
export function usePaginatedQuery<T>(
  queryKey: readonly unknown[],
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number
): { results: T[]; status: PaginationStatus; loadMore: () => void } {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const items = await fetchPage(pageParam, pageSize);
      return { items, nextOffset: items.length < pageSize ? null : pageParam + pageSize };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  const results = query.data?.pages.flatMap((p) => p.items) ?? [];
  const status: PaginationStatus = query.isLoading
    ? "LoadingFirstPage"
    : query.hasNextPage
      ? "CanLoadMore"
      : "Exhausted";

  return {
    results,
    status,
    loadMore: () => query.fetchNextPage(),
  };
}
