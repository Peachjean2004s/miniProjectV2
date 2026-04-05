<script setup>
import { ref, computed, onMounted } from 'vue'
import RecipientPicker from '@/components/RecipientPicker.vue'
import {
  txReceiveLot, txInitiateTransfer,
  Status, hasPendingTransfer, parseContractError, formatLotId, assertWalletMatch,
} from '@/utils/blockchain'
import { fetchPendingLots, fetchOwnedLots, getDisplayNames, recordLotEvent } from '@/utils/api'

const walletAddress = ref('')
const activePage = ref('pending')
const isLoading = ref(false)

const pending = ref([])
const onTruck = ref([])
const displayNames = ref({})

const transferLotId = ref('')
const transferTo = ref('')
const transferSuccess = ref(null)
const transferError = ref('')
const isTransferring = ref(false)
const loadSuccess = ref(null)
const loadError = ref('')

const CHAIN_STEPS = ['ORCHARD', 'PACKING', 'TRANSIT', 'RETAILER']

onMounted(async () => {
  const stored = localStorage.getItem('walletAddress')
  if (stored) { walletAddress.value = stored; await refreshLots() }
})

async function refreshLots() {
  isLoading.value = true
  try {
    const [pend, truck] = await Promise.all([
      fetchPendingLots(walletAddress.value),
      fetchOwnedLots(walletAddress.value, [Status.InTransit]),
    ])
    pending.value = pend
    onTruck.value = truck.filter(l => !hasPendingTransfer(l))
    const addrs = [...new Set(pend.map(l => l.currentOwner))]
    if (addrs.length) displayNames.value = await getDisplayNames(addrs)
  } catch (e) { console.error('refreshLots:', e) }
  finally { isLoading.value = false }
}

const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
const displayFrom = (addr) => displayNames.value[addr] || shortAddress(addr)
const totalWeight = computed(() => onTruck.value.reduce((s, i) => s + i.weightKg, 0))
const canTransfer = computed(() =>
  transferLotId.value && transferTo.value.trim().startsWith('0x') && transferTo.value.trim().length === 42
)

async function loadToTruck(lotId) {
  loadError.value = ''
  try {
    await assertWalletMatch(walletAddress.value)
    const { txHash, blockNumber, newStatus, timestamp } = await txReceiveLot(lotId)
    loadSuccess.value = lotId
    await refreshLots()
    setTimeout(() => (loadSuccess.value = null), 5000)
    recordLotEvent({
      eventType: 'HandshakeCompleted', lotId, txHash, blockNumber,
      actorAddress: walletAddress.value, timestamp,
      lotData: { newStatus },
    })
  } catch (e) { loadError.value = parseContractError(e) }
}

async function handleTransfer() {
  if (!canTransfer.value) return
  isTransferring.value = true
  transferError.value = ''
  try {
    await assertWalletMatch(walletAddress.value)
    const lotId = Number(transferLotId.value)
    const toAddr = transferTo.value.trim()
    const { txHash, blockNumber, timestamp } = await txInitiateTransfer(lotId, toAddr)
    transferSuccess.value = lotId
    transferLotId.value = ''
    transferTo.value = ''
    await refreshLots()
    setTimeout(() => (transferSuccess.value = null), 5000)
    recordLotEvent({
      eventType: 'HandshakeInitiated', lotId, txHash, blockNumber,
      actorAddress: walletAddress.value, targetAddress: toAddr, timestamp,
    })
  } catch (e) { transferError.value = parseContractError(e) }
  finally { isTransferring.value = false }
}

function disconnect() {
  localStorage.removeItem('walletAddress')
  localStorage.removeItem('userRole')
  window.location.href = '/'
}
</script>

