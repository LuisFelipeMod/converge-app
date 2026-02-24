import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { API_BASE, BACKEND_BASE } from '@/config';

export interface AuthUser {
  userId: string;
  email: string | null;
  name: string;
  avatar: string | null;
  guest?: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const token = ref<string | null>(localStorage.getItem('auth_token'));
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isGuest = computed(() => user.value?.guest === true);
  const loading = ref(false);

  function login(provider: 'google' | 'github') {
    window.location.href = `${BACKEND_BASE}/auth/${provider}`;
  }

  async function handleCallback(newToken: string) {
    token.value = newToken;
    localStorage.setItem('auth_token', newToken);
    await fetchProfile();
  }

  async function loginAsGuest() {
    const guestId = Math.random().toString(36).slice(2, 10);
    const guestName = `Guest-${guestId.slice(0, 4)}`;
    try {
      const res = await fetch(`${API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: guestId, name: guestName }),
      });
      if (res.ok) {
        const data = await res.json();
        token.value = data.token;
        localStorage.setItem('auth_token', data.token);
        user.value = {
          userId: guestId,
          email: null,
          name: guestName,
          avatar: null,
          guest: true,
        };
      }
    } catch {
      // Server might not be running
    }
  }

  async function fetchProfile() {
    if (!token.value) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (res.ok) {
        const profile = await res.json();
        user.value = {
          userId: profile.userId,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
        };
      } else {
        // Token invalid
        logout();
      }
    } catch {
      // Server might not be running
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('auth_token');
  }

  async function init() {
    if (token.value) {
      loading.value = true;
      await fetchProfile();
      // If fetchProfile failed but token exists, try decoding as guest
      if (!user.value && token.value) {
        try {
          const payload = JSON.parse(atob(token.value.split('.')[1]));
          if (payload.guest) {
            user.value = {
              userId: payload.sub,
              email: null,
              name: payload.name,
              avatar: null,
              guest: true,
            };
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }
      loading.value = false;
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isGuest,
    loading,
    login,
    handleCallback,
    loginAsGuest,
    fetchProfile,
    logout,
    init,
  };
});
