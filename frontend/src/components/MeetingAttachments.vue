<template>
  <section class="mt-5 border-t border-outline-elevation-2 pt-4">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-lg font-medium text-ink-gray-9">
        {{ __('Attachments') }}
      </h4>
      <Button
        :label="__('Upload Attachment')"
        iconLeft="lucide-plus"
        :disabled="uploading"
        @click="showUploader = true"
      />
    </div>
    <p v-if="error" role="alert" class="mt-2 text-ink-red-4">{{ error }}</p>
    <p v-else-if="loading && !files.length" class="mt-2">{{ __('Loading...') }}</p>
    <p
      v-else-if="!files.length && !pendingFiles.length"
      class="mt-2 text-ink-gray-5"
    >
      {{ __('No attachments yet') }}
    </p>
    <ul v-if="files.length" class="mt-2 space-y-2">
      <li v-for="file in files" :key="file.name">
        <a
          :href="file.file_url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ink-gray-8 underline"
        >{{ file.file_name }}</a>
      </li>
    </ul>
    <ul v-if="pendingFiles.length" class="mt-2 space-y-2">
      <li
        v-for="file in pendingFiles"
        :key="file.id"
        class="flex items-center justify-between gap-2 rounded-4 bg-surface-gray-1 px-3 py-2 text-ink-gray-8"
      >
        <span class="truncate">{{ file.name }}</span>
        <Button
          variant="ghost"
          icon="lucide-x"
          :aria-label="__('Remove {0}', [file.name])"
          :disabled="uploading"
          @click="removePendingFile(file)"
        />
      </li>
    </ul>
    <p v-if="hasPending()" class="mt-2 text-sm text-ink-gray-5">
      {{ __('Attachments are added when you save the meeting.') }}
    </p>
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
      :docname="docname || ''"
      :defer-upload="true"
      :doctype="uploadDoctype"
      @selected="stageFiles"
    />
  </section>
</template>

<script setup>
import FilesUploader from '@/components/FilesUploader/FilesUploader.vue'
import FilesUploadHandler from '@/components/FilesUploader/filesUploaderHandler'
import { getMeetingAttachmentTarget } from '@/utils/meetingAttachments'
import { call } from 'frappe-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  doc: { type: Object, default: () => ({}) },
  docname: { type: String, required: true },
})
const files = ref([])
const pendingFiles = ref([])
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const hasMore = ref(false)
const showUploader = ref(false)
const pageSize = 20
let requestId = 0

const hasPending = () => pendingFiles.value.length > 0
const uploadDoctype = computed(
  () =>
    getMeetingAttachmentTarget(props.doc)?.doctype || 'CRM Meeting Minutes',
)

function stageFiles(selectedFiles) {
  error.value = ''
  pendingFiles.value = [
    ...pendingFiles.value,
    ...selectedFiles.map((file) => ({ ...file, id: Symbol(file.name) })),
  ]
}

function removePendingFile(file) {
  error.value = ''
  pendingFiles.value = pendingFiles.value.filter((pending) => pending !== file)
}

function uploadErrorMessage(err) {
  if (err?._server_messages) {
    try {
      return JSON.parse(JSON.parse(err._server_messages)[0]).message
    } catch {
      return __('Could not upload attachment')
    }
  }
  if (err?.messages?.[0]) return err.messages[0]
  if (err?.message) return err.message
  if (typeof err === 'string') return err
  return __('Could not upload attachment')
}

async function uploadPending(doc) {
  if (!pendingFiles.value.length) return
  const target = getMeetingAttachmentTarget(doc)
  if (!target) {
    throw new Error(__('Save the meeting before uploading attachments'))
  }

  uploading.value = true
  error.value = ''
  try {
    for (const file of [...pendingFiles.value]) {
      try {
        const uploader = new FilesUploadHandler()
        await uploader.upload(file.fileObj || null, {
          fileObj: file.fileObj,
          fileUrl: file.fileUrl,
          type: file.type,
          private: file.private,
          folder: 'Home/Attachments',
          doctype: target.doctype,
          docname: target.docname,
        })
        removePendingFile(file)
      } catch (err) {
        error.value = __('Could not upload "{0}": {1}', [
          file.name,
          uploadErrorMessage(err),
        ])
        throw new Error(error.value, { cause: err })
      }
    }
    if (target.doctype === 'CRM Meeting Minutes') await loadFiles()
  } finally {
    uploading.value = false
  }
}

async function loadFiles(append = false) {
  if (!props.docname) {
    files.value = []
    hasMore.value = false
    loading.value = false
    return
  }
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

defineExpose({ hasPending, uploadPending })
</script>
