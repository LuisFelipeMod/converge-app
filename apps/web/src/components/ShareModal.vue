<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCollaborationStore } from '@/stores/collaboration';
import { API_BASE } from '@/config';

const props = defineProps<{
  documentId: string;
  documentName: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const store = useCollaborationStore();

const email = ref('');
const shares = ref<Array<{ id: string; sharedWith: { name: string; email: string }; status: string }>>([]);
const shareLink = ref<{ id: string; token: string; active: boolean } | null>(null);
const linkCopied = ref(false);
const inviteError = ref('');
const inviteLoading = ref(false);
const origin = window.location.origin;

async function fetchShares() {
  try {
    const res = await fetch(`${API_BASE}/api/documents/${props.documentId}/shares`, {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) shares.value = await res.json();
  } catch { /* ignore */ }
}

async function fetchShareLink() {
  try {
    const res = await fetch(`${API_BASE}/api/documents/${props.documentId}/share-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
    });
    if (res.ok) shareLink.value = await res.json();
  } catch { /* ignore */ }
}

async function inviteByEmail() {
  if (!email.value.trim()) return;
  inviteError.value = '';
  inviteLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/documents/${props.documentId}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({ email: email.value.trim() }),
    });
    if (res.ok) {
      email.value = '';
      fetchShares();
    } else {
      const data = await res.json();
      if (res.status === 404) inviteError.value = t('share.userNotFound');
      else if (res.status === 409) {
        const msg = data.message || '';
        inviteError.value = msg.includes('yourself') ? t('share.cannotShareSelf') : t('share.alreadyShared');
      }
    }
  } catch { /* ignore */ }
  inviteLoading.value = false;
}

async function removeShare(shareId: string) {
  try {
    await fetch(`${API_BASE}/api/shares/${shareId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    shares.value = shares.value.filter((s) => s.id !== shareId);
  } catch { /* ignore */ }
}

async function generateLink() {
  await fetchShareLink();
}

async function deactivateLink() {
  if (!shareLink.value) return;
  try {
    await fetch(`${API_BASE}/api/share-links/${shareLink.value.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    shareLink.value = null;
  } catch { /* ignore */ }
}

function copyLink() {
  if (!shareLink.value) return;
  const url = `${window.location.origin}?invite=${shareLink.value.token}`;
  navigator.clipboard.writeText(url);
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2000);
}

onMounted(() => {
  fetchShares();
});
</script>

<template>
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" @click.self="emit('close')">
    <div class="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4 p-6 animate-fade-in">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-white">{{ t('share.title') }}</h2>
        <button class="text-gray-400 hover:text-white transition-colors" @click="emit('close')">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Email invite -->
      <div class="mb-5">
        <label class="text-sm text-gray-400 mb-2 block">{{ t('share.emailLabel') }}</label>
        <div class="flex gap-2">
          <input
            v-model="email"
            type="email"
            :placeholder="t('share.emailPlaceholder')"
            class="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            @keyup.enter="inviteByEmail"
          />
          <button
            :disabled="inviteLoading || !email.trim()"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-white"
            @click="inviteByEmail"
          >
            {{ t('share.invite') }}
          </button>
        </div>
        <p v-if="inviteError" class="text-red-400 text-xs mt-1">{{ inviteError }}</p>
      </div>

      <!-- Link sharing -->
      <div class="mb-5">
        <label class="text-sm text-gray-400 mb-2 block">{{ t('share.linkLabel') }}</label>
        <div v-if="shareLink" class="space-y-2">
          <div class="flex gap-2">
            <input
              readonly
              :value="`${origin}?invite=${shareLink.token}`"
              class="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 truncate"
            />
            <button
              class="px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white"
              :class="linkCopied ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'"
              @click="copyLink"
            >
              {{ linkCopied ? t('share.linkCopied') : t('share.copyLink') }}
            </button>
          </div>
          <button
            class="text-xs text-red-400 hover:text-red-300 transition-colors"
            @click="deactivateLink"
          >
            {{ t('share.deactivateLink') }}
          </button>
        </div>
        <button
          v-else
          class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors text-white"
          @click="generateLink"
        >
          {{ t('share.generateLink') }}
        </button>
      </div>

      <!-- Current shares -->
      <div v-if="shares.length > 0">
        <label class="text-sm text-gray-400 mb-2 block">{{ t('share.currentShares') }}</label>
        <div class="space-y-2 max-h-40 overflow-y-auto">
          <div
            v-for="share in shares"
            :key="share.id"
            class="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2"
          >
            <div>
              <span class="text-sm text-white">{{ share.sharedWith.name }}</span>
              <span class="text-xs text-gray-500 ml-2">{{ share.sharedWith.email }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="share.status === 'ACCEPTED' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'"
              >
                {{ share.status === 'ACCEPTED' ? t('share.accepted') : t('share.pending') }}
              </span>
              <button
                class="text-gray-500 hover:text-red-400 transition-colors"
                @click="removeShare(share.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
