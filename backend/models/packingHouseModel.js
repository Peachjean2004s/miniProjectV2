export async function upsertPackingHouse(client, { walletAddress, companyName, ownerName, location, phone }) {
  await client.query(
    `INSERT INTO packing_house (wallet_address, company_name, owner_name, location, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet_address) DO UPDATE
       SET company_name = $2, owner_name = $3, location = $4, phone = $5`,
    [walletAddress, companyName, ownerName, location || null, phone || null]
  )
}
