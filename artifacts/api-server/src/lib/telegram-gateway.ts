const BASE_URL = 'https://gatewayapi.telegram.org/';

async function gatewayRequest(endpoint: string, body: any): Promise<any> {
  const TOKEN = process.env.TELEGRAM_GATEWAY_TOKEN;
  if (!TOKEN) {
    console.log(`[TelegramGateway] TELEGRAM_GATEWAY_TOKEN not set — skipping ${endpoint}`);
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    console.log(`[TelegramGateway] ${endpoint} response:`, JSON.stringify(data));
    if (!data.ok) {
      console.log(`[TelegramGateway] ${endpoint} error:`, data.error);
      return null;
    }
    return data.result;
  } catch (err) {
    console.log(`[TelegramGateway] ${endpoint} fetch error:`, err);
    return null;
  }
}

export async function checkSendAbility(phoneE164: string) {
  return gatewayRequest('checkSendAbility', { phone_number: phoneE164 });
}

export async function sendTelegramOtp(phoneE164: string, requestId?: string) {
  const body: any = {
    phone_number: phoneE164,
    code_length: 6,
    ttl: 600,
    payload: 'xendrx_otp',
  };
  if (requestId) body.request_id = requestId;
  return gatewayRequest('sendVerificationMessage', body);
}

export async function checkTelegramOtp(requestId: string, code: string): Promise<boolean> {
  const result = await gatewayRequest('checkVerificationStatus', { request_id: requestId, code });
  console.log('[Auth] Telegram checkVerificationStatus result:', result?.verification_status?.status);
  return result?.verification_status?.status === 'code_valid';
}

export function formatToE164(phone: string): string {
  let clean = phone.replace(/[\s\-()\u200B]/g, '');
  if (!clean.startsWith('+')) clean = '+' + clean;
  return clean;
}
