export async function upsertFarmer(client, { walletAddress, farmName, ownerName, location, phone }) {
  await client.query(
    `INSERT INTO farmer (wallet_address, farm_name, owner_name, location, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet_address) DO UPDATE
       SET farm_name = $2, owner_name = $3, location = $4, phone = $5`,
    [walletAddress, farmName, ownerName, location || null, phone || null]
  )
}
