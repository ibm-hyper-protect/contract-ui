import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'g100', // 'white' for light mode, 'g100' for dark mode

      toggleTheme: () => set((state) => ({
        theme: state.theme === 'white' ? 'g100' : 'white'
      }))
    }),
    {
      name: 'ccrt-theme-storage'
    }
  )
);
