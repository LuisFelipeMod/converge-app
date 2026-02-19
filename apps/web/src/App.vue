<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useCollaborationStore } from '@/stores/collaboration';
import CollabCanvas from '@/components/CollabCanvas.vue';
import AuthCallback from '@/components/AuthCallback.vue';
import ShareModal from '@/components/ShareModal.vue';
import InvitationBadge from '@/components/InvitationBadge.vue';

const { t, locale } = useI18n();
const authStore = useAuthStore();
const store = useCollaborationStore();

const documentId = ref<string | null>(null);
const documentName = ref('');
const documents = ref<Array<{ id: string; name: string; ownerId: string | null; owner?: { name: string; email: string } | null }>>([]);
const archivedDocuments = ref<Array<{ id: string; name: string; ownerId: string | null }>>([]);
const loading = ref(false);
const initializing = ref(true);
const showArchived = ref(false);
const confirmingDeleteId = ref<string | null>(null);

// Sharing state
const sharingDocId = ref<string | null>(null);
const sharingDocName = ref('');
const inviteBadgeRef = ref<InstanceType<typeof InvitationBadge> | null>(null);

// Invite link state
const pendingInviteToken = ref<string | null>(null);
const inviteLinkInfo = ref<{ document: { id: string; name: string } } | null>(null);
const inviteLinkLoading = ref(false);

const isAuthCallback = computed(() =>
  window.location.pathname === '/auth/callback' ||
  window.location.search.includes('token='),
);

const myDocuments = computed(() =>
  documents.value.filter((d) => d.ownerId === authStore.user?.userId || d.ownerId === null),
);

const sharedDocuments = computed(() =>
  documents.value.filter((d) => d.ownerId !== null && d.ownerId !== authStore.user?.userId),
);

function isOwner(doc: { ownerId: string | null }) {
  return doc.ownerId === authStore.user?.userId || doc.ownerId === null;
}

const locales = [
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
];

function setLocale(code: string) {
  locale.value = code;
  localStorage.setItem('locale', code);
}

async function fetchDocuments() {
  if (!store.token) return;
  try {
    const res = await fetch('/api/documents', {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      documents.value = await res.json();
    }
  } catch {
    // Server might not be running
  }
}

async function createDocument() {
  const name = documentName.value.trim() || 'Untitled';
  try {
    loading.value = true;
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const doc = await res.json();
      documentId.value = doc.id;
      store.setDocument(doc.id);
      documentName.value = '';
    }
  } finally {
    loading.value = false;
  }
}

function openDocument(id: string) {
  documentId.value = id;
  store.setDocument(id);
}

function goBack() {
  documentId.value = null;
  fetchDocuments();
  inviteBadgeRef.value?.fetchInvitations();
}

async function deleteDocument(id: string) {
  try {
    await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    documents.value = documents.value.filter((d) => d.id !== id);
    archivedDocuments.value = archivedDocuments.value.filter((d) => d.id !== id);
  } catch {
    // ignore
  }
  confirmingDeleteId.value = null;
}

