<template>
  <LayoutHeader>
    <template #left-header>
      <span class="text-lg font-medium">{{ __('Meetings') }}</span>
    </template>
  </LayoutHeader>
  <MeetingsList class="overflow-y-auto" />
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import MeetingsList from '@/components/MeetingsList.vue'
</script>
