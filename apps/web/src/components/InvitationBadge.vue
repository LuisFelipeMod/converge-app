<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCollaborationStore } from '@/stores/collaboration';

const emit = defineEmits<{
  openDocument: [id: string];
}>();

const { t } = useI18n();
const store = useCollaborationStore();

const invitations = ref<Array<{
  id: string;
  document: { id: string; name: string };
  sharedBy: { name: string; email: string; avatar?: string };
  createdAt: string;
}>>([]);
const showDropdown = ref(false);

async function fetchInvitations() {
  try {
    const res = await fetch('/api/invitations', {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) invitations.value = await res.json();
  } catch { /* ignore */ }
}

async function acceptInvite(invite: typeof invitations.value[0]) {
  try {
    const res = await fetch(`/api/invitations/${invite.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      invitations.value = invitations.value.filter((i) => i.id !== invite.id);
      emit('openDocument', invite.document.id);
      showDropdown.value = false;
    }
  } catch { /* ignore */ }
}

async function declineInvite(id: string) {
  try {
    const res = await fetch(`/api/invitations/${id}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      invitations.value = invitations.value.filter((i) => i.id !== id);
    }
  } catch { /* ignore */ }
}

defineExpose({ fetchInvitations });

onMounted(() => {
  fetchInvitations();
});
</script>

<template>
  <div class="relative">
    <button
      class="relative text-gray-400 hover:text-white transition-colors p-1.5"
      :title="t('invitation.title')"
      @click="showDropdown = !showDropdown"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>
      <span
        v-if="invitations.length > 0"
        class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
      >
        {{ invitations.length }}
      </span>
    </button>

    <!-- Dropdown -->
    <Transition name="fade">
      <div
        v-if="showDropdown"
        class="absolute right-0 top-full mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50"
      >
        <div class="p-3 border-b border-gray-700">
          <h3 class="text-sm font-semibold text-white">{{ t('invitation.title') }}</h3>
        </div>
        <div v-if="invitations.length === 0" class="p-4 text-center">
          <p class="text-sm text-gray-500">{{ t('invitation.empty') }}</p>
        </div>
        <div v-else class="max-h-60 overflow-y-auto">
          <div
            v-for="invite in invitations"
            :key="invite.id"
            class="p-3 border-b border-gray-700/50 last:border-b-0"
          >
            <p class="text-sm text-white font-medium truncate">{{ invite.document.name }}</p>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ t('invitation.from') }} {{ invite.sharedBy.name }}
              <span class="text-gray-600">({{ invite.sharedBy.email }})</span>
            </p>
            <div class="flex gap-2 mt-2">
              <button
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
                @click="acceptInvite(invite)"
              >
                {{ t('invitation.accept') }}
              </button>
              <button
                class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-1.5 rounded-lg font-medium transition-colors"
                @click="declineInvite(invite.id)"
              >
                {{ t('invitation.decline') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Click outside to close -->
    <div
      v-if="showDropdown"
      class="fixed inset-0 z-40"
      @click="showDropdown = false"
    />
  </div>
</template>
