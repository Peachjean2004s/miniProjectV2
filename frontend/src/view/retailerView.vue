<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  txReceiveLot, txSellLot,
  Status, parseContractError, formatLotId, assertWalletMatch,
} from '@/utils/blockchain'
import { fetchPendingLots, fetchOwnedLots, fetchLotTrackHistory, getDisplayNames, recordLotEvent } from '@/utils/api'

const walletAddress = ref('')
const activePage = ref('pending')
const isLoading = ref(false)

const pending = ref([])
const inventory = ref([])
const sold = ref([])
const displayNames = ref({})

const trackId = ref('')
const trackResult = ref(null)
const isTracking = ref(false)
const trackError = ref('')

const confirmSuccess = ref(null)
const confirmError = ref('')
const sellSuccess = ref(null)
const sellError = ref('')
const isSelling = ref(false)

const CHAIN_STEPS = ['ORCHARD', 'PACKING', 'TRANSIT', 'RETAILER']

onMounted(async () => {
  const stored = localStorage.getItem('walletAddress')
  if (stored) { walletAddress.value = stored; await refreshLots() }
})

async function refreshLots() {
  isLoading.value = true
  try {
    const [pend, inv] = await Promise.all([
      fetchPendingLots(walletAddress.value),
      fetchOwnedLots(walletAddress.value, [Status.ReceivedByRetailer]),
    ])
    pending.value = pend
    inventory.value = inv
    const addrs = [...new Set(pend.map(l => l.currentOwner))]
    if (addrs.length) displayNames.value = await getDisplayNames(addrs)
  } catch (e) { console.error('refreshLots:', e) }
  finally { isLoading.value = false }
}

const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
const displayFrom = (addr) => displayNames.value[addr] || shortAddress(addr)
const totalInStore = computed(() => inventory.value.reduce((s, i) => s + i.weightKg, 0))

async function confirmDelivery(lotId) {
  confirmError.value = ''
  try {
    await assertWalletMatch(walletAddress.value)
    const { txHash, blockNumber, newStatus, timestamp } = await txReceiveLot(lotId)
    confirmSuccess.value = lotId
    await refreshLots()
    setTimeout(() => (confirmSuccess.value = null), 5000)
    recordLotEvent({
      eventType: 'HandshakeCompleted', lotId, txHash, blockNumber,
      actorAddress: walletAddress.value, timestamp,
      lotData: { newStatus },
    })
  } catch (e) { confirmError.value = parseContractError(e) }
}

async function markSold(lotId) {
  isSelling.value = true
  sellError.value = ''
  try {
    await assertWalletMatch(walletAddress.value)
    const { txHash, blockNumber, timestamp } = await txSellLot(lotId)
    const item = inventory.value.find(i => i.lotId === lotId)
    if (item) sold.value.unshift({ lotId: item.lotId, variety: item.variety, weightKg: item.weightKg, soldAt: item.createdAtStr })
    sellSuccess.value = lotId
    await refreshLots()
    setTimeout(() => (sellSuccess.value = null), 5000)
    recordLotEvent({
      eventType: 'LotSold', lotId, txHash, blockNumber,
      actorAddress: walletAddress.value, timestamp,
    })
  } catch (e) { sellError.value = parseContractError(e) }
  finally { isSelling.value = false }
}

