<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getReadContract, ROLE_TO_ROUTE } from '@/utils/contract'

const router = useRouter()
const walletAddress = ref('')
const checking = ref(true)

onMounted(async () => {
  const stored = localStorage.getItem('walletAddress')
  if (stored) walletAddress.value = stored

  // Check if already registered on-chain, redirect to dashboard
  try {
    if (stored) {
      const contract = await getReadContract()
      const registered = await contract.isRegistered(stored)
      if (registered) {
        const role = Number(await contract.getRole(stored))
        localStorage.setItem('userRole', String(role))
        const route = ROLE_TO_ROUTE[role]
        if (route) {
          router.replace({ name: route })
          return
        }
      }
    }
  } catch (e) {
    // If check fails, let user choose role normally
  }
  checking.value = false
})

const roles = [
  {
    name: 'Orchard',
    route: 'RegisterOrchard',
    icon: `<svg width="30" height="30" fill="none" stroke="#7c4a1e" stroke-width="1.7" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="3"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
      <path d="M2 17c0-2.209 1.791-4 4-4"/>
      <path d="M22 17c0-2.209-1.791-4-4-4"/>
    </svg>`
  },
  {
    name: 'Packing House',
    route: 'RegisterPackingHouse',
    icon: `<svg width="30" height="30" fill="none" stroke="#7c4a1e" stroke-width="1.7" viewBox="0 0 24 24">
      <path d="M3 9.5L12 4l9 5.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>`
  },
  {
    name: 'Transporter',
    route: 'RegisterTransporter',
    icon: `<svg width="30" height="30" fill="none" stroke="#7c4a1e" stroke-width="1.7" viewBox="0 0 24 24">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 5v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>`
  },
  {
    name: 'Retailer',
    route: 'RegisterRetailer',
    icon: `<svg width="30" height="30" fill="none" stroke="#7c4a1e" stroke-width="1.7" viewBox="0 0 24 24">
      <path d="M3 3h18v4H3z"/>
      <path d="M3 7v14h18V7"/>
      <path d="M9 7v14M15 7v14"/>
    </svg>`
  }
]

function selectRole(route) {
  router.push({ name: route })
}

function disconnect() {
  localStorage.removeItem('walletAddress')
  localStorage.removeItem('userRole')
  window.location.href = '/'
}

const shortAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
</script>

<template>
  <div class="app">
    <div class="blob blob-green"></div>
    <div class="blob blob-peach"></div>

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

    <main class="main">
      <div class="hero">
        <h1 class="hero-title">Choose Your Role</h1>
        <p class="hero-sub">
          Select your role in the supply chain to<br />
          setup your profile and start<br />
          documenting the provenance.
        </p>
      </div>

      <div class="role-grid">
        <button
          v-for="role in roles"
          :key="role.name"
          class="role-card"
          @click="selectRole(role.route)"
        >
          <div class="role-icon-wrap">
            <span v-html="role.icon"></span>
          </div>
          <span class="role-label">{{ role.name }}</span>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.app { min-height: 100vh; background: #fffaf4; font-family: 'DM Sans', sans-serif; position: relative; overflow: hidden; }

.blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.28; pointer-events: none; z-index: 0; }
.blob-green { width: 360px; height: 360px; background: #a8d5a2; bottom: 20px; left: -110px; }
.blob-peach { width: 280px; height: 280px; background: #f5c6a0; top: 20px; right: -80px; }

.navbar { position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 22px 40px; }
.nav-brand { font-weight: 600; font-size: 13px; letter-spacing: 0.12em; color: #2d6a4f; text-transform: uppercase; }
.navbar-right { display: flex; align-items: center; gap: 10px; }

.wallet-pill { display: flex; align-items: center; gap: 7px; background: #fdefd8; border: 1px solid #e8c99a; border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: #5c3317; user-select: none; }
.wallet-dot { width: 8px; height: 8px; border-radius: 50%; background: #2d6a4f; flex-shrink: 0; }

.logout-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1.5px solid #d9b89a; border-radius: 20px; padding: 6px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #7c4a1e; cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.logout-btn:hover { background: #fdecea; border-color: #c0392b; color: #c0392b; }

.main { position: relative; z-index: 5; max-width: 660px; margin: 0 auto; padding: 20px 32px 80px; display: flex; flex-direction: column; align-items: center; gap: 40px; }

.hero { text-align: center; }
.hero-title { font-size: 2.5rem; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; }
.hero-sub { font-size: 15.5px; color: #777; line-height: 1.75; }

.role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }

.role-card { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 16px; background: #fdefd8; border: 2px solid transparent; border-radius: 18px; padding: 36px 20px 32px; cursor: pointer; transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s; text-align: center; }
.role-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(92, 51, 23, 0.12); border-color: #7c4a1e; background: #fae0c2; }

.role-icon-wrap { width: 60px; height: 60px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
.role-label { font-size: 14px; font-weight: 700; color: #3a2010; line-height: 1.4; }
</style>