<template>
  <div class="app">
    <div class="blob blob-green"></div>
    <div class="blob blob-peach"></div>

    <nav class="navbar">
      <span class="nav-brand">LONGAN TRACEABILITY</span>
      <div class="navbar-right">
        <div v-if="walletAddress" class="wallet-pill">
          <span class="wallet-dot"></span>{{ shortAddress(walletAddress) }}
        </div>
        <button class="logout-btn" @click="disconnect">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </nav>

    <main class="main">
      <div class="page-hero">
        <h1 class="page-title">Transporter <span class="page-title-highlight">Dashboard</span></h1>
        <p class="page-sub">Load lots from packing houses and deliver to retailers on the blockchain</p>
      </div>

      <div class="tab-nav">
        <button class="tab-btn" :class="{ active: activePage === 'pending' }" @click="activePage = 'pending'">
          Pending
          <span v-if="pending.length > 0" class="tab-badge">{{ pending.length }}</span>
        </button>
        <button class="tab-btn" :class="{ active: activePage === 'truck' }" @click="activePage = 'truck'">On
          Truck</button>
        <button class="tab-btn" :class="{ active: activePage === 'deliver' }"
          @click="activePage = 'deliver'">Deliver</button>
      </div>

      <!-- PENDING -->
      <div v-if="activePage === 'pending'" class="content">
        <div class="section-label">Lots Ready to Load</div>
        <transition name="fade">
          <div v-if="loadSuccess" class="alert-success">✅ LOT #{{ formatLotId(loadSuccess) }} loaded — receiveLot called on blockchain</div>
        </transition>
        <div v-if="loadError" class="alert-error">❌ {{ loadError }}</div>
        <div v-if="isLoading" class="empty-box">Loading from blockchain...</div>
        <div v-else-if="pending.length === 0" class="empty-box">No lots waiting to be loaded</div>
        <div v-else class="lot-list">
          <div v-for="item in pending" :key="item.lotId" class="lot-card">
            <div class="lot-card-top">
              <span class="lot-id">LOT #{{ formatLotId(item.lotId) }}</span>
              <span class="status-badge" style="background:#fdefd8;color:#7c4a1e;border:1px solid #e8c99a">Ready to
                Load</span>
            </div>
            <div class="lot-variety">{{ item.variety }}</div>
            <div class="lot-info-grid">
              <div class="info-cell">
                <div class="info-label">WEIGHT</div>
                <div class="info-value">{{ item.weightKg.toLocaleString() }} kg</div>
              </div>
              <div class="info-cell">
                <div class="info-label">FROM</div>
                <div class="info-value">{{ displayFrom(item.currentOwner) }}</div>
              </div>
            </div>
            <div class="onchain-preview" style="margin-top:12px">
              <div class="preview-label">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                Calls receiveLot — will update on-chain
              </div>
              <div class="preview-grid">
                <div class="preview-item"><span class="preview-key">lotId</span><span class="preview-val">{{ formatLotId(item.lotId) }}</span></div>
                <div class="preview-item"><span class="preview-key">status</span><span class="preview-val">InTransit</span></div>
              </div>
            </div>
            <button class="btn-primary" style="margin-top:14px" @click="loadToTruck(item.lotId)">Load onto Truck (Sign Transaction)</button>
          </div>
        </div>
      </div>

      <!-- ON TRUCK -->
      <div v-else-if="activePage === 'truck'" class="content">
        <div class="summary-row">
          <div class="summary-card">
            <div class="summary-label">LOTS ON TRUCK</div>
            <div class="summary-value">{{ onTruck.length }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">TOTAL WEIGHT</div>
            <div class="summary-value">{{ totalWeight.toLocaleString() }} kg</div>
          </div>
        </div>
        <div class="section-label">Currently In Transit</div>
        <div v-if="onTruck.length === 0" class="empty-box">No lots on truck</div>
        <div v-else class="lot-list">
          <div v-for="item in onTruck" :key="item.lotId" class="lot-card">
            <div class="lot-card-top">
              <span class="lot-id">LOT #{{ formatLotId(item.lotId) }}</span>
              <span class="status-badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80">In
                Transit</span>
            </div>
            <div class="lot-variety">{{ item.variety }}</div>
            <div class="lot-info-grid">
              <div class="info-cell">
                <div class="info-label">WEIGHT</div>
                <div class="info-value">{{ item.weightKg.toLocaleString() }} kg</div>
              </div>
              <div class="info-cell">
                <div class="info-label">CREATED AT</div>
                <div class="info-value">{{ item.createdAtStr }}</div>
              </div>
            </div>
            <!-- Progress -->
            <div class="progress-bar">
              <div v-for="(step, i) in CHAIN_STEPS" :key="step" class="progress-step">
                <div class="progress-track"
                  :style="{ background: i <= 2 ? '#5c3317' : '#e8dcc8', borderRadius: i === 0 ? '4px 0 0 4px' : i === 3 ? '0 4px 4px 0' : '0' }">
                </div>
                <span class="progress-label" :style="{ color: i <= 2 ? '#5c3317' : '#baa88a' }">{{ step }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DELIVER -->
      <div v-else-if="activePage === 'deliver'" class="content">
        <div class="chain-flow">
          <div class="chain-step">Orchard</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
          <div class="chain-step">Packing House</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
          <div class="chain-step active">Transporter</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
          <div class="chain-step">Retailer</div>
        </div>
        <div class="section-label">Deliver to Retailer</div>
        <div class="form-card">
          <transition name="fade">
            <div v-if="transferSuccess" class="alert-success">✅ Transfer initiated for LOT #{{ formatLotId(transferSuccess) }}.
              Waiting for Retailer to confirm.</div>
          </transition>
          <div v-if="transferError" class="alert-error">❌ {{ transferError }}</div>
          <div class="field">
            <label>SELECT LOT</label>
            <div v-if="onTruck.length === 0" class="empty-sm">No lots on truck</div>
            <div v-else class="select-list">
              <div v-for="lot in onTruck" :key="lot.lotId" class="select-item"
                :class="{ selected: transferLotId === String(lot.lotId) }" @click="transferLotId = String(lot.lotId)">
                <div><span class="select-lot-id">LOT #{{ formatLotId(lot.lotId) }}</span><span class="select-lot-info"> · {{ lot.variety
                    }} · {{ lot.weightKg }}kg</span></div>
                <svg v-if="transferLotId === String(lot.lotId)" width="16" height="16" fill="none" stroke="#7c4a1e"
                  stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div class="field">
            <label>RETAILER</label>
            <RecipientPicker
              role="Retailer"
              v-model="transferTo"
              placeholder="พิมชื่อร้านค้า หรือ 0x..."
            />
            <span class="field-hint">เลือกจาก dropdown หรือพิม wallet address โดยตรง</span>
          </div>
          <div class="onchain-preview">
            <div class="preview-label">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Calls initiateTransfer on Smart Contract
            </div>
            <div class="preview-grid">
              <div class="preview-item"><span class="preview-key">lotId</span><span class="preview-val">{{ transferLotId ? formatLotId(Number(transferLotId)) : '—' }}</span></div>
              <div class="preview-item"><span class="preview-key">_to (Retailer)</span><span class="preview-val mono">{{
                transferTo ? shortAddress(transferTo) : '—' }}</span></div>
            </div>
          </div>
          <button class="btn-primary" :disabled="!canTransfer || isTransferring" @click="handleTransfer">
            <span v-if="isTransferring" class="spinner"></span>
            <span v-else>Initiate Transfer (Sign Transaction)</span>
          </button>
        </div>
      </div>

    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

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
  overflow-x: hidden;
}

