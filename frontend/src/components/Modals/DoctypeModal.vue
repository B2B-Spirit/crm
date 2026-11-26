<template>
  <Dialog
    v-model:open="show"
    :size="doctype === 'CRM Meeting Minutes' ? '4xl' : doctype === 'FCRM Note' ? '2xl' : 'xl'"
    :dismissible="doctype !== 'FCRM Note'"
    bare
  >
    <template #default>
      <div
        class="bg-surface-elevation-2 px-4 pb-6 pt-5 sm:px-6"
        @keydown.meta.enter.capture.prevent.stop="submit"
        @keydown.ctrl.enter.capture.prevent.stop="submit"
      >
        <div class="mb-5 flex items-center justify-between">
          <div class="flex gap-2 items-center">
            <Dialog.Title as-child>
              <h3 class="text-3xl-semibold leading-6 text-ink-gray-9">
                {{
                  editMode
                    ? __('Edit {0}', [__(doctypeTitle || doctype)])
                    : __('Create {0}', [__(doctypeTitle || doctype)])
                }}
              </h3>
            </Dialog.Title>
          </div>
          <div class="flex items-center gap-1">
            <CustomActions
              v-if="document.actions?.length"
              :actions="document.actions"
              :close="() => (show = false)"
            />
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              :tooltip="__('Edit Fields Layout')"
              :icon="EditIcon"
              @click="openQuickEntryModal"
            />
            <Dialog.Close as-child>
              <Button
                :aria-label="__('Close')"
                variant="ghost"
                class="w-7"
                icon="lucide-x"
              />
            </Dialog.Close>
          </div>
        </div>
        <div>
          <FieldLayout
            v-if="layout.data && !createdRecord"
            :tabs="layout.data"
            :data="doc"
            :doctype="doctype"
            :docname="docname"
          />
          <p v-if="createdRecord" class="text-sm text-ink-gray-6">
            {{ __('The meeting was saved. Finish uploading its attachments below.') }}
          </p>
          <MeetingAttachments
            v-if="isMeeting"
            ref="meetingAttachments"
            :doc="createdRecord || doc"
            :docname="createdRecord?.name || doc.name || docname"
          />
          <ErrorMessage v-if="error" class="mt-4" :message="__(error)" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="flex flex-row-reverse gap-2">
          <Button
            variant="solid"
            :label="
              createdRecord
                ? __('Retry Attachments')
                : editMode
                  ? __('Update')
                  : __('Create')
            "
            :loading="
              savingAttachments ||
              (editMode ? document.save.loading : _create.loading)
            "
            @click="submit"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import EditIcon from '@/components/Icons/EditIcon.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import MeetingAttachments from '@/components/MeetingAttachments.vue'
import CustomActions from '@/components/CustomActions.vue'
import { useDocument } from '@/data/document'
import { globalStore } from '@/stores/global'
import { usersStore } from '@/stores/users'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { isMobileView } from '@/composables/settings'
import { setupCustomizations } from '@/utils'

import { Dialog, call, createResource, toast } from 'frappe-ui'
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  doctypeTitle: { type: String, default: '' },
  doctype: { type: String, default: '' },
  docname: { type: String, default: '' },
  defaults: { type: Object, default: () => ({}) },
})

const show = defineModel({ type: Boolean })

const emit = defineEmits(['afterInsert', 'afterUpdate'])

const router = useRouter()

const { isManager } = usersStore()
const { $dialog, $socket } = globalStore()

const { document, scripts, triggerOnRender, triggerOnBeforeCreate } =
  useDocument(props.doctype, props.docname || null)

const doc = computed(() => document.doc || {})

const layout = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['Quick Entry', props.doctype],
  params: { doctype: props.doctype, type: 'Quick Entry' },
  auto: true,
})

const error = ref(null)
const editMode = computed(() => Boolean(document.doc?.name))
const isMeeting = computed(() => props.doctype === 'CRM Meeting Minutes')
const meetingAttachments = ref(null)
const savingAttachments = ref(false)
const createdRecord = ref(null)

const _create = createResource({
  url: 'frappe.client.insert',
  onSuccess: async (d) => {
    emit('afterInsert', d)
    if (hasPendingMeetingAttachments()) {
      createdRecord.value = d
      await finishMeetingAttachmentUpload(d, true)
      return
    }
    document.doc = {}
    show.value = false
  },
  onError: (err) => {
    if (err.exc_type == 'MandatoryError') {
      const fieldName = err.messages
        .map((msg) => {
          let arr = msg.split(': ')
          return arr[arr.length - 1].trim()
        })
        .join(', ')
      error.value = __('Mandatory field error: {0}', [fieldName])
      return
    }
    error.value = err.messages?.[0] || __('Could not create document')
  },
})

async function create() {
  await triggerOnBeforeCreate?.()

  _create.submit({
    doc: {
      doctype: props.doctype,
      ...document.doc,
    },
  })
}

function update() {
  // frappe-ui skips saving an unchanged doc without calling back, so handle it here
  if (!document.isDirty) {
    if (hasPendingMeetingAttachments()) {
      return finishMeetingAttachmentUpload(document.doc)
    }
    toast.info(__('Nothing to update'))
    show.value = false
    return
  }
  document.save.submit(null, {
    onSuccess: async (d) => {
      emit('afterUpdate', d)
      if (hasPendingMeetingAttachments()) {
        await finishMeetingAttachmentUpload(d)
        return
      }
      show.value = false
    },
    onError: (err) => {
      error.value = err.messages?.[0] || __('Could not update document')
    },
  })
}

function hasPendingMeetingAttachments() {
  return isMeeting.value && meetingAttachments.value?.hasPending?.()
}

async function finishMeetingAttachmentUpload(record, resetDocument = false) {
  savingAttachments.value = true
  error.value = null
  try {
    await meetingAttachments.value.uploadPending(record)
  } catch (err) {
    error.value =
      err.message ||
      __('The meeting was saved, but its attachments could not be uploaded. Retry to finish.')
    return
  } finally {
    savingAttachments.value = false
  }
  if (resetDocument) {
    createdRecord.value = null
    document.doc = {}
  }
  show.value = false
}

async function submit() {
  // editors save their text on blur, so blur first when saving from the keyboard
  window.document.activeElement?.blur()
  await nextTick()
  if (createdRecord.value) {
    await finishMeetingAttachmentUpload(createdRecord.value, true)
    return
  }
  if (editMode.value) update()
  else create()
}

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: props.doctype }
  nextTick(() => (show.value = false))
}

watch(
  () => document.doc,
  async (_doc) => {
    if (scripts.data?.length) {
      setupCustomizations(scripts.data, {
        doc: _doc,
        $dialog,
        $socket,
        router,
        call,
      })
    }
  },
  { once: true },
)

onMounted(async () => {
  document.doc = {
    ...document.doc,
    ...props.defaults,
  }
  await triggerOnRender()
})
</script>
