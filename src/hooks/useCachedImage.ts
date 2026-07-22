import { useQuery } from '@tanstack/react-query';
import { getCachedImage } from '../lib/imageCache';

export function useCachedImage(url: string | undefined | null): string | undefined | null {
  const { data } = useQuery({
    queryKey: ['cachedImage', url],
    queryFn: async () => {
      if (!url) return url;
      return getCachedImage(url);
    },
    enabled: !!url,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return data ?? url;
}
