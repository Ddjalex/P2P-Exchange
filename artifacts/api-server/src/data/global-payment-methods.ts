/**
 * Global payment methods by country — Binance P2P style.
 * 119 countries, 800+ methods. Each entry has:
 *   id        — unique stable key stored in DB
 *   name      — display name
 *   fieldType — "bank" | "mobile" | "wallet" | "card"
 *   accountLabel / accountPlaceholder / inputType — form hints
 */

export interface PaymentMethodDef {
  id: string;
  name: string;
  fieldType: "bank" | "mobile" | "wallet" | "card";
  accountLabel: string;
  accountPlaceholder: string;
  inputType: "text" | "tel" | "number";
}

export interface CountryMethods {
  country: string;       // ISO 3166-1 alpha-2
  countryName: string;
  currency: string;      // e.g. "ETB"
  methods: PaymentMethodDef[];
}

// ─── Shared / universal methods ──────────────────────────────────────────────
const BANK_TRANSFER: PaymentMethodDef = { id: "BANK_TRANSFER", name: "Bank Transfer", fieldType: "bank", accountLabel: "Account Number", accountPlaceholder: "Account / IBAN", inputType: "text" };
const PAYPAL: PaymentMethodDef = { id: "PAYPAL", name: "PayPal", fieldType: "wallet", accountLabel: "PayPal Email / Phone", accountPlaceholder: "name@email.com or +1...", inputType: "text" };
const WISE: PaymentMethodDef = { id: "WISE", name: "Wise (TransferWise)", fieldType: "wallet", accountLabel: "Wise Email / Account", accountPlaceholder: "name@email.com", inputType: "text" };
const REVOLUT: PaymentMethodDef = { id: "REVOLUT", name: "Revolut", fieldType: "wallet", accountLabel: "Revolut Tag / Phone", accountPlaceholder: "@revoluttag or +44...", inputType: "text" };
const SKRILL: PaymentMethodDef = { id: "SKRILL", name: "Skrill", fieldType: "wallet", accountLabel: "Skrill Email", accountPlaceholder: "name@email.com", inputType: "text" };
const NETELLER: PaymentMethodDef = { id: "NETELLER", name: "Neteller", fieldType: "wallet", accountLabel: "Neteller Account ID / Email", accountPlaceholder: "Account ID or email", inputType: "text" };
const WESTERN_UNION: PaymentMethodDef = { id: "WESTERN_UNION", name: "Western Union", fieldType: "wallet", accountLabel: "Receiver Name / MTCN", accountPlaceholder: "Full legal name", inputType: "text" };
const MONEYGRAM: PaymentMethodDef = { id: "MONEYGRAM", name: "MoneyGram", fieldType: "wallet", accountLabel: "Reference Number", accountPlaceholder: "Reference number", inputType: "text" };
const SEPA: PaymentMethodDef = { id: "SEPA", name: "SEPA Bank Transfer", fieldType: "bank", accountLabel: "IBAN", accountPlaceholder: "DE89...", inputType: "text" };
const SWIFT: PaymentMethodDef = { id: "SWIFT", name: "SWIFT Wire Transfer", fieldType: "bank", accountLabel: "Account / IBAN + BIC", accountPlaceholder: "IBAN or account number", inputType: "text" };
const USDT_TRC20: PaymentMethodDef = { id: "USDT_TRC20", name: "USDT (TRC20)", fieldType: "wallet", accountLabel: "TRC20 Wallet Address", accountPlaceholder: "T...", inputType: "text" };
const USDT_BEP20: PaymentMethodDef = { id: "USDT_BEP20", name: "USDT (BEP20/BSC)", fieldType: "wallet", accountLabel: "BEP20 Wallet Address", accountPlaceholder: "0x...", inputType: "text" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function bank(id: string, name: string, placeholder = "Account number"): PaymentMethodDef {
  return { id, name, fieldType: "bank", accountLabel: "Account Number", accountPlaceholder: placeholder, inputType: "text" };
}
function mobile(id: string, name: string, placeholder = "Phone number"): PaymentMethodDef {
  return { id, name, fieldType: "mobile", accountLabel: "Phone Number", accountPlaceholder: placeholder, inputType: "tel" };
}
function wallet(id: string, name: string, label = "Account / ID", placeholder = "Account or ID"): PaymentMethodDef {
  return { id, name, fieldType: "wallet", accountLabel: label, accountPlaceholder: placeholder, inputType: "text" };
}

// ─── Country list ─────────────────────────────────────────────────────────────
export const GLOBAL_PAYMENT_METHODS: CountryMethods[] = [

  // ── AFRICA ─────────────────────────────────────────────────────────────────

  {
    country: "ET", countryName: "Ethiopia", currency: "ETB",
    methods: [
      bank("CBE", "Commercial Bank of Ethiopia (CBE)", "13-digit account number"),
      mobile("TELEBIRR", "Telebirr (Ethio Telecom)", "09XX XXX XXXX"),
      bank("AWASH", "Awash Bank"),
      bank("DASHEN", "Dashen Bank"),
      bank("ABYSSINIA", "Bank of Abyssinia"),
      mobile("HELLOCASH", "HelloCash", "09XX XXX XXXX"),
      mobile("MPESA_ET", "M-Pesa Ethiopia", "09XX XXX XXXX"),
      mobile("CBEBIRR", "CBEBirr", "09XX XXX XXXX"),
      bank("AMHARA", "Amhara Bank"),
      bank("WEGAGEN", "Wegagen Bank"),
      bank("COOPBANK", "Cooperative Bank of Oromia"),
      bank("HIBRET", "Hibret Bank (United Bank)"),
      bank("ZEMEN", "Zemen Bank"),
      bank("BERHAN", "Berhan Bank"),
      bank("ENAT", "Enat Bank"),
      bank("SIINQEE", "Siinqee Bank"),
      bank("GADAA", "Gadaa Bank"),
      bank("TSEDEY", "Tsedey Bank"),
      bank("GLOBAL_ET", "Global Bank Ethiopia"),
      mobile("AMOLE", "Amole (Dashen)"),
      mobile("KACHA", "Kacha Mobile Money"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "NG", countryName: "Nigeria", currency: "NGN",
    methods: [
      bank("GTB", "Guaranty Trust Bank (GTBank)", "10-digit account number"),
      bank("ACCESS_NG", "Access Bank Nigeria"),
      bank("ZENITH_NG", "Zenith Bank"),
      bank("FIRST_NG", "First Bank of Nigeria"),
      bank("UBA_NG", "United Bank for Africa (UBA)"),
      bank("FCMB", "FCMB (First City Monument Bank)"),
      bank("STANBIC_NG", "Stanbic IBTC Bank"),
      bank("STERLING_NG", "Sterling Bank"),
      bank("FIDELITY_NG", "Fidelity Bank Nigeria"),
      bank("WEMA", "Wema Bank"),
      bank("POLARIS", "Polaris Bank"),
      bank("KEYSTONE", "Keystone Bank"),
      bank("ECOBANK_NG", "Ecobank Nigeria"),
      mobile("OPAY", "OPay", "080X XXX XXXX"),
      mobile("PALMPAY", "PalmPay", "080X XXX XXXX"),
      wallet("KUDA", "Kuda Bank", "Account Number"),
      wallet("PIGGYVEST", "PiggyVest"),
      WESTERN_UNION, PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "KE", countryName: "Kenya", currency: "KES",
    methods: [
      mobile("MPESA_KE", "M-Pesa Kenya (Safaricom)", "07XX XXX XXX"),
      bank("KCB", "Kenya Commercial Bank (KCB)"),
      bank("EQUITY_KE", "Equity Bank Kenya"),
      bank("COOPERATIVE_KE", "Co-operative Bank of Kenya"),
      bank("ABSA_KE", "Absa Bank Kenya"),
      bank("NCBA", "NCBA Bank Kenya"),
      bank("STANBIC_KE", "Stanbic Bank Kenya"),
      bank("DTB", "Diamond Trust Bank (DTB)"),
      bank("FAMILY_KE", "Family Bank Kenya"),
      mobile("AIRTEL_KE", "Airtel Money Kenya", "073X XXX XXX"),
      wallet("PESALINK", "PesaLink"),
      wallet("FLUTTERWAVE_KE", "Flutterwave"),
      WESTERN_UNION, WISE, SWIFT,
    ],
  },

  {
    country: "GH", countryName: "Ghana", currency: "GHS",
    methods: [
      mobile("MTN_MOMO_GH", "MTN Mobile Money (MoMo)", "024/054 XXX XXXX"),
      mobile("VODAFONE_CASH", "Vodafone Cash", "020 XXX XXXX"),
      mobile("AIRTELTIGO_GH", "AirtelTigo Money", "026/056 XXX XXXX"),
      bank("GCB", "Ghana Commercial Bank (GCB)"),
      bank("ECOBANK_GH", "Ecobank Ghana"),
      bank("ABSA_GH", "Absa Bank Ghana"),
      bank("STANBIC_GH", "Stanbic Bank Ghana"),
      bank("CAL_BANK", "CAL Bank"),
      bank("ZENITH_GH", "Zenith Bank Ghana"),
      bank("ACCESS_GH", "Access Bank Ghana"),
      wallet("ZEEPAY", "Zeepay"),
      WESTERN_UNION, WISE, SWIFT,
    ],
  },

  {
    country: "ZA", countryName: "South Africa", currency: "ZAR",
    methods: [
      bank("FNB", "First National Bank (FNB)"),
      bank("ABSA_ZA", "ABSA Bank South Africa"),
      bank("STANDARD_ZA", "Standard Bank South Africa"),
      bank("NEDBANK", "Nedbank"),
      bank("CAPITEC", "Capitec Bank"),
      bank("INVESTEC", "Investec Bank"),
      bank("AFRICAN_BANK", "African Bank"),
      wallet("SNAPSCAN", "SnapScan"),
      wallet("ZAPPER", "Zapper"),
      mobile("MTN_MOMO_ZA", "MTN MoMo South Africa"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "EG", countryName: "Egypt", currency: "EGP",
    methods: [
      bank("NBE", "National Bank of Egypt (NBE)"),
      bank("CIB_EG", "CIB Egypt"),
      bank("BANQUE_MISR", "Banque Misr"),
      bank("QNB_EG", "QNB Egypt"),
      bank("HSBC_EG", "HSBC Egypt"),
      bank("ALEXBANK", "Bank of Alexandria"),
      mobile("VODAFONE_CASH_EG", "Vodafone Cash Egypt", "010X XXX XXXX"),
      mobile("ORANGE_MONEY_EG", "Orange Money Egypt"),
      mobile("ETISALAT_CASH", "Etisalat Cash (e-Finance)"),
      wallet("FAWRY", "Fawry"),
      wallet("MEEZA", "Meeza"),
      WESTERN_UNION, WISE, SWIFT,
    ],
  },

  {
    country: "TZ", countryName: "Tanzania", currency: "TZS",
    methods: [
      mobile("MPESA_TZ", "M-Pesa Tanzania (Vodacom)", "075X XXX XXX"),
      mobile("AIRTEL_TZ", "Airtel Money Tanzania", "078X XXX XXX"),
      mobile("TIGOPESA", "Tigo Pesa", "071X XXX XXX"),
      mobile("HALOPESA", "HaloPesa", "062X XXX XXX"),
      bank("CRDB", "CRDB Bank Tanzania"),
      bank("NMB_TZ", "NMB Bank Tanzania"),
      bank("NBC_TZ", "NBC Bank Tanzania"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "UG", countryName: "Uganda", currency: "UGX",
    methods: [
      mobile("MTN_MOMO_UG", "MTN Mobile Money Uganda", "077X XXX XXX"),
      mobile("AIRTEL_UG", "Airtel Money Uganda", "075X XXX XXX"),
      bank("STANBIC_UG", "Stanbic Bank Uganda"),
      bank("ABSA_UG", "Absa Bank Uganda"),
      bank("EQUITY_UG", "Equity Bank Uganda"),
      bank("CENTENARY_UG", "Centenary Bank Uganda"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "RW", countryName: "Rwanda", currency: "RWF",
    methods: [
      mobile("MTN_MOMO_RW", "MTN Mobile Money Rwanda", "078X XXX XXX"),
      mobile("AIRTEL_RW", "Airtel Money Rwanda", "073X XXX XXX"),
      bank("BK_RW", "Bank of Kigali"),
      bank("EQUITY_RW", "Equity Bank Rwanda"),
      bank("ECOBANK_RW", "Ecobank Rwanda"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CI", countryName: "Côte d'Ivoire", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_CI", "Orange Money Côte d'Ivoire"),
      mobile("MTN_MOMO_CI", "MTN Mobile Money Côte d'Ivoire"),
      mobile("MOOV_MONEY_CI", "Moov Money"),
      bank("ECOBANK_CI", "Ecobank Côte d'Ivoire"),
      bank("SGBCI", "Société Générale Côte d'Ivoire"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CM", countryName: "Cameroon", currency: "XAF",
    methods: [
      mobile("ORANGE_MONEY_CM", "Orange Money Cameroon"),
      mobile("MTN_MOMO_CM", "MTN Mobile Money Cameroon"),
      bank("ECOBANK_CM", "Ecobank Cameroon"),
      bank("AFRILAND", "Afriland First Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SN", countryName: "Senegal", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_SN", "Orange Money Senegal"),
      mobile("FREE_MONEY", "Free Money Senegal"),
      mobile("WAVE_SN", "Wave Senegal"),
      bank("CBAO", "CBAO Group Senegal"),
      bank("ECOBANK_SN", "Ecobank Senegal"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MA", countryName: "Morocco", currency: "MAD",
    methods: [
      bank("ATTIJARIWAFA", "Attijariwafa Bank"),
      bank("BMCE", "BMCE Bank (Bank of Africa)"),
      bank("CIH_MA", "CIH Bank Morocco"),
      bank("BCP_MA", "Banque Centrale Populaire"),
      mobile("MAROC_TELECOM_MONEY", "Maroc Telecom Money"),
      mobile("ORANGE_MONEY_MA", "Orange Money Morocco"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "TN", countryName: "Tunisia", currency: "TND",
    methods: [
      bank("BIAT", "Banque Internationale Arabe de Tunisie (BIAT)"),
      bank("STB", "Société Tunisienne de Banque"),
      bank("ATTIJARI_TN", "Attijari Bank Tunisia"),
      bank("UIB", "UIB (Union Internationale de Banques)"),
      wallet("SOBFLOUS", "SobFlous"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "DZ", countryName: "Algeria", currency: "DZD",
    methods: [
      bank("BNA_DZ", "Banque Nationale d'Algérie (BNA)"),
      bank("BEA_DZ", "Banque Extérieure d'Algérie (BEA)"),
      bank("CPA_DZ", "Crédit Populaire d'Algérie (CPA)"),
      bank("BDL", "Banque de Développement Local"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ZW", countryName: "Zimbabwe", currency: "ZWL",
    methods: [
      mobile("ECOCASH", "EcoCash", "07X XXX XXXX"),
      mobile("ONEMONEY", "OneMoney (NetOne)"),
      mobile("TELECASH", "TeleCash"),
      bank("CBZ", "CBZ Bank Zimbabwe"),
      bank("STANBIC_ZW", "Stanbic Bank Zimbabwe"),
      bank("ZB_BANK", "ZB Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ZM", countryName: "Zambia", currency: "ZMW",
    methods: [
      mobile("MTN_MOMO_ZM", "MTN Mobile Money Zambia"),
      mobile("AIRTEL_ZM", "Airtel Money Zambia"),
      mobile("ZAMTEL_KWACHA", "Zamtel Kwacha"),
      bank("ZANACO", "Zanaco Bank"),
      bank("STANBIC_ZM", "Stanbic Bank Zambia"),
      bank("FNB_ZM", "FNB Zambia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MZ", countryName: "Mozambique", currency: "MZN",
    methods: [
      mobile("MPESA_MZ", "M-Pesa Mozambique (Vodacom)"),
      mobile("EMOLA", "eMola (Movitel)"),
      bank("BIM", "BIM (Millennium BIM)"),
      bank("BCI_MZ", "BCI Mozambique"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "AO", countryName: "Angola", currency: "AOA",
    methods: [
      wallet("MULTICAIXA", "Multicaixa Express"),
      bank("BAI", "Banco Angolano de Investimentos (BAI)"),
      bank("BFA_AO", "BFA Angola"),
      bank("BIC_AO", "BIC Angola"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SD", countryName: "Sudan", currency: "SDG",
    methods: [
      bank("KHARTOUM_BANK", "Bank of Khartoum"),
      bank("OMDURMAN", "Omdurman National Bank"),
      mobile("MTN_MOMO_SD", "MTN Mobile Money Sudan"),
      mobile("SUDANI_MONEY", "Sudani Money"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SO", countryName: "Somalia", currency: "USD",
    methods: [
      mobile("EVCPLUS", "EVC Plus (Hormuud)", "061X XXX XXX"),
      mobile("ZAAD", "Zaad Service (Telesom)", "063X XXX XXX"),
      mobile("SAHAL", "Sahal (Somtel)"),
      mobile("E-DAHAB", "E-Dahab (Golis)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MG", countryName: "Madagascar", currency: "MGA",
    methods: [
      mobile("MVola", "MVola (Telma)", "034X XX XXX"),
      mobile("ORANGE_MONEY_MG", "Orange Money Madagascar"),
      mobile("AIRTEL_MG", "Airtel Money Madagascar"),
      bank("BNI_MG", "BNI Madagascar"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MU", countryName: "Mauritius", currency: "MUR",
    methods: [
      bank("MCB_MU", "MCB Group Mauritius"),
      bank("SBM_MU", "SBM Bank Mauritius"),
      bank("ABSA_MU", "Absa Bank Mauritius"),
      mobile("JUICE_MU", "Juice (MCB)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  // ── MIDDLE EAST ─────────────────────────────────────────────────────────────

  {
    country: "AE", countryName: "United Arab Emirates", currency: "AED",
    methods: [
      bank("ADCB", "Abu Dhabi Commercial Bank (ADCB)"),
      bank("FAB", "First Abu Dhabi Bank (FAB)"),
      bank("ENBD", "Emirates NBD"),
      bank("DIB", "Dubai Islamic Bank (DIB)"),
      bank("MASHREQ", "Mashreq Bank"),
      bank("RAK_BANK", "RAK Bank"),
      bank("HSBC_AE", "HSBC UAE"),
      wallet("AANI", "Aani (Instant Payment)"),
      wallet("PAYIT", "PayIt (FAB)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "SA", countryName: "Saudi Arabia", currency: "SAR",
    methods: [
      bank("AL_RAJHI", "Al Rajhi Bank"),
      bank("ALINMA", "Alinma Bank"),
      bank("RIYAD", "Riyad Bank"),
      bank("SNB", "Saudi National Bank (SNB)"),
      bank("SAMBA", "Samba Financial Group"),
      bank("BSF", "Banque Saudi Fransi"),
      wallet("STCPAY", "STC Pay"),
      wallet("URPAY", "UrPay"),
      wallet("APPLE_PAY_SA", "Apple Pay (Mada)"),
      SWIFT, WISE,
    ],
  },

  {
    country: "TR", countryName: "Turkey", currency: "TRY",
    methods: [
      bank("ZIRAAT", "Ziraat Bankası"),
      bank("GARANTI", "Garanti BBVA"),
      bank("IS_BANKASI", "İş Bankası (İşbank)"),
      bank("AKBANK", "Akbank"),
      bank("YAPI_KREDI", "Yapı Kredi"),
      bank("HALKBANK", "Halkbank"),
      bank("VAKIFBANK", "VakıfBank"),
      wallet("PAPARA", "Papara"),
      wallet("ININAL", "ininal"),
      wallet("PAYCO", "Payco"),
      PAYPAL, SWIFT, WISE,
    ],
  },

  {
    country: "IQ", countryName: "Iraq", currency: "IQD",
    methods: [
      bank("RASHEED", "Rasheed Bank Iraq"),
      bank("RAFIDAIN", "Rafidain Bank Iraq"),
      bank("TBI", "Trade Bank of Iraq"),
      mobile("ZAIN_CASH", "ZainCash", "077X XXX XXXX"),
      mobile("ASIACELL_CASH", "AsiaCell Cash"),
      mobile("FASTPAY_IQ", "FastPay Iraq"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "IR", countryName: "Iran", currency: "IRR",
    methods: [
      bank("MELLAT", "Bank Mellat"),
      bank("MELLI_IR", "Bank Melli Iran"),
      bank("SADERAT", "Bank Saderat Iran"),
      bank("TEJARAT", "Bank Tejarat"),
      bank("PASARGAD", "Bank Pasargad"),
      wallet("CARD_TO_CARD", "Card-to-Card Transfer", "Card Number", "16-digit card number"),
      SWIFT,
    ],
  },

  {
    country: "KW", countryName: "Kuwait", currency: "KWD",
    methods: [
      bank("NBK", "National Bank of Kuwait (NBK)"),
      bank("KFH", "Kuwait Finance House (KFH)"),
      bank("CBK", "Commercial Bank of Kuwait (CBK)"),
      bank("BOUBYAN", "Boubyan Bank"),
      wallet("KNET", "KNET"),
      SWIFT, WISE,
    ],
  },

  {
    country: "QA", countryName: "Qatar", currency: "QAR",
    methods: [
      bank("QNB_QA", "Qatar National Bank (QNB)"),
      bank("CBQ", "Commercial Bank of Qatar (CBQ)"),
      bank("DOHA_BANK", "Doha Bank"),
      bank("MASRAF_AL_RAYAN", "Masraf Al Rayan"),
      wallet("OOREDOO_MONEY", "Ooredoo Money"),
      SWIFT, WISE,
    ],
  },

  {
    country: "BH", countryName: "Bahrain", currency: "BHD",
    methods: [
      bank("NBB", "National Bank of Bahrain (NBB)"),
      bank("BBK", "Bank of Bahrain and Kuwait (BBK)"),
      bank("ITHMAAR", "Ithmaar Bank"),
      wallet("BENEFIT", "BenefitPay"),
      SWIFT, WISE,
    ],
  },

  {
    country: "JO", countryName: "Jordan", currency: "JOD",
    methods: [
      bank("ARAB_BANK", "Arab Bank Jordan"),
      bank("HOUSING_BANK", "Housing Bank for Trade & Finance"),
      bank("CAIRO_AMMAN", "Cairo Amman Bank"),
      mobile("ZAIN_CASH_JO", "ZainCash Jordan"),
      mobile("ORANGE_MONEY_JO", "Orange Money Jordan"),
      wallet("CLIQ", "CliQ"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LB", countryName: "Lebanon", currency: "LBP",
    methods: [
      bank("BLOM_BANK", "BLOM Bank"),
      bank("BYBLOS_BANK", "Byblos Bank"),
      bank("BANK_AUDI", "Bankmed (formerly Bank Audi)"),
      mobile("OMMONEY", "OMT / Wish Money"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "YE", countryName: "Yemen", currency: "YER",
    methods: [
      mobile("FLOOSAK", "Floosak (MTN Yemen)"),
      mobile("M_FLOOS", "M Floos (Sabafon)"),
      bank("CAC_YE", "CAC Bank Yemen"),
      WESTERN_UNION, SWIFT,
    ],
  },

  // ── SOUTH ASIA ───────────────────────────────────────────────────────────────

  {
    country: "IN", countryName: "India", currency: "INR",
    methods: [
      wallet("UPI", "UPI (Unified Payments Interface)", "UPI ID", "name@upi"),
      wallet("PHONEPE", "PhonePe", "UPI ID / Phone"),
      wallet("GOOGLEPAY_IN", "Google Pay (GPay)", "UPI ID / Phone"),
      wallet("PAYTM", "Paytm", "Phone / UPI ID"),
      wallet("BHIM", "BHIM"),
      bank("SBI", "State Bank of India (SBI)", "Account number"),
      bank("HDFC", "HDFC Bank"),
      bank("ICICI", "ICICI Bank"),
      bank("AXIS", "Axis Bank"),
      bank("KOTAK", "Kotak Mahindra Bank"),
      bank("PNB", "Punjab National Bank (PNB)"),
      bank("BOI", "Bank of India"),
      bank("CANARA", "Canara Bank"),
      bank("UNION_IN", "Union Bank of India"),
      PAYPAL, SWIFT, WISE,
    ],
  },

  {
    country: "PK", countryName: "Pakistan", currency: "PKR",
    methods: [
      mobile("EASYPAISA", "Easypaisa (Telenor)", "03XX XXX XXXX"),
      mobile("JAZZCASH", "JazzCash", "03XX XXX XXXX"),
      mobile("SADAPAY", "SadaPay"),
      mobile("NAYAPAY", "NayaPay"),
      bank("HBL", "Habib Bank Limited (HBL)"),
      bank("UBL_PK", "United Bank Limited (UBL)"),
      bank("MCB_PK", "MCB Bank Pakistan"),
      bank("ABL", "Allied Bank Limited (ABL)"),
      bank("MEEZAN", "Meezan Bank"),
      bank("BANK_ALFALAH", "Bank Alfalah"),
      bank("FAYSAL", "Faysal Bank"),
      WESTERN_UNION, WISE, SWIFT,
    ],
  },

  {
    country: "BD", countryName: "Bangladesh", currency: "BDT",
    methods: [
      mobile("BKASH", "bKash", "01XXX XXX XXX"),
      mobile("NAGAD", "Nagad", "01XXX XXX XXX"),
      mobile("ROCKET_BD", "Rocket (Dutch-Bangla)", "01XXX XXX XXX"),
      mobile("UPAY", "Upay"),
      bank("DUTCH_BANGLA", "Dutch-Bangla Bank"),
      bank("ISLAMI_BD", "Islami Bank Bangladesh"),
      bank("BRAC_BD", "BRAC Bank"),
      bank("CITY_BD", "City Bank Bangladesh"),
      bank("PREMIER_BD", "Premier Bank Bangladesh"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LK", countryName: "Sri Lanka", currency: "LKR",
    methods: [
      mobile("DIALOG_EZCASH", "Dialog eZ Cash"),
      mobile("MOBICASH", "Mobicash (Mobitel)"),
      wallet("FRIMI", "FriMi (NDB Bank)"),
      bank("BOC_LK", "Bank of Ceylon"),
      bank("PEOPLE_LK", "People's Bank Sri Lanka"),
      bank("COMMERCIAL_LK", "Commercial Bank of Ceylon"),
      bank("HNB", "Hatton National Bank (HNB)"),
      bank("SAMPATH", "Sampath Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "NP", countryName: "Nepal", currency: "NPR",
    methods: [
      mobile("ESEWA", "eSewa", "98XX XXX XXX"),
      mobile("KHALTI", "Khalti"),
      mobile("IME_PAY", "IME Pay"),
      mobile("CONNECTIPS", "ConnectIPS"),
      bank("NABIL", "Nabil Bank Nepal"),
      bank("NIC_ASIA", "NIC Asia Bank"),
      bank("GLOBAL_IME", "Global IME Bank"),
      bank("EVEREST_NP", "Everest Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  // ── SOUTHEAST ASIA ──────────────────────────────────────────────────────────

  {
    country: "VN", countryName: "Vietnam", currency: "VND",
    methods: [
      wallet("MOMO_VN", "MoMo Vietnam", "Phone Number", "09XX XXX XXX"),
      wallet("ZALOPAY", "ZaloPay"),
      wallet("VNPAY", "VNPay"),
      bank("VIETCOMBANK", "Vietcombank"),
      bank("TECHCOMBANK", "Techcombank"),
      bank("BIDV", "BIDV"),
      bank("MB_VN", "MB Bank (Military Bank)"),
      bank("VPB", "VPBank"),
      bank("TPBANK", "TPBank"),
      bank("AGRIBANK", "Agribank"),
      bank("ACB_VN", "ACB Vietnam"),
      WISE, SWIFT,
    ],
  },

  {
    country: "TH", countryName: "Thailand", currency: "THB",
    methods: [
      wallet("PROMPTPAY", "PromptPay", "Phone / National ID", "0X-XXXX-XXXX"),
      bank("SCB_TH", "Siam Commercial Bank (SCB)"),
      bank("KBANK", "Kasikorn Bank (KBank)"),
      bank("BANGKOK_BANK", "Bangkok Bank"),
      bank("KRUNGSRI", "Krungsri (Bank of Ayudhya)"),
      bank("TMB", "TMB Thanachart Bank (TTB)"),
      bank("KRUNGTHAI", "Krungthai Bank"),
      wallet("TRUEMONEY", "TrueMoney Wallet"),
      wallet("RABBIT_LINE", "Rabbit LINE Pay"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "ID", countryName: "Indonesia", currency: "IDR",
    methods: [
      bank("BCA", "Bank Central Asia (BCA)"),
      bank("BNI_ID", "Bank Negara Indonesia (BNI)"),
      bank("BRI_ID", "Bank Rakyat Indonesia (BRI)"),
      bank("MANDIRI", "Bank Mandiri"),
      bank("CIMB_ID", "CIMB Niaga"),
      wallet("OVO", "OVO"),
      wallet("DANA", "DANA"),
      wallet("GOPAY", "GoPay"),
      wallet("SHOPEEPAY", "ShopeePay"),
      mobile("LINKAJA", "LinkAja"),
      WISE, SWIFT,
    ],
  },

  {
    country: "PH", countryName: "Philippines", currency: "PHP",
    methods: [
      wallet("GCASH", "GCash", "GCash Number", "09XX XXX XXXX"),
      wallet("MAYA", "Maya (PayMaya)"),
      wallet("COINS_PH", "Coins.ph"),
      bank("BDO", "Banco de Oro (BDO)"),
      bank("BPI", "Bank of the Philippine Islands (BPI)"),
      bank("METROBANK", "Metrobank"),
      bank("PNB_PH", "Philippine National Bank (PNB)"),
      bank("RCBC", "Rizal Commercial Banking Corp (RCBC)"),
      bank("EASTWEST", "EastWest Bank"),
      WESTERN_UNION, PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MY", countryName: "Malaysia", currency: "MYR",
    methods: [
      wallet("DUITNOW", "DuitNow", "Phone / IC / Account"),
      wallet("TNGD", "Touch 'n Go eWallet (TNG)"),
      wallet("BOOST_MY", "Boost"),
      wallet("GRABPAY_MY", "GrabPay Malaysia"),
      bank("MAYBANK", "Maybank"),
      bank("CIMB_MY", "CIMB Bank Malaysia"),
      bank("PUBLIC_BANK", "Public Bank Berhad"),
      bank("RHB", "RHB Bank"),
      bank("HONG_LEONG_MY", "Hong Leong Bank"),
      bank("AMBANK", "AmBank"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MM", countryName: "Myanmar", currency: "MMK",
    methods: [
      mobile("KBZPAY", "KBZPay", "09X XXX XXXX"),
      mobile("WAVEMONEY", "Wave Money"),
      mobile("MPITESAN", "M-Pitesan"),
      bank("KBZ_BANK", "KBZ Bank Myanmar"),
      bank("CB_BANK", "CB Bank Myanmar"),
      bank("AYA_BANK", "AYA Bank"),
      bank("MAB", "MAB (Myanma Apex Bank)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "KH", countryName: "Cambodia", currency: "KHR",
    methods: [
      mobile("WING_KH", "Wing Money Cambodia"),
      mobile("TRUEMONEY_KH", "TrueMoney Cambodia"),
      bank("ACLEDA", "ACLEDA Bank"),
      bank("ABA_KH", "ABA Bank Cambodia"),
      bank("CANADIA", "Canadia Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SG", countryName: "Singapore", currency: "SGD",
    methods: [
      wallet("PAYNOW", "PayNow", "Mobile / NRIC / UEN"),
      bank("DBS", "DBS / POSB"),
      bank("OCBC", "OCBC Bank"),
      bank("UOB", "United Overseas Bank (UOB)"),
      bank("CITIBANK_SG", "Citibank Singapore"),
      bank("STANDARD_CHARTERED_SG", "Standard Chartered Singapore"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  // ── EAST ASIA ───────────────────────────────────────────────────────────────

  {
    country: "CN", countryName: "China", currency: "CNY",
    methods: [
      wallet("ALIPAY", "Alipay (支付宝)", "Alipay Account", "Phone or email"),
      wallet("WECHAT_PAY", "WeChat Pay (微信支付)", "WeChat ID"),
      bank("ICBC", "ICBC (工商银行)"),
      bank("ABC_CN", "Agricultural Bank of China (农业银行)"),
      bank("BOC_CN", "Bank of China (中国银行)"),
      bank("CCB", "China Construction Bank (建设银行)"),
      bank("CMB", "China Merchants Bank (招商银行)"),
      bank("CITIC_BANK", "CITIC Bank (中信银行)"),
      bank("SPDB", "Shanghai Pudong Development Bank (浦发银行)"),
      bank("CEB", "China Everbright Bank (光大银行)"),
      SWIFT,
    ],
  },

  {
    country: "HK", countryName: "Hong Kong", currency: "HKD",
    methods: [
      wallet("FPS_HK", "FPS (Faster Payment System)", "Phone / Email / FPS ID"),
      wallet("PAYME", "PayMe by HSBC"),
      wallet("ALI_PAY_HK", "AlipayHK"),
      bank("HSBC_HK", "HSBC Hong Kong"),
      bank("HANG_SENG", "Hang Seng Bank"),
      bank("BOC_HK", "Bank of China (Hong Kong)"),
      bank("BOCHK", "Bank of Communications HK"),
      bank("SCB_HK", "Standard Chartered HK"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "TW", countryName: "Taiwan", currency: "TWD",
    methods: [
      wallet("LINEPAY_TW", "LINE Pay Taiwan"),
      wallet("JKOPAY", "JKOPay (街口支付)"),
      bank("FUBON", "Taipei Fubon Bank (富邦銀行)"),
      bank("CATHAY_TW", "Cathay United Bank (國泰世華)"),
      bank("ESUN", "E.SUN Bank (玉山銀行)"),
      bank("CTBC", "CTBC Bank (中信銀行)"),
      bank("BOT_TW", "Bank of Taiwan (台灣銀行)"),
      SWIFT, WISE,
    ],
  },

  {
    country: "KR", countryName: "South Korea", currency: "KRW",
    methods: [
      wallet("KAKAOPAY", "KakaoPay"),
      wallet("TOSSPAY", "Toss (토스)"),
      wallet("NAVERPAY", "Naver Pay (네이버페이)"),
      bank("KOOKMIN", "KB Kookmin Bank (국민은행)"),
      bank("SHINHAN", "Shinhan Bank (신한은행)"),
      bank("WOORI", "Woori Bank (우리은행)"),
      bank("HANA_KR", "Hana Bank (하나은행)"),
      bank("NH_KR", "NH Nonghyup Bank (농협은행)"),
      bank("IBK_KR", "IBK Industrial Bank (기업은행)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "JP", countryName: "Japan", currency: "JPY",
    methods: [
      wallet("PAYPAY", "PayPay"),
      wallet("LINE_PAY_JP", "LINE Pay Japan"),
      wallet("RAKUTEN_PAY", "Rakuten Pay"),
      bank("MUFG", "MUFG Bank (三菱UFJ銀行)"),
      bank("MIZUHO", "Mizuho Bank (みずほ銀行)"),
      bank("SMBC", "Sumitomo Mitsui Bank (三井住友銀行)"),
      bank("JPPOST", "Japan Post Bank (ゆうちょ銀行)"),
      bank("RAKUTEN_BANK", "Rakuten Bank (楽天銀行)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  // ── CENTRAL ASIA ────────────────────────────────────────────────────────────

  {
    country: "KZ", countryName: "Kazakhstan", currency: "KZT",
    methods: [
      wallet("KASPI_KZ", "Kaspi Pay", "Kaspi Phone Number"),
      bank("HALYK", "Halyk Bank Kazakhstan"),
      bank("CENTERCREDIT", "Bank CenterCredit"),
      bank("FORTE_KZ", "Forte Bank"),
      bank("FREEDOM_KZ", "Freedom Bank Kazakhstan"),
      mobile("MTN_MOMO_KZ", "Tele2 Pay"),
      SWIFT, WISE,
    ],
  },

  {
    country: "UZ", countryName: "Uzbekistan", currency: "UZS",
    methods: [
      wallet("CLICK_UZ", "Click", "Phone / Card Number"),
      wallet("PAYME_UZ", "Payme"),
      wallet("UZUM_UZ", "Uzum (Apelsin)"),
      bank("NBU_UZ", "National Bank of Uzbekistan"),
      bank("KAPITALBANK", "Kapitalbank"),
      bank("HAMKORBANK", "Hamkorbank"),
      bank("IPAK_YOLI", "Ipak Yoli Bank"),
      SWIFT,
    ],
  },

  // ── EUROPE ──────────────────────────────────────────────────────────────────

  {
    country: "GB", countryName: "United Kingdom", currency: "GBP",
    methods: [
      wallet("FASTER_PAYMENTS_UK", "Faster Payments (UK)", "Sort Code + Account Number", "XX-XX-XX / XXXXXXXX"),
      bank("BARCLAYS", "Barclays Bank"),
      bank("LLOYDS", "Lloyds Bank"),
      bank("HSBC_UK", "HSBC UK"),
      bank("NATWEST", "NatWest"),
      bank("SANTANDER_UK", "Santander UK"),
      wallet("MONZO", "Monzo"),
      wallet("STARLING", "Starling Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "DE", countryName: "Germany", currency: "EUR",
    methods: [
      SEPA,
      bank("DEUTSCHE_BANK", "Deutsche Bank"),
      bank("COMMERZBANK", "Commerzbank"),
      bank("SPARKASSE", "Sparkasse"),
      bank("DKB", "Deutsche Kreditbank (DKB)"),
      bank("N26", "N26 Bank"),
      wallet("KLARNA", "Klarna"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "FR", countryName: "France", currency: "EUR",
    methods: [
      SEPA,
      bank("BNP_PARIBAS", "BNP Paribas"),
      bank("CREDIT_AGRICOLE", "Crédit Agricole"),
      bank("SOCIETE_GENERALE", "Société Générale"),
      bank("LYONNAIS", "LCL (Crédit Lyonnais)"),
      bank("BANQUE_POSTALE", "La Banque Postale"),
      wallet("LYDIA", "Lydia"),
      wallet("SUMERIA", "Sumeria (ex-Lydia Pro)"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "IT", countryName: "Italy", currency: "EUR",
    methods: [
      SEPA,
      bank("INTESA", "Intesa Sanpaolo"),
      bank("UNICREDIT", "UniCredit"),
      bank("BNL", "BNL (Banca Nazionale del Lavoro)"),
      bank("MONTE_PASCHI", "Banca Monte dei Paschi di Siena"),
      wallet("SATISPAY", "Satispay"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "ES", countryName: "Spain", currency: "EUR",
    methods: [
      SEPA,
      bank("SANTANDER_ES", "Banco Santander"),
      bank("BBVA_ES", "BBVA Spain"),
      bank("CAIXABANK", "CaixaBank"),
      bank("SABADELL", "Banco Sabadell"),
      bank("BANKINTER", "Bankinter"),
      wallet("BIZUM", "Bizum", "Phone Number", "6XX XXX XXX"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "PL", countryName: "Poland", currency: "PLN",
    methods: [
      SEPA,
      bank("PKO_BP", "PKO Bank Polski"),
      bank("PEKAO", "Bank Pekao"),
      bank("MBANK", "mBank"),
      bank("ING_PL", "ING Bank Śląski"),
      bank("SANTANDER_PL", "Santander Bank Polska"),
      wallet("BLIK", "BLIK", "BLIK Code", "6-digit BLIK code"),
      wallet("PAYBYNET", "PayByNet"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "RO", countryName: "Romania", currency: "RON",
    methods: [
      SEPA,
      bank("BCR", "Banca Comercială Română (BCR)"),
      bank("BRD", "BRD - Groupe Société Générale"),
      bank("RAIFFEISEN_RO", "Raiffeisen Bank Romania"),
      bank("ING_RO", "ING Bank Romania"),
      bank("BANCA_TRANSILVANIA", "Banca Transilvania"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "UA", countryName: "Ukraine", currency: "UAH",
    methods: [
      wallet("MONOBANK", "Monobank", "Card Number / Phone", "Card number or +38..."),
      wallet("PRIVAT24", "PrivatBank / Privat24", "Card Number", "16-digit card number"),
      bank("OSCHADBANK", "Oschadbank"),
      bank("UKRSIBBANK", "UkrSibbank (BNP Paribas Group)"),
      bank("ALFA_UA", "Alfa-Bank Ukraine"),
      WISE, SWIFT,
    ],
  },

  {
    country: "RU", countryName: "Russia", currency: "RUB",
    methods: [
      bank("SBERBANK", "Sberbank"),
      bank("TINKOFF", "Tinkoff Bank", "Phone / Card Number"),
      bank("VTB", "VTB Bank"),
      bank("ALFA_RU", "Alfa-Bank Russia"),
      bank("RAIFFEISEN_RU", "Raiffeisen Bank Russia"),
      wallet("QIWI", "QIWI Wallet"),
      wallet("YOOMONEY", "YooMoney (Yandex Pay)"),
      wallet("SBERPAY", "SberPay"),
      SWIFT,
    ],
  },

  {
    country: "CZ", countryName: "Czech Republic", currency: "CZK",
    methods: [
      SEPA,
      bank("CSOB", "ČSOB (Československá obchodní banka)"),
      bank("CESKA_SPORITELNA", "Česká spořitelna"),
      bank("KOMERCNI", "Komerční banka"),
      bank("MONETA", "Moneta Money Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "HU", countryName: "Hungary", currency: "HUF",
    methods: [
      SEPA,
      bank("OTP_HU", "OTP Bank Hungary"),
      bank("K_AND_H", "K&H Bank"),
      bank("ERSTE_HU", "Erste Bank Hungary"),
      bank("MKB", "MKB Bank"),
      wallet("BARION", "Barion"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "SE", countryName: "Sweden", currency: "SEK",
    methods: [
      wallet("SWISH", "Swish", "Phone Number", "07XX XXX XXX"),
      bank("SWEDBANK", "Swedbank"),
      bank("SEB_SE", "SEB Bank Sweden"),
      bank("NORDEA_SE", "Nordea Sweden"),
      bank("HANDELSBANKEN", "Handelsbanken"),
      PAYPAL, WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "NO", countryName: "Norway", currency: "NOK",
    methods: [
      wallet("VIPPS", "Vipps", "Phone Number"),
      bank("DNB", "DNB Bank"),
      bank("NORDEA_NO", "Nordea Norway"),
      bank("SPAREBANK", "SpareBank 1"),
      PAYPAL, WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "DK", countryName: "Denmark", currency: "DKK",
    methods: [
      wallet("MOBILEPAY", "MobilePay", "Phone Number"),
      bank("DANSKE_BANK", "Danske Bank"),
      bank("NORDEA_DK", "Nordea Denmark"),
      bank("JYSKE_BANK", "Jyske Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "FI", countryName: "Finland", currency: "EUR",
    methods: [
      SEPA,
      wallet("MOBILEPAY_FI", "MobilePay Finland"),
      bank("OP_FI", "OP Financial Group"),
      bank("NORDEA_FI", "Nordea Finland"),
      bank("DANSKE_FI", "Danske Bank Finland"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "NL", countryName: "Netherlands", currency: "EUR",
    methods: [
      SEPA,
      wallet("IDEAL", "iDEAL", "Bank / iDEAL Issuer"),
      bank("ING_NL", "ING Netherlands"),
      bank("RABOBANK", "Rabobank"),
      bank("ABN_AMRO", "ABN AMRO"),
      bank("SNS", "SNS Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "BE", countryName: "Belgium", currency: "EUR",
    methods: [
      SEPA,
      wallet("PAYCONIQ", "Payconiq"),
      bank("BNP_BE", "BNP Paribas Fortis"),
      bank("KBC", "KBC Bank"),
      bank("ING_BE", "ING Belgium"),
      bank("BELFIUS", "Belfius Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "CH", countryName: "Switzerland", currency: "CHF",
    methods: [
      wallet("TWINT", "TWINT", "Phone Number"),
      bank("UBS", "UBS Switzerland"),
      bank("CREDIT_SUISSE", "Credit Suisse (UBS)"),
      bank("ZKB", "Zürcher Kantonalbank (ZKB)"),
      bank("POSTFINANCE", "PostFinance"),
      bank("RAIFFEISEN_CH", "Raiffeisen Switzerland"),
      bank("DUKASCOPY", "Dukascopy Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "AT", countryName: "Austria", currency: "EUR",
    methods: [
      SEPA,
      bank("ERSTE_AT", "Erste Bank Austria"),
      bank("RAIFFEISEN_AT", "Raiffeisen Bank Austria"),
      bank("BAWAG", "BAWAG P.S.K."),
      bank("VOLKSBANK_AT", "Volksbank Austria"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "PT", countryName: "Portugal", currency: "EUR",
    methods: [
      SEPA,
      wallet("MBWAY", "MBWay", "Phone Number", "9XX XXX XXX"),
      bank("CGD", "Caixa Geral de Depósitos (CGD)"),
      bank("MILLENNIUM_PT", "Millennium BCP"),
      bank("BPI", "BPI (Banco BPI)"),
      bank("NOVO_BANCO", "Novo Banco"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "GR", countryName: "Greece", currency: "EUR",
    methods: [
      SEPA,
      bank("PIRAEUS", "Piraeus Bank"),
      bank("ALPHA_GR", "Alpha Bank Greece"),
      bank("NBG", "National Bank of Greece (NBG)"),
      bank("EUROBANK", "Eurobank"),
      wallet("IRIS_GR", "IRIS Online Payments"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "BG", countryName: "Bulgaria", currency: "BGN",
    methods: [
      SEPA,
      bank("UNICREDIT_BG", "UniCredit Bulbank"),
      bank("DSK", "DSK Bank"),
      bank("OBB", "OBB (Objedinena Balgarska Banka)"),
      bank("RAIFFEISEN_BG", "Raiffeisen Bank Bulgaria"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "HR", countryName: "Croatia", currency: "EUR",
    methods: [
      SEPA,
      bank("ZABA", "Zagrebačka banka (Unicredit)"),
      bank("PBZ", "Privredna banka Zagreb (PBZ)"),
      bank("OTP_HR", "OTP banka Croatia"),
      bank("ERSTE_HR", "Erste & Steiermärkische Bank Croatia"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "SK", countryName: "Slovakia", currency: "EUR",
    methods: [
      SEPA,
      bank("SLSP", "Slovenská sporiteľňa (Erste)"),
      bank("VUB", "VÚB Banka"),
      bank("TATRABANKA", "Tatra banka"),
      bank("OTP_SK", "OTP Banka Slovensko"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "RS", countryName: "Serbia", currency: "RSD",
    methods: [
      bank("BANCA_INTESA_RS", "Banca Intesa Serbia"),
      bank("KOMERCIJALNA", "Komercijalna Banka"),
      bank("UNICREDIT_RS", "UniCredit Bank Serbia"),
      bank("OTP_RS", "OTP banka Serbia"),
      wallet("DINA_CARD", "Dina Card"),
      SWIFT, WISE,
    ],
  },

  // ── AMERICAS ─────────────────────────────────────────────────────────────────

  {
    country: "US", countryName: "United States", currency: "USD",
    methods: [
      wallet("ZELLE", "Zelle", "Email or Phone", "email@example.com or +1..."),
      wallet("CASHAPP", "Cash App", "Cashtag or Phone", "$cashtag"),
      wallet("VENMO", "Venmo", "Venmo Username / Phone"),
      PAYPAL,
      bank("CHASE", "Chase Bank"),
      bank("BANK_OF_AMERICA", "Bank of America"),
      bank("WELLS_FARGO", "Wells Fargo"),
      bank("CITIBANK_US", "Citibank USA"),
      bank("US_BANK", "U.S. Bank"),
      bank("PNC", "PNC Bank"),
      bank("CAPITAL_ONE", "Capital One"),
      bank("ALLY_BANK", "Ally Bank"),
      WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "CA", countryName: "Canada", currency: "CAD",
    methods: [
      wallet("INTERAC", "Interac e-Transfer", "Email or Phone"),
      bank("RBC", "Royal Bank of Canada (RBC)"),
      bank("TD_CANADA", "TD Canada Trust"),
      bank("SCOTIABANK", "Scotiabank"),
      bank("BMO", "Bank of Montreal (BMO)"),
      bank("CIBC", "CIBC"),
      bank("TANGERINE", "Tangerine Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "BR", countryName: "Brazil", currency: "BRL",
    methods: [
      wallet("PIX", "Pix", "Pix Key (CPF/Phone/Email)", "CPF, phone, or email"),
      bank("BRADESCO", "Bradesco"),
      bank("ITAU", "Itaú Unibanco"),
      bank("SANTANDER_BR", "Santander Brasil"),
      bank("BB_BR", "Banco do Brasil"),
      bank("CAIXA_BR", "Caixa Econômica Federal"),
      bank("NUBANK_BR", "Nubank"),
      bank("INTER_BR", "Banco Inter"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MX", countryName: "Mexico", currency: "MXN",
    methods: [
      wallet("SPEI", "SPEI Transfer", "CLABE (18 digits)", "18-digit CLABE"),
      bank("BANAMEX", "Banamex (Citibanamex)"),
      bank("BBVA_MX", "BBVA México"),
      bank("BANORTE", "Banorte"),
      bank("HSBC_MX", "HSBC México"),
      bank("SANTANDER_MX", "Santander México"),
      bank("SCOTIABANK_MX", "Scotiabank México"),
      wallet("MERCADOPAGO_MX", "MercadoPago México"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "AR", countryName: "Argentina", currency: "ARS",
    methods: [
      wallet("MERCADOPAGO_AR", "MercadoPago Argentina"),
      bank("BANCO_NACION", "Banco de la Nación Argentina"),
      bank("SANTANDER_AR", "Santander Argentina"),
      bank("BBVA_AR", "BBVA Argentina"),
      bank("GALICIA", "Banco Galicia"),
      bank("MACRO", "Banco Macro"),
      bank("BRUBANK", "Brubank"),
      SWIFT, WISE,
    ],
  },

  {
    country: "CO", countryName: "Colombia", currency: "COP",
    methods: [
      wallet("NEQUI", "Nequi", "Phone Number", "3XX XXX XXXX"),
      wallet("DAVIPLATA", "Daviplata", "Phone Number"),
      bank("BANCOLOMBIA", "Bancolombia"),
      bank("DAVIVIENDA", "Davivienda"),
      bank("BBVA_CO", "BBVA Colombia"),
      bank("SCOTIABANK_CO", "Scotiabank Colombia"),
      bank("ITAU_CO", "Itaú Colombia"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "PE", countryName: "Peru", currency: "PEN",
    methods: [
      wallet("YAPE", "Yape", "Phone Number", "9XX XXX XXX"),
      wallet("PLIN", "Plin"),
      bank("BCP_PE", "BCP (Banco de Crédito del Perú)"),
      bank("INTERBANK_PE", "Interbank Peru"),
      bank("BBVA_PE", "BBVA Perú"),
      bank("SCOTIABANK_PE", "Scotiabank Perú"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "CL", countryName: "Chile", currency: "CLP",
    methods: [
      wallet("MACH", "MACH", "RUT / Phone"),
      wallet("MERCADOPAGO_CL", "MercadoPago Chile"),
      bank("BANCO_ESTADO", "Banco Estado Chile"),
      bank("SANTANDER_CL", "Santander Chile"),
      bank("BANCHILE", "Banchile (Banco de Chile)"),
      bank("BBVA_CL", "BBVA Chile"),
      bank("ITAU_CL", "Itaú Chile"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "VE", countryName: "Venezuela", currency: "VES",
    methods: [
      wallet("PAGO_MOVIL", "Pago Móvil", "Phone + Bank Code", "Phone number"),
      bank("BANESCO", "Banesco"),
      bank("MERCANTIL_VE", "Banco Mercantil Venezuela"),
      bank("BOD", "BOD (Banco Occidental de Descuento)"),
      bank("BANCO_DE_VENEZUELA", "Banco de Venezuela"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "EC", countryName: "Ecuador", currency: "USD",
    methods: [
      mobile("DE_UNO", "DeUno (Movistar)", "09XX XXX XXX"),
      wallet("PAYPHONE_EC", "PayPhone"),
      bank("PICHINCHA", "Banco Pichincha"),
      bank("PRODUBANCO", "Produbanco"),
      bank("GUAYAQUIL", "Banco de Guayaquil"),
      bank("BOLIVARIANO", "Banco Bolivariano"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GT", countryName: "Guatemala", currency: "GTQ",
    methods: [
      mobile("TIGO_MONEY_GT", "Tigo Money Guatemala"),
      bank("BANRURAL_GT", "Banrural Guatemala"),
      bank("INDUSTRIAL_GT", "Banco Industrial Guatemala"),
      bank("BAM_GT", "BAM Guatemala"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CR", countryName: "Costa Rica", currency: "CRC",
    methods: [
      wallet("SINPE_MOVIL", "SINPE Móvil", "Phone Number", "8XXX XXXX"),
      bank("BCR_CR", "Banco de Costa Rica (BCR)"),
      bank("BNCR", "Banco Nacional de Costa Rica"),
      bank("BAC_CR", "BAC Credomatic Costa Rica"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "DO", countryName: "Dominican Republic", currency: "DOP",
    methods: [
      wallet("TPAGO", "tPago"),
      wallet("PAGAMASTARD", "PagaMasTarde"),
      bank("BANRESERVAS", "Banco de Reservas (Banreservas)"),
      bank("BHD_LEON", "Banco BHD León"),
      bank("POPULAR_DO", "Banco Popular Dominicano"),
      WESTERN_UNION, PAYPAL, SWIFT,
    ],
  },

  // ── OCEANIA ──────────────────────────────────────────────────────────────────

  {
    country: "AU", countryName: "Australia", currency: "AUD",
    methods: [
      wallet("PAYID", "PayID (Australia)", "Phone / Email / ABN"),
      wallet("OSKO", "Osko / NPP"),
      bank("CBA", "Commonwealth Bank (CommBank)"),
      bank("NAB", "NAB (National Australia Bank)"),
      bank("ANZ", "ANZ Bank"),
      bank("WESTPAC", "Westpac"),
      bank("MACQUARIE", "Macquarie Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "NZ", countryName: "New Zealand", currency: "NZD",
    methods: [
      bank("ANZ_NZ", "ANZ New Zealand"),
      bank("ASB", "ASB Bank"),
      bank("BNZ", "BNZ (Bank of New Zealand)"),
      bank("WESTPAC_NZ", "Westpac New Zealand"),
      bank("KIWIBANK", "Kiwibank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  // ── ADDITIONAL COUNTRIES ────────────────────────────────────────────────────

  {
    country: "AF", countryName: "Afghanistan", currency: "AFN",
    methods: [
      mobile("MTNCASH_AF", "MTN Cash Afghanistan"),
      mobile("ROSHAN_PAISA", "Roshan Paisa"),
      mobile("SALAAM_MOBILE", "Salaam Mobile Money"),
      bank("AIB_AF", "Afghan International Bank (AIB)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "AM", countryName: "Armenia", currency: "AMD",
    methods: [
      wallet("TELCELL", "Telcell Wallet"),
      wallet("IDRAM", "IDram"),
      bank("AMERIABANK", "Ameriabank"),
      bank("ACBA_BANK", "ACBA Bank"),
      bank("ARDSHINBANK", "Ardshinbank"),
      SWIFT, WISE,
    ],
  },

  {
    country: "AZ", countryName: "Azerbaijan", currency: "AZN",
    methods: [
      wallet("MPAY_AZ", "mPay"),
      bank("KAPITAL_AZ", "Kapital Bank Azerbaijan"),
      bank("ABB_AZ", "ABB (Azerbaijan Business Bank)"),
      bank("XALQ_BANK", "Xalq Bank"),
      SWIFT,
    ],
  },

  {
    country: "GE", countryName: "Georgia", currency: "GEL",
    methods: [
      wallet("TBC_PAY", "TBC Pay"),
      wallet("BOG_PAY", "BOG Pay"),
      bank("TBC_GE", "TBC Bank Georgia"),
      bank("BOG", "Bank of Georgia"),
      bank("LIBERTBANK", "Liberty Bank Georgia"),
      SWIFT, WISE,
    ],
  },

  {
    country: "BY", countryName: "Belarus", currency: "BYN",
    methods: [
      bank("BELARUSBANK", "ASB Belarusbank"),
      bank("PRIORBANK", "Priorbank (Raiffeisen Group)"),
      bank("BPS_SBERBANK", "BPS-Sberbank"),
      wallet("BEPAID", "bePaid"),
      wallet("WEBPAY_BY", "WebPay"),
      SWIFT,
    ],
  },

  {
    country: "MD", countryName: "Moldova", currency: "MDL",
    methods: [
      bank("MAIB", "MAIB (Moldova Agroindbank)"),
      bank("MOBIASBANCA", "Mobiasbancă"),
      bank("VICTORIABANK", "Victoriabank"),
      wallet("MPAY_MD", "MPay"),
      SWIFT, WISE,
    ],
  },

  {
    country: "MN", countryName: "Mongolia", currency: "MNT",
    methods: [
      wallet("SOCIALPAY_MN", "SocialPay"),
      wallet("MONPAY", "MonPay"),
      bank("KHAN_BANK", "Khan Bank"),
      bank("GOLOMT_BANK", "Golomt Bank"),
      bank("TDB_MN", "Trade and Development Bank (TDB)"),
      SWIFT,
    ],
  },

  {
    country: "KG", countryName: "Kyrgyzstan", currency: "KGS",
    methods: [
      wallet("MBANK_KG", "MBank Kyrgyzstan"),
      wallet("OPTIMA_PAY", "Optima Pay"),
      bank("OPTIMA_BANK", "Optima Bank"),
      bank("RSK_BANK", "RSK Bank"),
      SWIFT,
    ],
  },

  {
    country: "TJ", countryName: "Tajikistan", currency: "TJS",
    methods: [
      mobile("ALIF_MOBI", "Alif Mobi"),
      wallet("VASL", "Vasl"),
      bank("ALIF_BANK", "Alif Bank"),
      bank("ESKHATA", "Eskhata Bank"),
      SWIFT,
    ],
  },

  {
    country: "TM", countryName: "Turkmenistan", currency: "TMT",
    methods: [
      bank("TFEB", "Turkmen Foreign Exchange Bank"),
      bank("RYSGAL", "Rysgal Bank"),
      SWIFT,
    ],
  },

  {
    country: "LA", countryName: "Laos", currency: "LAK",
    methods: [
      mobile("UNITEL_MONEY", "Unitel Money Laos"),
      mobile("BCEL_ONE", "BCEL One"),
      bank("BCEL", "Banque pour le Commerce Extérieur Lao (BCEL)"),
      bank("LDB_LA", "Lao Development Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BT", countryName: "Bhutan", currency: "BTN",
    methods: [
      mobile("MPAY_BT", "mPay Bhutan"),
      wallet("GPAY_BT", "G-Pay Bhutan"),
      bank("BOB_BT", "Bank of Bhutan"),
      bank("BNBL", "Bhutan National Bank"),
      SWIFT,
    ],
  },

  {
    country: "MV", countryName: "Maldives", currency: "MVR",
    methods: [
      wallet("FAISA_PAY", "Faisa Pay"),
      bank("BOC_MV", "Bank of Maldives (BML)"),
      bank("MIB_MV", "Maldives Islamic Bank"),
      SWIFT,
    ],
  },

  {
    country: "PS", countryName: "Palestine", currency: "ILS",
    methods: [
      bank("BANK_OF_PALESTINE", "Bank of Palestine"),
      bank("CAIRO_AMMAN_PS", "Cairo Amman Bank Palestine"),
      bank("ARAB_BANK_PS", "Arab Bank Palestine"),
      mobile("JAWWAL_PAY", "Jawwal Pay"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SY", countryName: "Syria", currency: "SYP",
    methods: [
      bank("CBS_SY", "Commercial Bank of Syria"),
      bank("BEMO_SY", "BEMO Saudi Fransi Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LY", countryName: "Libya", currency: "LYD",
    methods: [
      bank("WAHDA_BANK", "Wahda Bank Libya"),
      bank("SAHARA_BANK", "Sahara Bank Libya"),
      bank("JUMHOURIA", "Jumhouria Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SS", countryName: "South Sudan", currency: "SSP",
    methods: [
      mobile("MTN_MOMO_SS", "MTN Mobile Money South Sudan"),
      mobile("VIVACELL_SS", "Vivacell Money"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ER", countryName: "Eritrea", currency: "ERN",
    methods: [
      bank("COMMERCIAL_BANK_ER", "Commercial Bank of Eritrea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "DJ", countryName: "Djibouti", currency: "DJF",
    methods: [
      mobile("DJIBOUTI_TELECOM_MONEY", "Djibouti Telecom Money"),
      bank("BCIMR", "BCIMR Djibouti"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MW", countryName: "Malawi", currency: "MWK",
    methods: [
      mobile("AIRTEL_MW", "Airtel Money Malawi"),
      mobile("TNM_MPAMBA", "TNM Mpamba"),
      bank("NBM_MW", "National Bank of Malawi"),
      bank("STANDARD_MW", "Standard Bank Malawi"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BI", countryName: "Burundi", currency: "BIF",
    methods: [
      mobile("LUMICASH", "Lumicash (Econet)"),
      mobile("AIRTEL_BI", "Airtel Money Burundi"),
      bank("BANCOBU", "Bancobu Burundi"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CF", countryName: "Central African Republic", currency: "XAF",
    methods: [
      mobile("ORANGE_MONEY_CF", "Orange Money CAR"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "TD", countryName: "Chad", currency: "XAF",
    methods: [
      mobile("AIRTEL_TD", "Airtel Money Chad"),
      mobile("MTN_MOMO_TD", "MTN Mobile Money Chad"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "NE", countryName: "Niger", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_NE", "Orange Money Niger"),
      mobile("AIRTEL_NE", "Airtel Money Niger"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ML", countryName: "Mali", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_ML", "Orange Money Mali"),
      mobile("MOOV_ML", "Moov Money Mali"),
      bank("ECOBANK_ML", "Ecobank Mali"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BF", countryName: "Burkina Faso", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_BF", "Orange Money Burkina Faso"),
      mobile("CORIS_MONEY", "Coris Money"),
      bank("ECOBANK_BF", "Ecobank Burkina Faso"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GN", countryName: "Guinea", currency: "GNF",
    methods: [
      mobile("ORANGE_MONEY_GN", "Orange Money Guinea"),
      mobile("MTN_MOMO_GN", "MTN Mobile Money Guinea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SL", countryName: "Sierra Leone", currency: "SLL",
    methods: [
      mobile("ORANGE_MONEY_SL", "Orange Money Sierra Leone"),
      mobile("AFRIMONEY_SL", "Afrimoney"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LR", countryName: "Liberia", currency: "LRD",
    methods: [
      mobile("MTN_MOMO_LR", "MTN Mobile Money Liberia"),
      mobile("ORANGE_MONEY_LR", "Orange Money Liberia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GM", countryName: "Gambia", currency: "GMD",
    methods: [
      mobile("AFRIMONEY_GM", "Afrimoney Gambia"),
      mobile("QMONEY", "QMoney"),
      bank("GTB_GM", "Guaranty Trust Bank Gambia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GW", countryName: "Guinea-Bissau", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_GW", "Orange Money Guinea-Bissau"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "TG", countryName: "Togo", currency: "XOF",
    methods: [
      mobile("FLOOZ_TG", "Flooz (Moov) Togo"),
      mobile("T_MONEY", "T-Money (Togocel)"),
      bank("ECOBANK_TG", "Ecobank Togo"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BJ", countryName: "Benin", currency: "XOF",
    methods: [
      mobile("MTN_MOMO_BJ", "MTN Mobile Money Benin"),
      mobile("MOOV_BJ", "Moov Money Benin"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "NE", countryName: "Niger (Republic)", currency: "XOF",
    methods: [
      mobile("AIRTEL_NER", "Airtel Money Niger"),
      mobile("ORANGE_MONEY_NER", "Orange Money Niger"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CG", countryName: "Republic of Congo", currency: "XAF",
    methods: [
      mobile("MTN_MOMO_CG", "MTN Mobile Money Congo"),
      mobile("AIRTEL_CG", "Airtel Money Congo"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CD", countryName: "DR Congo", currency: "CDF",
    methods: [
      mobile("MPESA_CD", "M-Pesa DRC (Vodacom)"),
      mobile("ORANGE_MONEY_CD", "Orange Money DRC"),
      mobile("AIRTEL_CD", "Airtel Money DRC"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GA", countryName: "Gabon", currency: "XAF",
    methods: [
      mobile("AIRTEL_GA", "Airtel Money Gabon"),
      mobile("MOOV_GA", "Moov Money Gabon"),
      bank("BGFI_BANK", "BGFI Bank Gabon"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GQ", countryName: "Equatorial Guinea", currency: "XAF",
    methods: [
      bank("CCEI_GQ", "CCEI Bank Equatorial Guinea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ST", countryName: "São Tomé and Príncipe", currency: "STN",
    methods: [
      bank("BISTP", "BISTP (Banco Internacional de São Tomé e Príncipe)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "KM", countryName: "Comoros", currency: "KMF",
    methods: [
      bank("BDC_KM", "Banque de Développement des Comores"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CV", countryName: "Cape Verde", currency: "CVE",
    methods: [
      mobile("MPESA_CV", "M-Pesa Cape Verde"),
      bank("BCA_CV", "BCA (Banco Comercial do Atlântico)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "PY", countryName: "Paraguay", currency: "PYG",
    methods: [
      mobile("TIGO_MONEY_PY", "Tigo Money Paraguay"),
      wallet("BILLETERA_PY", "Billetera Personal"),
      bank("BNF_PY", "BNF (Banco Nacional de Fomento)"),
      bank("CONTINENTAL_PY", "Banco Continental Paraguay"),
      bank("ITAU_PY", "Itaú Paraguay"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BO", countryName: "Bolivia", currency: "BOB",
    methods: [
      wallet("TIGO_MONEY_BO", "Tigo Money Bolivia"),
      wallet("SIMPLE_PAY_BO", "Simple Pay"),
      bank("BNB_BO", "BNB (Banco Nacional de Bolivia)"),
      bank("BISA_BO", "Banco BISA"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "UY", countryName: "Uruguay", currency: "UYU",
    methods: [
      wallet("MERCADOPAGO_UY", "MercadoPago Uruguay"),
      wallet("OCA_UY", "OCA Blue"),
      bank("BROU", "BROU (Banco de la República Oriental)"),
      bank("SCOTIABANK_UY", "Scotiabank Uruguay"),
      bank("SANTANDER_UY", "Santander Uruguay"),
      PAYPAL, SWIFT,
    ],
  },

  {
    country: "HN", countryName: "Honduras", currency: "HNL",
    methods: [
      mobile("TIGO_MONEY_HN", "Tigo Money Honduras"),
      bank("BANCATLAN", "Bancatlán"),
      bank("BANHCAFE", "Banhcafé"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SV", countryName: "El Salvador", currency: "USD",
    methods: [
      wallet("CHIVO", "Chivo Wallet (Bitcoin/USD)"),
      mobile("TIGO_MONEY_SV", "Tigo Money El Salvador"),
      bank("AGRICOLA_SV", "Banco Agrícola El Salvador"),
      bank("DAVIVIENDA_SV", "Davivienda El Salvador"),
      WESTERN_UNION, PAYPAL, SWIFT,
    ],
  },

  {
    country: "NI", countryName: "Nicaragua", currency: "NIO",
    methods: [
      mobile("TIGO_MONEY_NI", "Tigo Money Nicaragua"),
      bank("BDF_NI", "BDF Nicaragua"),
      bank("BANPRO", "Banpro"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "PA", countryName: "Panama", currency: "PAB",
    methods: [
      bank("BANISTMO", "Banistmo"),
      bank("GLOBAL_BANK_PA", "Global Bank Panama"),
      bank("BANCO_GENERAL", "Banco General"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CU", countryName: "Cuba", currency: "CUP",
    methods: [
      wallet("TRANSFERMOVIL", "TransferMóvil"),
      wallet("ENZONA", "EnZona"),
      bank("BPA_CU", "Banco Popular de Ahorro (BPA)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "HT", countryName: "Haiti", currency: "HTG",
    methods: [
      mobile("MONCASH", "MonCash (Digicel)"),
      mobile("LAJAN_CASH", "Lajan Cash (Natcom)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "JM", countryName: "Jamaica", currency: "JMD",
    methods: [
      wallet("LYNK_JM", "Lynk"),
      bank("NCB_JM", "National Commercial Bank (NCB) Jamaica"),
      bank("SCOTIABANK_JM", "Scotiabank Jamaica"),
      bank("JNBS", "Jamaica National (JNBS)"),
      WESTERN_UNION, PAYPAL, SWIFT,
    ],
  },

  {
    country: "TT", countryName: "Trinidad and Tobago", currency: "TTD",
    methods: [
      bank("RBC_TT", "RBC Royal Bank Trinidad"),
      bank("FCB_TT", "First Citizens Bank TT"),
      bank("SCOTIABANK_TT", "Scotiabank Trinidad"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "IL", countryName: "Israel", currency: "ILS",
    methods: [
      wallet("BIT_IL", "bit (Bank Hapoalim)", "Phone Number"),
      wallet("PAYBOX_IL", "PayBox"),
      bank("HAPOALIM", "Bank Hapoalim"),
      bank("LEUMI", "Bank Leumi"),
      bank("DISCOUNT_IL", "Bank Discount Israel"),
      bank("MIZRAHI_TEFAHOT", "Mizrahi-Tefahot Bank"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "CY", countryName: "Cyprus", currency: "EUR",
    methods: [
      SEPA,
      bank("BANK_OF_CYPRUS", "Bank of Cyprus"),
      bank("HELLENIC_CY", "Hellenic Bank Cyprus"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MT", countryName: "Malta", currency: "EUR",
    methods: [
      SEPA,
      bank("BOV", "Bank of Valletta (BOV)"),
      bank("HSBC_MT", "HSBC Bank Malta"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "IS", countryName: "Iceland", currency: "ISK",
    methods: [
      bank("LANDSBANKINN", "Landsbankinn"),
      bank("ISLANDSBANKI", "Íslandsbanki"),
      bank("ARION", "Arion Bank"),
      WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "LI", countryName: "Liechtenstein", currency: "CHF",
    methods: [
      bank("LLB", "Liechtensteinische Landesbank (LLB)"),
      bank("VP_BANK", "VP Bank"),
      WISE, SWIFT, SEPA,
    ],
  },

  {
    country: "LU", countryName: "Luxembourg", currency: "EUR",
    methods: [
      SEPA,
      bank("BCEE", "BCEE (Banque et Caisse d'Épargne de l'État)"),
      bank("BGL_BNP", "BGL BNP Paribas Luxembourg"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "LV", countryName: "Latvia", currency: "EUR",
    methods: [
      SEPA,
      bank("SWEDBANK_LV", "Swedbank Latvia"),
      bank("SEB_LV", "SEB Bank Latvia"),
      bank("LUMINOR_LV", "Luminor Bank Latvia"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "LT", countryName: "Lithuania", currency: "EUR",
    methods: [
      SEPA,
      bank("SWEDBANK_LT", "Swedbank Lithuania"),
      bank("SEB_LT", "SEB Bank Lithuania"),
      bank("LUMINOR_LT", "Luminor Bank Lithuania"),
      wallet("PAYSERA", "Paysera"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "EE", countryName: "Estonia", currency: "EUR",
    methods: [
      SEPA,
      bank("SWEDBANK_EE", "Swedbank Estonia"),
      bank("SEB_EE", "SEB Bank Estonia"),
      bank("LHV", "LHV Bank"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "SI", countryName: "Slovenia", currency: "EUR",
    methods: [
      SEPA,
      bank("NLB", "NLB (Nova Ljubljanska Banka)"),
      bank("ABANKA", "Abanka"),
      bank("SKB", "SKB Banka"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MK", countryName: "North Macedonia", currency: "MKD",
    methods: [
      bank("STOPANSKA", "Stopanska Banka"),
      bank("NLB_MK", "NLB Banka Macedonia"),
      bank("KOMERCIJALNA_MK", "Komercijalna Banka"),
      SWIFT, WISE,
    ],
  },

  {
    country: "AL", countryName: "Albania", currency: "ALL",
    methods: [
      bank("CREDINS", "Credins Bank"),
      bank("RAIFFEISEN_AL", "Raiffeisen Bank Albania"),
      bank("BKT_AL", "BKT (Banka Kombetare Tregtare)"),
      wallet("PAY_SMART", "PaySmart"),
      SWIFT, WISE,
    ],
  },

  {
    country: "BA", countryName: "Bosnia and Herzegovina", currency: "BAM",
    methods: [
      bank("RAIFFEISEN_BA", "Raiffeisen Bank BiH"),
      bank("UNICREDIT_BA", "UniCredit Bank BiH"),
      bank("INTESA_BA", "Intesa Sanpaolo Bank BiH"),
      SWIFT, WISE, SEPA,
    ],
  },

  {
    country: "ME", countryName: "Montenegro", currency: "EUR",
    methods: [
      SEPA,
      bank("CRNOGORSKA", "Crnogorska Komercijalna Banka"),
      bank("NLB_ME", "NLB Banka Montenegro"),
      SWIFT, WISE,
    ],
  },

  {
    country: "XK", countryName: "Kosovo", currency: "EUR",
    methods: [
      SEPA,
      bank("PROCREDIT_KS", "ProCredit Bank Kosovo"),
      bank("RAIFFEISEN_KS", "Raiffeisen Bank Kosovo"),
      SWIFT, WISE,
    ],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

const _byCountry = new Map<string, CountryMethods>(
  GLOBAL_PAYMENT_METHODS.map(c => [c.country, c])
);

/** Get methods for a given ISO-2 country code. Falls back to SWIFT + WU. */
export function getMethodsForCountry(countryCode: string): PaymentMethodDef[] {
  const entry = _byCountry.get(countryCode?.toUpperCase());
  if (entry) return entry.methods;
  // Generic fallback for unlisted countries
  return [BANK_TRANSFER, SWIFT, WESTERN_UNION, WISE, PAYPAL, USDT_BEP20];
}

/** Returns all unique method IDs across all countries (for migration checks). */
export function getAllMethodIds(): string[] {
  const ids = new Set<string>();
  for (const c of GLOBAL_PAYMENT_METHODS) {
    for (const m of c.methods) ids.add(m.id);
  }
  return [...ids];
}

/** Lookup a single method def by id. */
export function getMethodById(id: string): PaymentMethodDef | undefined {
  for (const c of GLOBAL_PAYMENT_METHODS) {
    const m = c.methods.find(m => m.id === id);
    if (m) return m;
  }
  return undefined;
}

/** List of all supported country codes. */
export const SUPPORTED_COUNTRIES = GLOBAL_PAYMENT_METHODS.map(c => ({
  code: c.country,
  name: c.countryName,
  currency: c.currency,
}));
