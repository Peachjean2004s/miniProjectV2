import { ethers } from 'ethers'

export const CONTRACT_ADDRESS = '0xB4626F8ADCBC6e443E3ab9A7bDa445FDdaACfF6C'

export const CONTRACT_ABI = [
  {
    "inputs": [{ "internalType": "enum LonganSupplyChain.Role", "name": "_role", "type": "uint8" }],
    "name": "registerSelf",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "getRole",
    "outputs": [{ "internalType": "enum LonganSupplyChain.Role", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "isRegistered",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "_variety", "type": "string" }, { "internalType": "uint256", "name": "_weightKg", "type": "uint256" }],
    "name": "registerLot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_lotId", "type": "uint256" }, { "internalType": "address", "name": "_to", "type": "address" }],
    "name": "initiateTransfer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_lotId", "type": "uint256" }],
    "name": "receiveLot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_lotId", "type": "uint256" }],
    "name": "sellLot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_lotId", "type": "uint256" }],
    "name": "getLotInfo",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "lotId", "type": "uint256" },
          { "internalType": "string", "name": "variety", "type": "string" },
          { "internalType": "uint256", "name": "weightKg", "type": "uint256" },
          { "internalType": "address", "name": "orchard", "type": "address" },
          { "internalType": "address", "name": "currentOwner", "type": "address" },
          { "internalType": "address", "name": "nextOwner", "type": "address" },
          { "internalType": "enum LonganSupplyChain.Status", "name": "status", "type": "uint8" },
          { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
        ],
        "internalType": "struct LonganSupplyChain.LonganLot",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lotCounter",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "enum LonganSupplyChain.Role", "name": "role", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "RoleRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "lotId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "orchard", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "variety", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "weightKg", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "LotRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "lotId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "HandshakeInitiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "lotId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" },
      { "indexed": false, "internalType": "enum LonganSupplyChain.Status", "name": "newStatus", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "HandshakeCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "lotId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "retailer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "LotSold",
    "type": "event"
  }
]

export const Role = {
  None: 0,
  Orchard: 1,
  PackingHouse: 2,
  Transporter: 3,
  Retailer: 4
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLE_TO_ROUTE: Record<number, string> = {
  [Role.Orchard]: 'OrchardView',
  [Role.PackingHouse]: 'PackingHouseView',
  [Role.Transporter]: 'TransporterView',
  [Role.Retailer]: 'RetailerView'
}

export const ROLE_LABELS: Record<number, string> = {
  [Role.Orchard]: 'orchard',
  [Role.PackingHouse]: 'packinghouse',
  [Role.Transporter]: 'transporter',
  [Role.Retailer]: 'retailer'
}

export async function getContract() {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
}

export async function getReadContract() {
  if (!window.ethereum) throw new Error('MetaMask not installed')
  const provider = new ethers.BrowserProvider(window.ethereum)
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
}
