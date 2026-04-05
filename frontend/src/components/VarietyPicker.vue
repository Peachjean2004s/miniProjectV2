<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const VARIETIES = ['อีดอ', 'เจริญรัตน์', 'โป่ง', 'สายสว่าง', 'พวงทอง', 'เพชรบ้านแพ้ว', 'เบี้ยว', 'จันทบุรี']

const inputText = ref(props.modelValue)
const isOpen = ref(false)

watch(() => props.modelValue, (v) => { if (v !== inputText.value) inputText.value = v })

const filtered = computed(() => {
  const q = inputText.value.trim()
  if (!q) return VARIETIES
  return VARIETIES.filter(v => v.includes(q))
})

function onInput() {
  emit('update:modelValue', inputText.value)
  isOpen.value = true
}

function onFocus() {
  isOpen.value = true
}

function select(v: string) {
  inputText.value = v
  emit('update:modelValue', v)
  isOpen.value = false
}

function onBlur() {
  setTimeout(() => { isOpen.value = false }, 150)
}
</script>

<template>
  <div class="variety-wrap">
    <div class="input-row">
      <input
        v-model="inputText"
        type="text"
        placeholder="พิมหรือเลือกพันธุ์ลำไย..."
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <svg class="arrow-icon" width="14" height="14" fill="none" stroke="#9a7a55" stroke-width="2" viewBox="0 0 24 24">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </div>

    <div v-if="isOpen && filtered.length > 0" class="dropdown">
      <div
        v-for="v in filtered"
        :key="v"
        class="dropdown-item"
        @mousedown.prevent="select(v)"
      >
        {{ v }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.variety-wrap { position: relative; }

.input-row { position: relative; }

.input-row input {
  width: 100%;
  padding: 13px 40px 13px 16px;
  border-radius: 12px;
  border: none;
  background: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 14.5px;
  color: #333;
  outline: none;
  transition: box-shadow 0.2s;
  box-sizing: border-box;
}
.input-row input:focus { box-shadow: 0 0 0 2px #d4a574; }

.arrow-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8c99a;
  box-shadow: 0 8px 24px rgba(92,51,23,0.12);
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  padding: 11px 16px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #3d2e1e;
  font-weight: 600;
  transition: background 0.12s;
}
.dropdown-item:hover { background: #faf6f0; }
</style>