async function handleTrack() {
  const id = Number(trackId.value.trim())
  if (!id) return
  isTracking.value = true
  trackError.value = ''
  trackResult.value = null
  try {
    const result = await fetchLotTrackHistory(id)
    if (!result) { trackError.value = `LOT #${String(id).padStart(4,'0')} not found`; return }

    // Resolve display names for all actors
    const actorAddrs = [...new Set(result.steps.map(s => s.actor))]
    const names = await getDisplayNames(actorAddrs)
    result.steps.forEach(s => { s.displayName = names[s.actor] || shortAddress(s.actor) })

    trackResult.value = result
  } catch (e) {
    trackError.value = 'Failed to load lot data from blockchain.'
  } finally { isTracking.value = false }
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
        <h1 class="page-title">Retailer <span class="page-title-highlight">Dashboard</span></h1>
        <p class="page-sub">Receive lots from transporters, manage store inventory, and track provenance</p>
      </div>

      <div class="tab-nav">
        <button class="tab-btn" :class="{ active: activePage === 'pending' }" @click="activePage = 'pending'">
          Incoming
          <span v-if="pending.length > 0" class="tab-badge">{{ pending.length }}</span>
        </button>
        <button class="tab-btn" :class="{ active: activePage === 'inventory' }"
          @click="activePage = 'inventory'">Inventory</button>
        <button class="tab-btn" :class="{ active: activePage === 'sold' }" @click="activePage = 'sold'">Sold</button>
        <button class="tab-btn" :class="{ active: activePage === 'track' }" @click="activePage = 'track'">Track</button>
      </div>

      <!-- INCOMING -->
      <div v-if="activePage === 'pending'" class="content">
        <div class="section-label">Lots In Transit to Your Store</div>
        <transition name="fade">
          <div v-if="confirmSuccess" class="alert-success">✅ LOT #{{ formatLotId(confirmSuccess) }} received — receiveLot called, you
            are now the owner</div>
        </transition>
        <div v-if="isLoading" class="empty-box">Loading…</div>
        <div v-else-if="pending.length === 0" class="empty-box">No incoming deliveries</div>
        <div v-else class="lot-list">
          <div v-for="item in pending" :key="item.lotId" class="lot-card">
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
                <div class="info-label">FROM</div>
                <div class="info-value mono">{{ displayFrom(item.currentOwner) }}</div>
              </div>
            </div>
            <!-- Progress -->
            <div class="progress-bar">
              <div v-for="(step, i) in CHAIN_STEPS" :key="step" class="progress-step">
                <div class="progress-track"
                  :style="{ background: i < 3 ? '#5c3317' : '#e8dcc8', borderRadius: i === 0 ? '4px 0 0 4px' : i === 3 ? '0 4px 4px 0' : '0' }">
                </div>
                <span class="progress-label" :style="{ color: i < 3 ? '#5c3317' : '#baa88a' }">{{ step }}</span>
              </div>
            </div>
            <div v-if="confirmError" class="alert-error" style="margin-top:10px">{{ confirmError }}</div>
            <div class="onchain-preview" style="margin-top:12px">
              <div class="preview-label">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                Calls receiveLot — will update on-chain
              </div>
              <div class="preview-grid">
                <div class="preview-item"><span class="preview-key">currentOwner</span><span class="preview-val mono">{{
                  shortAddress(walletAddress) }}</span></div>
                <div class="preview-item"><span class="preview-key">status</span><span
                    class="preview-val">ReceivedByRetailer</span></div>
                <div class="preview-item"><span class="preview-key">nextOwner</span><span class="preview-val">0x000...
                    (cleared)</span></div>
              </div>
            </div>
            <button class="btn-primary" style="margin-top:14px" @click="confirmDelivery(item.lotId)">Confirm Delivery (Sign
              Transaction)</button>
          </div>
        </div>
      </div>

      <!-- INVENTORY -->
      <div v-else-if="activePage === 'inventory'" class="content">
        <div class="summary-row">
          <div class="summary-card">
            <div class="summary-label">IN STORE</div>
            <div class="summary-value">{{ inventory.length }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">TOTAL WEIGHT</div>
            <div class="summary-value">{{ totalInStore.toLocaleString() }} kg</div>
          </div>
        </div>
        <div class="section-label">Store Inventory</div>
        <transition name="fade">
          <div v-if="sellSuccess" class="alert-success">✅ LOT #{{ formatLotId(sellSuccess) }} marked as Sold — sellLot called on
            blockchain</div>
        </transition>
        <div v-if="isLoading" class="empty-box">Loading…</div>
        <div v-else-if="inventory.length === 0" class="empty-box">Store inventory is empty</div>
        <div v-else class="lot-list">
          <div v-for="item in inventory" :key="item.lotId" class="lot-card">
            <div class="lot-card-top">
              <span class="lot-id">LOT #{{ formatLotId(item.lotId) }}</span>
              <span class="status-badge" style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9">At
                Retailer</span>
            </div>
            <div class="lot-variety">{{ item.variety }}</div>
            <div class="lot-info-grid">
              <div class="info-cell">
                <div class="info-label">WEIGHT</div>
                <div class="info-value">{{ item.weightKg.toLocaleString() }} kg</div>
              </div>
              <div class="info-cell">
                <div class="info-label">RECEIVED</div>
                <div class="info-value">{{ item.createdAtStr }}</div>
              </div>
            </div>
            <div v-if="sellError" class="alert-error" style="margin-top:10px">{{ sellError }}</div>
            <div class="onchain-preview" style="margin-top:12px">
              <div class="preview-label">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                Calls sellLot — final status, cannot be changed
              </div>
              <div class="preview-grid">
                <div class="preview-item"><span class="preview-key">status</span><span class="preview-val">Sold
                    (permanent)</span></div>
                <div class="preview-item"><span class="preview-key">event</span><span class="preview-val">LotSold
                    emitted</span></div>
              </div>
            </div>
            <button class="btn-sell" style="margin-top:14px" :disabled="isSelling" @click="markSold(item.lotId)">
              <span v-if="isSelling" class="spinner"></span>
              <span v-else>Mark as Sold (Sign Transaction)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- SOLD -->
      <div v-else-if="activePage === 'sold'" class="content">
        <div class="section-label">Sold Lots (Immutable Records)</div>
        <div v-if="sold.length === 0" class="empty-box">No sold lots yet</div>
        <div v-else class="sold-table">
          <div class="sold-header">
            <span>LOT</span><span>VARIETY</span><span>WEIGHT</span><span>SOLD DATE</span>
          </div>
          <div v-for="(item, i) in sold" :key="item.lotId" class="sold-row"
            :style="{ borderBottom: i < sold.length - 1 ? '1px solid #f5efe6' : 'none' }">
            <span class="sold-id">#{{ formatLotId(item.lotId) }}</span>
            <span class="sold-variety">{{ item.variety }}</span>
            <span>{{ item.weightKg }}kg</span>
            <span class="sold-date">{{ item.soldAt }}</span>
          </div>
        </div>
      </div>

      <!-- TRACK -->
      <div v-else-if="activePage === 'track'" class="content">
        <div class="section-label">Track Lot Provenance</div>
        <div class="track-search">
          <input v-model="trackId" type="text" placeholder="Enter Lot ID..." @keydown.enter="handleTrack" />
          <button class="btn-track" @click="handleTrack">Track</button>
        </div>
        <div v-if="isTracking" class="empty-box">Querying blockchain…</div>
        <div v-else-if="trackError" class="alert-error">{{ trackError }}</div>
        <div v-else-if="trackResult" class="track-card">
          <div class="track-top">
            <div>
              <div class="lot-id">LOT #{{ formatLotId(trackResult.lot.lotId) }}</div>
              <div class="lot-variety" style="margin-bottom:0">{{ trackResult.lot.variety }}</div>
            </div>
            <div class="track-weight">{{ trackResult.lot.weightKg.toLocaleString() }} kg</div>
          </div>
          <div class="timeline">
            <div v-for="(step, i) in trackResult.steps" :key="i" class="timeline-item">
              <div class="timeline-left">
                <div class="tl-dot"
                  :style="{ background: '#5c3317', boxShadow: '0 0 0 3px #fdefd8' }">
                </div>
                <div v-if="i < trackResult.steps.length - 1" class="tl-line"></div>
              </div>
              <div class="timeline-content">
                <div class="tl-name">{{ step.name }}</div>
                <div class="tl-actor">{{ step.displayName }}</div>
                <div class="tl-meta">
                  <span class="tl-action">{{ step.action }}</span>
                  <span class="tl-time">
                    <svg width="10" height="10" fill="none" stroke="#9a8a72" stroke-width="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    {{ step.time }}
                  </span>
                </div>
              </div>
            </div>
          </div>
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
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
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

.onchain-preview {
  background: #faf6f0;
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

.empty-box {
  padding: 48px;
  text-align: center;
  color: #baa88a;
  font-size: 0.9rem;
  background: #fff;
  border-radius: 16px;
  border: 1px dashed #e0d5c4;
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

.btn-sell {
  width: 100%;
  padding: 15px;
  border-radius: 50px;
  border: none;
  background: #2d6a4f;
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

.btn-sell:hover:not(:disabled) {
  background: #1e4d39;
}

.btn-sell:disabled {
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
  border: 1px solid #f5c6c0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #c0392b;
}

.sold-table {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #f0e6d6;
  overflow: hidden;
}

.sold-header {
  display: grid;
  grid-template-columns: 80px 1fr 80px 120px;
  padding: 12px 20px;
  background: #faf6f0;
  border-bottom: 1px solid #f0e6d6;
  font-size: 0.62rem;
  font-weight: 700;
  color: #9a8a72;
  letter-spacing: 0.1em;
}

.sold-row {
  display: grid;
  grid-template-columns: 80px 1fr 80px 120px;
  padding: 14px 20px;
  font-size: 0.85rem;
  color: #3d2e1e;
  align-items: center;
}

.sold-id {
  font-weight: 700;
}

.sold-variety {
  font-weight: 600;
}

.sold-date {
  color: #9a8a72;
  font-size: 0.8rem;
}

.track-search {
  display: flex;
  gap: 10px;
  width: 100%;
}

.track-search input {
  flex: 1;
  padding: 13px 16px;
  border-radius: 12px;
  border: 1px solid #e8dcc8;
  background: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #333;
  outline: none;
}

.track-search input:focus {
  border-color: #7c4a1e;
}

.btn-track {
  padding: 13px 28px;
  border-radius: 12px;
  border: none;
  background: #5c3317;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-track:hover {
  background: #7c4a1e;
}

.track-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #f0e6d6;
}

.track-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0e6d6;
}

.track-weight {
  font-size: 1.4rem;
  font-weight: 800;
  color: #3d2e1e;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 16px;
}

.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tl-line {
  width: 2px;
  flex: 1;
  background: #e8dcc8;
  min-height: 32px;
  margin: 4px 0;
}

.timeline-content {
  padding-bottom: 24px;
  flex: 1;
}

.timeline-item:last-child .timeline-content {
  padding-bottom: 0;
}

.tl-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #3d2e1e;
  margin-bottom: 2px;
}

.tl-actor {
  font-size: 0.8rem;
  color: #7a6a52;
  margin-bottom: 4px;
}

.tl-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tl-action {
  font-size: 0.68rem;
  font-weight: 700;
  background: #fdefd8;
  color: #7c4a1e;
  border-radius: 6px;
  padding: 2px 8px;
  font-family: monospace;
}

.tl-time {
  font-size: 0.7rem;
  color: #9a8a72;
  display: flex;
  align-items: center;
  gap: 3px;
}

.mono {
  font-family: monospace !important;
  font-size: 13px !important;
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