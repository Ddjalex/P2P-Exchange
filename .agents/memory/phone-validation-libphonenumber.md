---
name: Phone validation via libphonenumber-js
description: Country-aware phone validation/normalization pattern used across registration, login, and profile phone-verify flows.
---

Use the two-argument form `isValidPhoneNumber(nationalDigits, isoCountryCode)` — not the single-argument form — when the UI already lets the user pick a country. It correctly rejects a number typed in the wrong country's format even when dial codes are shared (e.g. +1 US/Canada) and handles per-country leading trunk zeros (e.g. Ethiopia's `0912345678` vs `912345678`) without per-country special-casing.

**Why:** the previous validation was a single hardcoded regex for one country (Ethiopia); any other country's number was accepted unchecked, causing OTP/account mismatches.

**How to apply:** validate on both ends — client-side for UX (inline error, disable submit) and server-side again before storing/matching (defense in depth, since API routes can be called directly). Always normalize to E.164 before storing/comparing so the OTP `target` written by `/send-code` matches what `/register`, `/login`, and profile phone-verify look up later.
