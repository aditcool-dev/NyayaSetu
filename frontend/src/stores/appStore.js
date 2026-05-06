import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Notifications
      notifications: [],
      // Directive selection for batch ops
      selectedDirectives: new Set(),
      // Filters for Verify page
      filters: {
        department: '',
        status: '',
        priority: '',
        search: '',
      },

      // ── Notifications ──
      addNotification: (notification) => {
        set((state) => ({
          notifications: [
            {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              read: false,
              ...notification,
            },
            ...state.notifications,
          ].slice(0, 50),
        }));
      },
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },
      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      clearNotifications: () => set({ notifications: [] }),

      // ── Directive Selection ──
      toggleDirectiveSelection: (id) => {
        set((state) => {
          const newSet = new Set(state.selectedDirectives);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return { selectedDirectives: newSet };
        });
      },
      selectAllDirectives: (ids) => {
        set({ selectedDirectives: new Set(ids) });
      },
      clearSelection: () => set({ selectedDirectives: new Set() }),

      // ── Filters ──
      setFilter: (key, value) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }));
      },
      resetFilters: () => {
        set({ filters: { department: '', status: '', priority: '', search: '' } });
      },
    }),
    {
      name: 'nyayasetu-app-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        filters: state.filters,
      }),
    }
  )
);
