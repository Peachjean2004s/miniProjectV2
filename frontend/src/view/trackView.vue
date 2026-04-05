<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLotTrackHistory, getDisplayNames } from '@/utils/api'
import { formatLotId } from '@/utils/blockchain'
import type { LotInfo, TrackStep } from '@/utils/blockchain'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref('')
const lot = ref<LotInfo | null>(null)
const steps = ref<TrackStep[]>([])

const STATUS_LABEL: Record<number, string> = {
  0: 'Harvested',
  1: 'At Packing House',
  2: 'In Transit',
  3: 'At Retailer',
  4: 'Sold',
}

const shortAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

onMounted(async () => {
  const lotId = Number(route.params.lotId)
  if (!lotId || lotId < 1) {
    error.value = 'Invalid lot ID.'
    isLoading.value = false
    return
  }
  try {
    const result = await fetchLotTrackHistory(lotId)
    if (!result) {
      error.value = `LOT #${formatLotId(lotId)} not found on blockchain.`
      isLoading.value = false
      return
    }
    const actorAddrs = [...new Set(result.steps.map(s => s.actor))]
    const names = await getDisplayNames(actorAddrs)
    result.steps.forEach(s => { s.displayName = names[s.actor] || shortAddress(s.actor) })
    lot.value = result.lot
    steps.value = result.steps
  } catch {
    error.value = 'Failed to load lot data. Please try again.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="app">
    <div class="blob blob-green"></div>
    <div class="blob blob-peach"></div>

    <nav class="navbar">
      <span class="nav-brand">LONGAN TRACEABILITY</span>
      <button class="back-btn" @click="router.push({ name: 'Home' })">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>
        </svg>
        Back
      </button>
    </nav>

    <main class="main">
      <div class="page-hero">
        <h1 class="page-title">Lot <span class="page-title-highlight">Traceability</span></h1>
        <p class="page-sub">Blockchain-verified supply chain record</p>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="state-box">
        <div class="spinner"></div>
        <span>Querying blockchain...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="alert-error">{{ error }}</div>

      <!-- Result -->
      <div v-else-if="lot" class="track-card">
        <!-- Lot header -->
        <div class="track-header">
          <div>
            <div class="lot-label">LOT #{{ formatLotId(lot.lotId) }}</div>
            <div class="lot-variety">{{ lot.variety }}</div>
          </div>
          <div class="lot-right">
            <div class="lot-weight">{{ lot.weightKg.toLocaleString() }} kg</div>
            <span class="status-badge">{{ STATUS_LABEL[lot.status] }}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Info grid -->
        <div class="info-grid">
          <div class="info-cell">
            <div class="info-label">ORCHARD</div>
            <div class="info-value mono">{{ shortAddress(lot.orchard) }}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">CURRENT OWNER</div>
            <div class="info-value mono">{{ shortAddress(lot.currentOwner) }}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">CREATED</div>
            <div class="info-value">{{ lot.createdAtStr }}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">STEPS RECORDED</div>
            <div class="info-value">{{ steps.length }}</div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Timeline -->
        <div class="timeline-label">SUPPLY CHAIN HISTORY</div>
        <div v-if="steps.length === 0" class="empty-steps">No events recorded yet.</div>
        <div v-else class="timeline">
          <div v-for="(step, i) in steps" :key="i" class="timeline-item">
            <div class="tl-left">
              <div class="tl-dot"></div>
              <div v-if="i < steps.length - 1" class="tl-line"></div>
            </div>
            <div class="tl-content">
              <div class="tl-name">{{ step.name }}</div>
              <div class="tl-actor">{{ step.displayName }}</div>
              <div class="tl-meta">
                <span class="tl-action">{{ step.action }}</span>
                <span class="tl-time">
                  <svg width="10" height="10" fill="none" stroke="#9a8a72" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
                  </svg>
                  {{ step.time }}
                </span>
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

* { box-sizing: border-box; margin: 0; padding: 0; }

.app { min-height: 100vh; background: #fffaf4; font-family: 'DM Sans', sans-serif; position: relative; overflow-x: hidden; }

.blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.28; pointer-events: none; z-index: 0; }
.blob-green { width: 360px; height: 360px; background: #a8d5a2; bottom: 20px; left: -110px; }
.blob-peach { width: 280px; height: 280px; background: #f5c6a0; top: 20px; right: -80px; }

.navbar { position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 22px 40px; }
.nav-brand { font-weight: 600; font-size: 13px; letter-spacing: 0.12em; color: #2d6a4f; text-transform: uppercase; }
.back-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1.5px solid #d9b89a; border-radius: 20px; padding: 7px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #7c4a1e; cursor: pointer; transition: all 0.2s; }
.back-btn:hover { background: #fdefd8; }

.main { position: relative; z-index: 5; max-width: 600px; margin: 0 auto; padding: 16px 32px 80px; display: flex; flex-direction: column; align-items: center; gap: 28px; }

.page-hero { text-align: center; }
.page-title { font-size: 2.2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.page-title-highlight { font-family: 'Playfair Display', serif; color: #7c4a1e; }
.page-sub { font-size: 14.5px; color: #888; }

.state-box { display: flex; align-items: center; gap: 12px; padding: 40px; color: #9a8a72; font-size: 0.9rem; }
.spinner { width: 20px; height: 20px; border: 2.5px solid #e8dcc8; border-top-color: #7c4a1e; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

.alert-error { background: #fdecea; border: 1px solid #f5c6c0; border-radius: 12px; padding: 16px 20px; font-size: 0.9rem; font-weight: 600; color: #c0392b; width: 100%; text-align: center; }

.track-card { background: #fff; border-radius: 20px; padding: 28px; border: 1px solid #f0e6d6; width: 100%; }

.track-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.lot-label { font-size: 0.7rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.1em; margin-bottom: 4px; }
.lot-variety { font-size: 1.3rem; font-weight: 700; color: #3d2e1e; }
.lot-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.lot-weight { font-size: 1.4rem; font-weight: 800; color: #3d2e1e; }
.status-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; padding: 4px 12px; border-radius: 20px; background: #fdefd8; color: #7c4a1e; border: 1px solid #e8c99a; }

.divider { height: 1px; background: #f0e6d6; margin: 4px 0 20px; }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.info-cell { background: #faf6f0; border-radius: 10px; padding: 12px 14px; border: 1px solid #f0e6d6; }
.info-label { font-size: 0.58rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.1em; margin-bottom: 4px; }
.info-value { font-size: 0.85rem; font-weight: 700; color: #3d2e1e; }
.mono { font-family: monospace !important; font-size: 0.78rem !important; }

.timeline-label { font-size: 0.65rem; font-weight: 700; color: #9a8a72; letter-spacing: 0.12em; margin-bottom: 16px; }
.empty-steps { font-size: 0.85rem; color: #baa88a; text-align: center; padding: 20px; }

.timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; gap: 16px; }
.tl-left { display: flex; flex-direction: column; align-items: center; }
.tl-dot { width: 12px; height: 12px; border-radius: 50%; background: #5c3317; box-shadow: 0 0 0 3px #fdefd8; flex-shrink: 0; }
.tl-line { width: 2px; flex: 1; background: #e8dcc8; min-height: 32px; margin: 4px 0; }
.tl-content { padding-bottom: 24px; flex: 1; }
.timeline-item:last-child .tl-content { padding-bottom: 0; }
.tl-name { font-size: 0.9rem; font-weight: 700; color: #3d2e1e; margin-bottom: 2px; }
.tl-actor { font-size: 0.8rem; color: #7a6a52; margin-bottom: 6px; }
.tl-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tl-action { font-size: 0.68rem; font-weight: 700; background: #fdefd8; color: #7c4a1e; border-radius: 6px; padding: 2px 8px; font-family: monospace; }
.tl-time { font-size: 0.7rem; color: #9a8a72; display: flex; align-items: center; gap: 3px; }
</style>
