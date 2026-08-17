# Crewly — Google Play Store Data Safety Answers

> Use this as a reference when filling out the **Data Safety** form in Google Play Console.
> Path: Google Play Console → Your App → Policy → App content → Data safety

---

## Does your app collect or share any of the required user data types?

**Yes**

---

## Data Collection & Sharing Table

| Data Type | Collected? | Shared? | Purpose | Optional? |
|-----------|-----------|---------|---------|-----------|
| **Name** | ✅ Yes | ❌ No | Account management, app functionality | No — required for account |
| **Email address** | ✅ Yes | ❌ No | Account management, authentication | No — required for login |
| **Phone number** | ❌ No | — | — | — |
| **Address** | ❌ No | — | — | — |
| **Photos** | ✅ Yes | ❌ No | App functionality (receipt images, work progress photos) | Yes — user chooses to attach |
| **Videos** | ❌ No | — | — | — |
| **Precise location** | ❌ No | — | — | — |
| **Approximate location** | ❌ No | — | — | — |
| **Contacts** | ❌ No | — | — | — |
| **Financial info (purchases)** | ✅ Yes | ❌ No | App functionality (material purchases, payments, petty cash) | No — core feature |
| **App interactions** | ✅ Yes | ❌ No | App functionality (daily reports, task verifications) | No — core feature |
| **Device or other IDs** | ✅ Yes | ✅ Yes (Firebase) | Push notifications via FCM | Yes — can disable notifications |

---

## Security Practices

| Question | Answer |
|----------|--------|
| Is all data encrypted in transit? | **Yes** — HTTPS/TLS for API communication |
| Is data encrypted at rest? | **Yes** — Auth tokens in Secure Store (encrypted); local DB is SQLite |
| Can users request data deletion? | **Yes** — Contact admin or email privacy@3hgroup.com |
| Is data transferred to third parties? | **Only** Firebase Cloud Messaging (Google) for push notification delivery |

---

## Detailed Answers for Each Section

### Personal Info
- **Name**: Collected. Used for account management and display in app. Not shared externally.
- **Email**: Collected. Used for authentication (login). Not shared externally.

### Photos and Videos  
- **Photos**: Collected when user voluntarily attaches receipt images or work progress photos. Stored on our servers. Not shared with third parties.

### Financial Info
- **Purchase history**: The app tracks material purchases, payments, and petty cash for construction project management. This is core business data, not personal shopping history. Not shared externally.

### App Activity
- **App interactions**: We store daily reports, task verifications, material orders, and team coordination data. This is the core functionality of the app.

### Device or Other IDs
- **Device token (FCM)**: Collected for push notification delivery via Firebase Cloud Messaging. Shared with Google (Firebase) solely for notification delivery. Users can opt out via notification preferences in the app.

---

## Content Rating Questionnaire Answers

| Question | Answer |
|----------|--------|
| Violence | None |
| Sexual content | None |
| Language | None |
| Controlled substances | None |
| User-generated content shared with others? | No (data is organization-internal) |
| Does the app allow purchases? | No |
| Does the app share user location? | No |
| Does the app contain ads? | No |

**Recommended rating**: PEGI 3 / Everyone

---

## Play Store Listing Checklist

- [ ] **App title**: Crewly — Construction Management
- [ ] **Short description** (80 chars): Manage construction crews, daily reports, materials & payments — even offline.
- [ ] **Full description**: *(see below)*
- [ ] **Privacy Policy URL**: Host `privacy-policy.html` and paste the URL
- [ ] **Feature graphic**: 1024×500 PNG/JPEG
- [ ] **App icon**: 512×512 PNG (use 3h-logo)
- [ ] **Screenshots**: At least 2 phone screenshots per supported device type
- [ ] **Category**: Business
- [ ] **Content rating**: Complete the questionnaire above
- [ ] **Data safety**: Fill using the table above
- [ ] **Target audience**: 18+ (business/professional use)

### Suggested Full Description

```
Crewly is the all-in-one construction management app built for teams that work on-site.

🏗️ DAILY REPORTS
Submit daily attendance, work progress, and task updates from the field — even without internet. Data syncs automatically when you're back online.

📦 MATERIALS & PURCHASES
Request materials, track purchases, attach receipt photos, and manage your supply chain in real time.

💰 PAYMENTS & PETTY CASH
Process wages, milestone payments, and lump-sum installments. Track petty cash floats and reconcile expenses.

👷 TEAM COORDINATION
Assign teams to project sites, verify completed tasks, and get instant notifications about site activity.

📊 COST TRACKING
Owners and accountants get full visibility into project budgets vs. actual spend, broken down by category.

🔔 SMART NOTIFICATIONS
Automatic alerts for overdue materials, idle teams, unverified tasks, and more — with optional push notifications.

📱 WORKS OFFLINE
Built with offline-first architecture. Your data is stored locally and syncs seamlessly when connectivity returns.

4 ROLES, 1 APP:
• Owner — Full project oversight, budgets, user management
• Super Supervisor — Live monitoring, task verification, team coordination
• Site Supervisor — Daily reports, material requests, petty cash
• Accountant — Payment processing, purchase review, cost reports

Built by 3H Group for construction teams that move fast.
```
