export async function fundTestnetAccount(address: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(response.statusText);
  }
}
