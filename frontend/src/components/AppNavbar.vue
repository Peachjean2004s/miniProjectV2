<script setup>
import { ref, onMounted } from 'vue'

const walletAddress = ref('')

onMounted(() => {
  const stored = localStorage.getItem('walletAddress')
  if (stored) walletAddress.value = stored
})

function disconnect() {
  localStorage.removeItem('walletAddress')
  localStorage.removeItem('userRole')
  window.location.href = '/'
}

const shortAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
</script>

<template>
  <nav class="navbar">
    <span class="nav-brand">LONGAN TRACEABILITY</span>
    <div class="navbar-right">
      <div v-if="walletAddress" class="wallet-pill">
        <span class="wallet-dot"></span>
        {{ shortAddress(walletAddress) }}
      </div>
      <button class="logout-btn" @click="disconnect">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Logout
      </button>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 40px;
}
.nav-brand {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: #2d6a4f;
  text-transform: uppercase;
  font-family: 'DM Sans', sans-serif;
}
.navbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wallet-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  background: #fdefd8;
  border: 1px solid #e8c99a;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #5c3317;
  font-family: 'DM Sans', sans-serif;
  user-select: none;
}
.wallet-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2d6a4f;
  flex-shrink: 0;
}
.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1.5px solid #d9b89a;
  border-radius: 20px;
  padding: 6px 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #7c4a1e;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.logout-btn:hover {
  background: #fdecea;
  border-color: #c0392b;
  color: #c0392b;
}
</style>