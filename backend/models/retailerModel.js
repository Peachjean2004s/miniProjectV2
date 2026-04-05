export async function upsertRetailer(client, { walletAddress, storeName, ownerName, location, phone }) {
  await client.query(
    `INSERT INTO retailer (wallet_address, store_name, owner_name, location, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet_address) DO UPDATE
       SET store_name = $2, owner_name = $3, location = $4, phone = $5`,
    [walletAddress, storeName, ownerName, location || null, phone || null]
  )
}
