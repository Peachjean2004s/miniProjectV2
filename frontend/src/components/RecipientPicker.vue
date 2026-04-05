<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  role: string        // 'PackingHouse' | 'Transporter' | 'Retailer'
  modelValue: string  // wallet address ที่ selected
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

interface Recipient { walletAddress: string; displayName: string }

const searchText = ref('')
const results = ref<Recipient[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
let debounce: ReturnType<typeof setTimeout>

watch(searchText, (val) => {
  clearTimeout(debounce)
  const trimmed = val.trim()

  // ถ้าพิม wallet address โดยตรง ให้ emit ทันที ไม่ต้องค้นหา
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    emit('update:modelValue', trimmed)
    isOpen.value = false
    results.value = []
    return
  }

  // ไม่ใช่ wallet address → ล้าง modelValue และ search ตามชื่อ
  emit('update:modelValue', '')
  if (!trimmed) { results.value = []; isOpen.value = false; return }
  debounce = setTimeout(() => fetchSearch(trimmed), 300)
})

async function fetchSearch(q: string) {
  isLoading.value = true
  try {
    const res = await fetch(
      `http://localhost:5254/api/users/search?role=${props.role}&q=${encodeURIComponent(q)}`
    )
    const data: Recipient[] = await res.json()
    results.value = data
    isOpen.value = data.length > 0
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function select(item: Recipient) {
  searchText.value = item.displayName
  emit('update:modelValue', item.walletAddress)
  isOpen.value = false
}

function onBlur() {
  // หน่วงเล็กน้อยให้ click dropdown ได้ก่อน
  setTimeout(() => { isOpen.value = false }, 150)
}

const short = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
</script>

<template>
  <div class="recipient-wrap">
    <div class="input-row">
      <input
        v-model="searchText"
        type="text"
        :placeholder="placeholder || 'พิมชื่อเพื่อค้นหา...'"
        autocomplete="off"
        @focus="searchText && fetchSearch(searchText)"
        @blur="onBlur"
      />
      <span v-if="isLoading" class="search-spinner"></span>
      <svg v-else-if="modelValue" class="check-icon" width="16" height="16" fill="none" stroke="#2d6a4f" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
    </div>

    <!-- Dropdown -->
    <div v-if="isOpen" class="dropdown">
      <div
        v-for="item in results"
        :key="item.walletAddress"
        class="dropdown-item"
        @mousedown.prevent="select(item)"
      >
        <span class="item-name">{{ item.displayName }}</span>
        <span class="item-addr">{{ short(item.walletAddress) }}</span>
      </div>
    </div>

    <!-- No results hint -->
    <div v-if="searchText && !isLoading && results.length === 0 && !modelValue" class="no-results">
      ไม่พบ "{{ searchText }}" — สามารถใส่ wallet address โดยตรงได้
    </div>

    <!-- Selected wallet preview -->
    <div v-if="modelValue" class="selected-preview">
      <svg width="11" height="11" fill="none" stroke="#2d6a4f" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
      wallet: <span class="mono-addr">{{ modelValue }}</span>
    </div>
  </div>
</template>

<style scoped>
.recipient-wrap { position: relative; display: flex; flex-direction: column; gap: 6px; }

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

.search-spinner {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px;
  border: 2px solid rgba(124,74,30,0.25);
  border-top-color: #7c4a1e;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }

.check-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); }

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
  max-height: 220px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 16px;
  cursor: pointer;
  transition: background 0.12s;
  gap: 12px;
}
.dropdown-item:hover { background: #faf6f0; }

.item-name { font-size: 0.88rem; font-weight: 600; color: #3d2e1e; }
.item-addr { font-size: 0.72rem; font-family: monospace; color: #9a8a72; white-space: nowrap; }

.no-results { font-size: 0.72rem; color: #a08060; padding: 2px 4px; }

.selected-preview {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: #2d6a4f;
  font-weight: 600;
  padding: 2px 4px;
}
.mono-addr { font-family: monospace; font-size: 0.68rem; color: #5c3317; word-break: break-all; }
</style>