async function archiveDocument(id: string) {
  try {
    await fetch(`/api/documents/${id}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    const doc = documents.value.find((d) => d.id === id);
    documents.value = documents.value.filter((d) => d.id !== id);
    if (doc) archivedDocuments.value.unshift(doc);
  } catch {
    // ignore
  }
}

async function unarchiveDocument(id: string) {
  try {
    await fetch(`/api/documents/${id}/unarchive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    const doc = archivedDocuments.value.find((d) => d.id === id);
    archivedDocuments.value = archivedDocuments.value.filter((d) => d.id !== id);
    if (doc) documents.value.unshift(doc);
  } catch {
    // ignore
  }
}

async function fetchArchivedDocuments() {
  if (!store.token) return;
  try {
    const res = await fetch('/api/documents/archived', {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      archivedDocuments.value = await res.json();
    }
  } catch {
    // ignore
  }
}

function toggleArchived() {
  showArchived.value = !showArchived.value;
  if (showArchived.value && archivedDocuments.value.length === 0) {
    fetchArchivedDocuments();
  }
}

function openShareModal(doc: { id: string; name: string }) {
  sharingDocId.value = doc.id;
  sharingDocName.value = doc.name;
}

// Handle invite link token
async function processInviteToken(token: string) {
  if (!store.token) {
    // Save for after login
    localStorage.setItem('pending_invite_token', token);
    return;
  }
  inviteLinkLoading.value = true;
  try {
    const res = await fetch(`/api/share-links/${token}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      pendingInviteToken.value = token;
      inviteLinkInfo.value = data;
    }
  } catch { /* ignore */ }
  inviteLinkLoading.value = false;
  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);
}

async function acceptInviteLink() {
  if (!pendingInviteToken.value) return;
  inviteLinkLoading.value = true;
  try {
    const res = await fetch(`/api/share-links/${pendingInviteToken.value}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      pendingInviteToken.value = null;
      inviteLinkInfo.value = null;
      openDocument(data.documentId);
    }
  } catch { /* ignore */ }
  inviteLinkLoading.value = false;
}

function dismissInviteLink() {
  pendingInviteToken.value = null;
  inviteLinkInfo.value = null;
}

function onAuthenticated() {
  if (authStore.isAuthenticated) {
    fetchDocuments();
    checkPendingInviteToken();
  }
  initializing.value = false;
}

function checkPendingInviteToken() {
  // Check URL for invite param
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');
  if (inviteToken) {
    processInviteToken(inviteToken);
    return;
  }
  // Check localStorage for saved invite token (from pre-login)
  const saved = localStorage.getItem('pending_invite_token');
  if (saved) {
    localStorage.removeItem('pending_invite_token');
    processInviteToken(saved);
  }
}

onMounted(async () => {
  if (!isAuthCallback.value) {
    // Check if there's an invite token before auth init (to save it for after login)
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (inviteToken && !localStorage.getItem('auth_token')) {
      localStorage.setItem('pending_invite_token', inviteToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    await authStore.init();
    if (authStore.isAuthenticated) {
      fetchDocuments();
      checkPendingInviteToken();
    }
    initializing.value = false;
  }
});
</script>

<template>
  <!-- Auth callback handler -->
  <AuthCallback v-if="isAuthCallback" @authenticated="onAuthenticated" />

  <!-- Loading -->
  <div v-else-if="initializing" class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
  </div>

  <!-- Login page -->
  <div v-else-if="!authStore.isAuthenticated" class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <!-- Language selector -->
    <div class="absolute top-4 right-4 flex gap-1 z-10">
      <button
        v-for="loc in locales"
        :key="loc.code"
        :class="[
          'px-2 py-1 rounded text-xs font-medium transition-colors',
          locale === loc.code
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-700',
        ]"
        @click="setLocale(loc.code)"
      >
        {{ loc.label }}
      </button>
    </div>

    <div class="max-w-md w-full p-6 text-center">
      <img src="./logo.png" width="125px" height="125px" style="border-radius: 5rem;" class="mx-auto mb-4 animate-fade-in">
      <h1 class="text-3xl font-bold mb-2 animate-fade-in-up">{{ t('app.title') }}</h1>
      <p class="text-gray-400 mb-8 animate-fade-in-up" style="animation-delay: 50ms">{{ t('app.subtitle') }}</p>

      <div class="space-y-3">
        <button
          class="w-full flex items-center justify-center gap-3 bg-white text-gray-900 px-4 py-3 rounded-lg font-medium hover:bg-gray-100 transition-all duration-200 btn-press animate-fade-in-up"
          style="animation-delay: 100ms"
          @click="authStore.login('google')"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {{ t('app.loginGoogle') }}
        </button>

        <button
          class="w-full flex items-center justify-center gap-3 bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-all duration-200 border border-gray-600 btn-press animate-fade-in-up"
          style="animation-delay: 150ms"
          @click="authStore.login('github')"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          {{ t('app.loginGithub') }}
        </button>

        <div class="relative my-4">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-700"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-gray-900 text-gray-500">{{ t('app.or') }}</span>
          </div>
        </div>

        <button
          class="w-full text-gray-400 px-4 py-2 rounded-lg font-medium hover:text-white transition-all duration-200 text-sm animate-fade-in-up"
          style="animation-delay: 250ms"
          @click="authStore.loginAsGuest().then(() => fetchDocuments())"
        >
          {{ t('app.continueGuest') }}
        </button>
      </div>
    </div>
  </div>

  <!-- Invite link acceptance overlay -->
  <div v-else-if="inviteLinkInfo && !documentId" class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="max-w-sm w-full p-6 text-center">
      <div class="bg-gray-800 border border-gray-700 rounded-xl p-8">
        <svg class="w-12 h-12 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
        </svg>
        <p class="text-lg font-semibold mb-2">{{ t('invitation.joinDocument', { name: inviteLinkInfo.document.name }) }}</p>
        <div class="flex gap-3 mt-6">
          <button
            :disabled="inviteLinkLoading"
            class="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            @click="acceptInviteLink"
          >
            {{ t('invitation.acceptLink') }}
          </button>
          <button
            class="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2.5 rounded-lg font-medium transition-colors"
            @click="dismissInviteLink"
          >
            {{ t('app.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Document browser -->
  <div v-else-if="!documentId" class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <!-- Language selector -->
    <div class="absolute top-4 right-4 flex gap-1 z-10">
      <button
        v-for="loc in locales"
        :key="loc.code"
        :class="[
          'px-2 py-1 rounded text-xs font-medium transition-colors',
          locale === loc.code
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-700',
        ]"
        @click="setLocale(loc.code)"
      >
        {{ loc.label }}
      </button>
    </div>

    <div class="max-w-md w-full p-6">
      <div class="flex items-start justify-between mb-6">
        <div>
          <img src="./logo.png" width="80px" height="80px" style="border-radius: 3rem;">
          <h1 class="text-3xl font-bold mb-1">{{ t('app.title') }}</h1>
          <p class="text-gray-400 text-sm">{{ t('app.collaborativeWhiteboard') }}</p>
        </div>
        <div class="flex items-center gap-3">
          <InvitationBadge
            v-if="!authStore.isGuest"
            ref="inviteBadgeRef"
            @open-document="openDocument"
          />
          <div class="flex items-center gap-2">
            <img
              v-if="store.userAvatar"
              :src="store.userAvatar"
              class="w-8 h-8 rounded-full"
              :alt="store.userName"
            />
            <div
              v-else
              class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              :style="{ backgroundColor: store.userColor }"
            >
              {{ store.userName.slice(0, 2).toUpperCase() }}
            </div>
            <span class="text-sm text-gray-300">{{ store.userName }}</span>
          </div>
          <button
            class="text-gray-500 hover:text-gray-300 text-sm"
            @click="authStore.logout()"
          >
            {{ t('app.logout') }}
          </button>
        </div>
      </div>

      <div class="flex gap-2 mb-8">
        <input
          v-model="documentName"
          type="text"
          :placeholder="t('app.docPlaceholder')"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          @keyup.enter="createDocument"
        />
        <button
          :disabled="loading"
          class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          @click="createDocument"
        >
          {{ t('app.create') }}
        </button>
      </div>

      <!-- My Documents -->
      <div v-if="myDocuments.length > 0" class="space-y-2">
        <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3 animate-fade-in">{{ t('app.myDocuments') }}</h2>
        <TransitionGroup name="list" tag="div" class="space-y-2">
        <div
          v-for="(doc, index) in myDocuments"
          :key="doc.id"
          class="flex items-center bg-gray-800/80 border border-gray-700/60 rounded-lg transition-all duration-200 hover:border-gray-500 hover:translate-x-1 hover:bg-gray-800"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <button
            class="flex-1 text-left px-4 py-3 hover:text-blue-400 transition-colors duration-200 truncate"
            @click="openDocument(doc.id)"
          >{{ doc.name }}</button>
          <div class="flex items-center gap-1 pr-2">
            <template v-if="confirmingDeleteId === doc.id">
              <span class="text-xs text-gray-400">{{ t('app.confirmDelete') }}</span>
              <button
                class="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded transition-colors"
                @click.stop="deleteDocument(doc.id)"
              >{{ t('app.delete') }}</button>
              <button
                class="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded transition-colors"
                @click.stop="confirmingDeleteId = null"
              >{{ t('app.cancel') }}</button>
            </template>
            <template v-else>
              <!-- Share button (non-guests only) -->
              <button
                v-if="!authStore.isGuest"
                class="text-gray-500 hover:text-blue-400 p-1.5 rounded transition-colors"
                :title="t('app.share')"
                @click.stop="openShareModal(doc)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
              </button>
              <button
                v-if="!authStore.isGuest"
                class="text-gray-500 hover:text-yellow-400 p-1.5 rounded transition-colors"
                :title="t('app.archive')"
                @click.stop="archiveDocument(doc.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </button>
              <button
                class="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors"
                :title="t('app.delete')"
                @click.stop="confirmingDeleteId = doc.id"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </template>
          </div>
        </div>
        </TransitionGroup>
      </div>

      <!-- Shared with me -->
      <div v-if="sharedDocuments.length > 0" class="mt-6 space-y-2">
        <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3 animate-fade-in">{{ t('app.sharedWithMe') }}</h2>
        <TransitionGroup name="list" tag="div" class="space-y-2">
        <div
          v-for="(doc, index) in sharedDocuments"
          :key="doc.id"
          class="flex items-center bg-gray-800/80 border border-gray-700/60 rounded-lg transition-all duration-200 hover:border-gray-500 hover:translate-x-1 hover:bg-gray-800"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <button
            class="flex-1 text-left px-4 py-3 hover:text-blue-400 transition-colors duration-200 truncate"
            @click="openDocument(doc.id)"
          >
            <span>{{ doc.name }}</span>
            <span v-if="doc.owner" class="text-xs text-gray-500 ml-2">{{ t('app.ownerLabel', { name: doc.owner.name }) }}</span>
          </button>
        </div>
        </TransitionGroup>
      </div>

      <!-- Archived documents (hidden for guests) -->
      <div v-if="!authStore.isGuest" class="mt-6">
        <button
          class="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          @click="toggleArchived"
        >
          {{ showArchived ? t('app.hideArchived') : t('app.showArchived') }}
        </button>
        <Transition name="slide">
        <div v-if="showArchived && archivedDocuments.length > 0" class="space-y-2 mt-3">
          <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">{{ t('app.archived') }}</h2>
          <div
            v-for="doc in archivedDocuments"
            :key="doc.id"
            class="flex items-center bg-gray-800/50 border border-gray-700/50 rounded-lg transition-colors"
          >
            <span class="flex-1 text-left px-4 py-3 text-gray-500 truncate">{{ doc.name }}</span>
            <div class="flex items-center gap-1 pr-2">
              <template v-if="confirmingDeleteId === doc.id">
                <span class="text-xs text-gray-400">{{ t('app.confirmDelete') }}</span>
                <button
                  class="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded transition-colors"
                  @click.stop="deleteDocument(doc.id)"
                >{{ t('app.delete') }}</button>
                <button
                  class="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded transition-colors"
                  @click.stop="confirmingDeleteId = null"
                >{{ t('app.cancel') }}</button>
              </template>
              <template v-else-if="isOwner(doc)">
                <button
                  class="text-gray-500 hover:text-green-400 p-1.5 rounded transition-colors"
                  :title="t('app.unarchive')"
                  @click.stop="unarchiveDocument(doc.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                </button>
                <button
                  class="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors"
                  :title="t('app.delete')"
                  @click.stop="confirmingDeleteId = doc.id"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </template>
            </div>
          </div>
        </div>
        </Transition>
      </div>
    </div>

    <!-- Share Modal -->
    <ShareModal
      v-if="sharingDocId"
      :document-id="sharingDocId"
      :document-name="sharingDocName"
      @close="sharingDocId = null"
    />
  </div>

  <!-- Canvas -->
  <div v-else class="relative">
    <button
      class="absolute top-4 left-4 z-20 glass hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm text-gray-300 transition-all duration-200 btn-press animate-slide-down"
      @click="goBack"
    >
      {{ t('app.back') }}
    </button>
    <CollabCanvas :document-id="documentId" />
  </div>
</template>
