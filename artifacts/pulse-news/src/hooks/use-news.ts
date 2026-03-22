import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  getNewsArticles, 
  likeNewsArticle, 
  bookmarkNewsArticle, 
  getCategories,
  getGetNewsArticlesQueryKey,
  getGetCategoriesQueryKey
} from "@workspace/api-client-react";

export function useCategories() {
  return useQuery({
    queryKey: getGetCategoriesQueryKey(),
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useInfiniteNewsFeed(category?: string) {
  return useInfiniteQuery({
    queryKey: ['news', 'feed', category],
    queryFn: async ({ pageParam = 1 }) => {
      return getNewsArticles({ page: pageParam, limit: 10, category });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}

export function useLikeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => likeNewsArticle(id),
    onMutate: async (id) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['news', 'feed'] });

      // Snapshot previous value
      const previousQueries = queryClient.getQueriesData({ queryKey: ['news', 'feed'] });

      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: ['news', 'feed'] }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            articles: page.articles.map((article: any) => {
              if (article.id === id) {
                return { ...article, likes: article.likes + 1 };
              }
              return article;
            }),
          })),
        };
      });

      return { previousQueries };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // We don't invalidate here to prevent the UI from jittering, 
      // but in a real app we might invalidate in the background.
    },
  });
}

export function useBookmarkArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => bookmarkNewsArticle(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['news', 'feed'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['news', 'feed'] });

      queryClient.setQueriesData({ queryKey: ['news', 'feed'] }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            articles: page.articles.map((article: any) => {
              if (article.id === id) {
                return { ...article, isBookmarked: !article.isBookmarked };
              }
              return article;
            }),
          })),
        };
      });

      return { previousQueries };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
  });
}
