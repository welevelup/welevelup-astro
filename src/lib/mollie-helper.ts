export async function getPaymentStatus(paymentId: string): Promise<{ status: string; amount?: string; currency?: string }> {
  const mollieApiKey = process.env.MOLLIE_API_KEY;
  if (!mollieApiKey) throw new Error('MOLLIE_API_KEY not configured');

  const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mollieApiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch payment: ${response.status}`);
  }

  const data = await response.json();
  return {
    status: data.status,
    amount: data.amount?.value,
    currency: data.amount?.currency,
  };
}
