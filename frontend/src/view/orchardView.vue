<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import RecipientPicker from '@/components/RecipientPicker.vue'
import VarietyPicker from '@/components/VarietyPicker.vue'
import {
  txRegisterLot, txInitiateTransfer,
  STATUS_LABEL, STATUS_STYLE, hasPendingTransfer, parseContractError, formatLotId, assertWalletMatch,
} from '@/utils/blockchain'

import { fetchOrchardLots, recordLotEvent, getDisplayNames } from '@/utils/api'

const router = useRouter()
const walletAddress = ref('')
const activePage = ref('lots')
const lots = ref([])
const isLoadingLots = ref(false)
const companyNames = ref({})

// Create Lot
const variety = ref('')
const weightKg = ref('')
const createSuccess = ref(null)
const createError = ref('')
const isSubmitting = ref(false)
const createStatusMsg = ref('')

// Transfer
const transferLotId = ref('')
const transferTo = ref('')
const transferSuccess = ref(null)
const transferError = ref('')
const isTransferring = ref(false)

onMounted(async () => {
  const stored = localStorage.getItem('walletAddress')
  if (stored) { walletAddress.value = stored; await refreshLots() }
})

async function refreshLots() {
  isLoadingLots.value = true
  try {
    const all = await fetchOrchardLots(walletAddress.value)
    lots.value = all.filter(l =>
      l.currentOwner.toLowerCase() === walletAddress.value.toLowerCase()
    )

    const pendingAddresses = lots.value
      .filter(l => hasPendingTransfer(l) && l.nextOwner)
      .map(l => l.nextOwner)
    
    const uniqueAddresses = [...new Set(pendingAddresses)]

    if (uniqueAddresses.length > 0) {
      const namesMap = await getDisplayNames(uniqueAddresses)
      companyNames.value = { ...companyNames.value, ...namesMap }
    }
  }
  catch (e) { console.error('fetchOrchardLots:', e) }
  finally { isLoadingLots.value = false }
}

const getCompanyName = (addr) => {
  if (!addr) return ''
  const name = companyNames.value[addr] || companyNames.value[addr.toLowerCase()]
  return name ? name : shortAddress(addr)
}

const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
const canCreate = computed(() => variety.value.trim() && weightKg.value && Number(weightKg.value) > 0)
const canTransfer = computed(() =>
  transferLotId.value && transferTo.value.trim().startsWith('0x') && transferTo.value.trim().length === 42
)
const transferableLots = computed(() =>
  lots.value.filter(l => l.status !== 4 && !hasPendingTransfer(l))
)

