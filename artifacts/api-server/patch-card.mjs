import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);
const result = await sql`
  UPDATE cards
  SET
    reference = 'CARD_CREATE_019F041681CA',
    customer_email = 'almesagadw@gmail.com',
    card_number = '4865550144442464'
  WHERE card_id = '019f0416-81ca-7b1f-b9cc-75f0af483861'
  RETURNING id, card_id, reference, customer_email, card_number
`;
console.log("Updated:", JSON.stringify(result, null, 2));
