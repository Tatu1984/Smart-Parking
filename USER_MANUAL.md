# SParking - User Manual

## AI-Powered Smart Parking Management System

**Version:** 2.2
**Last Updated:** February 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Parking Lot Management](#4-parking-lot-management)
5. [Zone Management](#5-zone-management)
6. [Slot Management](#6-slot-management)
7. [Camera Management](#7-camera-management)
8. [Token & Session Management](#8-token--session-management)
9. [Vehicle Management](#9-vehicle-management)
10. [Payment & Wallet System](#10-payment--wallet-system)
11. [Analytics & Reports](#11-analytics--reports)
12. [Settings & User Management](#12-settings--user-management)
13. [Find My Car](#13-find-my-car)
14. [Mobile App Guide](#14-mobile-app-guide)
15. [Troubleshooting & FAQ](#15-troubleshooting--faq)

---

## 1. Introduction

SParking is an AI-powered smart parking management system designed for parking facilities of all sizes, from small lots to large multi-level commercial structures. The system provides real-time occupancy tracking, automated vehicle detection, intelligent slot allocation, secure payment processing, and comprehensive analytics.

### Who Is This For?

| Role | What You Can Do |
|------|-----------------|
| **Super Admin** | Full system access, manage organizations and global settings |
| **Admin** | Manage parking lots, zones, cameras, users, and view all reports |
| **Manager** | Manage operations, tokens, vehicles, and view reports |
| **Operator** | Handle daily entry/exit, tokens, and payments |
| **Finance** | View payments, transactions, and financial reports |
| **Viewer** | View dashboard and read-only access to all data |
| **Customer** | Use mobile app for parking, vehicles, and payments |

### Supported Browsers

- Google Chrome 90+
- Mozilla Firefox 90+
- Microsoft Edge 90+
- Safari 14+

---

## 2. Getting Started

### 2.1 Accessing the System

Open your web browser and navigate to your SParking instance URL (e.g., `https://your-domain.com`).

### 2.2 Logging In

1. On the login page, enter your **email** and **password**
2. Click **Sign In**
3. Alternatively, click **Sign in with Microsoft** to use your Microsoft/Azure AD account

After successful login, you will be redirected to the **Dashboard**.

### 2.3 First-Time Setup

If you are an Admin setting up the system for the first time:

1. **Create an Organization** - Set your company name, logo, and contact details
2. **Add a Parking Lot** - Define your first parking facility
3. **Create Zones** - Organize your lot into zones (General, VIP, EV Charging, etc.)
4. **Add Slots** - Define individual parking slots (use bulk creation for efficiency)
5. **Set Pricing Rules** - Configure pricing models for each zone
6. **Add Cameras** - Connect RTSP cameras for AI detection (optional)
7. **Invite Users** - Add operators and other team members

### 2.4 Forgot Password

1. Click **Forgot Password?** on the login page
2. Enter your registered email address
3. Check your email for a password reset link
4. Follow the link to set a new password

---

## 3. Dashboard Overview

The main dashboard provides a real-time overview of your parking operations.

### 3.1 Key Metrics

The top of the dashboard displays key statistics:

| Metric | Description |
|--------|-------------|
| **Total Slots** | Total number of parking slots across all lots |
| **Occupied** | Currently occupied slots |
| **Available** | Currently available slots |
| **Occupancy Rate** | Percentage of slots occupied |
| **Active Tokens** | Number of vehicles currently parked |
| **Today's Revenue** | Total revenue collected today |

### 3.2 Occupancy Chart

An interactive line/bar chart showing occupancy trends over time. You can toggle between:
- **Today** - Hourly breakdown
- **This Week** - Daily breakdown
- **This Month** - Daily breakdown

### 3.3 Zone Occupancy

A breakdown of occupancy by zone, showing:
- Zone name and type
- Current occupancy count
- Capacity and fill percentage
- Color-coded status indicator

### 3.4 Recent Activity

A feed of recent events including:
- Vehicle entries and exits
- Payment completions
- Camera status changes
- Alert notifications

### 3.5 Navigation

Use the **sidebar** on the left to navigate between sections:
- Dashboard
- Live Monitoring
- Parking Lots
- Zones
- Slots
- Cameras
- Tokens
- Vehicles
- Transactions
- Wallet
- Analytics
- Reports
- Settings

---

## 4. Parking Lot Management

Navigate to **Dashboard > Parking Lots** to manage your parking facilities.

### 4.1 Viewing Parking Lots

The parking lots page displays a list of all facilities with:
- Name and address
- Venue type (Airport, Mall, Hospital, etc.)
- Total capacity and current occupancy
- Status (Active, Maintenance, Closed)

### 4.2 Creating a Parking Lot

1. Click **Add Parking Lot**
2. Fill in the required fields:
   - **Name** - Facility name (e.g., "Main Parking Complex")
   - **Venue Type** - Select from Airport, Mall, Hospital, Stadium, Hotel, Cinema, Residential, Commercial, Government, Other
   - **Address** - Full address
   - **City, State, Country** - Location details
   - **Total Slots** - Planned capacity
   - **Currency** - Default currency (INR, USD, EUR, GBP)
   - **Timezone** - Operating timezone
3. Optional settings:
   - Operating hours (JSON format)
   - EV charging availability
   - Valet service
   - GPS coordinates (latitude/longitude)
4. Click **Create**

### 4.3 Editing a Parking Lot

1. Click on a parking lot from the list
2. Modify any fields
3. Click **Save Changes**

### 4.4 Viewing Lot Status

Each parking lot has a **Status** tab showing:
- Real-time occupancy by zone
- Available vs. occupied slots
- Camera status summary
- Active tokens count

---

## 5. Zone Management

Navigate to **Dashboard > Zones** to organize your parking lots into zones.

### 5.1 Zone Types

| Zone Type | Description |
|-----------|-------------|
| General | Standard parking for all vehicles |
| VIP | Premium parking with extra space |
| EV Charging | Zones with electric vehicle charging stations |
| Disabled | Accessible parking for disabled permit holders |
| Staff | Employee-only parking |
| Visitor | Guest/visitor parking |
| Short-term | Short duration parking (up to 2 hours) |
| Long-term | Extended duration parking (daily/weekly) |
| Two-Wheeler | Motorcycle and scooter parking |
| Valet | Valet-serviced parking |
| Reserved | Pre-reserved parking spaces |

### 5.2 Creating a Zone

1. Click **Add Zone**
2. Select the **Parking Lot** this zone belongs to
3. Fill in:
   - **Name** - Zone display name (e.g., "Zone A - Ground Floor")
   - **Zone Type** - Select from the types above
   - **Floor/Level** - Floor number (0 for ground, 1+ for upper floors, -1 for basement)
   - **Total Slots** - Maximum capacity for this zone
4. Click **Create**

### 5.3 Pricing Rules

Each zone can have its own pricing rules:

| Pricing Model | How It Works |
|---------------|-------------|
| **Flat Rate** | Fixed fee regardless of duration |
| **Hourly** | Per-hour charge with optional peak multiplier |
| **Slab** | Different rates for different time ranges |
| **Dynamic** | AI-adjusted pricing based on demand |
| **Free** | No charge (e.g., first 30 minutes free) |

---

## 6. Slot Management

Navigate to **Dashboard > Slots** to manage individual parking spaces.

### 6.1 Viewing Slots

The slot page shows all slots with:
- Slot number (e.g., A-001)
- Zone assignment
- Type (Standard, Compact, Large, EV, Handicapped, etc.)
- Current status (Available, Occupied, Reserved, Maintenance, Blocked)
- Vehicle type restriction

### 6.2 Creating Slots

**Single Slot:**
1. Click **Add Slot**
2. Select Zone
3. Enter slot number, type, and vehicle type
4. Click **Create**

**Bulk Creation:**
1. Click **Bulk Add**
2. Select Zone
3. Enter:
   - **Prefix** (e.g., "A")
   - **Start Number** (e.g., 1)
   - **Count** (e.g., 50)
   - **Type** and **Vehicle Type**
4. Click **Create** to generate all slots at once (e.g., A-001 through A-050)

### 6.3 Slot Features

Individual slots can be configured with:
- **EV Charger** - Has an electric vehicle charging station
- **Accessible** - ADA/disability accessible
- **Covered** - Has roof coverage
- **Position** - X/Y coordinates for visual map display
- **Detection Bounds** - AI bounding box for camera-based occupancy detection

### 6.4 Updating Slot Status

Manually change slot status:
1. Click on a slot
2. Select new status: Available, Occupied, Reserved, Maintenance, Blocked
3. Click **Update**

> **Note:** When AI detection is active, slot status updates automatically based on camera feeds.

---

## 7. Camera Management

Navigate to **Dashboard > Cameras** to manage CCTV cameras.

### 7.1 Adding a Camera

1. Click **Add Camera**
2. Fill in:
   - **Name** - Camera identifier (e.g., "Entry Gate Camera 1")
   - **Parking Lot** - Assigned facility
   - **Zone** - Optional zone assignment
   - **RTSP URL** - Camera stream URL (e.g., `rtsp://admin:pass@192.168.1.100:554/stream`)
   - **Username/Password** - Camera credentials (stored encrypted)
3. Optional settings:
   - PTZ (Pan-Tilt-Zoom) capability
   - Infrared capability
   - Coverage slots count
   - ONVIF URL for advanced control
4. Click **Save**

### 7.2 Camera Status

| Status | Meaning |
|--------|---------|
| **Online** | Camera is connected and streaming |
| **Offline** | Camera is not reachable |
| **Error** | Camera has an error (check RTSP URL) |
| **Maintenance** | Camera is under maintenance |

### 7.3 Live Viewing

Navigate to **Dashboard > Live** to view live camera feeds:
- Click on a camera card to view its stream
- Streams are delivered as MJPEG or WebRTC
- Snapshots can be captured on demand

### 7.4 AI Detection

When cameras are connected and the AI pipeline is running:
- Vehicles are automatically detected in real-time
- License plates are read using ANPR
- Slot occupancy is updated automatically
- Detection events are logged with timestamps and confidence scores

---

## 8. Token & Session Management

Navigate to **Dashboard > Tokens** to manage parking sessions.

### 8.1 What is a Token?

A **token** represents a single parking session from entry to exit. Each token contains:
- Token number (unique identifier)
- Entry time and exit time
- Vehicle information (license plate, type)
- Allocated slot
- Payment status

### 8.2 Token Types

| Type | Description |
|------|-------------|
| **QR** | QR code generated at entry |
| **RFID** | RFID card/tag scanned at entry |
| **Barcode** | Barcode printed on ticket |
| **ANPR** | Automatic via license plate recognition |
| **Manual** | Manually created by operator |

### 8.3 Creating a Token (Entry)

1. Click **Create Token**
2. Select the **Parking Lot**
3. Enter or scan the **License Plate** (optional for QR/Manual)
4. Select **Vehicle Type** (Car, SUV, Motorcycle, Bus, Truck, Van)
5. Select **Entry Type** (QR, RFID, Barcode, ANPR, Manual)
6. System automatically:
   - Allocates the best available slot
   - Generates a unique token number
   - Opens the entry gate (if connected)
7. Click **Create**

### 8.4 Processing Exit

1. Find the token (search by token number or license plate)
2. Click **Mark Exit**
3. System automatically:
   - Calculates parking duration
   - Computes the fee based on pricing rules
   - Prompts for payment
4. After payment, the slot is released and gate opens

### 8.5 Token Statuses

| Status | Meaning |
|--------|---------|
| **Active** | Vehicle is currently parked |
| **Completed** | Vehicle has exited and payment is complete |
| **Expired** | Token has exceeded maximum parking duration |
| **Lost** | Token was reported as lost |
| **Cancelled** | Token was cancelled by operator |

---

## 9. Vehicle Management

Navigate to **Dashboard > Vehicles** to manage the vehicle registry.

### 9.1 Registering a Vehicle

1. Click **Add Vehicle**
2. Enter:
   - **License Plate** - Vehicle registration number
   - **Vehicle Type** - Car, SUV, Motorcycle, Bus, Truck, Van
   - **Owner Name** - Vehicle owner
   - **Phone** - Contact number
   - **Make & Model** - Vehicle manufacturer and model (optional)
   - **Color** - Vehicle color (optional)
3. Click **Register**

### 9.2 Searching Vehicles

Use the search bar to find vehicles by:
- License plate number
- Owner name
- Phone number

### 9.3 Vehicle Image Search

If the AI pipeline is running with vehicle feature indexing:
1. Navigate to **Vehicles > Image Search**
2. Upload a photo or description of a vehicle
3. The system uses AI to match vehicles based on visual features
4. Results show matching vehicles with confidence scores

### 9.4 Vehicle History

Click on any vehicle to see:
- All past parking sessions (tokens)
- Total parking duration
- Total amount spent
- Frequent parking lots and zones

---

## 10. Payment & Wallet System

### 10.1 Processing Payments

Navigate to **Dashboard > Transactions** to view and manage payments.

**Payment Methods:**
| Method | Description |
|--------|-------------|
| **Cash** | Physical cash payment at counter |
| **UPI** | Scan QR code for UPI payment (Razorpay) |
| **Card** | Credit/debit card payment (Stripe/Razorpay) |
| **Wallet** | Pay from SParking digital wallet |
| **Bank Transfer** | Direct bank transfer |

### 10.2 Digital Wallet

Navigate to **Dashboard > Wallet** to manage the built-in wallet system.

**Wallet Features:**
- View current balance
- Deposit funds via payment gateway
- Transfer money to other users (P2P)
- Pay for parking directly from wallet
- View transaction history

**Depositing Funds:**
1. Go to **Wallet > Deposit**
2. Enter amount
3. Select payment method (UPI, Card, Net Banking)
4. Complete payment through the payment gateway
5. Balance is updated immediately

**P2P Transfer:**
1. Go to **Wallet > Transfer**
2. Enter recipient email or wallet ID
3. Enter amount
4. Add a note (optional)
5. Click **Transfer**

**Payment Requests:**
1. Go to **Wallet > Request**
2. Enter the payer's email
3. Enter amount and description
4. Click **Send Request**
5. The payer receives a notification and can pay via a link

### 10.3 Bank Accounts

**Linking a Bank Account:**
1. Go to **Wallet > Bank Accounts**
2. Click **Add Bank Account**
3. Enter account details (account number, IFSC, account holder name)
4. Complete penny-drop verification (a small test deposit)
5. Account is verified and ready for withdrawals

**Withdrawing Funds:**
1. Go to **Wallet > Withdraw**
2. Select linked bank account
3. Enter amount
4. Click **Withdraw**
5. Processing takes 1-3 business days

### 10.4 Transaction History

All transactions are logged with:
- Date and time
- Type (Payment, Deposit, Withdrawal, Transfer, Refund)
- Amount and currency
- Status (Pending, Completed, Failed, Refunded)
- Reference number

Export transactions to **CSV** or **PDF** using the export buttons.

---

## 11. Analytics & Reports

### 11.1 Analytics Dashboard

Navigate to **Dashboard > Analytics** for comprehensive insights.

**Available Analytics:**

| View | What It Shows |
|------|--------------|
| **Occupancy** | Real-time and historical occupancy rates |
| **Revenue** | Revenue breakdown by day, zone, payment method |
| **Traffic** | Entry/exit patterns by hour and day of week |
| **Zone Performance** | Comparative utilization across zones |
| **Vehicle Distribution** | Breakdown by vehicle type |
| **Peak Hours** | Busiest periods for staffing optimization |
| **Predictive** | AI-based occupancy forecasting |

### 11.2 Filtering Data

Use the filter controls to narrow your view:
- **Date Range** - Select start and end dates
- **Parking Lot** - Filter by facility
- **Zone** - Filter by zone
- **Time Period** - Today, This Week, This Month, Custom

### 11.3 Reports

Navigate to **Dashboard > Reports** to generate and export reports.

**Report Types:**
- Occupancy Report
- Revenue Report
- Transaction Summary
- Vehicle Activity Report
- Zone Utilization Report

**Exporting:**
1. Select report type
2. Set date range and filters
3. Click **Export as CSV** or **Export as PDF**
4. File downloads automatically

---

## 12. Settings & User Management

### 12.1 Organization Settings

Navigate to **Dashboard > Settings** to configure your organization.

**Configurable Settings:**
- Organization name and logo
- Default currency and timezone
- Operating hours
- Feature toggles (EV charging, valet service)
- Branding colors

### 12.2 User Management

Navigate to **Dashboard > Settings > Users** to manage team members.

**Adding a User:**
1. Click **Add User**
2. Enter:
   - **Name** - Full name
   - **Email** - Login email
   - **Password** - Initial password
   - **Role** - Select from Super Admin, Admin, Manager, Operator, Finance, Viewer
3. Optionally assign to specific parking lots
4. Click **Create**

**Editing a User:**
1. Click on a user from the list
2. Modify name, email, role, or status
3. Click **Save**

**Deactivating a User:**
1. Click on the user
2. Set status to **Inactive**
3. The user can no longer log in, but their data is preserved

### 12.3 Session Management

Each user can have up to 5 concurrent sessions (configurable). When the limit is reached, the oldest session is automatically terminated.

View active sessions for any user in the user detail page.

---

## 13. Find My Car

The **Find My Car** feature helps visitors locate their parked vehicle.

### How to Use

1. Navigate to `/find-car` (public access, no login required)
2. Enter your **license plate number** or **token number**
3. The system shows:
   - Parking lot name
   - Zone and floor
   - Slot number
   - Directions to the slot
4. If AI image search is enabled, you can also upload a photo of your car

### For Operators

The Find My Car feature can be:
- Accessed from the dashboard sidebar
- Used at kiosk terminals
- Shared via QR code at entry points

---

## 14. Mobile App Guide

The SParking mobile app is available for iOS and Android, built with Expo/React Native.

### 14.1 Getting Started

1. Download the SParking app from the App Store or Google Play
2. Create an account using **Register** or sign in with existing credentials
3. You'll be assigned the **Customer** role automatically

### 14.2 Adding Vehicles

1. Tap the **Vehicles** tab
2. Tap **Add Vehicle**
3. Enter your license plate, make, model, and color
4. Tap **Save**

### 14.3 Parking Session

**Starting a Session:**
1. Tap **Start Parking**
2. Select a parking lot from the list
3. View available zones and slots
4. Select your vehicle
5. Scan the entry QR code or tap **Create Session**
6. Your session is now active

**Ending a Session:**
1. Go to **Active Session**
2. Tap **End Parking**
3. Review the calculated fee
4. Pay using your wallet or another payment method
5. Session is marked as completed

### 14.4 Wallet

1. Tap the **Wallet** tab
2. View your current balance
3. Tap **Add Money** to deposit funds
4. View transaction history

### 14.5 Notifications

The app sends push notifications for:
- Parking session start/end
- Payment confirmations
- Overstay warnings
- Promotional offers

### 14.6 QR Code Scanning

1. Tap the **Scan QR** button
2. Point your camera at the parking QR code
3. The system validates the code and processes entry/exit

---

## 15. Troubleshooting & FAQ

### Common Issues

**Q: I can't log in**
- Verify your email and password are correct
- Check if your account has been deactivated (contact your admin)
- Try resetting your password via "Forgot Password"
- Clear browser cookies and try again

**Q: Dashboard shows no data**
- Ensure you have at least one parking lot created
- Check that your user is assigned to a parking lot
- Verify your internet connection
- Try refreshing the page

**Q: Camera shows "Offline" status**
- Verify the camera is powered on and connected to the network
- Check the RTSP URL is correct
- Ensure the camera is accessible from the server
- Verify camera credentials (username/password)
- Check if FFmpeg is installed on the server

**Q: Payments are not processing**
- Verify payment gateway credentials (Razorpay/Stripe)
- Check that webhooks are properly configured
- Test using sandbox mode first
- Review transaction status in the Transactions page

**Q: Slots are not updating automatically**
- Ensure the AI pipeline is running and connected
- Check camera status (must be Online)
- Verify detection bounds are configured for slots
- Review detection events in the logs

**Q: Mobile app can't connect**
- Ensure you're using the correct API URL
- Check that your auth token hasn't expired (app should auto-refresh)
- Verify your internet connection
- Try logging out and back in

**Q: Microsoft SSO is not working**
- Verify `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `NEXT_PUBLIC_AZURE_AD_TENANT_ID` are configured
- Ensure the redirect URI is registered as **"Web"** type (NOT "SPA") in Azure AD
- Check that your app's root URL is added as a redirect URI in Azure AD (e.g. `https://myapp.azurewebsites.net`)
- On Azure App Service, verify `WEBSITE_HOSTNAME` or `NEXT_PUBLIC_APP_URL` is set correctly
- If you see "interaction_in_progress" errors, clear browser cache or try incognito mode

### Getting Help

- Contact your system administrator
- Review the Developer Guide for technical details
- Check system logs at **Dashboard > Settings** (Admin only)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open search |
| `Ctrl/Cmd + /` | Toggle sidebar |
| `Esc` | Close dialog/modal |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Token** | A parking session record from entry to exit |
| **Slot** | An individual parking space |
| **Zone** | A group of slots within a parking lot |
| **ANPR** | Automatic Number Plate Recognition |
| **RTSP** | Real-Time Streaming Protocol (camera video) |
| **ONVIF** | Open Network Video Interface Forum (camera standard) |
| **KYC** | Know Your Customer (identity verification for wallets) |
| **P2P** | Peer-to-Peer (wallet transfers between users) |
| **OAuth2** | Open Authorization 2.0 (protocol used for Microsoft login) |
| **PKCE** | Proof Key for Code Exchange (security extension for OAuth2) |
| **SSO** | Single Sign-On |

---

*Last updated: February 2026*
*Version: 2.2*
