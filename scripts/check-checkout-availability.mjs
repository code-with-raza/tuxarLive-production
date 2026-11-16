// An anonymous, empty request cannot pass the function's authentication or cart
// guards and cannot create an order or Stripe session. Never send user tokens.
const response = await fetch('https://ncgxljatjajgcvnlrncm.supabase.co/functions/v1/create-checkout-session', {
  method: 'POST',
  headers: { Origin: 'https://tuxar.co.uk', 'Content-Type': 'application/json' },
  body: '{}',
  signal: AbortSignal.timeout(20000),
});
const body = await response.text();
console.log(JSON.stringify({ status: response.status, response: body.slice(0, 2000), authenticated: false, customerDataSent: false }));
