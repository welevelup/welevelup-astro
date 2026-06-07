import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { amount, recurring, donorName, donorEmail, giftAid } = await req.json()

    const MOLLIE_API_KEY = Deno.env.get('MOLLIE_API_KEY')
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://welevelup.org'

    if (!MOLLIE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing MOLLIE_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const mollie_res = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOLLIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { value: parseFloat(amount).toFixed(2), currency: 'GBP' },
        description: `Level Up — ${recurring ? 'Monthly' : ''} Donation`,
        redirectUrl: `${SITE_URL.replace(/\/$/, '')}/donate/thank-you`,
        metadata: { type: recurring ? 'recurring' : 'one-time', donorEmail, donorName, giftAid },
      }),
    })

    const payment = await mollie_res.json()

    return new Response(JSON.stringify({ checkoutUrl: payment._links?.checkout?.href }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