async function handleCreateLot() {
  if (!canCreate.value) return
  isSubmitting.value = true
  createError.value = ''
  createStatusMsg.value = 'Confirm in MetaMask...'
  try {
    await assertWalletMatch(walletAddress.value)
    const v = variety.value.trim()
    const w = Number(weightKg.value)
    const { txHash, blockNumber, lotId, timestamp } = await txRegisterLot(v, w)
    createSuccess.value = lotId
    variety.value = ''
    weightKg.value = ''
    createStatusMsg.value = ''
    await refreshLots()
    setTimeout(() => (createSuccess.value = null), 5000)
    // บันทึกลง DB (non-blocking)
    recordLotEvent({
      eventType: 'LotRegistered', lotId, txHash, blockNumber,
      actorAddress: walletAddress.value, timestamp,
      lotData: { variety: v, weightKg: w },
    })
  } catch (e) {
    createError.value = parseContractError(e)
    createStatusMsg.value = ''
  } finally { isSubmitting.value = false }
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
  } catch (e) {
    transferError.value = parseContractError(e)
  } finally { isTransferring.value = false }
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

    <!-- Navbar -->
    <nav class="navbar">
      <span class="nav-brand">LONGAN TRACEABILITY</span>
      <div class="navbar-right">
        <div v-if="walletAddress" class="wallet-pill">
          <span class="wallet-dot"></span>
          {{ shortAddress(walletAddress) }}
        </div>
        <button class="logout-btn" @click="disconnect">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </nav>

    <main class="main">

      <!-- Page title -->
      <div class="page-hero">
        <h1 class="page-title">Orchard <span class="page-title-highlight">Dashboard</span></h1>
        <p class="page-sub">Manage your longan lots and transfers on the blockchain</p>
      </div>

      <!-- Tab nav -->
      <div class="tab-nav">
        <button class="tab-btn" :class="{ active: activePage === 'lots' }" @click="activePage = 'lots'">My Lots</button>
        <button class="tab-btn" :class="{ active: activePage === 'create' }" @click="activePage = 'create'">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Lot
        </button>
        <button class="tab-btn" :class="{ active: activePage === 'transfer' }" @click="activePage = 'transfer'">Transfer</button>
      </div>

      <!-- ══ MY LOTS ══ -->
      <div v-if="activePage === 'lots'" class="content">
        <!-- Summary -->
        <div class="summary-row">
          <div class="summary-card">
            <div class="summary-label">TOTAL LOTS</div>
            <div class="summary-value">{{ lots.length }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">TOTAL WEIGHT</div>
            <div class="summary-value">{{ lots.reduce((s,l) => s + l.weightKg, 0).toLocaleString() }} kg</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">HARVESTED</div>
            <div class="summary-value">{{ lots.filter(l => l.status === 0).length }}</div>
          </div>
        </div>

        <!-- Lot list -->
        <div v-if="isLoadingLots" class="empty-box">Loading lots from blockchain...</div>
        <div v-else-if="lots.length === 0" class="empty-box">No lots registered yet</div>
        <div v-else class="lot-list">
          <div v-for="lot in lots" :key="lot.lotId" class="lot-card">
            <div class="lot-card-top">
              <span class="lot-id">LOT #{{ formatLotId(lot.lotId) }}</span>
              <span class="status-badge"
                :style="{ background: STATUS_STYLE[lot.status]?.bg, color: STATUS_STYLE[lot.status]?.text, border: `1px solid ${STATUS_STYLE[lot.status]?.border}` }">
                {{ STATUS_LABEL[lot.status] }}
              </span>
            </div>
            <div class="lot-variety">{{ lot.variety }}</div>
            <div class="lot-info-grid">
              <div class="info-cell">
                <div class="info-label">WEIGHT</div>
                <div class="info-value">{{ lot.weightKg.toLocaleString() }} kg</div>
              </div>
              <div class="info-cell">
                <div class="info-label">CREATED</div>
                <div class="info-value">{{ lot.createdAtStr }}</div>
              </div>
            </div>
            <div v-if="hasPendingTransfer(lot)" class="pending-transfer">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
              Pending transfer to {{ getCompanyName(lot.nextOwner) }}
            </div>
          </div>
        </div>
      </div>

      <!-- ══ CREATE LOT ══ -->
      <div v-else-if="activePage === 'create'" class="content">
        <div class="section-label">Register New Lot</div>
        <div class="form-card">
          <transition name="fade">
            <div v-if="createSuccess" class="alert-success">✅ LOT #{{ formatLotId(createSuccess) }} registered on blockchain</div>
          </transition>
          <div v-if="createError" class="alert-error">❌ {{ createError }}</div>
          <div v-if="createStatusMsg" class="alert-pending">⏳ {{ createStatusMsg }}</div>

          <div class="field">
            <label>VARIETY (สายพันธุ์)</label>
            <VarietyPicker v-model="variety" />
          </div>
          <div class="field">
            <label>WEIGHT KG (น้ำหนัก)</label>
            <input v-model="weightKg" type="number" placeholder="e.g. 500" min="1" />
          </div>

          <!-- On-chain preview -->
          <div class="onchain-preview">
            <div class="preview-label">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              On-chain data that will be recorded
            </div>
            <div class="preview-grid">
              <div class="preview-item"><span class="preview-key">orchard</span><span class="preview-val mono">{{ shortAddress(walletAddress) }}</span></div>
              <div class="preview-item"><span class="preview-key">variety</span><span class="preview-val">{{ variety || '—' }}</span></div>
              <div class="preview-item"><span class="preview-key">weightKg</span><span class="preview-val">{{ weightKg || '—' }}</span></div>
              <div class="preview-item"><span class="preview-key">status</span><span class="preview-val">Harvested</span></div>
            </div>
          </div>

          <button class="btn-primary" :disabled="!canCreate || isSubmitting" @click="handleCreateLot">
            <span v-if="isSubmitting" class="spinner"></span>
            <span v-else>Register Lot (Sign Transaction)</span>
          </button>
        </div>
      </div>

      <!-- ══ TRANSFER ══ -->
      <div v-else-if="activePage === 'transfer'" class="content">

        <!-- Chain flow -->
        <div class="chain-flow">
          <div class="chain-step active">Orchard</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          <div class="chain-step">Packing House</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          <div class="chain-step">Transporter</div>
          <svg width="16" height="16" fill="none" stroke="#c4a882" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
          <div class="chain-step">Retailer</div>
        </div>

        <div class="section-label">Initiate Transfer to Packing House</div>
        <div class="form-card">
          <transition name="fade">
            <div v-if="transferSuccess" class="alert-success">
              ✅ Transfer initiated for LOT #{{ formatLotId(transferSuccess) }}. Waiting for Packing House to confirm.
            </div>
          </transition>
          <div v-if="transferError" class="alert-error">❌ {{ transferError }}</div>

          <div class="field">
            <label>SELECT LOT</label>
            <div v-if="transferableLots.length === 0" class="empty-sm">No lots available for transfer</div>
            <div v-else class="select-list">
              <div v-for="lot in transferableLots" :key="lot.lotId"
                class="select-item" :class="{ selected: transferLotId === String(lot.lotId) }"
                @click="transferLotId = String(lot.lotId)">
                <div>
                  <span class="select-lot-id">LOT #{{ formatLotId(lot.lotId) }}</span>
                  <span class="select-lot-info"> · {{ lot.variety }} · {{ lot.weightKg }}kg</span>
                </div>
                <svg v-if="transferLotId === String(lot.lotId)" width="16" height="16" fill="none" stroke="#7c4a1e" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
              </div>
            </div>
          </div>

          <div class="field">
            <label>PACKING HOUSE</label>
            <RecipientPicker
              role="PackingHouse"
              v-model="transferTo"
              placeholder="พิมชื่อบริษัท หรือ 0x..."
            />
            <span class="field-hint">เลือกจาก dropdown หรือพิม wallet address โดยตรง</span>
          </div>

          <!-- On-chain preview -->
          <div class="onchain-preview">
            <div class="preview-label">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              Calls initiateTransfer on Smart Contract
            </div>
            <div class="preview-grid">
              <div class="preview-item"><span class="preview-key">lotId</span><span class="preview-val">{{ transferLotId ? formatLotId(Number(transferLotId)) : '—' }}</span></div>
              <div class="preview-item"><span class="preview-key">_to</span><span class="preview-val mono">{{ transferTo ? shortAddress(transferTo) : '—' }}</span></div>
              <div class="preview-item"><span class="preview-key">nextOwner set</span><span class="preview-val">{{ transferTo || '—' }}</span></div>
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

* { box-sizing: border-box; margin: 0; padding: 0; }

.app { min-height: 100vh; background: #fffaf4; font-family: 'DM Sans', sans-serif; position: relative; overflow-x: hidden; }

/* Blobs */
.blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.28; pointer-events: none; z-index: 0; }
.blob-green { width: 360px; height: 360px; background: #a8d5a2; bottom: 20px; left: -110px; }
.blob-peach { width: 280px; height: 280px; background: #f5c6a0; top: 20px; right: -80px; }

/* Navbar */
.navbar { position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 22px 40px; }
.nav-brand { font-weight: 600; font-size: 13px; letter-spacing: 0.12em; color: #2d6a4f; text-transform: uppercase; }
.navbar-right { display: flex; align-items: center; gap: 10px; }
.wallet-pill { display: flex; align-items: center; gap: 7px; background: #fdefd8; border: 1px solid #e8c99a; border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: #5c3317; user-select: none; }
.wallet-dot { width: 8px; height: 8px; border-radius: 50%; background: #2d6a4f; flex-shrink: 0; }
.logout-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1.5px solid #d9b89a; border-radius: 20px; padding: 6px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #7c4a1e; cursor: pointer; transition: all 0.2s; }
.logout-btn:hover { background: #fdecea; border-color: #c0392b; color: #c0392b; }

/* Main */
.main { position: relative; z-index: 5; max-width: 680px; margin: 0 auto; padding: 16px 32px 80px; display: flex; flex-direction: column; align-items: center; gap: 28px; }

/* Hero */
.page-hero { text-align: center; }
.page-title { font-size: 2.2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.page-title-highlight { font-family: 'Playfair Display', serif; color: #7c4a1e; }
.page-sub { font-size: 14.5px; color: #888; line-height: 1.6; }

/* Tabs */
.tab-nav { display: flex; gap: 8px; background: #fdefd8; border-radius: 14px; padding: 6px; width: 100%; }
.tab-btn { flex: 1; padding: 10px 16px; border-radius: 10px; border: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 600; color: #9a7a52; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
.tab-btn.active { background: #5c3317; color: #fff; }
.tab-btn:hover:not(.active) { background: #f5e6cc; color: #5c3317; }

/* Content */
.content { width: 100%; display: flex; flex-direction: column; gap: 20px; }

/* Summary */
.summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.summary-card { background: #fff; border-radius: 16px; padding: 18px 20px; border: 1px solid #f0e6d6; }
.summary-label { font-size: 0.62rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.1em; margin-bottom: 6px; }
.summary-value { font-size: 1.5rem; font-weight: 800; color: #3d2e1e; }

/* Section label */
.section-label { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #999; font-weight: 500; white-space: nowrap; width: 100%; }
.section-label::before, .section-label::after { content: ''; flex: 1; height: 1px; background: #e8dcc8; }

/* Lot list */
.lot-list { display: flex; flex-direction: column; gap: 12px; }
.lot-card { background: #fff; border-radius: 16px; padding: 20px 22px; border: 1px solid #f0e6d6; }
.lot-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.lot-id { font-size: 0.72rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.08em; }
.status-badge { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; padding: 3px 10px; border-radius: 20px; }
.lot-variety { font-size: 1.05rem; font-weight: 700; color: #3d2e1e; margin-bottom: 12px; }
.lot-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.info-cell { background: #faf6f0; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0e6d6; }
.info-label { font-size: 0.6rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.08em; margin-bottom: 3px; }
.info-value { font-size: 0.85rem; font-weight: 700; color: #3d2e1e; }
.pending-transfer { margin-top: 10px; font-size: 0.75rem; font-weight: 600; color: #7c4a1e; display: flex; align-items: center; gap: 5px; background: #fdefd8; border-radius: 8px; padding: 7px 10px; }

/* Empty */
.empty-box { padding: 48px; text-align: center; color: #baa88a; font-size: 0.9rem; background: #fff; border-radius: 16px; border: 1px dashed #e0d5c4; }
.empty-sm { padding: 16px; text-align: center; color: #baa88a; font-size: 0.82rem; background: #faf6f0; border-radius: 10px; border: 1px dashed #e0d5c4; }

/* Form */
.form-card { background: #fdefd8; border-radius: 20px; padding: 28px; display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.68rem; font-weight: 700; color: #7c4a1e; letter-spacing: 0.1em; }
.field input { padding: 13px 16px; border-radius: 12px; border: none; background: #fff; font-family: 'DM Sans', sans-serif; font-size: 14.5px; color: #333; outline: none; transition: box-shadow 0.2s; }
.field input:focus { box-shadow: 0 0 0 2px #d4a574; }
.field-hint { font-size: 0.7rem; color: #a08060; }
.mono { font-family: monospace !important; font-size: 13px !important; }

/* On-chain preview */
.onchain-preview { background: #fff; border-radius: 12px; padding: 14px 16px; border: 1px solid #e8c99a; }
.preview-label { font-size: 0.68rem; font-weight: 700; color: #7c4a1e; letter-spacing: 0.06em; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
.preview-grid { display: flex; flex-direction: column; gap: 5px; }
.preview-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; }
.preview-key { color: #9a7a52; font-weight: 600; }
.preview-val { color: #3d2e1e; font-weight: 600; }

/* Buttons */
.btn-primary { width: 100%; padding: 15px; border-radius: 50px; border: none; background: #5c3317; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s, opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; }
.btn-primary:hover:not(:disabled) { background: #7c4a1e; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Spinner */
.spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Alert */
.alert-success { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 12px; padding: 12px 16px; font-size: 0.85rem; font-weight: 600; color: #2d6a4f; }
.alert-error { background: #fdecea; border: 1px solid #ef9a9a; border-radius: 12px; padding: 12px 16px; font-size: 0.85rem; font-weight: 600; color: #b71c1c; }
.alert-pending { background: #e8f4fd; border: 1px solid #90caf9; border-radius: 12px; padding: 12px 16px; font-size: 0.85rem; font-weight: 600; color: #1565c0; }

/* Chain flow */
.chain-flow { background: #fff; border-radius: 14px; padding: 16px 24px; border: 1px solid #f0e6d6; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; width: 100%; }
.chain-step { padding: 7px 16px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; background: #faf6f0; color: #9a8a72; border: 1px solid #e8dcc8; }
.chain-step.active { background: #5c3317; color: #fff; border-color: #5c3317; }

/* Select list */
.select-list { display: flex; flex-direction: column; gap: 8px; }
.select-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e8dcc8; background: #fff; cursor: pointer; transition: all 0.15s; }
.select-item:hover { border-color: #c4a882; }
.select-item.selected { border-color: #7c4a1e; background: #faf6f0; }
.select-lot-id { font-size: 0.88rem; font-weight: 700; color: #3d2e1e; }
.select-lot-info { font-size: 0.82rem; color: #9a8a72; }

/* Fade transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(6px); }
</style>