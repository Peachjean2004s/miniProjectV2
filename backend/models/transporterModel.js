export async function upsertTransporter(client, { walletAddress, companyName, driverName, licensePlate, phone }) {
  await client.query(
    `INSERT INTO transporter (wallet_address, company_name, driver_name, license_plate, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet_address) DO UPDATE
       SET company_name = $2, driver_name = $3, license_plate = $4, phone = $5`,
    [walletAddress, companyName, driverName, licensePlate || null, phone || null]
  )
}
