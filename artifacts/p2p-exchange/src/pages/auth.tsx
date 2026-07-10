import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Eye, EyeOff } from "lucide-react";
import "./auth.css";

// On Replit/localhost the real site key is domain-locked and always fails (error 110200).
// Use Cloudflare's official always-pass test key so login works in dev.
// On the production domain the real site key is used and the backend enforces verification.
const IS_PRODUCTION_DOMAIN =
  typeof window !== "undefined" &&
  !window.location.hostname.includes("replit") &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("127.0.0.1");

const CF_TEST_KEY = "1x00000000000000000000AA"; // Always passes, any domain
const REAL_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAADfw5Ve1Ks9-MMzT";
const TURNSTILE_SITE_KEY = IS_PRODUCTION_DOMAIN ? REAL_SITE_KEY : CF_TEST_KEY;

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  // Ethiopia first so COUNTRIES[0] === ET
  { code: "ET", name: "Ethiopia",                        dial: "+251",  flag: "🇪🇹" },
  { code: "AF", name: "Afghanistan",                     dial: "+93",   flag: "🇦🇫" },
  { code: "AL", name: "Albania",                         dial: "+355",  flag: "🇦🇱" },
  { code: "DZ", name: "Algeria",                         dial: "+213",  flag: "🇩🇿" },
  { code: "AD", name: "Andorra",                         dial: "+376",  flag: "🇦🇩" },
  { code: "AO", name: "Angola",                          dial: "+244",  flag: "🇦🇴" },
  { code: "AG", name: "Antigua and Barbuda",             dial: "+1268", flag: "🇦🇬" },
  { code: "AR", name: "Argentina",                       dial: "+54",   flag: "🇦🇷" },
  { code: "AM", name: "Armenia",                         dial: "+374",  flag: "🇦🇲" },
  { code: "AU", name: "Australia",                       dial: "+61",   flag: "🇦🇺" },
  { code: "AT", name: "Austria",                         dial: "+43",   flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan",                      dial: "+994",  flag: "🇦🇿" },
  { code: "BS", name: "Bahamas",                         dial: "+1242", flag: "🇧🇸" },
  { code: "BH", name: "Bahrain",                         dial: "+973",  flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh",                      dial: "+880",  flag: "🇧🇩" },
  { code: "BB", name: "Barbados",                        dial: "+1246", flag: "🇧🇧" },
  { code: "BY", name: "Belarus",                         dial: "+375",  flag: "🇧🇾" },
  { code: "BE", name: "Belgium",                         dial: "+32",   flag: "🇧🇪" },
  { code: "BZ", name: "Belize",                          dial: "+501",  flag: "🇧🇿" },
  { code: "BJ", name: "Benin",                           dial: "+229",  flag: "🇧🇯" },
  { code: "BT", name: "Bhutan",                          dial: "+975",  flag: "🇧🇹" },
  { code: "BO", name: "Bolivia",                         dial: "+591",  flag: "🇧🇴" },
  { code: "BA", name: "Bosnia and Herzegovina",          dial: "+387",  flag: "🇧🇦" },
  { code: "BW", name: "Botswana",                        dial: "+267",  flag: "🇧🇼" },
  { code: "BR", name: "Brazil",                          dial: "+55",   flag: "🇧🇷" },
  { code: "BN", name: "Brunei",                          dial: "+673",  flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria",                        dial: "+359",  flag: "🇧🇬" },
  { code: "BF", name: "Burkina Faso",                    dial: "+226",  flag: "🇧🇫" },
  { code: "BI", name: "Burundi",                         dial: "+257",  flag: "🇧🇮" },
  { code: "CV", name: "Cabo Verde",                      dial: "+238",  flag: "🇨🇻" },
  { code: "KH", name: "Cambodia",                        dial: "+855",  flag: "🇰🇭" },
  { code: "CM", name: "Cameroon",                        dial: "+237",  flag: "🇨🇲" },
  { code: "CA", name: "Canada",                          dial: "+1",    flag: "🇨🇦" },
  { code: "CF", name: "Central African Republic",        dial: "+236",  flag: "🇨🇫" },
  { code: "TD", name: "Chad",                            dial: "+235",  flag: "🇹🇩" },
  { code: "CL", name: "Chile",                           dial: "+56",   flag: "🇨🇱" },
  { code: "CN", name: "China",                           dial: "+86",   flag: "🇨🇳" },
  { code: "CO", name: "Colombia",                        dial: "+57",   flag: "🇨🇴" },
  { code: "KM", name: "Comoros",                         dial: "+269",  flag: "🇰🇲" },
  { code: "CG", name: "Congo",                           dial: "+242",  flag: "🇨🇬" },
  { code: "CD", name: "Congo (DRC)",                     dial: "+243",  flag: "🇨🇩" },
  { code: "CR", name: "Costa Rica",                      dial: "+506",  flag: "🇨🇷" },
  { code: "CI", name: "Côte d'Ivoire",                   dial: "+225",  flag: "🇨🇮" },
  { code: "HR", name: "Croatia",                         dial: "+385",  flag: "🇭🇷" },
  { code: "CU", name: "Cuba",                            dial: "+53",   flag: "🇨🇺" },
  { code: "CY", name: "Cyprus",                          dial: "+357",  flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic",                  dial: "+420",  flag: "🇨🇿" },
  { code: "DK", name: "Denmark",                         dial: "+45",   flag: "🇩🇰" },
  { code: "DJ", name: "Djibouti",                        dial: "+253",  flag: "🇩🇯" },
  { code: "DM", name: "Dominica",                        dial: "+1767", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic",              dial: "+1809", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador",                         dial: "+593",  flag: "🇪🇨" },
  { code: "EG", name: "Egypt",                           dial: "+20",   flag: "🇪🇬" },
  { code: "SV", name: "El Salvador",                     dial: "+503",  flag: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea",               dial: "+240",  flag: "🇬🇶" },
  { code: "ER", name: "Eritrea",                         dial: "+291",  flag: "🇪🇷" },
  { code: "EE", name: "Estonia",                         dial: "+372",  flag: "🇪🇪" },
  { code: "SZ", name: "Eswatini",                        dial: "+268",  flag: "🇸🇿" },
  { code: "FJ", name: "Fiji",                            dial: "+679",  flag: "🇫🇯" },
  { code: "FI", name: "Finland",                         dial: "+358",  flag: "🇫🇮" },
  { code: "FR", name: "France",                          dial: "+33",   flag: "🇫🇷" },
  { code: "GA", name: "Gabon",                           dial: "+241",  flag: "🇬🇦" },
  { code: "GM", name: "Gambia",                          dial: "+220",  flag: "🇬🇲" },
  { code: "GE", name: "Georgia",                         dial: "+995",  flag: "🇬🇪" },
  { code: "DE", name: "Germany",                         dial: "+49",   flag: "🇩🇪" },
  { code: "GH", name: "Ghana",                           dial: "+233",  flag: "🇬🇭" },
  { code: "GR", name: "Greece",                          dial: "+30",   flag: "🇬🇷" },
  { code: "GD", name: "Grenada",                         dial: "+1473", flag: "🇬🇩" },
  { code: "GT", name: "Guatemala",                       dial: "+502",  flag: "🇬🇹" },
  { code: "GN", name: "Guinea",                          dial: "+224",  flag: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau",                   dial: "+245",  flag: "🇬🇼" },
  { code: "GY", name: "Guyana",                          dial: "+592",  flag: "🇬🇾" },
  { code: "HT", name: "Haiti",                           dial: "+509",  flag: "🇭🇹" },
  { code: "HN", name: "Honduras",                        dial: "+504",  flag: "🇭🇳" },
  { code: "HU", name: "Hungary",                         dial: "+36",   flag: "🇭🇺" },
  { code: "IS", name: "Iceland",                         dial: "+354",  flag: "🇮🇸" },
  { code: "IN", name: "India",                           dial: "+91",   flag: "🇮🇳" },
  { code: "ID", name: "Indonesia",                       dial: "+62",   flag: "🇮🇩" },
  { code: "IR", name: "Iran",                            dial: "+98",   flag: "🇮🇷" },
  { code: "IQ", name: "Iraq",                            dial: "+964",  flag: "🇮🇶" },
  { code: "IE", name: "Ireland",                         dial: "+353",  flag: "🇮🇪" },
  { code: "IL", name: "Israel",                          dial: "+972",  flag: "🇮🇱" },
  { code: "IT", name: "Italy",                           dial: "+39",   flag: "🇮🇹" },
  { code: "JM", name: "Jamaica",                         dial: "+1876", flag: "🇯🇲" },
  { code: "JP", name: "Japan",                           dial: "+81",   flag: "🇯🇵" },
  { code: "JO", name: "Jordan",                          dial: "+962",  flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan",                      dial: "+7",    flag: "🇰🇿" },
  { code: "KE", name: "Kenya",                           dial: "+254",  flag: "🇰🇪" },
  { code: "KI", name: "Kiribati",                        dial: "+686",  flag: "🇰🇮" },
  { code: "KW", name: "Kuwait",                          dial: "+965",  flag: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan",                      dial: "+996",  flag: "🇰🇬" },
  { code: "LA", name: "Laos",                            dial: "+856",  flag: "🇱🇦" },
  { code: "LV", name: "Latvia",                          dial: "+371",  flag: "🇱🇻" },
  { code: "LB", name: "Lebanon",                         dial: "+961",  flag: "🇱🇧" },
  { code: "LS", name: "Lesotho",                         dial: "+266",  flag: "🇱🇸" },
  { code: "LR", name: "Liberia",                         dial: "+231",  flag: "🇱🇷" },
  { code: "LY", name: "Libya",                           dial: "+218",  flag: "🇱🇾" },
  { code: "LI", name: "Liechtenstein",                   dial: "+423",  flag: "🇱🇮" },
  { code: "LT", name: "Lithuania",                       dial: "+370",  flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg",                      dial: "+352",  flag: "🇱🇺" },
  { code: "MG", name: "Madagascar",                      dial: "+261",  flag: "🇲🇬" },
  { code: "MW", name: "Malawi",                          dial: "+265",  flag: "🇲🇼" },
  { code: "MY", name: "Malaysia",                        dial: "+60",   flag: "🇲🇾" },
  { code: "MV", name: "Maldives",                        dial: "+960",  flag: "🇲🇻" },
  { code: "ML", name: "Mali",                            dial: "+223",  flag: "🇲🇱" },
  { code: "MT", name: "Malta",                           dial: "+356",  flag: "🇲🇹" },
  { code: "MH", name: "Marshall Islands",                dial: "+692",  flag: "🇲🇭" },
  { code: "MR", name: "Mauritania",                      dial: "+222",  flag: "🇲🇷" },
  { code: "MU", name: "Mauritius",                       dial: "+230",  flag: "🇲🇺" },
  { code: "MX", name: "Mexico",                          dial: "+52",   flag: "🇲🇽" },
  { code: "FM", name: "Micronesia",                      dial: "+691",  flag: "🇫🇲" },
  { code: "MD", name: "Moldova",                         dial: "+373",  flag: "🇲🇩" },
  { code: "MC", name: "Monaco",                          dial: "+377",  flag: "🇲🇨" },
  { code: "MN", name: "Mongolia",                        dial: "+976",  flag: "🇲🇳" },
  { code: "ME", name: "Montenegro",                      dial: "+382",  flag: "🇲🇪" },
  { code: "MA", name: "Morocco",                         dial: "+212",  flag: "🇲🇦" },
  { code: "MZ", name: "Mozambique",                      dial: "+258",  flag: "🇲🇿" },
  { code: "MM", name: "Myanmar",                         dial: "+95",   flag: "🇲🇲" },
  { code: "NA", name: "Namibia",                         dial: "+264",  flag: "🇳🇦" },
  { code: "NR", name: "Nauru",                           dial: "+674",  flag: "🇳🇷" },
  { code: "NP", name: "Nepal",                           dial: "+977",  flag: "🇳🇵" },
  { code: "NL", name: "Netherlands",                     dial: "+31",   flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand",                     dial: "+64",   flag: "🇳🇿" },
  { code: "NI", name: "Nicaragua",                       dial: "+505",  flag: "🇳🇮" },
  { code: "NE", name: "Niger",                           dial: "+227",  flag: "🇳🇪" },
  { code: "NG", name: "Nigeria",                         dial: "+234",  flag: "🇳🇬" },
  { code: "NO", name: "Norway",                          dial: "+47",   flag: "🇳🇴" },
  { code: "OM", name: "Oman",                            dial: "+968",  flag: "🇴🇲" },
  { code: "PK", name: "Pakistan",                        dial: "+92",   flag: "🇵🇰" },
  { code: "PW", name: "Palau",                           dial: "+680",  flag: "🇵🇼" },
  { code: "PS", name: "Palestine",                       dial: "+970",  flag: "🇵🇸" },
  { code: "PA", name: "Panama",                          dial: "+507",  flag: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea",                dial: "+675",  flag: "🇵🇬" },
  { code: "PY", name: "Paraguay",                        dial: "+595",  flag: "🇵🇾" },
  { code: "PE", name: "Peru",                            dial: "+51",   flag: "🇵🇪" },
  { code: "PH", name: "Philippines",                     dial: "+63",   flag: "🇵🇭" },
  { code: "PL", name: "Poland",                          dial: "+48",   flag: "🇵🇱" },
  { code: "PT", name: "Portugal",                        dial: "+351",  flag: "🇵🇹" },
  { code: "QA", name: "Qatar",                           dial: "+974",  flag: "🇶🇦" },
  { code: "RO", name: "Romania",                         dial: "+40",   flag: "🇷🇴" },
  { code: "RU", name: "Russia",                          dial: "+7",    flag: "🇷🇺" },
  { code: "RW", name: "Rwanda",                          dial: "+250",  flag: "🇷🇼" },
  { code: "KN", name: "Saint Kitts and Nevis",           dial: "+1869", flag: "🇰🇳" },
  { code: "LC", name: "Saint Lucia",                     dial: "+1758", flag: "🇱🇨" },
  { code: "VC", name: "Saint Vincent and the Grenadines",dial: "+1784", flag: "🇻🇨" },
  { code: "WS", name: "Samoa",                           dial: "+685",  flag: "🇼🇸" },
  { code: "SM", name: "San Marino",                      dial: "+378",  flag: "🇸🇲" },
  { code: "ST", name: "Sao Tome and Principe",           dial: "+239",  flag: "🇸🇹" },
  { code: "SA", name: "Saudi Arabia",                    dial: "+966",  flag: "🇸🇦" },
  { code: "SN", name: "Senegal",                         dial: "+221",  flag: "🇸🇳" },
  { code: "RS", name: "Serbia",                          dial: "+381",  flag: "🇷🇸" },
  { code: "SC", name: "Seychelles",                      dial: "+248",  flag: "🇸🇨" },
  { code: "SL", name: "Sierra Leone",                    dial: "+232",  flag: "🇸🇱" },
  { code: "SG", name: "Singapore",                       dial: "+65",   flag: "🇸🇬" },
  { code: "SK", name: "Slovakia",                        dial: "+421",  flag: "🇸🇰" },
  { code: "SI", name: "Slovenia",                        dial: "+386",  flag: "🇸🇮" },
  { code: "SB", name: "Solomon Islands",                 dial: "+677",  flag: "🇸🇧" },
  { code: "SO", name: "Somalia",                         dial: "+252",  flag: "🇸🇴" },
  { code: "ZA", name: "South Africa",                    dial: "+27",   flag: "🇿🇦" },
  { code: "SS", name: "South Sudan",                     dial: "+211",  flag: "🇸🇸" },
  { code: "ES", name: "Spain",                           dial: "+34",   flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka",                       dial: "+94",   flag: "🇱🇰" },
  { code: "SD", name: "Sudan",                           dial: "+249",  flag: "🇸🇩" },
  { code: "SR", name: "Suriname",                        dial: "+597",  flag: "🇸🇷" },
  { code: "SE", name: "Sweden",                          dial: "+46",   flag: "🇸🇪" },
  { code: "CH", name: "Switzerland",                     dial: "+41",   flag: "🇨🇭" },
  { code: "SY", name: "Syria",                           dial: "+963",  flag: "🇸🇾" },
  { code: "TW", name: "Taiwan",                          dial: "+886",  flag: "🇹🇼" },
  { code: "TJ", name: "Tajikistan",                      dial: "+992",  flag: "🇹🇯" },
  { code: "TZ", name: "Tanzania",                        dial: "+255",  flag: "🇹🇿" },
  { code: "TH", name: "Thailand",                        dial: "+66",   flag: "🇹🇭" },
  { code: "TL", name: "Timor-Leste",                     dial: "+670",  flag: "🇹🇱" },
  { code: "TG", name: "Togo",                            dial: "+228",  flag: "🇹🇬" },
  { code: "TO", name: "Tonga",                           dial: "+676",  flag: "🇹🇴" },
  { code: "TT", name: "Trinidad and Tobago",             dial: "+1868", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia",                         dial: "+216",  flag: "🇹🇳" },
  { code: "TR", name: "Turkey",                          dial: "+90",   flag: "🇹🇷" },
  { code: "TM", name: "Turkmenistan",                    dial: "+993",  flag: "🇹🇲" },
  { code: "TV", name: "Tuvalu",                          dial: "+688",  flag: "🇹🇻" },
  { code: "UG", name: "Uganda",                          dial: "+256",  flag: "🇺🇬" },
  { code: "UA", name: "Ukraine",                         dial: "+380",  flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates",            dial: "+971",  flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom",                  dial: "+44",   flag: "🇬🇧" },
  { code: "US", name: "United States",                   dial: "+1",    flag: "🇺🇸" },
  { code: "UY", name: "Uruguay",                         dial: "+598",  flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan",                      dial: "+998",  flag: "🇺🇿" },
  { code: "VA", name: "Vatican City",                    dial: "+39",   flag: "🇻🇦" },
  { code: "VU", name: "Vanuatu",                         dial: "+678",  flag: "🇻🇺" },
  { code: "VE", name: "Venezuela",                       dial: "+58",   flag: "🇻🇪" },
  { code: "VN", name: "Vietnam",                         dial: "+84",   flag: "🇻🇳" },
  { code: "YE", name: "Yemen",                           dial: "+967",  flag: "🇾🇪" },
  { code: "ZM", name: "Zambia",                          dial: "+260",  flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe",                        dial: "+263",  flag: "🇿🇼" },
  { code: "KP", name: "North Korea",                     dial: "+850",  flag: "🇰🇵" },
  { code: "KR", name: "South Korea",                     dial: "+82",   flag: "🇰🇷" },
];

const ET = COUNTRIES[0];

function filterCountries(q: string) {
  const lq = q.toLowerCase();
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(lq) || c.code.toLowerCase().includes(lq) || c.dial.includes(lq)
  );
}

export default function AuthPage() {
  const { user, isLoading, login } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const [, setLocation] = useLocation();

  const [toggled, setToggled] = useState(false);

  // Login state
  const [loginC, setLoginC] = useState<Country>(ET);
  const [loginType, setLoginType] = useState<"phone" | "email">("phone");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginPhoneErr, setLoginPhoneErr] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginPhoneFocused, setLoginPhoneFocused] = useState(false);

  // Register state
  const [regC, setRegC] = useState<Country>(ET);
  const [regType, setRegType] = useState<"phone" | "email">("phone");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regRef, setRegRef] = useState("");
  const [regNationality, setRegNationality] = useState("ET");
  const [regPhoneErr, setRegPhoneErr] = useState(false);
  const [regErr, setRegErr] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regPhoneFocused, setRegPhoneFocused] = useState(false);

  // Turnstile state
  const [loginTurnstileToken, setLoginTurnstileToken] = useState("");
  const [regTurnstileToken, setRegTurnstileToken] = useState("");
  const [loginTurnstileError, setLoginTurnstileError] = useState(false);
  const [regTurnstileError, setRegTurnstileError] = useState(false);
  const loginTurnstileRef = useRef<TurnstileInstance>(null);
  const regTurnstileRef = useRef<TurnstileInstance>(null);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpErr, setOtpErr] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [devCodeActive, setDevCodeActive] = useState(false);
  const [otpMethod, setOtpMethod] = useState<"telegram" | "sms" | "email" | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Country modal (top pill)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState<"login" | "reg">("login");
  const [modalSearch, setModalSearch] = useState("");
  const [loginPillOpen, setLoginPillOpen] = useState(false);
  const [regPillOpen, setRegPillOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Phone prefix inline dropdown
  const [loginPrefixOpen, setLoginPrefixOpen] = useState(false);
  const [regPrefixOpen, setRegPrefixOpen] = useState(false);
  const [loginPrefixSearch, setLoginPrefixSearch] = useState("");
  const [regPrefixSearch, setRegPrefixSearch] = useState("");
  const [loginDropRect, setLoginDropRect] = useState<DOMRect | null>(null);
  const [regDropRect, setRegDropRect] = useState<DOMRect | null>(null);
  const loginPrefixRef = useRef<HTMLDivElement>(null);
  const regPrefixRef = useRef<HTMLDivElement>(null);
  const loginPrefixSearchRef = useRef<HTMLInputElement>(null);
  const regPrefixSearchRef = useRef<HTMLInputElement>(null);

  // Nationality inline dropdown (email registration)
  const [regNatOpen, setRegNatOpen] = useState(false);
  const [regNatSearch, setRegNatSearch] = useState("");
  const [regNatDropRect, setRegNatDropRect] = useState<DOMRect | null>(null);
  const regNatRef = useRef<HTMLDivElement>(null);
  const regNatSearchRef = useRef<HTMLInputElement>(null);
  const regNationalityCountry = COUNTRIES.find(c => c.code === regNationality) ?? ET;

  useEffect(() => {
    if (!isLoading && user) {
      const params = new URLSearchParams(window.location.search);
      const dest = params.get("redirect") || localStorage.getItem("redirect_after_auth") || "/wallet";
      localStorage.removeItem("redirect_after_auth");
      setLocation(dest);
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { closeModal(); setLoginPrefixOpen(false); setRegPrefixOpen(false); setRegNatOpen(false); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Click-outside for prefix dropdowns
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // The prefix dropdowns are rendered via a portal into document.body, so
      // they are not DOM descendants of loginPrefixRef/regPrefixRef. Without
      // this check, this outside-click handler would treat every click inside
      // the portaled dropdown as "outside" and close it before the item's own
      // onClick (selection) had a chance to fire.
      const insidePrefixDropdown = !!target.closest?.(".prefix-dropdown");
      const insideNatDropdown = !!target.closest?.(".prefix-dropdown.nat-dropdown");
      if (
        loginPrefixRef.current &&
        !loginPrefixRef.current.contains(target) &&
        !insidePrefixDropdown
      ) {
        setLoginPrefixOpen(false);
        setLoginPrefixSearch("");
      }
      if (
        regPrefixRef.current &&
        !regPrefixRef.current.contains(target) &&
        !insidePrefixDropdown
      ) {
        setRegPrefixOpen(false);
        setRegPrefixSearch("");
      }
      if (
        regNatRef.current &&
        !regNatRef.current.contains(target) &&
        !insideNatDropdown
      ) {
        setRegNatOpen(false);
        setRegNatSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function startCooldown() {
    setOtpCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setOtpCooldown(v => { if (v <= 1) { clearInterval(cooldownRef.current!); return 0; } return v - 1; });
    }, 1000);
  }

  function openModal(ctx: "login" | "reg") {
    setModalCtx(ctx);
    setModalSearch("");
    setModalOpen(true);
    if (ctx === "login") setLoginPillOpen(true);
    else setRegPillOpen(true);
    setTimeout(() => searchRef.current?.focus(), 200);
  }

  function closeModal() {
    setModalOpen(false);
    setLoginPillOpen(false);
    setRegPillOpen(false);
  }

  function pickCountry(code: string) {
    const c = COUNTRIES.find(x => x.code === code)!;
    if (modalCtx === "login") { setLoginC(c); }
    else { setRegC(c); }
    closeModal();
  }

  function pickPrefixCountry(code: string, ctx: "login" | "reg") {
    const c = COUNTRIES.find(x => x.code === code)!;
    if (ctx === "login") {
      setLoginC(c);
      setLoginPrefixOpen(false);
      setLoginPrefixSearch("");
    } else {
      setRegC(c);
      setRegPrefixOpen(false);
      setRegPrefixSearch("");
    }
  }

  function openPrefixDropdown(ctx: "login" | "reg") {
    if (ctx === "login") {
      const rect = loginPrefixRef.current?.getBoundingClientRect() ?? null;
      setLoginDropRect(rect);
      setLoginPrefixOpen(v => !v);
      setLoginPrefixSearch("");
      if (!loginPrefixOpen) setTimeout(() => loginPrefixSearchRef.current?.focus(), 80);
    } else {
      const rect = regPrefixRef.current?.getBoundingClientRect() ?? null;
      setRegDropRect(rect);
      setRegPrefixOpen(v => !v);
      setRegPrefixSearch("");
      if (!regPrefixOpen) setTimeout(() => regPrefixSearchRef.current?.focus(), 80);
    }
  }

  function openNatDropdown() {
    const rect = regNatRef.current?.getBoundingClientRect() ?? null;
    setRegNatDropRect(rect);
    setRegNatOpen(v => !v);
    setRegNatSearch("");
    if (!regNatOpen) setTimeout(() => regNatSearchRef.current?.focus(), 80);
  }

  function pickNationality(code: string) {
    setRegNationality(code);
    setRegNatOpen(false);
    setRegNatSearch("");
  }

  // Auto-detect country from phone number
  function handleLoginPhoneChange(raw: string) {
    let digits = raw.replace(/\D/g, "");
    if (loginC.code === "ET" && digits.startsWith("0") && digits.length > 1) {
      const second = digits[1];
      if (second === "9" || second === "7") digits = digits.slice(1);
      else digits = digits.slice(1);
    }
    const maxLen = loginC.code === "ET" ? 9 : 15;
    setLoginPhone(digits.slice(0, maxLen));
  }

  function handleRegPhoneChange(raw: string) {
    let digits = raw.replace(/\D/g, "");
    if (regC.code === "ET" && digits.startsWith("0") && digits.length > 1) {
      const second = digits[1];
      if (second === "9" || second === "7") digits = digits.slice(1);
      else digits = digits.slice(1);
    }
    const maxLen = regC.code === "ET" ? 9 : 15;
    setRegPhone(digits.slice(0, maxLen));
  }

  const filteredCountries = COUNTRIES.filter(c => {
    const q = modalSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dial.includes(q);
  });

  function getOtpTarget() {
    return regType === "phone" ? `${regC.dial}${regPhone}` : regEmail;
  }

  async function doLogin() {
    setLoginErr("");
    if (loginType === "phone" && loginC.code === "ET" && !/^[97]\d{8}$/.test(loginPhone)) {
      setLoginPhoneErr(true);
      return;
    }
    setLoginPhoneErr(false);
    const identifier = loginType === "phone" ? loginPhone : loginEmail;
    if (!identifier || !loginPwd) { setLoginErr("Please fill in all fields"); return; }

    setLoginLoading(true);
    try {
      if (loginType === "email") {
        try {
          await adminLogin(identifier, loginPwd);
          setLocation("/admin/dashboard");
          return;
        } catch { }
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: loginPwd, country: loginC.code, dialCode: loginC.dial, type: loginType, turnstileToken: loginTurnstileToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginErr(data.error || "Login failed");
        loginTurnstileRef.current?.reset();
        setLoginTurnstileToken("");
        return;
      }
      login(data.token, data.user);
      const params = new URLSearchParams(window.location.search);
      const dest = params.get("redirect") || localStorage.getItem("redirect_after_auth") || "/wallet";
      localStorage.removeItem("redirect_after_auth");
      setLocation(dest);
    } catch {
      setLoginErr("Network error. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function doSendCode() {
    setRegErr("");
    setOtpErr("");
    if (regType === "phone" && regC.code === "ET" && !/^[97]\d{8}$/.test(regPhone)) {
      setRegPhoneErr(true);
      return;
    }
    setRegPhoneErr(false);
    const identifier = regType === "phone" ? regPhone : regEmail;
    if (!identifier || !regPwd || !regUser) { setRegErr("Please fill in all required fields"); return; }
    if (regType === "email" && !regNationality) { setRegErr("Please select your nationality"); return; }
    if (regPwd.length < 6) { setRegErr("Password must be at least 6 characters"); return; }
    if (regUser.length < 3) { setRegErr("Username must be at least 3 characters"); return; }

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: getOtpTarget(), type: regType, turnstileToken: regTurnstileToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegErr(data.error || "Failed to send code");
        regTurnstileRef.current?.reset();
        setRegTurnstileToken("");
        return;
      }
      setOtpStep(true);
      setOtpMethod(data.method ?? null);
      if (data.devCode) { setOtpCode(data.devCode); setDevCodeActive(true); }
      else { setOtpCode(""); setDevCodeActive(false); }
      startCooldown();
    } catch {
      setRegErr("Network error. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function doResendCode() {
    if (otpCooldown > 0) return;
    setOtpErr("");
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: getOtpTarget(), type: regType }),
      });
      if (res.ok) {
        const d = await res.json();
        setOtpMethod(d.method ?? null);
        if (d.devCode) { setOtpCode(d.devCode); setDevCodeActive(true); }
        startCooldown();
      } else { const d = await res.json(); setOtpErr(d.error || "Failed to resend"); }
    } catch { setOtpErr("Network error."); }
    finally { setOtpLoading(false); }
  }

  async function doVerifyAndRegister() {
    setOtpErr("");
    if (otpCode.length !== 6) { setOtpErr("Enter the 6-digit code"); return; }
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: regType === "phone" ? regPhone : regEmail,
          password: regPwd,
          username: regUser,
          country: regType === "phone" ? regC.code : regNationality,
          dialCode: regC.dial,
          type: regType,
          referral: regRef || undefined,
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.toLowerCase().includes("code")) setOtpErr(data.error);
        else { setRegErr(data.error || "Registration failed"); setOtpStep(false); }
        return;
      }
      login(data.token, data.user);
      const params = new URLSearchParams(window.location.search);
      const dest = params.get("redirect") || localStorage.getItem("redirect_after_auth") || "/wallet";
      localStorage.removeItem("redirect_after_auth");
      setLocation(dest);
    } catch { setOtpErr("Network error. Please try again."); }
    finally { setRegLoading(false); }
  }

  if (isLoading) {
    return <div className="auth-root"><div style={{ color: "#00e5ff", fontSize: 14 }}>Loading…</div></div>;
  }

  return (
    <div className="auth-root">
      {/* Country Modal (top pill) */}
      <div className={`country-modal-overlay${modalOpen ? " open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="country-modal">
          <div className="modal-header">
            <h3>Select Country</h3>
            <button className="modal-close" onClick={closeModal}><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="modal-search">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input ref={searchRef} type="text" placeholder="Search by name or dial code…" value={modalSearch} onChange={e => setModalSearch(e.target.value)} />
            </div>
          </div>
          <div className="modal-list">
            {filteredCountries.length === 0
              ? <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 13 }}>No countries found</div>
              : filteredCountries.map(c => {
                const cur = modalCtx === "login" ? loginC : regC;
                return (
                  <div key={c.code} className={`modal-item${cur.code === c.code ? " active" : ""}`} onClick={() => pickCountry(c.code)}>
                    <img className="m-flag" src={`https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`} alt={c.name} />
                    <div className="m-info"><div className="m-name">{c.name}</div><div className="m-iso">{c.code}</div></div>
                    <span className="m-dial">{c.dial}</span>
                    <i className="fa-solid fa-check m-check"></i>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="auth-logo"><img src="/src/assets/logo-banner.svg" alt="Xendrx" height={44} style={{ display: 'block' }} /></div>

      {/* Auth Wrapper */}
      <div className={`auth-wrapper${toggled ? " toggled" : ""}`}>
        <div className="background-shape"></div>
        <div className="secondary-shape"></div>

        {/* ══ LOGIN PANEL ══ */}
        <div className="credentials-panel signin">
          <h2 className="slide-element">Login</h2>

          <div className="input-tabs slide-element">
            <button className={loginType === "phone" ? "active" : ""} onClick={() => setLoginType("phone")}>
              <span className="tab-icon">📱</span><span className="tab-label">Phone</span>
            </button>
            <button className={loginType === "email" ? "active" : ""} onClick={() => setLoginType("email")}>
              <span className="tab-icon">✉️</span><span className="tab-label">Email</span>
            </button>
          </div>

          {loginType === "phone" && (
            <div className="phone-row-wrap slide-element">
              <div className="phone-row-label">Phone Number</div>
              <div className={`phone-row${loginPhoneFocused ? " focused" : ""}`}>
                <div ref={loginPrefixRef} className="phone-prefix-wrap">
                  <div
                    className={`phone-prefix clickable${loginPrefixOpen ? " prefix-active" : ""}`}
                    onClick={() => openPrefixDropdown("login")}
                    title="Change country"
                  >
                    <img className="pf-flag" src={`https://flagcdn.com/20x15/${loginC.code.toLowerCase()}.png`} alt={loginC.name} />
                    <span className="pf-code">{loginC.dial}</span>
                    <i className="fa-solid fa-chevron-down pf-caret"></i>
                  </div>
                  {loginPrefixOpen && loginDropRect && createPortal(
                    <div className="prefix-dropdown" style={{ position: "fixed", top: loginDropRect.bottom + 6, left: loginDropRect.left, zIndex: 99999 }}>
                      <div className="prefix-search">
                        <i className="fa-solid fa-magnifying-glass"></i>
                        <input
                          ref={loginPrefixSearchRef}
                          type="text"
                          placeholder="Search…"
                          value={loginPrefixSearch}
                          onChange={e => setLoginPrefixSearch(e.target.value)}
                        />
                      </div>
                      <div className="prefix-list">
                        {filterCountries(loginPrefixSearch).map(c => (
                          <div
                            key={c.code}
                            className={`prefix-item${loginC.code === c.code ? " active" : ""}`}
                            onClick={() => pickPrefixCountry(c.code, "login")}
                          >
                            <img className="pi-flag" src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`} alt={c.name} />
                            <span className="pi-name">{c.name}</span>
                            <span className="pi-dial">{c.dial}</span>
                          </div>
                        ))}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
                <input
                  type="tel"
                  placeholder={loginC.code === "ET" ? "9XX XXX XXXX" : "Phone number"}
                  value={loginPhone}
                  onChange={e => handleLoginPhoneChange(e.target.value)}
                  onFocus={() => setLoginPhoneFocused(true)}
                  onBlur={() => setLoginPhoneFocused(false)}
                />
                <i className="fa-solid fa-phone"></i>
              </div>
              <div className={`auth-err${loginPhoneErr ? " show" : ""}`}>{loginC.code === "ET" ? "Ethiopian number must start with 9 or 7" : "Invalid phone number"}</div>
            </div>
          )}

          {loginType === "email" && (
            <div className="field-wrapper slide-element">
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              <label>Email Address</label>
              <i className="fa-solid fa-envelope"></i>
            </div>
          )}

          <div className="field-wrapper slide-element">
            <input type={showLoginPwd ? "text" : "password"} value={loginPwd} onChange={e => setLoginPwd(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} required />
            <label>Password</label>
            <button type="button" onClick={() => setShowLoginPwd(v => !v)} style={{ position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center" }}>
              {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="forgot slide-element"><a href="/forgot-password" style={{ color: '#00e5ff', textDecoration: 'none' }}>Forgot password?</a></div>

          {TURNSTILE_SITE_KEY && (
            <div className="slide-element" style={{ width: "100%", margin: "6px 0 2px" }}>
              <Turnstile
                ref={loginTurnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => { setLoginTurnstileToken(token); setLoginTurnstileError(false); }}
                onExpire={() => { setLoginTurnstileToken(""); loginTurnstileRef.current?.reset(); }}
                onError={() => { setLoginTurnstileToken(""); loginTurnstileRef.current?.reset(); }}
                options={{ theme: "dark", size: "flexible", appearance: "always", retry: "auto", retryInterval: 500 }}
                style={{ width: "100%" }}
              />
            </div>
          )}

          <div className="slide-element">
            <button
              className="submit-btn"
              onClick={doLogin}
              disabled={loginLoading || (!!TURNSTILE_SITE_KEY && !loginTurnstileToken && !loginTurnstileError)}
            >
              {loginLoading ? "Logging in…" : "Login"}
            </button>
            {loginErr && <div className="server-err">{loginErr}</div>}
          </div>

          <div className="switch-link slide-element">
            Don't have an account? <a onClick={() => { setToggled(true); setOtpStep(false); setOtpCode(""); setRegErr(""); }}>Sign Up</a>
          </div>
        </div>

        {/* Welcome right */}
        <div className="welcome-section signin">
          <h2 className="slide-element">WELCOME<br />BACK!</h2>
          <p className="slide-element">Trade crypto safely with Xendrx</p>
        </div>

        {/* ══ REGISTER PANEL ══ */}
        <div className="credentials-panel signup">
          {!otpStep ? (
            <>
              <h2 className="slide-element">Register</h2>

              <div className="input-tabs slide-element">
                <button className={regType === "phone" ? "active" : ""} onClick={() => setRegType("phone")}>
                  <span className="tab-icon">📱</span><span className="tab-label">Phone</span>
                </button>
                <button className={regType === "email" ? "active" : ""} onClick={() => setRegType("email")}>
                  <span className="tab-icon">✉️</span><span className="tab-label">Email</span>
                </button>
              </div>

              {regType === "phone" && (
                <div className="phone-row-wrap slide-element">
                  <div className="phone-row-label">Phone Number</div>
                  <div className={`phone-row${regPhoneFocused ? " focused" : ""}`}>
                    <div ref={regPrefixRef} className="phone-prefix-wrap">
                      <div
                        className={`phone-prefix clickable${regPrefixOpen ? " prefix-active" : ""}`}
                        onClick={() => openPrefixDropdown("reg")}
                        title="Change country"
                      >
                        <img className="pf-flag" src={`https://flagcdn.com/20x15/${regC.code.toLowerCase()}.png`} alt={regC.name} />
                        <span className="pf-code">{regC.dial}</span>
                        <i className="fa-solid fa-chevron-down pf-caret"></i>
                      </div>
                      {regPrefixOpen && regDropRect && createPortal(
                        <div className="prefix-dropdown" style={{ position: "fixed", top: regDropRect.bottom + 6, left: regDropRect.left, zIndex: 99999 }}>
                          <div className="prefix-search">
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <input
                              ref={regPrefixSearchRef}
                              type="text"
                              placeholder="Search…"
                              value={regPrefixSearch}
                              onChange={e => setRegPrefixSearch(e.target.value)}
                            />
                          </div>
                          <div className="prefix-list">
                            {filterCountries(regPrefixSearch).map(c => (
                              <div
                                key={c.code}
                                className={`prefix-item${regC.code === c.code ? " active" : ""}`}
                                onClick={() => pickPrefixCountry(c.code, "reg")}
                              >
                                <img className="pi-flag" src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`} alt={c.name} />
                                <span className="pi-name">{c.name}</span>
                                <span className="pi-dial">{c.dial}</span>
                              </div>
                            ))}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                    <input
                      type="tel"
                      placeholder={regC.code === "ET" ? "9XX XXX XXXX" : "Phone number"}
                      value={regPhone}
                      onChange={e => handleRegPhoneChange(e.target.value)}
                      onFocus={() => setRegPhoneFocused(true)}
                      onBlur={() => setRegPhoneFocused(false)}
                    />
                    <i className="fa-solid fa-phone"></i>
                  </div>
                  <div className={`auth-err${regPhoneErr ? " show" : ""}`}>{regC.code === "ET" ? "Ethiopian number must start with 9 or 7" : "Invalid phone number"}</div>
                </div>
              )}

              {regType === "email" && (
                <>
                  <div className="field-wrapper slide-element">
                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    <label>Email Address</label>
                    <i className="fa-solid fa-envelope"></i>
                  </div>
                  <div className="slide-element nat-wrap" ref={regNatRef}>
                    <div className="nat-label">Nationality <span className="nat-required">*</span></div>
                    <div
                      className={`phone-prefix clickable nat-trigger${regNatOpen ? " prefix-active" : ""}`}
                      onClick={openNatDropdown}
                      style={{ width: "100%", justifyContent: "space-between" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <img className="pf-flag" src={`https://flagcdn.com/20x15/${regNationalityCountry.code.toLowerCase()}.png`} alt={regNationalityCountry.name} />
                        <span className="pf-code">{regNationalityCountry.name} ({regNationalityCountry.code})</span>
                      </span>
                      <i className="fa-solid fa-chevron-down pf-caret"></i>
                    </div>
                    {regNatOpen && regNatDropRect && createPortal(
                      <div className="prefix-dropdown nat-dropdown" style={{ position: "fixed", top: regNatDropRect.bottom + 6, left: regNatDropRect.left, width: regNatDropRect.width, zIndex: 99999 }}>
                        <div className="prefix-search">
                          <i className="fa-solid fa-magnifying-glass"></i>
                          <input
                            ref={regNatSearchRef}
                            type="text"
                            placeholder="Search…"
                            value={regNatSearch}
                            onChange={e => setRegNatSearch(e.target.value)}
                          />
                        </div>
                        <div className="prefix-list">
                          {filterCountries(regNatSearch).map(c => (
                            <div
                              key={c.code}
                              className={`prefix-item${regNationality === c.code ? " active" : ""}`}
                              onClick={() => pickNationality(c.code)}
                            >
                              <img className="pi-flag" src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`} alt={c.name} />
                              <span className="pi-name">{c.name}</span>
                              <span className="pi-dial">{c.code}</span>
                            </div>
                          ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </>
              )}

              <div className="field-wrapper slide-element">
                <input type="text" value={regUser} onChange={e => setRegUser(e.target.value)} required />
                <label>Username</label>
                <i className="fa-solid fa-user"></i>
              </div>

              <div className="field-wrapper slide-element">
                <input type={showRegPwd ? "text" : "password"} value={regPwd} onChange={e => setRegPwd(e.target.value)} required />
                <label>Password</label>
                <button type="button" onClick={() => setShowRegPwd(v => !v)} style={{ position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center" }}>
                  {showRegPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="field-wrapper slide-element">
                <input type="text" value={regRef} onChange={e => setRegRef(e.target.value)} />
                <label>Referral Code (optional)</label>
                <i className="fa-solid fa-gift"></i>
              </div>

              {TURNSTILE_SITE_KEY && (
                <div className="slide-element" style={{ width: "100%", margin: "6px 0 2px" }}>
                  <Turnstile
                    ref={regTurnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    onSuccess={(token) => { setRegTurnstileToken(token); setRegTurnstileError(false); }}
                    onExpire={() => { setRegTurnstileToken(""); regTurnstileRef.current?.reset(); }}
                    onError={() => { setRegTurnstileToken(""); regTurnstileRef.current?.reset(); }}
                    options={{ theme: "dark", size: "flexible", appearance: "always", retry: "auto", retryInterval: 500 }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}

              <div className="slide-element">
                <button
                  className="submit-btn"
                  onClick={doSendCode}
                  disabled={otpLoading || (regType === "email" && !regNationality) || (!!TURNSTILE_SITE_KEY && !regTurnstileToken && !regTurnstileError)}
                >
                  {otpLoading ? "Sending code…" : (regType === "phone" ? "📱 Send SMS Code" : "✉️ Send Email Code")}
                </button>
                {regErr && <div className="server-err">{regErr}</div>}
              </div>

              <div className="switch-link slide-element">
                Already have an account? <a onClick={() => setToggled(false)}>Sign In</a>
              </div>
            </>
          ) : (
            <>
              <h2 className="slide-element">Verify</h2>
              <p className="slide-element" style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 8 }}>
                {otpMethod === 'telegram'
                  ? `📨 We sent a code to your Telegram. Open the Telegram app to view it.`
                  : otpMethod === 'sms'
                  ? `📱 Code sent via SMS to ${regC.dial} ${regPhone}`
                  : otpMethod === 'email'
                  ? `📧 Code sent to ${regEmail}`
                  : regType === "phone" ? `Code sent to ${regC.dial} ${regPhone}` : `Code sent to ${regEmail}`}
              </p>

              {devCodeActive && (
                <div className="slide-element" style={{ background: "rgba(255,193,7,0.12)", border: "1px solid rgba(255,193,7,0.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 4, fontSize: 12, color: "#ffc107" }}>
                  ⚡ Dev mode — code auto-filled: <strong>{otpCode}</strong>
                </div>
              )}

              <div className="otp-input-wrap slide-element">
                <input className="otp-input" type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                  value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && doVerifyAndRegister()} autoFocus />
              </div>

              <div className="slide-element">
                <button className="submit-btn" onClick={doVerifyAndRegister} disabled={regLoading}>
                  {regLoading ? "Verifying…" : "Verify & Create Account"}
                </button>
                {otpErr && <div className="server-err">{otpErr}</div>}
              </div>

              <div className="otp-resend slide-element">
                {otpCooldown > 0 ? <span>Resend in {otpCooldown}s</span> : <a onClick={doResendCode}>Resend code</a>}
              </div>

              <div className="switch-link slide-element">
                <a onClick={() => { setOtpStep(false); setOtpErr(""); setRegErr(""); }}>
                  <i className="fa-solid fa-arrow-left" style={{ marginRight: 5, fontSize: 10 }}></i>Back
                </a>
              </div>
            </>
          )}
        </div>

        {/* Welcome left */}
        <div className="welcome-section signup">
          <h2 className="slide-element">JOIN<br />XENDRX!</h2>
          <p className="slide-element">Fast &amp; secure P2P exchange</p>
        </div>
      </div>
    </div>
  );
}
