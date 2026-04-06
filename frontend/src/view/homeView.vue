<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAddress } from 'ethers'
import { checkUser, ROLE_NAME_TO_ROUTE } from '@/utils/api'

const router = useRouter()

const lotNumber = ref('')
const statusMsg = ref('')
const statusType = ref('info')
const isConnecting = ref(false)

function trackLot() {
  const raw = lotNumber.value.trim()
  if (!raw) return

  const match = raw.match(/^(?:LOT\s*#?\s*)?(\d{2,})$/i)
  if (!match) {
    statusMsg.value = 'Format: 0001 | LOT0001 | LOT#0001 | LOT #0001 | LOT # 0001'
    statusType.value = 'error'
    setTimeout(() => (statusMsg.value = ''), 4000)
    return
  }
  const id = Number(match[1])
  if (id < 1) {
    statusMsg.value = 'Lot number must be at least 1.'
    statusType.value = 'error'
    setTimeout(() => (statusMsg.value = ''), 3000)
    return
  }
  router.push({ name: 'TrackView', params: { lotId: id } })
}

async function connectMetaMask() {
  if (typeof window.ethereum === 'undefined') {
    statusMsg.value = '⚠️ MetaMask not detected. Please install MetaMask.'
    statusType.value = 'error'
    setTimeout(() => (statusMsg.value = ''), 4000)
    return
  }

  isConnecting.value = true
  statusMsg.value = '⏳ Connecting to MetaMask...'
  statusType.value = 'info'

  try {
    await window.ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }]
    })
    const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
    const address = getAddress(accounts[0])
    localStorage.setItem('walletAddress', address)

    statusMsg.value = '⏳ Checking registration...'

    // ตรวจสอบว่า wallet นี้มีข้อมูลใน Supabase แล้วหรือยัง
    const user = await checkUser(address)

    if (user.exists && user.roleName) {
      localStorage.setItem('userRole', String(user.roleId))
      statusMsg.value = `✅ Welcome back! Redirecting...`
      statusType.value = 'success'
      const route = ROLE_NAME_TO_ROUTE[user.roleName]
      setTimeout(() => router.push({ name: route || 'ChooseRole' }), 1000)
    } else {
      statusMsg.value = `✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}`
      statusType.value = 'success'
      setTimeout(() => router.push({ name: 'ChooseRole' }), 1000)
    }
  } catch (err: any) {
    statusMsg.value = err.code === 4001
      ? '❌ Connection rejected by user.'
      : '❌ Connection failed. Please try again.'
    statusType.value = 'error'
    setTimeout(() => (statusMsg.value = ''), 4000)
  } finally {
    isConnecting.value = false
  }
}

function connectOther() {
  statusMsg.value = '🔗 Other wallet options coming soon...'
  statusType.value = 'info'
  setTimeout(() => (statusMsg.value = ''), 3000)
}
</script>

<template>
  <div class="app">
    <div class="blob blob-green"></div>
    <div class="blob blob-peach"></div>

    <nav class="navbar">
      <span class="nav-brand">LONGAN TRACEABILITY</span>
    </nav>

    <main class="main">
      <div class="hero">
        <h1 class="hero-title">
          Welcome to the<br />
          <span class="hero-highlight">Digital Orchard</span>
        </h1>
      </div>

      <section class="section">
        <div class="divider-label">Track Lot</div>
        <div class="track-box">
          <input v-model="lotNumber" class="track-input" type="text" placeholder="e.g. 0001, LOT0001, LOT#0001" @keydown.enter="trackLot" />
          <button class="track-btn" @click="trackLot">Track</button>
        </div>
      </section>

      <section class="section">
        <div class="divider-label">Connect Wallet</div>
        <div class="wallet-card">
          <p class="wallet-desc">
            Connect your Wallet to<br />
            continue and access the<br />
            authenticated heritage records.
          </p>

          <button class="btn-metamask" :disabled="isConnecting" @click="connectMetaMask">
            <span v-if="isConnecting" class="spinner"></span>
            <span v-else>Connect MetaMask</span>
          </button>

          <button class="btn-other" :disabled="isConnecting" @click="connectOther">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            Other Wallets
          </button>
        </div>
      </section>

      <transition name="fade">
        <div v-if="statusMsg" class="status-msg" :class="statusType">{{ statusMsg }}</div>
      </transition>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app {
  min-height: 100vh;
  background: #fffaf4;
  font-family: 'DM Sans', sans-serif;
  position: relative;
  overflow: hidden;
}

.blob {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}

.blob-green {
  width: 340px;
  height: 340px;
  background: #a8d5a2;
  bottom: 40px;
  left: -100px;
}

.blob-peach {
  width: 280px;
  height: 280px;
  background: #f5c6a0;
  top: 30px;
  right: -80px;
}

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
}

.main {
  position: relative;
  z-index: 5;
  max-width: 620px;
  margin: 0 auto;
  padding: 20px 32px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36px;
}

.hero-title {
  font-size: 2.4rem;
  font-weight: 700;
  color: #1a1a1a;
  text-align: center;
  line-height: 1.3;
}

.hero-highlight {
  font-family: 'Playfair Display', serif;
  color: #7c4a1e;
}

.section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.divider-label {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13.5px;
  color: #888;
  font-weight: 500;
  white-space: nowrap;
}

.divider-label::before,
.divider-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #ccc;
}

.track-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fdefd8;
  border-radius: 16px;
  padding: 10px 10px 10px 20px;
}

.track-input {
  flex: 1;
  background: #fff;
  border: none;
  outline: none;
  border-radius: 10px;
  padding: 12px 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  color: #333;
}

.track-btn {
  background: #5c3317;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 12px 28px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 14.5px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.track-btn:hover {
  background: #7c4a1e;
}

.wallet-card {
  background: #fdefd8;
  border-radius: 20px;
  padding: 36px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.wallet-desc {
  font-size: 15px;
  color: #5a3a1a;
  text-align: center;
  line-height: 1.7;
}

.btn-metamask {
  width: 100%;
  background: #5c3317;
  color: #fff;
  border: none;
  border-radius: 50px;
  padding: 16px 28px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
}

.btn-metamask:hover:not(:disabled) {
  background: #7c4a1e;
}

.btn-metamask:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-other {
  width: 100%;
  background: #fff;
  color: #3a2010;
  border: none;
  border-radius: 50px;
  padding: 14px 28px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s, opacity 0.2s;
}

.btn-other:hover:not(:disabled) {
  background: #f5f0eb;
}

.btn-other:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-msg {
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  width: 100%;
}

.status-msg.info {
  background: #e8f4fd;
  color: #1a6fa8;
}

.status-msg.success {
  background: #e8f5e9;
  color: #2d6a4f;
}

.status-msg.error {
  background: #fdecea;
  color: #b71c1c;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>