.blob {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.28;
  pointer-events: none;
  z-index: 0;
}

.blob-green {
  width: 360px;
  height: 360px;
  background: #a8d5a2;
  bottom: 20px;
  left: -110px;
}

.blob-peach {
  width: 280px;
  height: 280px;
  background: #f5c6a0;
  top: 20px;
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
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #fdecea;
  border-color: #c0392b;
  color: #c0392b;
}

.main {
  position: relative;
  z-index: 5;
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 32px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.page-hero {
  text-align: center;
}

.page-title {
  font-size: 2.2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.page-title-highlight {
  font-family: 'Playfair Display', serif;
  color: #7c4a1e;
}

.page-sub {
  font-size: 14.5px;
  color: #888;
  line-height: 1.6;
}

.tab-nav {
  display: flex;
  gap: 8px;
  background: #fdefd8;
  border-radius: 14px;
  padding: 6px;
  width: 100%;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  font-family: 'DM Sans', sans-serif;
  font-size: 13.5px;
  font-weight: 600;
  color: #9a7a52;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn.active {
  background: #5c3317;
  color: #fff;
}

.tab-btn:hover:not(.active) {
  background: #f5e6cc;
  color: #5c3317;
}

.tab-badge {
  background: #fff;
  color: #7c4a1e;
  font-size: 0.65rem;
  font-weight: 800;
  border-radius: 10px;
  padding: 1px 7px;
}

.tab-btn.active .tab-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.summary-card {
  background: #fff;
  border-radius: 16px;
  padding: 18px 20px;
  border: 1px solid #f0e6d6;
}

.summary-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: #9a8a72;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #3d2e1e;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #999;
  font-weight: 500;
  white-space: nowrap;
  width: 100%;
}

.section-label::before,
.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8dcc8;
}

