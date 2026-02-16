<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCollaborationStore } from '@/stores/collaboration';
import CollabCanvas from '@/components/CollabCanvas.vue';

const store = useCollaborationStore();
const documentId = ref<string | null>(null);
const documentName = ref('');
const documents = ref<Array<{ id: string; name: string }>>([]);
const loading = ref(false);

async function fetchDocuments() {
  try {
    const res = await fetch('/api/documents', {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (res.ok) {
      documents.value = await res.json();
    }
  } catch {
    // Server might not be running yet
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
}

onMounted(fetchDocuments);
</script>

<template>
  <div v-if="!documentId" class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="max-w-md w-full p-6">
      <h1 class="text-3xl font-bold mb-2">Realtime Collab</h1>
      <p class="text-gray-400 mb-8">Collaborative whiteboard with real-time sync</p>

      <div class="flex gap-2 mb-8">
        <input
          v-model="documentName"
          type="text"
          placeholder="Document name..."
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          @keyup.enter="createDocument"
        />
        <button
          :disabled="loading"
          class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          @click="createDocument"
        >
          Create
        </button>
      </div>

      <div v-if="documents.length > 0" class="space-y-2">
        <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Documents</h2>
        <button
          v-for="doc in documents"
          :key="doc.id"
          class="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg px-4 py-3 transition-colors hover:border-gray-600"
          @click="openDocument(doc.id)"
        >
          {{ doc.name }}
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-8">
        Connected as <span class="text-gray-300">{{ store.userName }}</span>
      </p>
    </div>
  </div>

  <div v-else class="relative">
    <button
      class="absolute top-4 left-4 z-20 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-md text-sm text-gray-300 transition-colors"
      @click="goBack"
    >
      Back
    </button>
    <CollabCanvas :document-id="documentId" />
  </div>
</template>
