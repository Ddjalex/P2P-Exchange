import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  adsTable,
  paymentMethodsTable,
  notificationsTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create users
  const [devUser] = await db
    .insert(usersTable)
    .values({
      username: "alem_tesfaye",
      email: "alem@ethiop2p.com",
      phone: "+251911234567",
      country: "Ethiopia",
      kycStatus: "verified",
      isMerchant: true,
      emailVerified: true,
      smsVerified: true,
      addressVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  const [trader2] = await db
    .insert(usersTable)
    .values({
      username: "biruk_haile",
      email: "biruk@ethiop2p.com",
      phone: "+251922345678",
      country: "Ethiopia",
      kycStatus: "verified",
      isMerchant: true,
      emailVerified: true,
      smsVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  const [trader3] = await db
    .insert(usersTable)
    .values({
      username: "sara_girma",
      email: "sara@ethiop2p.com",
      phone: "+251933456789",
      country: "Ethiopia",
      kycStatus: "verified",
      isMerchant: false,
      emailVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  const [trader4] = await db
    .insert(usersTable)
    .values({
      username: "yonas_bekele",
      email: "yonas@ethiop2p.com",
      phone: "+251944567890",
      country: "Ethiopia",
      kycStatus: "verified",
      isMerchant: true,
      emailVerified: true,
      smsVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  const [trader5] = await db
    .insert(usersTable)
    .values({
      username: "meron_tadesse",
      email: "meron@ethiop2p.com",
      phone: "+251955678901",
      country: "Ethiopia",
      kycStatus: "verified",
      isMerchant: false,
      emailVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  console.log("✅ Users created");

  // Create wallets for all users
  const users = [devUser, trader2, trader3, trader4, trader5].filter(Boolean);
  const balances = ["1250.00", "5800.50", "320.75", "9999.99", "780.00"];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user) continue;
    await db
      .insert(walletsTable)
      .values({
        userId: user.id,
        asset: "USDT",
        availableBalance: balances[i] ?? "100.00",
        frozenBalance: "0.00",
      })
      .onConflictDoNothing();
  }

  console.log("✅ Wallets created");

  // Create payment methods for dev user
  if (devUser) {
    await db
      .insert(paymentMethodsTable)
      .values([
        {
          userId: devUser.id,
          type: "CBE" as const,
          accountNumber: "1000123456789",
          accountName: "Alem Tesfaye",
        },
        {
          userId: devUser.id,
          type: "Telebirr" as const,
          accountNumber: "+251911234567",
          accountName: "Alem Tesfaye",
        },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Payment methods created");

  // Create ads — mix of buy and sell
  const adUsers = [trader2, trader3, trader4, trader5, devUser].filter(Boolean);

  const sellAds = [
    {
      userId: adUsers[0]?.id ?? 2,
      type: "sell" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "fixed" as const,
      price: "179.00",
      totalAmount: "2000.00",
      availableAmount: "2000.00",
      minLimit: "500",
      maxLimit: "50000",
      paymentMethods: JSON.stringify(["CBE", "Awash Bank", "TeleBirr"]),
      paymentTimeLimit: 15,
      autoReply: "Verified merchant, fast release. Send proof after payment.",
      conditions: JSON.stringify({ minTrades: 0, minCompletionRate: 0 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
    {
      userId: adUsers[1]?.id ?? 3,
      type: "sell" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "fixed" as const,
      price: "181.50",
      totalAmount: "500.00",
      availableAmount: "500.00",
      minLimit: "200",
      maxLimit: "20000",
      paymentMethods: JSON.stringify(["Dashen Bank", "TeleBirr"]),
      paymentTimeLimit: 30,
      autoReply: "Pay and send screenshot. Will release within 5 min.",
      conditions: JSON.stringify({ minTrades: 5, minCompletionRate: 90 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
    {
      userId: adUsers[2]?.id ?? 4,
      type: "sell" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "floating" as const,
      price: "180.20",
      floatingMargin: "0.5",
      totalAmount: "8000.00",
      availableAmount: "8000.00",
      minLimit: "1000",
      maxLimit: "200000",
      paymentMethods: JSON.stringify(["CBE", "Awash Bank", "Abyssinia Bank", "TeleBirr", "M-PESA"]),
      paymentTimeLimit: 15,
      autoReply: "Top merchant. Instant release 24/7.",
      conditions: JSON.stringify({ minTrades: 10, minCompletionRate: 95 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
    {
      userId: adUsers[3]?.id ?? 5,
      type: "sell" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "fixed" as const,
      price: "178.00",
      totalAmount: "300.00",
      availableAmount: "300.00",
      minLimit: "100",
      maxLimit: "10000",
      paymentMethods: JSON.stringify(["TeleBirr"]),
      paymentTimeLimit: 20,
      autoReply: "Send payment then notify me.",
      conditions: JSON.stringify({ minTrades: 0, minCompletionRate: 0 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
  ];

  const buyAds = [
    {
      userId: adUsers[0]?.id ?? 2,
      type: "buy" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "fixed" as const,
      price: "177.50",
      totalAmount: "3000.00",
      availableAmount: "3000.00",
      minLimit: "500",
      maxLimit: "80000",
      paymentMethods: JSON.stringify(["CBE", "Awash Bank"]),
      paymentTimeLimit: 15,
      autoReply: "Paying instantly after you initiate.",
      conditions: JSON.stringify({ minTrades: 0, minCompletionRate: 0 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
    {
      userId: adUsers[2]?.id ?? 4,
      type: "buy" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "floating" as const,
      price: "176.80",
      floatingMargin: "0.3",
      totalAmount: "10000.00",
      availableAmount: "10000.00",
      minLimit: "2000",
      maxLimit: "500000",
      paymentMethods: JSON.stringify(["CBE", "Awash Bank", "TeleBirr", "Dashen Bank"]),
      paymentTimeLimit: 10,
      autoReply: "Premium buyer. Will pay immediately.",
      conditions: JSON.stringify({ minTrades: 20, minCompletionRate: 98 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
    {
      userId: adUsers[3]?.id ?? 5,
      type: "buy" as const,
      asset: "USDT",
      fiat: "ETB",
      priceType: "fixed" as const,
      price: "175.00",
      totalAmount: "1000.00",
      availableAmount: "1000.00",
      minLimit: "300",
      maxLimit: "30000",
      paymentMethods: JSON.stringify(["TeleBirr", "Abyssinia Bank"]),
      paymentTimeLimit: 20,
      autoReply: "Send USDT, I pay ETB fast.",
      conditions: JSON.stringify({ minTrades: 3, minCompletionRate: 85 }),
      region: "Ethiopia Only",
      status: "online" as const,
    },
  ];

  await db.insert(adsTable).values([...sellAds, ...buyAds]).onConflictDoNothing();

  console.log("✅ Ads created");

  // Create notifications for dev user
  if (devUser) {
    await db
      .insert(notificationsTable)
      .values([
        {
          userId: devUser.id,
          type: "system",
          title: "Welcome to EthioP2P!",
          message: "Your account is ready. Complete KYC to unlock full trading features.",
          isRead: false,
        },
        {
          userId: devUser.id,
          type: "kyc",
          title: "KYC Verified",
          message: "Your identity has been verified. You can now trade without limits.",
          isRead: false,
        },
        {
          userId: devUser.id,
          type: "trade",
          title: "New order received",
          message: "Biruk Haile placed an order on your sell ad. Check your orders.",
          isRead: false,
        },
      ])
      .onConflictDoNothing();
  }

  console.log("✅ Notifications created");
  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
