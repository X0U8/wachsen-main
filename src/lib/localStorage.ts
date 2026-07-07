

const CACHE_PREFIX = 'glixup_';

export const localStorageCache = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);
      return parsed.data || parsed;
    } catch (error) {
      console.error('LocalStorage get error:', error);
      return null;
    }
  },

  set<T>(key: string, data: T): void {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
    } catch (error: any) {
      console.error('LocalStorage set error:', error);
      
      if (error.name === 'QuotaExceededError') {
        localStorageCache.clear();
        try {
          localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
        } catch (retryError) {
          console.error('LocalStorage retry failed:', retryError);
        }
      }
    }
  },

  remove(key: string): void {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },

  clear(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  },

  
  keys: {
    EXAM_CATEGORIES: 'exam_categories',
    EXAM_INSTANCES: (categoryId: string) => `exams_${categoryId}`,
    RESULTS: 'results',
    UPCOMING_EXAMS: 'upcoming_exams',
    USER_PROFILE: 'user_profile',
    CREDITS: 'credits',
  },
};

export default localStorageCache;
