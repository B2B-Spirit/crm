<template>
  <section class="mt-5">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-lg font-medium">{{ __('Attachments') }}</h4>
      <Button
        :label="__('Upload Attachment')"
        iconLeft="lucide-plus"
        @click="showUploader = true"
      />
    </div>
    <p v-if="error" role="alert" class="mt-2 text-ink-red-4">{{ error }}</p>
    <p v-else-if="loading && !files.length" class="mt-2">{{ __('Loading...') }}</p>
    <p v-else-if="!files.length" class="mt-2 text-ink-gray-5">
      {{ __('No attachments yet') }}
    </p>
    <ul v-else class="mt-2 space-y-2">
      <li v-for="file in files" :key="file.name">
        <a
          :href="file.file_url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ink-gray-8 underline"
        >{{ file.file_name }}</a>
      </li>
    </ul>
    <Button
      v-if="hasMore"
      class="mt-2"
      :label="__('Load more')"
      :loading="loading"
      @click="loadFiles(true)"
    />
    <FilesUploader
      v-if="showUploader"
      v-model="showUploader"
      doctype="CRM Meeting Minutes"
      :docname="docname"
      @after="loadFiles()"
    />
  </section>
</template>

<script setup>
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import { call } from 'frappe-ui'
import { ref, watch } from 'vue'

const props = defineProps({ docname: { type: String, required: true } })
const files = ref([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
const showUploader = ref(false)
const pageSize = 20
let requestId = 0

async function loadFiles(append = false) {
  const id = ++requestId
  loading.value = true
  error.value = ''
  if (!append) {
    files.value = []
    hasMore.value = false
  }
  try {
    const result = await call('frappe.client.get_list', {
      doctype: 'File',
      fields: ['name', 'file_name', 'file_url'],
      filters: {
        attached_to_doctype: 'CRM Meeting Minutes',
        attached_to_name: props.docname,
      },
      order_by: 'creation desc, name desc',
      limit_start: append ? files.value.length : 0,
      limit_page_length: pageSize + 1,
    })
    if (id !== requestId) return
    hasMore.value = result.length > pageSize
    const page = result.slice(0, pageSize)
    files.value = append ? [...files.value, ...page] : page
  } catch (err) {
    if (id === requestId) {
      error.value = err.messages?.[0] || __('Could not load attachments')
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => props.docname, () => loadFiles(), { immediate: true })
</script>
