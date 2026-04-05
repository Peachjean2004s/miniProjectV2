<script setup lang="ts">
import { ref } from 'vue'
import AppNavbar from '@/components/AppNavbar.vue'
import { useRouter } from 'vue-router'
import { getContract, Role } from '@/utils/contract'
import { registerPackingHouse } from '@/utils/api'

const router = useRouter()
const form = ref({ companyName: '', ownerName: '', location: '', phone: '' })
const loading = ref(false)
const error = ref('')
const txHash = ref('')
const statusMsg = ref('')

async function register() {
  if (!form.value.companyName || !form.value.ownerName) {
    error.value = 'Please fill in all required fields.'
    return
  }
  error.value = ''
  loading.value = true
  try {
    statusMsg.value = 'Step 1/2: Confirm transaction in MetaMask...'
    const contract = await getContract()
    const tx = await contract.registerSelf(Role.PackingHouse)
    txHash.value = tx.hash
    statusMsg.value = 'Step 1/2: Waiting for confirmation...'
    await tx.wait()

    statusMsg.value = 'Step 2/2: Saving profile...'
    const walletAddress = localStorage.getItem('walletAddress') || ''
    await registerPackingHouse({
      walletAddress,
      companyName: form.value.companyName,
      ownerName: form.value.ownerName,
      location: form.value.location,
      phone: form.value.phone
    })

    localStorage.setItem('userRole', String(Role.PackingHouse))
    router.push({ name: 'PackingHouseView' })
  } catch (e: any) {
    if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') {
      error.value = 'Transaction rejected by user.'
    } else if (e?.message?.includes('already registered')) {
      error.value = 'This wallet is already registered.'
    } else {
      error.value = e?.reason || e?.message || 'Registration failed.'
    }
    statusMsg.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="app">
    <div class="blob blob-green"></div>
    <div class="blob blob-peach"></div>
    <AppNavbar />
    <main class="main">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">Packing House</h1>
          <p class="card-desc">Establish your entity within the Organic Ledger. Your facility will serve as a critical node in the verified supply chain protocol.</p>
        </div>
        <div class="card-body">
          <div class="section-label"><span class="dot"></span>PACKING HOUSE IDENTITY</div>
          <div class="field"><label>COMPANY NAME</label><input v-model="form.companyName" type="text" placeholder="e.g. Golden Valley Estates" /></div>
          <div class="field"><label>OWNER NAME</label><input v-model="form.ownerName" type="text" placeholder="Full Name" /></div>
          <div class="field"><label>LOCATION</label><input v-model="form.location" type="text" placeholder="Address" /></div>
          <div class="field"><label>PHONE</label><input v-model="form.phone" type="tel" placeholder="564-345-345" /></div>
          <div v-if="error" class="msg-error">{{ error }}</div>
          <div v-if="statusMsg && !error" class="msg-pending">{{ statusMsg }}</div>
          <button class="btn-register" @click="register" :disabled="loading">
            {{ loading ? 'Waiting for MetaMask...' : 'Register' }}
          </button>
          <button class="btn-back" @click="router.push({ name: 'ChooseRole' })" :disabled="loading">← Back to Roles</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
.app { min-height: 100vh; background: #fffaf4; font-family: 'DM Sans', sans-serif; position: relative; overflow: hidden; }
.blob { position: fixed; border-radius: 50%; filter: blur(90px); opacity: 0.28; pointer-events: none; z-index: 0; }
.blob-green { width: 360px; height: 360px; background: #a8d5a2; bottom: 20px; left: -110px; }
.blob-peach { width: 280px; height: 280px; background: #f5c6a0; top: 20px; right: -80px; }
.navbar { position: relative; z-index: 10; display: flex; align-items: center; padding: 22px 40px; }
.nav-brand { font-weight: 600; font-size: 13px; letter-spacing: 0.12em; color: #2d6a4f; text-transform: uppercase; }
.main { position: relative; z-index: 5; max-width: 560px; margin: 0 auto; padding: 10px 24px 60px; }
.card { border-radius: 20px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
.card-header { background: #5c3317; padding: 32px 28px; }
.card-title { font-size: 2rem; font-weight: 700; color: #fff; margin-bottom: 12px; }
.card-desc { font-size: 13.5px; color: rgba(255,255,255,0.75); line-height: 1.7; }
.card-body { background: #fdefd8; padding: 24px 28px 28px; display: flex; flex-direction: column; gap: 16px; }
.section-label { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #5c3317; text-transform: uppercase; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #2d6a4f; flex-shrink: 0; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #5c3317; text-transform: uppercase; }
.field input { background: #fff; border: none; outline: none; border-radius: 12px; padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #333; }
.field input::placeholder { color: #bbb; }
.btn-register { background: #5c3317; color: #fff; border: none; border-radius: 50px; padding: 15px; font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 15px; cursor: pointer; transition: background 0.2s; margin-top: 4px; }
.btn-register:hover { background: #7c4a1e; }
.btn-back { background: transparent; border: none; color: #7c4a1e; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 600; cursor: pointer; text-align: center; text-decoration: underline; }
.btn-back:hover { color: #5c3317; }
.btn-register:disabled { background: #b08060; cursor: not-allowed; }
.btn-back:disabled { opacity: 0.5; cursor: not-allowed; }
.msg-error { background: #fdecea; color: #c0392b; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 500; }
.msg-pending { background: #eaf4ee; color: #2d6a4f; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 500; }
</style>