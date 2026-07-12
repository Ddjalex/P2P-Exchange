/**
 * Global payment methods by country — Binance P2P style.
 * 162 countries, 1100+ methods. Each entry has:
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
      mobile("AMOLE", "Amole (Dashen Bank)"),
      mobile("KACHA", "Kacha Mobile Money"),
      bank("NIB_ET", "Nib International Bank"),
      bank("ADDIS_BANK", "Addis International Bank"),
      bank("LION_ET", "Lion International Bank"),
      bank("BUNNA", "Bunna International Bank"),
      bank("ABAY", "Abay Bank"),
      bank("OIB_ET", "Oromia International Bank"),
      bank("TSEHAY", "Tsehay Bank"),
      bank("GOH_BETOCH", "Goh Betoch Bank"),
      bank("SIDAMA_ET", "Sidama Bank"),
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
      bank("UNION_NG", "Union Bank of Nigeria"),
      bank("HERITAGE_NG", "Heritage Bank Nigeria"),
      bank("JAIZ", "Jaiz Bank"),
      bank("TAJ_NG", "Taj Bank Nigeria"),
      bank("PROVIDUS", "Providus Bank"),
      bank("LOTUS_NG", "Lotus Bank Nigeria"),
      bank("SIGNATURE_NG", "Signature Bank Nigeria"),
      mobile("OPAY", "OPay", "080X XXX XXXX"),
      mobile("PALMPAY", "PalmPay", "080X XXX XXXX"),
      wallet("MONIEPOINT", "Moniepoint", "Account Number"),
      wallet("KUDA", "Kuda Bank", "Account Number"),
      wallet("CARBON_NG", "Carbon (Paylater)", "Phone / Account"),
      wallet("PIGGYVEST", "PiggyVest"),
      wallet("CHIPPER_NG", "Chipper Cash Nigeria"),
      wallet("EYOWO", "Eyowo", "Phone Number"),
      wallet("VFD_MICRO", "VFD Microfinance Bank"),
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
      bank("SCB_KE", "Standard Chartered Kenya"),
      bank("IM_BANK_KE", "I&M Bank Kenya"),
      bank("BOA_KE", "Bank of Africa Kenya"),
      bank("SIDIAN", "Sidian Bank"),
      bank("ECOBANK_KE", "Ecobank Kenya"),
      bank("NBK", "National Bank of Kenya"),
      bank("PRIME_KE", "Prime Bank Kenya"),
      mobile("AIRTEL_KE", "Airtel Money Kenya", "073X XXX XXX"),
      mobile("TKASH", "T-Kash (Telkom Kenya)", "077X XXX XXX"),
      wallet("PESALINK", "PesaLink"),
      wallet("FULIZA", "Fuliza M-Pesa"),
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
      bank("REPUBLIC_GH", "Republic Bank Ghana"),
      bank("FIDELITY_GH", "Fidelity Bank Ghana"),
      bank("CONSOLIDATED_GH", "Consolidated Bank Ghana"),
      bank("PRUDENTIAL_GH", "Prudential Bank Ghana"),
      bank("UBA_GH", "UBA Ghana"),
      wallet("ZEEPAY", "Zeepay"),
      wallet("HUBTEL_GH", "Hubtel"),
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
      bank("GRINDROD", "Grindrod Bank"),
      bank("TYME_BANK", "TymeBank"),
      bank("DISCOVERY_BANK", "Discovery Bank"),
      bank("ACCESS_ZA", "Access Bank South Africa"),
      wallet("FNB_EWALLET", "FNB eWallet"),
      wallet("SNAPSCAN", "SnapScan"),
      wallet("ZAPPER", "Zapper"),
      wallet("OZOW", "Ozow Instant EFT"),
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
      bank("AAIB_EG", "Arab African International Bank"),
      bank("EMIRATES_NBD_EG", "Emirates NBD Egypt"),
      bank("ABU_DHABI_EG", "Abu Dhabi Islamic Bank Egypt"),
      mobile("VODAFONE_CASH_EG", "Vodafone Cash Egypt", "010X XXX XXXX"),
      mobile("ORANGE_MONEY_EG", "Orange Money Egypt"),
      mobile("ETISALAT_CASH", "Etisalat Cash (e-Finance)"),
      mobile("WE_PAY_EG", "WE Pay Egypt"),
      wallet("FAWRY", "Fawry"),
      wallet("MEEZA", "Meeza"),
      wallet("INSTAPAY_EG", "InstaPay Egypt"),
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
      mobile("AZAMPESA", "Azam Pesa"),
      mobile("SELCOM_TZ", "Selcom Tanzania"),
      bank("CRDB", "CRDB Bank Tanzania"),
      bank("NMB_TZ", "NMB Bank Tanzania"),
      bank("NBC_TZ", "NBC Bank Tanzania"),
      bank("STANBIC_TZ", "Stanbic Bank Tanzania"),
      bank("EQUITY_TZ", "Equity Bank Tanzania"),
      bank("ABSA_TZ", "Absa Bank Tanzania"),
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
      bank("DFCU", "DFCU Bank Uganda"),
      bank("HOUSING_UG", "Housing Finance Bank Uganda"),
      bank("POSTBANK_UG", "PostBank Uganda"),
      bank("UBA_UG", "UBA Uganda"),
      bank("ECOBANK_UG", "Ecobank Uganda"),
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
      bank("IM_BANK_RW", "I&M Bank Rwanda"),
      bank("COGEBANQUE", "Cogebanque Rwanda"),
      bank("BPR_RW", "BPR Bank Rwanda (formerly Banque Populaire)"),
      bank("URWEGO", "Urwego Bank Rwanda"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CI", countryName: "Côte d'Ivoire", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_CI", "Orange Money Côte d'Ivoire"),
      mobile("MTN_MOMO_CI", "MTN Mobile Money Côte d'Ivoire"),
      mobile("MOOV_MONEY_CI", "Moov Money"),
      mobile("WAVE_CI", "Wave Côte d'Ivoire"),
      bank("ECOBANK_CI", "Ecobank Côte d'Ivoire"),
      bank("SGBCI", "Société Générale Côte d'Ivoire"),
      bank("BICICI", "BICICI (BNP Paribas CI)"),
      bank("CORIS_CI", "Coris Bank International CI"),
      bank("NSIA_CI", "NSIA Banque CI"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CM", countryName: "Cameroon", currency: "XAF",
    methods: [
      mobile("ORANGE_MONEY_CM", "Orange Money Cameroon"),
      mobile("MTN_MOMO_CM", "MTN Mobile Money Cameroon"),
      mobile("EXPRESS_UNION", "Express Union Mobile"),
      bank("ECOBANK_CM", "Ecobank Cameroon"),
      bank("AFRILAND", "Afriland First Bank"),
      bank("SCB_CM", "SCB Cameroon"),
      bank("UBA_CM", "UBA Cameroon"),
      bank("CCA_BANK", "CCA Bank Cameroon"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SN", countryName: "Senegal", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_SN", "Orange Money Senegal"),
      mobile("FREE_MONEY", "Free Money Senegal"),
      mobile("WAVE_SN", "Wave Senegal"),
      mobile("EXPRESSO_MONEY", "Expresso Money Senegal"),
      bank("CBAO", "CBAO Group Senegal"),
      bank("ECOBANK_SN", "Ecobank Senegal"),
      bank("SGBS", "Société Générale Sénégal"),
      bank("BHS", "Banque de l'Habitat du Sénégal"),
      bank("BICIS_SN", "BICIS Senegal"),
      bank("CORIS_SN", "Coris Bank Senegal"),
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
      bank("BMCI", "BMCI (BNP Paribas Morocco)"),
      bank("SOCIETE_GENERALE_MA", "Société Générale Maroc"),
      bank("CFG_MA", "CFG Bank Morocco"),
      mobile("MAROC_TELECOM_MONEY", "Maroc Telecom Money"),
      mobile("ORANGE_MONEY_MA", "Orange Money Morocco"),
      wallet("CMI_MA", "CMI Payment Morocco"),
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
      bank("BNA_TN", "Banque Nationale Agricole (BNA)"),
      bank("AMEN_TN", "Amen Bank"),
      bank("BH_TN", "Banque de l'Habitat Tunisia"),
      bank("UBCI", "UBCI (BNP Paribas Tunisia)"),
      wallet("SOBFLOUS", "SobFlous"),
      wallet("D17_TN", "D17 Tunisia"),
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
      bank("BADR", "Banque de l'Agriculture et du Développement Rural (BADR)"),
      bank("AGB_DZ", "Algerian Gulf Bank (AGB)"),
      bank("NATIXIS_DZ", "Natixis Algérie"),
      wallet("DAHABIA", "Dahabia (CPA)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ZW", countryName: "Zimbabwe", currency: "ZWL",
    methods: [
      mobile("ECOCASH", "EcoCash", "07X XXX XXXX"),
      mobile("ONEMONEY", "OneMoney (NetOne)"),
      mobile("TELECASH", "TeleCash"),
      mobile("INNBUCKS", "InnBucks"),
      bank("CBZ", "CBZ Bank Zimbabwe"),
      bank("STANBIC_ZW", "Stanbic Bank Zimbabwe"),
      bank("ZB_BANK", "ZB Bank"),
      bank("BancABC_ZW", "BancABC Zimbabwe"),
      bank("STEWARD_ZW", "Steward Bank Zimbabwe"),
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
      bank("ABSA_ZM", "Absa Bank Zambia"),
      bank("INDO_ZM", "Indo Zambia Bank"),
      bank("ATLAS_MARA_ZM", "Atlas Mara Zambia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MZ", countryName: "Mozambique", currency: "MZN",
    methods: [
      mobile("MPESA_MZ", "M-Pesa Mozambique (Vodacom)"),
      mobile("EMOLA", "eMola (Movitel)"),
      mobile("MKESH", "mKesh (Mcel)"),
      bank("BIM", "BIM (Millennium BIM)"),
      bank("BCI_MZ", "BCI Mozambique"),
      bank("STANDARD_MZ", "Standard Bank Mozambique"),
      bank("BOM_MZ", "Banco Opportunidade Mozambique"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "AO", countryName: "Angola", currency: "AOA",
    methods: [
      wallet("MULTICAIXA", "Multicaixa Express"),
      mobile("UNITEL_MONEY", "Unitel Money Angola"),
      bank("BAI", "Banco Angolano de Investimentos (BAI)"),
      bank("BFA_AO", "BFA Angola"),
      bank("BIC_AO", "BIC Angola"),
      bank("ATLANTICO", "Banco Atlântico Angola"),
      bank("KEVE_AO", "Banco Keve Angola"),
      bank("SOL_AO", "Banco Sol Angola"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SD", countryName: "Sudan", currency: "SDG",
    methods: [
      bank("KHARTOUM_BANK", "Bank of Khartoum"),
      bank("OMDURMAN", "Omdurman National Bank"),
      bank("FAISAL_ISLAMIC_SD", "Faisal Islamic Bank Sudan"),
      bank("AGRICULTURAL_SD", "Agricultural Bank of Sudan"),
      mobile("MTN_MOMO_SD", "MTN Mobile Money Sudan"),
      mobile("SUDANI_MONEY", "Sudani Money"),
      wallet("BANKAK", "Bankak Sudan"),
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
      mobile("AMTEL_SO", "Amtel Mobile Money"),
      bank("IBS_SO", "International Bank of Somalia"),
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
      bank("BFV_MG", "BFV-SG Madagascar"),
      bank("BOA_MG", "Bank of Africa Madagascar"),
      bank("ACCESS_MG", "AccèsBanque Madagascar"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "MU", countryName: "Mauritius", currency: "MUR",
    methods: [
      bank("MCB_MU", "MCB Group Mauritius"),
      bank("SBM_MU", "SBM Bank Mauritius"),
      bank("ABSA_MU", "Absa Bank Mauritius"),
      bank("AXA_MU", "AXA Bank Mauritius"),
      bank("MAUBANK", "MauBank Mauritius"),
      mobile("JUICE_MU", "Juice (MCB)"),
      wallet("EMTEL_MONEY", "Emtel Money"),
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
      bank("CBD_AE", "Commercial Bank of Dubai"),
      bank("NBF_AE", "National Bank of Fujairah"),
      bank("SIB_AE", "Sharjah Islamic Bank"),
      bank("ADIB", "Abu Dhabi Islamic Bank (ADIB)"),
      wallet("AANI", "Aani (Instant Payment)"),
      wallet("PAYIT", "PayIt (FAB)"),
      wallet("WIO_AE", "WIO Bank"),
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
      bank("ANB_SA", "Arab National Bank (ANB)"),
      bank("ALBILAD", "Bank Albilad"),
      bank("ALAWWAL", "Alawwal Bank (SABB)"),
      bank("GIB_SA", "Gulf International Bank Saudi Arabia"),
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
      bank("DENIZBANK", "Denizbank"),
      bank("TEB_TR", "Türk Ekonomi Bankası (TEB)"),
      bank("QNB_FINANSBANK", "QNB Finansbank"),
      bank("ING_TR", "ING Bank Turkey"),
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
      bank("NBF_IQ", "National Bank of Fallujah Iraq"),
      bank("GULF_COMMERCIAL_IQ", "Gulf Commercial Bank Iraq"),
      mobile("ZAIN_CASH", "ZainCash", "077X XXX XXXX"),
      mobile("ASIACELL_CASH", "AsiaCell Cash"),
      mobile("FASTPAY_IQ", "FastPay Iraq"),
      wallet("QI_CARD", "Qi Card Iraq"),
      wallet("NASSWALLET", "Nass Wallet Iraq"),
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
      bank("EGHTESAD_NOVIN", "Bank Eghtesad Novin"),
      bank("PARSIAN", "Parsian Bank"),
      bank("SAMAN", "Saman Bank"),
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
      bank("BURGAN_KW", "Burgan Bank Kuwait"),
      bank("WARBA", "Warba Bank Kuwait"),
      bank("GULF_BANK_KW", "Gulf Bank Kuwait"),
      wallet("KNET", "KNET"),
      wallet("MYFATOORAH_KW", "MyFatoorah Kuwait"),
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
      bank("AHLI_QA", "Ahlibank Qatar"),
      bank("QIIB", "Qatar International Islamic Bank (QIIB)"),
      wallet("OOREDOO_MONEY", "Ooredoo Money"),
      wallet("QPAY", "QPay Qatar"),
      SWIFT, WISE,
    ],
  },

  {
    country: "BH", countryName: "Bahrain", currency: "BHD",
    methods: [
      bank("NBB", "National Bank of Bahrain (NBB)"),
      bank("BBK", "Bank of Bahrain and Kuwait (BBK)"),
      bank("ITHMAAR", "Ithmaar Bank"),
      bank("AHLI_BH", "Ahli United Bank Bahrain"),
      bank("KHALEEJI_BH", "Khaleeji Commercial Bank"),
      wallet("BENEFIT", "BenefitPay"),
      wallet("MYFATOORAH_BH", "MyFatoorah Bahrain"),
      SWIFT, WISE,
    ],
  },

  {
    country: "JO", countryName: "Jordan", currency: "JOD",
    methods: [
      bank("ARAB_BANK", "Arab Bank Jordan"),
      bank("HOUSING_BANK", "Housing Bank for Trade & Finance"),
      bank("CAIRO_AMMAN", "Cairo Amman Bank"),
      bank("JORDAN_ISLAMIC", "Jordan Islamic Bank"),
      bank("CAPITAL_BANK_JO", "Capital Bank Jordan"),
      mobile("ZAIN_CASH_JO", "ZainCash Jordan"),
      mobile("ORANGE_MONEY_JO", "Orange Money Jordan"),
      mobile("UMNIAH_MONEY", "Umniah Money Jordan"),
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
      bank("FRANSABANK", "FransaBank"),
      bank("BANK_MED", "BankMed Lebanon"),
      mobile("OMMONEY", "OMT / Wish Money"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "YE", countryName: "Yemen", currency: "YER",
    methods: [
      mobile("FLOOSAK", "Floosak (MTN Yemen)"),
      mobile("M_FLOOS", "M Floos (Sabafon)"),
      mobile("JAIB_YE", "Jaib (Spacetel)"),
      bank("CAC_YE", "CAC Bank Yemen"),
      bank("TADHAMON_YE", "Tadhamon International Islamic Bank"),
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
      wallet("AMAZON_PAY_IN", "Amazon Pay India"),
      wallet("MOBIKWIK", "MobiKwik"),
      wallet("CRED_IN", "CRED Pay"),
      bank("SBI", "State Bank of India (SBI)", "Account number"),
      bank("HDFC", "HDFC Bank"),
      bank("ICICI", "ICICI Bank"),
      bank("AXIS", "Axis Bank"),
      bank("KOTAK", "Kotak Mahindra Bank"),
      bank("PNB", "Punjab National Bank (PNB)"),
      bank("BOI", "Bank of India"),
      bank("CANARA", "Canara Bank"),
      bank("UNION_IN", "Union Bank of India"),
      bank("BOB", "Bank of Baroda"),
      bank("IDBI", "IDBI Bank"),
      bank("YES_BANK", "Yes Bank"),
      bank("FEDERAL", "Federal Bank India"),
      bank("INDIAN_OVERSEAS", "Indian Overseas Bank"),
      bank("CENTRAL_IN", "Central Bank of India"),
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
      mobile("ZINDIGI", "Zindigi (Jazz)"),
      bank("HBL", "Habib Bank Limited (HBL)"),
      bank("UBL_PK", "United Bank Limited (UBL)"),
      bank("MCB_PK", "MCB Bank Pakistan"),
      bank("ABL", "Allied Bank Limited (ABL)"),
      bank("MEEZAN", "Meezan Bank"),
      bank("BANK_ALFALAH", "Bank Alfalah"),
      bank("FAYSAL", "Faysal Bank"),
      bank("ASKARI", "Askari Bank"),
      bank("NBP", "National Bank of Pakistan"),
      bank("BANK_ALHABIB", "Bank Al Habib"),
      bank("SUMMIT_PK", "Summit Bank Pakistan"),
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
      mobile("TAP_BD", "TAP Bangladesh"),
      bank("DUTCH_BANGLA", "Dutch-Bangla Bank"),
      bank("ISLAMI_BD", "Islami Bank Bangladesh"),
      bank("BRAC_BD", "BRAC Bank"),
      bank("CITY_BD", "City Bank Bangladesh"),
      bank("PREMIER_BD", "Premier Bank Bangladesh"),
      bank("MUTUAL_TRUST", "Mutual Trust Bank Bangladesh"),
      bank("PRIME_BD", "Prime Bank Bangladesh"),
      bank("SOUTHEAST_BD", "Southeast Bank Bangladesh"),
      bank("TRUST_BD", "Trust Bank Bangladesh"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LK", countryName: "Sri Lanka", currency: "LKR",
    methods: [
      mobile("DIALOG_EZCASH", "Dialog eZ Cash"),
      mobile("MOBICASH", "Mobicash (Mobitel)"),
      mobile("HUTCH_CASH", "Hutch Cash"),
      wallet("FRIMI", "FriMi (NDB Bank)"),
      wallet("GENIE_LK", "Genie (HNB)"),
      bank("BOC_LK", "Bank of Ceylon"),
      bank("PEOPLE_LK", "People's Bank Sri Lanka"),
      bank("COMMERCIAL_LK", "Commercial Bank of Ceylon"),
      bank("HNB", "Hatton National Bank (HNB)"),
      bank("SAMPATH", "Sampath Bank"),
      bank("NDB_LK", "NDB Bank Sri Lanka"),
      bank("SEYLAN", "Seylan Bank"),
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
      mobile("PRABHUPAY", "PrabhuPay"),
      bank("NABIL", "Nabil Bank Nepal"),
      bank("NIC_ASIA", "NIC Asia Bank"),
      bank("GLOBAL_IME", "Global IME Bank"),
      bank("EVEREST_NP", "Everest Bank"),
      bank("NEPAL_INVESTMENT", "Nepal Investment Bank"),
      bank("STANDARD_CHAR_NP", "Standard Chartered Nepal"),
      bank("SANIMA_NP", "Sanima Bank"),
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
      wallet("VIETTEL_MONEY", "Viettel Money (Viettel Pay)"),
      bank("VIETCOMBANK", "Vietcombank (VCB)"),
      bank("TECHCOMBANK", "Techcombank"),
      bank("BIDV", "BIDV"),
      bank("MB_VN", "MB Bank (Military Bank)"),
      bank("VPB", "VPBank"),
      bank("TPBANK", "TPBank"),
      bank("AGRIBANK", "Agribank"),
      bank("ACB_VN", "ACB Vietnam"),
      bank("VIETINBANK", "VietinBank"),
      bank("SHB_VN", "SHB Vietnam"),
      bank("OCB_VN", "OCB (Orient Commercial Bank)"),
      bank("SACOMBANK", "Sacombank"),
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
      bank("GSB_TH", "Government Savings Bank (GSB)"),
      bank("CIMB_TH", "CIMB Thai Bank"),
      bank("UOB_TH", "UOB Thailand"),
      bank("GHBANK", "GH Bank (Government Housing Bank)"),
      bank("BAAC_TH", "BAAC Thailand"),
      wallet("TRUEMONEY", "TrueMoney Wallet"),
      wallet("RABBIT_LINE", "Rabbit LINE Pay"),
      wallet("SHOPEE_TH", "ShopeePay Thailand"),
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
      bank("PERMATA", "Bank Permata"),
      bank("BTN_ID", "Bank Tabungan Negara (BTN)"),
      bank("BSI_ID", "Bank Syariah Indonesia (BSI)"),
      bank("MAYBANK_ID", "Maybank Indonesia"),
      bank("PANIN_ID", "Panin Bank"),
      wallet("OVO", "OVO"),
      wallet("DANA", "DANA"),
      wallet("GOPAY", "GoPay"),
      wallet("SHOPEEPAY", "ShopeePay"),
      wallet("JENIUS", "Jenius (BTPN)"),
      wallet("FLIP_ID", "Flip"),
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
      wallet("SHOPEEPAY_PH", "ShopeePay Philippines"),
      wallet("GOTYME", "GoTyme Bank"),
      bank("BDO", "Banco de Oro (BDO)"),
      bank("BPI", "Bank of the Philippine Islands (BPI)"),
      bank("METROBANK", "Metrobank"),
      bank("PNB_PH", "Philippine National Bank (PNB)"),
      bank("RCBC", "Rizal Commercial Banking Corp (RCBC)"),
      bank("EASTWEST", "EastWest Bank"),
      bank("SECURITY_BANK", "Security Bank Philippines"),
      bank("LANDBANK", "Landbank of the Philippines"),
      bank("DBP_PH", "Development Bank of the Philippines (DBP)"),
      bank("UNIONBANK_PH", "UnionBank of the Philippines"),
      bank("CIMB_PH", "CIMB Bank Philippines"),
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
      wallet("BIGPAY", "BigPay"),
      wallet("SETEL_MY", "Setel (Petronas)"),
      bank("MAYBANK", "Maybank"),
      bank("CIMB_MY", "CIMB Bank Malaysia"),
      bank("PUBLIC_BANK", "Public Bank Berhad"),
      bank("RHB", "RHB Bank"),
      bank("HONG_LEONG_MY", "Hong Leong Bank"),
      bank("AMBANK", "AmBank"),
      bank("AFFIN_MY", "Affin Bank"),
      bank("ALLIANCE_MY", "Alliance Bank Malaysia"),
      bank("BSN_MY", "BSN (Bank Simpanan Nasional)"),
      bank("BANK_ISLAM", "Bank Islam Malaysia"),
      bank("BANK_MUAMALAT", "Bank Muamalat Malaysia"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MM", countryName: "Myanmar", currency: "MMK",
    methods: [
      mobile("KBZPAY", "KBZPay", "09X XXX XXXX"),
      mobile("WAVEMONEY", "Wave Money"),
      mobile("MPITESAN", "M-Pitesan"),
      mobile("ONEPAY_MM", "OnePay Myanmar"),
      bank("KBZ_BANK", "KBZ Bank Myanmar"),
      bank("CB_BANK", "CB Bank Myanmar"),
      bank("AYA_BANK", "AYA Bank"),
      bank("MAB", "MAB (Myanma Apex Bank)"),
      bank("YOMA_BANK", "Yoma Bank Myanmar"),
      bank("AGD_BANK", "AGD Bank Myanmar"),
      bank("COOPERATIVE_MM", "Myanmar Cooperative Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "KH", countryName: "Cambodia", currency: "KHR",
    methods: [
      mobile("WING_KH", "Wing Money Cambodia"),
      mobile("TRUEMONEY_KH", "TrueMoney Cambodia"),
      mobile("BAKONG_KH", "Bakong (National Bank QR)"),
      bank("ACLEDA", "ACLEDA Bank"),
      bank("ABA_KH", "ABA Bank Cambodia"),
      bank("CANADIA", "Canadia Bank"),
      bank("CAMBODIA_POST", "Cambodia Post Bank"),
      bank("FTB_KH", "Foreign Trade Bank Cambodia"),
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
      bank("MAYBANK_SG", "Maybank Singapore"),
      bank("CIMB_SG", "CIMB Bank Singapore"),
      bank("TRUST_SG", "Trust Bank Singapore (Standard Chartered × FairPrice)"),
      wallet("GRABPAY_SG", "GrabPay Singapore"),
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
      bank("PSBC", "Postal Savings Bank of China (邮储银行)"),
      bank("MINSHENG", "China Minsheng Bank (民生银行)"),
      bank("PING_AN_BANK", "Ping An Bank (平安银行)"),
      bank("GUANGFA", "China Guangfa Bank (广发银行)"),
      SWIFT,
    ],
  },

  {
    country: "HK", countryName: "Hong Kong", currency: "HKD",
    methods: [
      wallet("FPS_HK", "FPS (Faster Payment System)", "Phone / Email / FPS ID"),
      wallet("PAYME", "PayMe by HSBC"),
      wallet("ALI_PAY_HK", "AlipayHK"),
      wallet("OCTOPUS_HK", "Octopus (O! ePay)"),
      bank("HSBC_HK", "HSBC Hong Kong"),
      bank("HANG_SENG", "Hang Seng Bank"),
      bank("BOC_HK", "Bank of China (Hong Kong)"),
      bank("BOCHK", "Bank of Communications HK"),
      bank("SCB_HK", "Standard Chartered HK"),
      bank("CITIBANK_HK", "Citibank Hong Kong"),
      bank("EAST_ASIA_HK", "Bank of East Asia (BEA)"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "TW", countryName: "Taiwan", currency: "TWD",
    methods: [
      wallet("LINEPAY_TW", "LINE Pay Taiwan"),
      wallet("JKOPAY", "JKOPay (街口支付)"),
      wallet("PXPAY_TW", "PX Pay (全聯)"),
      bank("FUBON", "Taipei Fubon Bank (富邦銀行)"),
      bank("CATHAY_TW", "Cathay United Bank (國泰世華)"),
      bank("ESUN", "E.SUN Bank (玉山銀行)"),
      bank("CTBC", "CTBC Bank (中信銀行)"),
      bank("BOT_TW", "Bank of Taiwan (台灣銀行)"),
      bank("MEGA_TW", "Mega International Commercial Bank (兆豐銀行)"),
      bank("FIRST_TW", "First Bank Taiwan (第一銀行)"),
      SWIFT, WISE,
    ],
  },

  {
    country: "KR", countryName: "South Korea", currency: "KRW",
    methods: [
      wallet("KAKAOPAY", "KakaoPay"),
      wallet("TOSSPAY", "Toss (토스)"),
      wallet("NAVERPAY", "Naver Pay (네이버페이)"),
      wallet("KAKAO_BANK", "Kakao Bank (카카오뱅크)"),
      wallet("KBANK", "K Bank (케이뱅크)"),
      bank("KOOKMIN", "KB Kookmin Bank (국민은행)"),
      bank("SHINHAN", "Shinhan Bank (신한은행)"),
      bank("WOORI", "Woori Bank (우리은행)"),
      bank("HANA_KR", "Hana Bank (하나은행)"),
      bank("NH_KR", "NH Nonghyup Bank (농협은행)"),
      bank("IBK_KR", "IBK Industrial Bank (기업은행)"),
      bank("BUSAN_KR", "BNK Busan Bank (부산은행)"),
      bank("DAEGU_KR", "DGB Daegu Bank (대구은행)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "JP", countryName: "Japan", currency: "JPY",
    methods: [
      wallet("PAYPAY", "PayPay"),
      wallet("LINE_PAY_JP", "LINE Pay Japan"),
      wallet("RAKUTEN_PAY", "Rakuten Pay"),
      wallet("AUPAY", "au Pay"),
      wallet("DBARAI", "d-Barai (NTT Docomo)"),
      bank("MUFG", "MUFG Bank (三菱UFJ銀行)"),
      bank("MIZUHO", "Mizuho Bank (みずほ銀行)"),
      bank("SMBC", "Sumitomo Mitsui Bank (三井住友銀行)"),
      bank("JPPOST", "Japan Post Bank (ゆうちょ銀行)"),
      bank("RAKUTEN_BANK", "Rakuten Bank (楽天銀行)"),
      bank("SBI_NET_JP", "SBI Sumishin Net Bank (住信SBIネット銀行)"),
      bank("SONY_BANK", "Sony Bank (ソニー銀行)"),
      bank("RESONA", "Resona Bank (りそな銀行)"),
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
      bank("JUSAN_KZ", "Jusan Bank Kazakhstan"),
      bank("BEREKE_KZ", "Bereke Bank (formerly Sberbank KZ)"),
      mobile("TELE2_PAY", "Tele2 Pay Kazakhstan"),
      wallet("QAZKOM", "Qazkom (Kazkommertsbank)"),
      SWIFT, WISE,
    ],
  },

  {
    country: "UZ", countryName: "Uzbekistan", currency: "UZS",
    methods: [
      wallet("CLICK_UZ", "Click", "Phone / Card Number"),
      wallet("PAYME_UZ", "Payme"),
      wallet("UZUM_UZ", "Uzum (Apelsin)"),
      wallet("OSON_UZ", "Oson Wallet"),
      bank("NBU_UZ", "National Bank of Uzbekistan"),
      bank("KAPITALBANK", "Kapitalbank"),
      bank("HAMKORBANK", "Hamkorbank"),
      bank("IPAK_YOLI", "Ipak Yoli Bank"),
      bank("INFINBANK", "Infinbank"),
      bank("AGROBANK_UZ", "Agrobank Uzbekistan"),
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
      bank("HALIFAX", "Halifax"),
      bank("NATIONWIDE", "Nationwide Building Society"),
      bank("TSB_UK", "TSB Bank"),
      bank("METRO_BANK", "Metro Bank"),
      bank("VIRGIN_MONEY", "Virgin Money"),
      bank("FIRST_DIRECT", "first direct"),
      wallet("MONZO", "Monzo"),
      wallet("STARLING", "Starling Bank"),
      wallet("CHASE_UK", "Chase UK"),
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
      bank("ING_DE", "ING Germany"),
      bank("COMDIRECT", "Comdirect (Deutsche Bank)"),
      bank("POSTBANK", "Postbank"),
      bank("HYPOVEREINSBANK", "HypoVereinsbank (UniCredit)"),
      bank("VOLKSBANK_DE", "Volksbank / Raiffeisenbank"),
      wallet("KLARNA", "Klarna"),
      wallet("BISON_DE", "BisonApp (Euwax)"),
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
      bank("CREDIT_MUTUEL", "Crédit Mutuel"),
      bank("CAISSE_EPARGNE", "Caisse d'Épargne"),
      bank("BANQUE_POPULAIRE", "Banque Populaire"),
      bank("HELLO_BANK", "Hello bank! (BNP Paribas)"),
      wallet("LYDIA", "Lydia"),
      wallet("SUMERIA", "Sumeria (ex-Lydia Pro)"),
      wallet("PAYLIB", "Paylib"),
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
      bank("BPER", "BPER Banca"),
      bank("BANCO_BPM", "Banco BPM"),
      bank("FINECO", "FinecoBank"),
      bank("CREDITO_VALTELLINESE", "CreVal (Credito Valtellinese)"),
      wallet("SATISPAY", "Satispay"),
      wallet("POSTEPAY", "Postepay (Poste Italiane)"),
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
      bank("ABANCA", "Abanca"),
      bank("IBERCAJA", "Ibercaja"),
      bank("UNICAJA", "Unicaja Banco"),
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
      bank("MILLENNIUM_PL", "Bank Millennium"),
      bank("ALIOR", "Alior Bank"),
      bank("BNP_PL", "BNP Paribas Bank Polska"),
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
      bank("UNICREDIT_RO", "UniCredit Bank Romania"),
      bank("CEC_RO", "CEC Bank Romania"),
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
      bank("PUMB", "PUMB (First Ukrainian International Bank)"),
      bank("UKRGASBANK", "Ukrgasbank"),
      bank("SENSE_BANK", "Sense Bank (formerly Alfa-Bank UA)"),
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
      bank("GAZPROMBANK", "Gazprombank"),
      bank("ROSBANK", "Rosbank"),
      bank("OTKRITIE", "Otkritie Bank"),
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
      bank("RAIFFEISEN_CZ", "Raiffeisenbank Czech Republic"),
      bank("AIRBANK_CZ", "Air Bank"),
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
      bank("RAIFFEISEN_HU", "Raiffeisen Bank Hungary"),
      bank("GRANIT", "Gránit Bank Hungary"),
      wallet("BARION", "Barion"),
      wallet("REVOLUT_HU", "Revolut Hungary"),
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
      bank("LANSFORSAKRINGAR", "Länsförsäkringar Bank"),
      bank("ICA_BANKEN", "ICA Banken"),
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
      bank("HANDELSBANKEN_NO", "Handelsbanken Norway"),
      bank("EIKA_NO", "Eika Group (Sparebank)"),
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
      bank("SYDBANK", "Sydbank"),
      bank("NYKREDIT", "Nykredit Bank"),
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
      bank("AKTIA_FI", "Aktia Bank"),
      bank("HANDELSBANKEN_FI", "Handelsbanken Finland"),
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
      bank("BUNQ", "bunq"),
      bank("TRIODOS_NL", "Triodos Bank"),
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
      bank("ARGENTA", "Argenta Bank Belgium"),
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
      bank("VALIANT_CH", "Valiant Bank"),
      bank("DUKASCOPY", "Dukascopy Bank"),
      bank("MIGROS_BANK", "Migros Bank"),
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
      bank("HYPOVEREINB_AT", "UniCredit Bank Austria"),
      bank("OBERBANK", "Oberbank Austria"),
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
      bank("SANTANDER_PT", "Santander Portugal"),
      bank("BIG_PT", "BIG (Banco de Investimento Global)"),
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
      bank("ATTICA_GR", "Attica Bank"),
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
      bank("FIRST_INVESTMENT_BG", "First Investment Bank (FIB)"),
      bank("CENTRAL_COOPERATIVE_BG", "Central Cooperative Bank Bulgaria"),
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
      bank("HPBS_HR", "Hrvatska poštanska banka"),
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
      bank("CSOB_SK", "ČSOB Slovakia"),
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
      bank("RAIFFEISEN_RS", "Raiffeisen Banka Serbia"),
      bank("AIK_BANK", "AIK Banka Serbia"),
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
      wallet("APPLE_CASH", "Apple Cash"),
      wallet("GOOGLE_PAY_US", "Google Pay US"),
      wallet("CHIME", "Chime"),
      wallet("SOFI", "SoFi Bank"),
      PAYPAL,
      bank("CHASE", "Chase Bank"),
      bank("BANK_OF_AMERICA", "Bank of America"),
      bank("WELLS_FARGO", "Wells Fargo"),
      bank("CITIBANK_US", "Citibank USA"),
      bank("US_BANK", "U.S. Bank"),
      bank("PNC", "PNC Bank"),
      bank("CAPITAL_ONE", "Capital One"),
      bank("ALLY_BANK", "Ally Bank"),
      bank("TRUIST", "Truist Bank"),
      bank("TD_US", "TD Bank USA"),
      bank("FIFTH_THIRD", "Fifth Third Bank"),
      bank("CITIZENS_US", "Citizens Bank USA"),
      bank("REGIONS", "Regions Bank"),
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
      bank("NATIONAL_BANK_CA", "National Bank of Canada"),
      bank("DESJARDINS", "Desjardins Group"),
      bank("TANGERINE", "Tangerine Bank"),
      bank("EQ_BANK", "EQ Bank"),
      bank("SIMPLII", "Simplii Financial (CIBC)"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "BR", countryName: "Brazil", currency: "BRL",
    methods: [
      wallet("PIX", "Pix", "Pix Key (CPF/Phone/Email)", "CPF, phone, or email"),
      wallet("MERCADOPAGO_BR", "MercadoPago Brasil"),
      wallet("PICPAY", "PicPay"),
      bank("BRADESCO", "Bradesco"),
      bank("ITAU", "Itaú Unibanco"),
      bank("SANTANDER_BR", "Santander Brasil"),
      bank("BB_BR", "Banco do Brasil"),
      bank("CAIXA_BR", "Caixa Econômica Federal"),
      bank("NUBANK_BR", "Nubank"),
      bank("INTER_BR", "Banco Inter"),
      bank("C6_BANK", "C6 Bank"),
      bank("ORIGINAL_BR", "Banco Original"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MX", countryName: "Mexico", currency: "MXN",
    methods: [
      wallet("SPEI", "SPEI Transfer", "CLABE (18 digits)", "18-digit CLABE"),
      wallet("MERCADOPAGO_MX", "MercadoPago México"),
      wallet("CLIP_MX", "Clip Pay"),
      bank("BANAMEX", "Banamex (Citibanamex)"),
      bank("BBVA_MX", "BBVA México"),
      bank("BANORTE", "Banorte"),
      bank("HSBC_MX", "HSBC México"),
      bank("SANTANDER_MX", "Santander México"),
      bank("SCOTIABANK_MX", "Scotiabank México"),
      bank("AZTECA_MX", "Banco Azteca"),
      bank("INBURSA", "Banco Inbursa"),
      bank("BANJERCITO", "Banjercito (Banco del Ejército)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "AR", countryName: "Argentina", currency: "ARS",
    methods: [
      wallet("MERCADOPAGO_AR", "MercadoPago Argentina"),
      wallet("UALA", "Ualá"),
      wallet("NARANJA_X", "Naranja X"),
      bank("BANCO_NACION", "Banco de la Nación Argentina"),
      bank("SANTANDER_AR", "Santander Argentina"),
      bank("BBVA_AR", "BBVA Argentina"),
      bank("GALICIA", "Banco Galicia"),
      bank("MACRO", "Banco Macro"),
      bank("BRUBANK", "Brubank"),
      bank("BIND_AR", "BIND (Banco Industrial)"),
      SWIFT, WISE,
    ],
  },

  {
    country: "CO", countryName: "Colombia", currency: "COP",
    methods: [
      wallet("NEQUI", "Nequi", "Phone Number", "3XX XXX XXXX"),
      wallet("DAVIPLATA", "Daviplata", "Phone Number"),
      wallet("MOVII", "Movii Colombia"),
      bank("BANCOLOMBIA", "Bancolombia"),
      bank("DAVIVIENDA", "Davivienda"),
      bank("BBVA_CO", "BBVA Colombia"),
      bank("SCOTIABANK_CO", "Scotiabank Colombia"),
      bank("ITAU_CO", "Itaú Colombia"),
      bank("AV_VILLAS", "Banco AV Villas"),
      bank("POPULAR_CO", "Banco Popular Colombia"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "PE", countryName: "Peru", currency: "PEN",
    methods: [
      wallet("YAPE", "Yape", "Phone Number", "9XX XXX XXX"),
      wallet("PLIN", "Plin"),
      wallet("LUKITA", "Lukita (BCP)"),
      bank("BCP_PE", "BCP (Banco de Crédito del Perú)"),
      bank("INTERBANK_PE", "Interbank Peru"),
      bank("BBVA_PE", "BBVA Perú"),
      bank("SCOTIABANK_PE", "Scotiabank Perú"),
      bank("BN_PE", "Banco de la Nación Perú"),
      bank("BANBIF", "BanBif Perú"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "CL", countryName: "Chile", currency: "CLP",
    methods: [
      wallet("MACH", "MACH", "RUT / Phone"),
      wallet("MERCADOPAGO_CL", "MercadoPago Chile"),
      wallet("TENPO", "Tenpo Chile"),
      bank("BANCO_ESTADO", "Banco Estado Chile"),
      bank("SANTANDER_CL", "Santander Chile"),
      bank("BANCHILE", "Banchile (Banco de Chile)"),
      bank("BBVA_CL", "BBVA Chile"),
      bank("ITAU_CL", "Itaú Chile"),
      bank("SCOTIABANK_CL", "Scotiabank Chile"),
      bank("BCI_CL", "BCI (Banco de Crédito e Inversiones)"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "VE", countryName: "Venezuela", currency: "VES",
    methods: [
      wallet("PAGO_MOVIL", "Pago Móvil", "Phone + Bank Code", "Phone number"),
      wallet("ZELLE_VE", "Zelle (USD — widely used in Venezuela)"),
      bank("BANESCO", "Banesco"),
      bank("MERCANTIL_VE", "Banco Mercantil Venezuela"),
      bank("BOD", "BOD (Banco Occidental de Descuento)"),
      bank("BANCO_DE_VENEZUELA", "Banco de Venezuela"),
      bank("PROVINCIAL_VE", "Banco Provincial (BBVA)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "EC", countryName: "Ecuador", currency: "USD",
    methods: [
      mobile("DE_UNO", "DeUno (Movistar)", "09XX XXX XXX"),
      wallet("PAYPHONE_EC", "PayPhone"),
      wallet("BIMO_EC", "Bimo Ecuador"),
      bank("PICHINCHA", "Banco Pichincha"),
      bank("PRODUBANCO", "Produbanco"),
      bank("GUAYAQUIL", "Banco de Guayaquil"),
      bank("BOLIVARIANO", "Banco Bolivariano"),
      bank("PACIFICO_EC", "Banco del Pacífico"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GT", countryName: "Guatemala", currency: "GTQ",
    methods: [
      mobile("TIGO_MONEY_GT", "Tigo Money Guatemala"),
      wallet("BANRURAL_PAY", "Banrural Pay"),
      bank("BANRURAL_GT", "Banrural Guatemala"),
      bank("INDUSTRIAL_GT", "Banco Industrial Guatemala"),
      bank("BAM_GT", "BAM Guatemala"),
      bank("G_AND_T_GT", "G&T Continental Guatemala"),
      bank("AGROMERCANTIL", "Agromercantil Guatemala"),
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
      bank("DAVIVIENDA_CR", "Davivienda Costa Rica"),
      bank("SCOTIABANK_CR", "Scotiabank Costa Rica"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "DO", countryName: "Dominican Republic", currency: "DOP",
    methods: [
      wallet("TPAGO", "tPago"),
      wallet("PAGAMASTARD", "PagaMasTarde"),
      wallet("SUPERPAGOS", "SuperPagos"),
      bank("BANRESERVAS", "Banco de Reservas (Banreservas)"),
      bank("BHD_LEON", "Banco BHD León"),
      bank("POPULAR_DO", "Banco Popular Dominicano"),
      bank("SCOTIABANK_DO", "Scotiabank República Dominicana"),
      bank("JMMB_DO", "JMMB Bank Dominican Republic"),
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
      bank("ING_AU", "ING Australia"),
      bank("BOQ", "Bank of Queensland (BOQ)"),
      bank("BENDIGO", "Bendigo Bank"),
      bank("UP_BANK", "Up Bank"),
      wallet("BEEM_IT", "Beem It"),
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
      bank("TSB_NZ", "TSB Bank New Zealand"),
      wallet("PAYMARK_NZ", "Paymark Click"),
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
      mobile("ETISALAT_AF", "Etisalat Afghanistan Pay"),
      bank("AIB_AF", "Afghan International Bank (AIB)"),
      bank("AZIZI_BANK", "Azizi Bank Afghanistan"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "AM", countryName: "Armenia", currency: "AMD",
    methods: [
      wallet("TELCELL", "Telcell Wallet"),
      wallet("IDRAM", "IDram"),
      wallet("EASYPAY_AM", "EasyPay Armenia"),
      bank("AMERIABANK", "Ameriabank"),
      bank("ACBA_BANK", "ACBA Bank"),
      bank("ARDSHINBANK", "Ardshinbank"),
      bank("VTB_ARMENIA", "VTB Bank Armenia"),
      bank("ARMSWISSBANK", "ArmSwissBank"),
      SWIFT, WISE,
    ],
  },

  {
    country: "AZ", countryName: "Azerbaijan", currency: "AZN",
    methods: [
      wallet("MPAY_AZ", "mPay"),
      wallet("BIRBANK", "Birbank (ABB)"),
      wallet("BIRKART_AZ", "Birkart"),
      bank("KAPITAL_AZ", "Kapital Bank Azerbaijan"),
      bank("ABB_AZ", "ABB (Azerbaijan Business Bank)"),
      bank("XALQ_BANK", "Xalq Bank"),
      bank("RABITA_AZ", "Rabita Bank Azerbaijan"),
      bank("AZERPOST", "AzerPost Bank"),
      SWIFT,
    ],
  },

  {
    country: "GE", countryName: "Georgia", currency: "GEL",
    methods: [
      wallet("TBC_PAY", "TBC Pay"),
      wallet("BOG_PAY", "BOG Pay"),
      wallet("SPACE_GE", "Space Neobank"),
      bank("TBC_GE", "TBC Bank Georgia"),
      bank("BOG", "Bank of Georgia"),
      bank("LIBERTBANK", "Liberty Bank Georgia"),
      bank("VTB_GE", "VTB Bank Georgia"),
      bank("HALYK_GE", "Halyk Bank Georgia"),
      SWIFT, WISE,
    ],
  },

  {
    country: "BY", countryName: "Belarus", currency: "BYN",
    methods: [
      bank("BELARUSBANK", "ASB Belarusbank"),
      bank("PRIORBANK", "Priorbank (Raiffeisen Group)"),
      bank("BPS_SBERBANK", "BPS-Sberbank"),
      bank("BELGAZPROMBANK", "Belgazprombank"),
      bank("MTBANK", "MTBank"),
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
      bank("ENERGBANK", "Energbank Moldova"),
      wallet("MPAY_MD", "MPay"),
      wallet("PAYNET_MD", "PayNet Moldova"),
      SWIFT, WISE,
    ],
  },

  {
    country: "MN", countryName: "Mongolia", currency: "MNT",
    methods: [
      wallet("SOCIALPAY_MN", "SocialPay"),
      wallet("MONPAY", "MonPay"),
      wallet("HIPAY_MN", "HiPay Mongolia"),
      bank("KHAN_BANK", "Khan Bank"),
      bank("GOLOMT_BANK", "Golomt Bank"),
      bank("TDB_MN", "Trade and Development Bank (TDB)"),
      bank("XAC_BANK", "XacBank Mongolia"),
      bank("STATE_BANK_MN", "State Bank Mongolia"),
      SWIFT,
    ],
  },

  {
    country: "KG", countryName: "Kyrgyzstan", currency: "KGS",
    methods: [
      wallet("MBANK_KG", "MBank Kyrgyzstan"),
      wallet("OPTIMA_PAY", "Optima Pay"),
      wallet("O_DENGI", "O!Dengi (Beeline)"),
      bank("OPTIMA_BANK", "Optima Bank"),
      bank("RSK_BANK", "RSK Bank"),
      bank("BANK_OF_ASIA", "Bank of Asia Kyrgyzstan"),
      bank("BAKAI_BANK", "Bakai Bank"),
      SWIFT,
    ],
  },

  {
    country: "TJ", countryName: "Tajikistan", currency: "TJS",
    methods: [
      mobile("ALIF_MOBI", "Alif Mobi"),
      wallet("VASL", "Vasl"),
      wallet("IMON_TJ", "Imon International"),
      bank("ALIF_BANK", "Alif Bank"),
      bank("ESKHATA", "Eskhata Bank"),
      bank("ORIENBANK", "Orienbank"),
      SWIFT,
    ],
  },

  {
    country: "TM", countryName: "Turkmenistan", currency: "TMT",
    methods: [
      bank("TFEB", "Turkmen Foreign Exchange Bank"),
      bank("RYSGAL", "Rysgal Bank"),
      bank("HALKBANK_TM", "Halkbank Turkmenistan"),
      SWIFT,
    ],
  },

  {
    country: "LA", countryName: "Laos", currency: "LAK",
    methods: [
      mobile("UNITEL_MONEY", "Unitel Money Laos"),
      mobile("BCEL_ONE", "BCEL One"),
      mobile("LOCA_LA", "LAReDI / Loca Laos"),
      bank("BCEL", "Banque pour le Commerce Extérieur Lao (BCEL)"),
      bank("LDB_LA", "Lao Development Bank"),
      bank("BFL_LA", "Banque Franco-Lao"),
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
      bank("DRUK_PNB", "Druk PNB Bank"),
      SWIFT,
    ],
  },

  {
    country: "MV", countryName: "Maldives", currency: "MVR",
    methods: [
      wallet("FAISA_PAY", "Faisa Pay"),
      wallet("BML_MOBILE", "BML Mobile Pay"),
      bank("BOC_MV", "Bank of Maldives (BML)"),
      bank("MIB_MV", "Maldives Islamic Bank"),
      bank("MAURITHIUS_MV", "Mauritius Commercial Bank Maldives"),
      SWIFT,
    ],
  },

  {
    country: "PS", countryName: "Palestine", currency: "ILS",
    methods: [
      bank("BANK_OF_PALESTINE", "Bank of Palestine"),
      bank("CAIRO_AMMAN_PS", "Cairo Amman Bank Palestine"),
      bank("ARAB_BANK_PS", "Arab Bank Palestine"),
      bank("QUDS_BANK", "Quds Bank Palestine"),
      mobile("JAWWAL_PAY", "Jawwal Pay"),
      mobile("OOREDOO_PAY_PS", "Ooredoo Pay Palestine"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SY", countryName: "Syria", currency: "SYP",
    methods: [
      bank("CBS_SY", "Commercial Bank of Syria"),
      bank("BEMO_SY", "BEMO Saudi Fransi Bank"),
      bank("SYRIA_INTERNATIONAL", "Syria International Islamic Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LY", countryName: "Libya", currency: "LYD",
    methods: [
      bank("WAHDA_BANK", "Wahda Bank Libya"),
      bank("SAHARA_BANK", "Sahara Bank Libya"),
      bank("JUMHOURIA", "Jumhouria Bank"),
      bank("NATIONAL_COMMERCIAL_LY", "National Commercial Bank Libya"),
      mobile("LIBYANA_PAY", "Libyana Money Transfer"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SS", countryName: "South Sudan", currency: "SSP",
    methods: [
      mobile("MTN_MOMO_SS", "MTN Mobile Money South Sudan"),
      mobile("VIVACELL_SS", "Vivacell Money"),
      mobile("ZAIN_SS", "Zain Cash South Sudan"),
      bank("BUFFALO_COMMERCE", "Buffalo Commercial Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ER", countryName: "Eritrea", currency: "ERN",
    methods: [
      bank("COMMERCIAL_BANK_ER", "Commercial Bank of Eritrea"),
      bank("HOUSING_ER", "Housing and Commerce Bank of Eritrea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "DJ", countryName: "Djibouti", currency: "DJF",
    methods: [
      mobile("DJIBOUTI_TELECOM_MONEY", "Djibouti Telecom Money"),
      mobile("EVINA_DJ", "Evina Djibouti"),
      bank("BCIMR", "BCIMR Djibouti"),
      bank("CAC_DJ", "CAC International Bank Djibouti"),
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
      bank("FDH_MW", "FDH Bank Malawi"),
      bank("NBS_MW", "NBS Bank Malawi"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BI", countryName: "Burundi", currency: "BIF",
    methods: [
      mobile("LUMICASH", "Lumicash (Econet)"),
      mobile("AIRTEL_BI", "Airtel Money Burundi"),
      mobile("MOBINOTEL_BI", "Mobinotel Money Burundi"),
      bank("BANCOBU", "Bancobu Burundi"),
      bank("BGF_BI", "Banque de Gestion et de Financement"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CF", countryName: "Central African Republic", currency: "XAF",
    methods: [
      mobile("ORANGE_MONEY_CF", "Orange Money CAR"),
      mobile("MOOV_CF", "Moov Money CAR"),
      bank("CBCA", "Banque Populaire Maroco-Centrafricaine"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "TD", countryName: "Chad", currency: "XAF",
    methods: [
      mobile("AIRTEL_TD", "Airtel Money Chad"),
      mobile("MTN_MOMO_TD", "MTN Mobile Money Chad"),
      bank("SOCIETE_GENERALE_TD", "Société Générale Tchad"),
      bank("ECOBANK_TD", "Ecobank Chad"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "NE", countryName: "Niger", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_NE", "Orange Money Niger"),
      mobile("AIRTEL_NE", "Airtel Money Niger"),
      mobile("MOOV_NE", "Moov Money Niger"),
      bank("ECOBANK_NE", "Ecobank Niger"),
      bank("BIA_NE", "BIA Niger"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ML", countryName: "Mali", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_ML", "Orange Money Mali"),
      mobile("MOOV_ML", "Moov Money Mali"),
      mobile("WAVE_ML", "Wave Mali"),
      bank("ECOBANK_ML", "Ecobank Mali"),
      bank("BDM_ML", "Banque de Développement du Mali (BDM)"),
      bank("BNDA_ML", "BNDA Mali"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BF", countryName: "Burkina Faso", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_BF", "Orange Money Burkina Faso"),
      mobile("CORIS_MONEY", "Coris Money"),
      mobile("MOOV_BF", "Moov Money Burkina Faso"),
      bank("ECOBANK_BF", "Ecobank Burkina Faso"),
      bank("CORIS_BANK_BF", "Coris Bank International BF"),
      bank("BOA_BF", "Bank of Africa Burkina Faso"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GN", countryName: "Guinea", currency: "GNF",
    methods: [
      mobile("ORANGE_MONEY_GN", "Orange Money Guinea"),
      mobile("MTN_MOMO_GN", "MTN Mobile Money Guinea"),
      mobile("MOOV_GN", "Moov Money Guinea"),
      bank("ECOBANK_GN", "Ecobank Guinea"),
      bank("BICIGUI_GN", "BICIGUI Guinea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SL", countryName: "Sierra Leone", currency: "SLL",
    methods: [
      mobile("ORANGE_MONEY_SL", "Orange Money Sierra Leone"),
      mobile("AFRIMONEY_SL", "Afrimoney"),
      mobile("QMONEY_SL", "QMoney Sierra Leone"),
      bank("SIERRA_LEONE_COMMERCIAL", "Sierra Leone Commercial Bank"),
      bank("ROKEL_SL", "Rokel Commercial Bank"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "LR", countryName: "Liberia", currency: "LRD",
    methods: [
      mobile("MTN_MOMO_LR", "MTN Mobile Money Liberia"),
      mobile("ORANGE_MONEY_LR", "Orange Money Liberia"),
      mobile("LONESTAR_LR", "Lonestar Cell Money"),
      bank("ECOBANK_LR", "Ecobank Liberia"),
      bank("FIRST_INT_LR", "First International Bank Liberia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GM", countryName: "Gambia", currency: "GMD",
    methods: [
      mobile("AFRIMONEY_GM", "Afrimoney Gambia"),
      mobile("QMONEY", "QMoney"),
      mobile("AFRICELL_MONEY", "Africell Money Gambia"),
      bank("GTB_GM", "Guaranty Trust Bank Gambia"),
      bank("ACCESS_GM", "Access Bank Gambia"),
      bank("TRUST_BANK_GM", "Trust Bank Gambia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GW", countryName: "Guinea-Bissau", currency: "XOF",
    methods: [
      mobile("ORANGE_MONEY_GW", "Orange Money Guinea-Bissau"),
      mobile("MTN_GW", "MTN Guinea-Bissau"),
      bank("BIAT_GW", "Banco da África Ocidental"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "TG", countryName: "Togo", currency: "XOF",
    methods: [
      mobile("FLOOZ_TG", "Flooz (Moov) Togo"),
      mobile("T_MONEY", "T-Money (Togocel)"),
      bank("ECOBANK_TG", "Ecobank Togo"),
      bank("ORABANK_TG", "Orabank Togo"),
      bank("SGBT_TG", "SGBT Togo"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BJ", countryName: "Benin", currency: "XOF",
    methods: [
      mobile("MTN_MOMO_BJ", "MTN Mobile Money Benin"),
      mobile("MOOV_BJ", "Moov Money Benin"),
      bank("ECOBANK_BJ", "Ecobank Benin"),
      bank("BOA_BJ", "Bank of Africa Benin"),
      bank("ORABANK_BJ", "Orabank Benin"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CG", countryName: "Republic of Congo", currency: "XAF",
    methods: [
      mobile("MTN_MOMO_CG", "MTN Mobile Money Congo"),
      mobile("AIRTEL_CG", "Airtel Money Congo"),
      bank("ECOBANK_CG", "Ecobank Congo"),
      bank("LCB_CG", "La Congolaise de Banque (LCB)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CD", countryName: "DR Congo", currency: "CDF",
    methods: [
      mobile("MPESA_CD", "M-Pesa DRC (Vodacom)"),
      mobile("ORANGE_MONEY_CD", "Orange Money DRC"),
      mobile("AIRTEL_CD", "Airtel Money DRC"),
      mobile("AFRICELL_CD", "Africell Money DRC"),
      bank("RAWBANK", "Rawbank DRC"),
      bank("EQUITY_CD", "Equity Bank DRC"),
      bank("ECOBANK_CD", "Ecobank DRC"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GA", countryName: "Gabon", currency: "XAF",
    methods: [
      mobile("AIRTEL_GA", "Airtel Money Gabon"),
      mobile("MOOV_GA", "Moov Money Gabon"),
      bank("BGFI_BANK", "BGFI Bank Gabon"),
      bank("UGB_GA", "UGB (Union Gabonaise de Banque)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "GQ", countryName: "Equatorial Guinea", currency: "XAF",
    methods: [
      bank("CCEI_GQ", "CCEI Bank Equatorial Guinea"),
      bank("BGFI_GQ", "BGFI Bank Equatorial Guinea"),
      mobile("MTN_GQ", "MTN Mobile Money Equatorial Guinea"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "ST", countryName: "São Tomé and Príncipe", currency: "STN",
    methods: [
      bank("BISTP", "BISTP (Banco Internacional de São Tomé e Príncipe)"),
      bank("ECOBANK_ST", "Ecobank São Tomé"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "KM", countryName: "Comoros", currency: "KMF",
    methods: [
      bank("BDC_KM", "Banque de Développement des Comores"),
      bank("EXIM_KM", "Exim Bank Comoros"),
      mobile("HURI_KM", "Huri Money Comoros"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CV", countryName: "Cape Verde", currency: "CVE",
    methods: [
      mobile("MPESA_CV", "M-Pesa Cape Verde"),
      mobile("T_MONEY_CV", "T-Money Cape Verde"),
      bank("BCA_CV", "BCA (Banco Comercial do Atlântico)"),
      bank("CAIXA_CV", "Caixa Económica de Cabo Verde"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "PY", countryName: "Paraguay", currency: "PYG",
    methods: [
      mobile("TIGO_MONEY_PY", "Tigo Money Paraguay"),
      wallet("BILLETERA_PY", "Billetera Personal"),
      wallet("PERSONAL_PY", "Personal Pay"),
      bank("BNF_PY", "BNF (Banco Nacional de Fomento)"),
      bank("CONTINENTAL_PY", "Banco Continental Paraguay"),
      bank("ITAU_PY", "Itaú Paraguay"),
      bank("GNB_PY", "Banco GNB Paraguay"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "BO", countryName: "Bolivia", currency: "BOB",
    methods: [
      wallet("TIGO_MONEY_BO", "Tigo Money Bolivia"),
      wallet("SIMPLE_PAY_BO", "Simple Pay"),
      wallet("BNB_MOVIL", "BNB Móvil"),
      bank("BNB_BO", "BNB (Banco Nacional de Bolivia)"),
      bank("BISA_BO", "Banco BISA"),
      bank("BANCO_UNION_BO", "Banco Unión Bolivia"),
      bank("BCP_BO", "BCP Bolivia"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "UY", countryName: "Uruguay", currency: "UYU",
    methods: [
      wallet("MERCADOPAGO_UY", "MercadoPago Uruguay"),
      wallet("OCA_UY", "OCA Blue"),
      wallet("PAGANZA_UY", "Paganza"),
      bank("BROU", "BROU (Banco de la República Oriental)"),
      bank("SCOTIABANK_UY", "Scotiabank Uruguay"),
      bank("SANTANDER_UY", "Santander Uruguay"),
      bank("ITAU_UY", "Itaú Uruguay"),
      PAYPAL, SWIFT,
    ],
  },

  {
    country: "HN", countryName: "Honduras", currency: "HNL",
    methods: [
      mobile("TIGO_MONEY_HN", "Tigo Money Honduras"),
      wallet("PAY_IT_HN", "PayIT Honduras"),
      bank("BANCATLAN", "Bancatlán"),
      bank("BANHCAFE", "Banhcafé"),
      bank("BANCO_OCCIDENTE", "Banco de Occidente Honduras"),
      bank("DAVIVIENDA_HN", "Davivienda Honduras"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "SV", countryName: "El Salvador", currency: "USD",
    methods: [
      wallet("CHIVO", "Chivo Wallet (Bitcoin/USD)"),
      mobile("TIGO_MONEY_SV", "Tigo Money El Salvador"),
      wallet("PAGADITO", "Pagadito El Salvador"),
      bank("AGRICOLA_SV", "Banco Agrícola El Salvador"),
      bank("DAVIVIENDA_SV", "Davivienda El Salvador"),
      bank("SCOTIABANK_SV", "Scotiabank El Salvador"),
      WESTERN_UNION, PAYPAL, SWIFT,
    ],
  },

  {
    country: "NI", countryName: "Nicaragua", currency: "NIO",
    methods: [
      mobile("TIGO_MONEY_NI", "Tigo Money Nicaragua"),
      wallet("PLIN_NI", "Plin Nicaragua"),
      bank("BDF_NI", "BDF Nicaragua"),
      bank("BANPRO", "Banpro"),
      bank("BAC_NI", "BAC Nicaragua"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "PA", countryName: "Panama", currency: "PAB",
    methods: [
      bank("BANISTMO", "Banistmo"),
      bank("GLOBAL_BANK_PA", "Global Bank Panama"),
      bank("BANCO_GENERAL", "Banco General"),
      bank("MMG_PA", "Multibank Panama"),
      bank("BAC_PA", "BAC Panama"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "CU", countryName: "Cuba", currency: "CUP",
    methods: [
      wallet("TRANSFERMOVIL", "TransferMóvil"),
      wallet("ENZONA", "EnZona"),
      bank("BPA_CU", "Banco Popular de Ahorro (BPA)"),
      bank("BANDEC", "Banco de Crédito y Comercio (BANDEC)"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "HT", countryName: "Haiti", currency: "HTG",
    methods: [
      mobile("MONCASH", "MonCash (Digicel)"),
      mobile("LAJAN_CASH", "Lajan Cash (Natcom)"),
      mobile("SOGEXPRESS", "SogExpress Haiti"),
      bank("SOGEBANK", "Sogebank Haiti"),
      bank("UNIBANK_HT", "Unibank Haiti"),
      WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "JM", countryName: "Jamaica", currency: "JMD",
    methods: [
      wallet("LYNK_JM", "Lynk"),
      wallet("MERO_JM", "Mero Jamaica"),
      bank("NCB_JM", "National Commercial Bank (NCB) Jamaica"),
      bank("SCOTIABANK_JM", "Scotiabank Jamaica"),
      bank("JNBS", "Jamaica National (JNBS)"),
      bank("SAGICOR_JM", "Sagicor Bank Jamaica"),
      WESTERN_UNION, PAYPAL, SWIFT,
    ],
  },

  {
    country: "TT", countryName: "Trinidad and Tobago", currency: "TTD",
    methods: [
      wallet("BMOBILE_TT", "bmobile Pay"),
      bank("RBC_TT", "RBC Royal Bank Trinidad"),
      bank("FCB_TT", "First Citizens Bank TT"),
      bank("SCOTIABANK_TT", "Scotiabank Trinidad"),
      bank("REPUBLIC_TT", "Republic Bank Trinidad"),
      bank("CIBC_TT", "CIBC First Caribbean TT"),
      PAYPAL, WESTERN_UNION, SWIFT,
    ],
  },

  {
    country: "IL", countryName: "Israel", currency: "ILS",
    methods: [
      wallet("BIT_IL", "bit (Bank Hapoalim)", "Phone Number"),
      wallet("PAYBOX_IL", "PayBox"),
      wallet("PEPPER_IL", "Pepper (Bank Mizrahi)"),
      bank("HAPOALIM", "Bank Hapoalim"),
      bank("LEUMI", "Bank Leumi"),
      bank("DISCOUNT_IL", "Bank Discount Israel"),
      bank("MIZRAHI_TEFAHOT", "Mizrahi-Tefahot Bank"),
      bank("FIRST_INTERNATIONAL_IL", "First International Bank of Israel"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "CY", countryName: "Cyprus", currency: "EUR",
    methods: [
      SEPA,
      bank("BANK_OF_CYPRUS", "Bank of Cyprus"),
      bank("HELLENIC_CY", "Hellenic Bank Cyprus"),
      bank("AXA_CY", "AXA Bank Cyprus"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MT", countryName: "Malta", currency: "EUR",
    methods: [
      SEPA,
      bank("BOV", "Bank of Valletta (BOV)"),
      bank("HSBC_MT", "HSBC Bank Malta"),
      bank("LOMBARD_MT", "Lombard Bank Malta"),
      PAYPAL, WISE, REVOLUT, SWIFT,
    ],
  },

  {
    country: "IS", countryName: "Iceland", currency: "ISK",
    methods: [
      bank("LANDSBANKINN", "Landsbankinn"),
      bank("ISLANDSBANKI", "Íslandsbanki"),
      bank("ARION", "Arion Bank"),
      bank("KVIKA", "Kvika Bank"),
      WISE, REVOLUT, SWIFT, SEPA,
    ],
  },

  {
    country: "LI", countryName: "Liechtenstein", currency: "CHF",
    methods: [
      bank("LLB", "Liechtensteinische Landesbank (LLB)"),
      bank("VP_BANK", "VP Bank"),
      bank("KAISER_LI", "Kaiser Partner Privatbank"),
      WISE, SWIFT, SEPA,
    ],
  },

  {
    country: "LU", countryName: "Luxembourg", currency: "EUR",
    methods: [
      SEPA,
      bank("BCEE", "BCEE (Banque et Caisse d'Épargne de l'État)"),
      bank("BGL_BNP", "BGL BNP Paribas Luxembourg"),
      bank("ING_LU", "ING Luxembourg"),
      bank("RAIFFEISEN_LU", "Raiffeisen Banque Luxembourg"),
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
      bank("CITADELE_LV", "Citadele Bank Latvia"),
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
      bank("SIAULIU_LT", "Šiaulių bankas"),
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
      bank("COOP_EE", "Coop Pank Estonia"),
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
      bank("UNICREDIT_SI", "UniCredit Bank Slovenija"),
      PAYPAL, WISE, SWIFT,
    ],
  },

  {
    country: "MK", countryName: "North Macedonia", currency: "MKD",
    methods: [
      bank("STOPANSKA", "Stopanska Banka"),
      bank("NLB_MK", "NLB Banka Macedonia"),
      bank("KOMERCIJALNA_MK", "Komercijalna Banka"),
      bank("OHRIDSKA_MK", "Ohridska Banka (Société Générale)"),
      wallet("CASYS_MK", "CASYS Macedonia"),
      SWIFT, WISE,
    ],
  },

  {
    country: "AL", countryName: "Albania", currency: "ALL",
    methods: [
      bank("CREDINS", "Credins Bank"),
      bank("RAIFFEISEN_AL", "Raiffeisen Bank Albania"),
      bank("BKT_AL", "BKT (Banka Kombetare Tregtare)"),
      bank("INTESA_AL", "Intesa Sanpaolo Bank Albania"),
      bank("UNION_AL", "Union Bank Albania"),
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
      bank("NLB_BA", "NLB Banka Bosnia"),
      bank("SPARKASSE_BA", "Sparkasse Bank BiH"),
      SWIFT, WISE, SEPA,
    ],
  },

  {
    country: "ME", countryName: "Montenegro", currency: "EUR",
    methods: [
      SEPA,
      bank("CRNOGORSKA", "Crnogorska Komercijalna Banka"),
      bank("NLB_ME", "NLB Banka Montenegro"),
      bank("HIPOTEKARNA", "Hipotekarna Banka"),
      SWIFT, WISE,
    ],
  },

  {
    country: "XK", countryName: "Kosovo", currency: "EUR",
    methods: [
      SEPA,
      bank("PROCREDIT_KS", "ProCredit Bank Kosovo"),
      bank("RAIFFEISEN_KS", "Raiffeisen Bank Kosovo"),
      bank("NLB_KS", "NLB Banka Kosovo"),
      bank("BKT_KS", "BKT Kosovo"),
      SWIFT, WISE,
    ],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export const SUPPORTED_COUNTRIES: { country: string; countryName: string; currency: string }[] =
  GLOBAL_PAYMENT_METHODS.map(({ country, countryName, currency }) => ({ country, countryName, currency }));

export function getCountryMethods(countryCode: string): CountryMethods | undefined {
  return GLOBAL_PAYMENT_METHODS.find(c => c.country === countryCode);
}

export function getAllMethodIds(): string[] {
  const ids = new Set<string>();
  for (const country of GLOBAL_PAYMENT_METHODS) {
    for (const m of country.methods) ids.add(m.id);
  }
  return [...ids];
}

export function getMethodById(id: string): PaymentMethodDef | undefined {
  for (const country of GLOBAL_PAYMENT_METHODS) {
    const m = country.methods.find(x => x.id === id);
    if (m) return m;
  }
  return undefined;
}
