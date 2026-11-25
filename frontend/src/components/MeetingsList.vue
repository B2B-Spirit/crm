<template>
  <section class="px-3 py-4 sm:px-10">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-2xl-semibold text-ink-gray-8">{{ __('Meetings') }}</h2>
      <Button
        variant="solid"
        iconLeft="lucide-plus"
        :label="__('New Meeting')"
        @click="openMeeting()"
      />
    </div>
    <p v-if="error" role="alert" class="mb-3 text-ink-red-4">{{ error }}</p>
    <p v-if="loading && !meetings.length">{{ __('Loading...') }}</p>
    <p v-else-if="!meetings.length && !error">{{ __('No meetings yet') }}</p>
    <ul v-else class="divide-y divide-outline-elevation-2">
      <li v-for="meeting in meetings" :key="meeting.name">
        <button
          type="button"
          class="flex w-full flex-col gap-1 rounded-4 p-3 text-left hover:bg-surface-gray-2"
          @click="openMeeting(meeting.name)"
        >
          <span class="font-medium text-ink-gray-8">{{ meeting.title }}</span>
          <span class="text-sm text-ink-gray-5">
            {{ meeting.meeting_date }} · {{ meeting.status }}
          </span>
        </button>
      </li>
    </ul>
    <Button
      v-if="hasMore"
      class="mt-4"
      :label="__('Load more')"
      :loading="loading"
      @click="loadMeetings(true)"
    />
  </section>
</template>

<script setup>
import { useDoctypeModal } from '@/composables/doctypeModal'
import { call } from 'frappe-ui'
import { ref, watch } from 'vue'

const props = defineProps({
  referenceDoctype: { type: String, default: '' },
  referenceName: { type: String, default: '' },
})

const meetings = ref([])
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
const pageSize = 20
let requestId = 0

async function loadMeetings(append = false) {
  const id = ++requestId
  loading.value = true
  error.value = ''
  if (!append) {
    meetings.value = []
    hasMore.value = false
  }
  const filters = {}
  if (props.referenceDoctype === 'CRM Deal') filters.deal = props.referenceName
  if (props.referenceDoctype === 'CRM Lead') filters.lead = props.referenceName
  try {
    const result = await call('frappe.client.get_list', {
      doctype: 'CRM Meeting Minutes',
      fields: ['name', 'title', 'meeting_date', 'status'],
      filters,
      order_by: 'meeting_date desc, name desc',
      limit_start: append ? meetings.value.length : 0,
      limit_page_length: pageSize + 1,
    })
    if (id !== requestId) return
    hasMore.value = result.length > pageSize
    const page = result.slice(0, pageSize)
    meetings.value = append ? [...meetings.value, ...page] : page
  } catch (err) {
    if (id === requestId) {
      error.value = err.messages?.[0] || __('Could not load meetings')
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

const { showModal } = useDoctypeModal()
function openMeeting(name = null) {
  const defaults = {}
  if (props.referenceDoctype === 'CRM Deal') defaults.deal = props.referenceName
  if (props.referenceDoctype === 'CRM Lead') defaults.lead = props.referenceName
  showModal({
    doctype: 'CRM Meeting Minutes',
    title: 'Meeting',
    name,
    defaults: name ? {} : defaults,
    callbacks: { afterInsert: () => loadMeetings(), afterUpdate: () => loadMeetings() },
  })
}

watch(
  () => [props.referenceDoctype, props.referenceName],
  () => loadMeetings(),
  { immediate: true },
)
</script>
