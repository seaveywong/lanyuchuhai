import { create } from 'zustand';

export const useUserStore = create((set) => ({
  accessToken: localStorage.getItem('customer_token') || null,
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('customer_token', token);
    set({ accessToken: token, user });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('customer_token');
    set({ accessToken: null, user: null });
  },
}));