.lot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lot-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 22px;
  border: 1px solid #f0e6d6;
}

.lot-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.lot-id {
  font-size: 0.72rem;
  font-weight: 700;
  color: #9a8a72;
  letter-spacing: 0.08em;
}

.status-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: 20px;
}

.lot-variety {
  font-size: 1.05rem;
  font-weight: 700;
  color: #3d2e1e;
  margin-bottom: 12px;
}

.lot-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-cell {
  background: #faf6f0;
  border-radius: 10px;
  padding: 10px 12px;
  border: 1px solid #f0e6d6;
}

.info-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: #9a8a72;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}

.info-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: #3d2e1e;
}

.progress-bar {
  display: flex;
  margin-top: 14px;
}

.progress-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-track {
  width: 100%;
  height: 4px;
}

.progress-label {
  font-size: 0.52rem;
  font-weight: 700;
  margin-top: 5px;
  letter-spacing: 0.05em;
}

.empty-box {
  padding: 48px;
  text-align: center;
  color: #baa88a;
  font-size: 0.9rem;
  background: #fff;
  border-radius: 16px;
  border: 1px dashed #e0d5c4;
}

.empty-sm {
  padding: 16px;
  text-align: center;
  color: #baa88a;
  font-size: 0.82rem;
  background: #faf6f0;
  border-radius: 10px;
  border: 1px dashed #e0d5c4;
}

.form-card {
  background: #fdefd8;
  border-radius: 20px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #7c4a1e;
  letter-spacing: 0.1em;
}

.field input {
  padding: 13px 16px;
  border-radius: 12px;
  border: none;
  background: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 14.5px;
  color: #333;
  outline: none;
  transition: box-shadow 0.2s;
}

.field input:focus {
  box-shadow: 0 0 0 2px #d4a574;
}

.field-hint {
  font-size: 0.7rem;
  color: #a08060;
}

.mono {
  font-family: monospace !important;
  font-size: 13px !important;
}

.onchain-preview {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid #e8c99a;
}

.preview-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #7c4a1e;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.preview-grid {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
}

.preview-key {
  color: #9a7a52;
  font-weight: 600;
}

.preview-val {
  color: #3d2e1e;
  font-weight: 600;
}

.btn-primary {
  width: 100%;
  padding: 15px;
  border-radius: 50px;
  border: none;
  background: #5c3317;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
}

.btn-primary:hover:not(:disabled) {
  background: #7c4a1e;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alert-success {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2d6a4f;
}

.alert-error {
  background: #fdecea;
  border: 1px solid #ef9a9a;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #b71c1c;
}

.chain-flow {
  background: #fff;
  border-radius: 14px;
  padding: 16px 24px;
  border: 1px solid #f0e6d6;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.chain-step {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  background: #faf6f0;
  color: #9a8a72;
  border: 1px solid #e8dcc8;
}

.chain-step.active {
  background: #5c3317;
  color: #fff;
  border-color: #5c3317;
}

.select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.select-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1.5px solid #e8dcc8;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.select-item:hover {
  border-color: #c4a882;
}

.select-item.selected {
  border-color: #7c4a1e;
  background: #faf6f0;
}

.select-lot-id {
  font-size: 0.88rem;
  font-weight: 700;
  color: #3d2e1e;
}

.select-lot-info {
  font-size: 0.82rem;
  color: #9a8a72;
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