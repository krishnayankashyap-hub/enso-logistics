<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=280&color=FF6B00&text=ENSO&fontSize=90&fontColor=ffffff&animation=fadeIn&fontAlignY=40&desc=Move%20Anything.%20Waste%20Nothing.&descAlignY=62"/>

<h3>🚚 A Decentralized, Zero-Waste Logistics Network https://enso-platform-one.vercel.app/ </h3>

<p>
Transforming unused vehicle space into an intelligent relay network for farmers, businesses, and supply chains. Milk run Model
</p>

<p>
<img src="https://img.shields.io/badge/React_Native-61DAFB?style=for-the-badge&logo=react&logoColor=white"/>
<img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black"/>
<img src="https://img.shields.io/badge/AI_Relay_Engine_GRoq-FF6B00?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge"/>
</p>

[**click Here - Main Platform "2 portals (Senders and Drivers) in one"**](https://enso-platform-one.vercel.app/) 

</div>

---



## 🌍 Why Enso?

Every day thousands of trucks drive with **unused cargo capacity** while farmers and small businesses struggle to move goods efficiently.

### The Problem

| Traditional Logistics | Impact       |
| --------------------- | ------------ |
| Dedicated Truck       |  High Cost |
| Shared Transport      |  Delays     |
| Produce Waiting       |  Spoilage  |
| Empty Vehicle Space   |  Waste     |

Example - A farmer in Assam shipping tomatoes to Shillong often loses profit before the shipment even arrives.

Meanwhile dozens of vehicles are already travelling the same route with available space.

### The Opportunity

Enso converts those unused kilometers into a live logistics marketplace.

```text
Available Vehicle Space
          ↓
     Relay Engine
          ↓
 Smart Route Matching
          ↓
    Instant Delivery
```

---

## ⚡ The ENSO Ecosystem & Innovations

ENSO is not a traditional delivery app. It is a decentralized, zero-inventory Monorepo consisting of three highly advanced technical layers:

### 1. 👁️ Groq Vision™ Cargo AI (Sender Portal)
Instead of forcing users to manually measure and weigh boxes, we integrated **Groq's LPU-powered `llama-3.2-90b-vision-instruct` model**. 
* Senders open the AR camera interface.
* The AI analyzes the live base64 web-stream.
* It instantly identifies the object, calculates dimensions, and estimates the volumetric weight in real-time.

### 2. 🧠 AI Relay Engine & Route Pooling (Driver Radar)
We don't rely on a single driver for long hauls. Our AI dynamically connects overlapping routes to pass cargo seamlessly like a baton.
* **Route Pooling:** Drivers can scan for multiple overlapping packages along their current trajectory to maximize their earnings per kilometer.
* **Relay Handoffs:** If a driver is only going halfway, they can drop the package at a designated **AI Relay Hub**, automatically triggering a 60-second broadcast to the next driver on that highway stretch.

### 3. 📍 4-Second Uber-Style Telemetry
Using a highly optimized Firebase `onSnapshot` architecture paired with a customized **Leaflet map engine**, the Driver app pushes GPS coordinates every 4 seconds. Senders can watch the driver's truck icon move across their map in true real-time.

---

# ⚡ AI Relay Engine

The heart of Enso.

Our proprietary matching engine continuously scans active transit routes and identifies drivers already travelling toward the destination.

### Features

 Live Driver Discovery

 Route Intelligence

 Real-Time Matching

 Dynamic Pricing

 60-Second Acceptance Window

### Pricing Logic

```text
Distance (Haversine Formula)
            +
Route Optimization
            +
Vehicle Availability
            =
Final Fare
```

### Relay Workflow

```text
Shipment Created
       ↓
Drivers Notified
       ↓
Driver Accepts
       ↓
Pickup
       ↓
Transit
       ↓
Delivered
```

---

#  AR Volumetric Scanner

Instead of typing package dimensions manually:

 Open Camera

 Scan Package

 AI Generates 3D Bounding Box

 Calculate Dimensions

 Estimate Volumetric Weight

### Powered By

* MediaPipe
* Three.js
* Computer Vision
* Real-Time Spatial Tracking

---

# 🌓 Dual Portal System

<table>
<tr>
<td width="50%">

### Sender Portal (https://enso-sender.vercel.app/)
### Driver Radar  (https://enso-driver.vercel.app/)


---

#  Architecture

```text
                    FIREBASE
                    FIRESTORE
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     ▼                   ▼                   ▼

Sender Portal     Relay Engine      Driver Radar

Create Job    →  Route Match   →   Accept Job
               Dynamic Pricing
               Live Tracking
```

---

# 🛠 Tech Stack

| Category       | Technology          |
| -------------- | ------------------- |
| Frontend       | React Native (Expo) |
| Backend        | Firebase            |
| Database       | Firestore           |
| Authentication | Firebase Auth       |
| Maps           | React Native Maps   |
| Geolocation    | Expo Location       |
| AR Engine      | MediaPipe           |
| Visualization  | Three.js            |

---

# ⚙️ Quick Start

**1. Clone the repository:**
```bash
git clone [https://github.com/krishnayankashyap-hub/enso-logistics.git](https://github.com/krishnayankashyap-hub/enso-logistics.git)
cd enso-logistics
2. Install dependencies:

Bash
npm install
3. Run the Sender Portal:

Bash
npm run sender
4. Run the Driver Radar (In a new terminal window):

```bash
npm run driver
```
Note: Ensure you have your Firebase environment configurations set up if testing locally, or simply view our live Vercel deployments.



---

# 🌱 Impact

### For Farmers

✅ Lower Shipping Costs

✅ Faster Deliveries

✅ Reduced Spoilage

### For Drivers

✅ Monetize Empty Space

✅ Additional Revenue

### For The Planet

✅ Fewer Empty Miles

✅ Lower Emissions

✅ Smarter Logistics

---

<div align="center">

🚀 TEAM ASTRANOVA
Built with precision for the FAR AWAY Hackathon.

Krishnayan Kashyap Pathak
💻 Full-Stack Architect & Team Lead

Mazharul Islam Barbhuiya
📈 Business Strategist & Co-Lead



Simplicity is the ultimate sophistication.

# 🟠 ENSO

### Move Anything. Waste Nothing.

**Building the future of decentralized logistics.**

⭐ Star this repository if you believe logistics should be smarter, greener, and more efficient.

</div>
