import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
  Animated,
  Easing,
  ScrollView,
  Keyboard,
  Linking,
  Image,
  Vibration,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  GeoPoint,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config/firebaseConfig';

const { height } = Dimensions.get('window');


const C = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  black: '#0A0A0A',
  charcoal: '#171717',
  line: '#262626',
  gray700: '#404040',
  gray500: '#737373',
  gray400: '#A3A3A3',
  white: '#FFFFFF',
};

// Fallback pickup point if GPS is unavailable (Guwahati)
const FALLBACK_COORDS = { latitude: 26.1445, longitude: 91.7362 };

const ACTIVE_STATUSES = ['searching', 'accepted', 'picked_up'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ==========================================
// MILK-RUN LINE STOPS (ALL-INDIA RELAY NETWORK)
// Nodes activate dynamically based on driver trajectories.
// ==========================================
const HIGHWAY_STOPS = [
  // ---- NH-27 · Guwahati – Upper Assam line ----
  { name: 'Guwahati (ISBT)', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.1207, longitude: 91.6517 },
  { name: 'Jorabat Junction', group: 'NH-27 · Guwahati – Upper Assam', tag: 'NH-27 / NH-6 junction', latitude: 26.1147, longitude: 91.8859 },
  { name: 'Nagaon', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.3464, longitude: 92.684 },
  { name: 'Tezpur', group: 'NH-27 · Guwahati – Upper Assam', tag: 'NH-15 link stop', latitude: 26.6338, longitude: 92.8 },
  { name: 'Jorhat', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.7509, longitude: 94.2037 },
  { name: 'Sivasagar', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.9826, longitude: 94.6425 },
  { name: 'Dibrugarh', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 27.4728, longitude: 94.912 },
  { name: 'Tinsukia', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 27.4922, longitude: 95.3468 },
  
  // ---- NH-6 · Guwahati – Shillong line ----
  { name: 'Khanapara (Guwahati)', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 26.1158, longitude: 91.8266 },
  { name: 'Jorabat Junction ', group: 'NH-6 · Guwahati – Shillong', tag: 'NH-27 / NH-6 junction', latitude: 26.1147, longitude: 91.8859 },
  { name: 'Nongpoh', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 25.9035, longitude: 91.877 },
  { name: 'Umiam (Barapani)', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 25.6635, longitude: 91.9117 },
  { name: 'Shillong (Police Bazar)', group: 'NH-6 · Guwahati – Shillong', tag: 'Line terminus', latitude: 25.5788, longitude: 91.8933 },

  // ---- NH-44 · North-South Corridor (Automated Relay) ----
  { name: 'Srinagar (NH-44 Start)', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 34.0837, longitude: 74.7973 },
  { name: 'Pathankot Bypass', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 32.2687, longitude: 75.6455 },
  { name: 'Delhi (Kondli)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 28.6139, longitude: 77.2090 },
  { name: 'Agra (NH-44)', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 27.1767, longitude: 78.0081 },
  { name: 'Gwalior Bypass', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 26.2124, longitude: 78.1772 },
  { name: 'Nagpur (Zero Mile)', group: 'NH-44 · North-South Corridor', tag: 'Central Hub', latitude: 21.1458, longitude: 79.0882 },
  { name: 'Hyderabad (Outer Ring)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 17.3850, longitude: 78.4867 },
  { name: 'Bengaluru (Electronic City)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 12.8452, longitude: 77.6602 },
  { name: 'Kanyakumari (NH-44 End)', group: 'NH-44 · North-South Corridor', tag: 'Line terminus', latitude: 8.0883, longitude: 77.5385 },

  // ---- NH-48 · Golden Quadrilateral West (Automated Relay) ----
  { name: 'Jaipur (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 26.9124, longitude: 75.7873 },
  { name: 'Ahmedabad (Ring Road)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Surat (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 21.1702, longitude: 72.8311 },
  { name: 'Mumbai (Navi Mumbai)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Major Hub', latitude: 19.0330, longitude: 73.0297 },
  { name: 'Pune (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Chennai (NH-48 End)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Line terminus', latitude: 13.0827, longitude: 80.2707 },

  // ---- NH-19 · Golden Quadrilateral East (Automated Relay) ----
  { name: 'Kanpur (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 26.4499, longitude: 80.3319 },
  { name: 'Prayagraj (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 25.4358, longitude: 81.8463 },
  { name: 'Varanasi (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 25.3176, longitude: 82.9739 },
  { name: 'Dhanbad (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 23.7957, longitude: 86.4304 },
  { name: 'Kolkata (NH-19 End)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Major Hub', latitude: 22.5726, longitude: 88.3639 },
];

// Dynamically extract groups to ensure no line is missed
const LINE_GROUPS = Array.from(new Set(HIGHWAY_STOPS.map(stop => stop.group)));

// Native-only modules (loaded safely so web doesn't crash)
let MapView: any = null;
let Marker: any = null;
let Location: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Location = require('expo-location');
}

// Cross-platform alert helper
const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

// "12 Jun, 4:30 PM" — works everywhere, no Intl needed
const formatDate = (ts: any) => {
  if (!ts?.toDate) return 'Just now';
  const d = ts.toDate();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${mm} ${ampm}`;
};

// Friendly messages shown while we search for a driver
const SEARCH_TIPS = [
  'Hold tight — we\u2019ll let you know the moment a driver accepts.',
  'Most requests are matched within a few minutes.',
  'Your request is live and visible to nearby drivers.',
];


const STATUS_COPY: Record<string, { title: string; subtitle: string }> = {
  searching: {
    title: 'Finding your driver\u2026',
    subtitle: 'We\u2019re matching you with drivers heading your way.',
  },
  accepted: {
    title: 'Driver found!',
    subtitle: 'Your driver is heading to the pickup point.',
  },
  picked_up: {
    title: 'Shipment picked up',
    subtitle: 'Your shipment is on its way to the destination.',
  },
  delivered: {
    title: 'Delivered \u2713',
    subtitle: 'Your shipment has reached its destination.',
  },
  cancelled: {
    title: 'Request cancelled',
    subtitle: 'No problem — you can create a new request anytime.',
  },
};

// Badge colors for the Activity list
const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: 'Searching', color: C.orange, bg: 'rgba(249,115,22,0.12)' },
  accepted: { label: 'Driver on way', color: C.orange, bg: 'rgba(249,115,22,0.12)' },
  picked_up: { label: 'In transit', color: C.orange, bg: 'rgba(249,115,22,0.12)' },
  delivered: { label: 'Delivered', color: C.white, bg: 'rgba(255,255,255,0.08)' },
  cancelled: { label: 'Cancelled', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
};

const TABS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'activity', icon: '🧾', label: 'Activity' },
  { key: 'stops', icon: '🛣️', label: 'Stops' },
  { key: 'profile', icon: '👤', label: 'Profile' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type LatLng = { latitude: number; longitude: number };

export default function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Auth form state
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Shipment form state
  const [itemName, setItemName] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoImage, setCargoImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pickup & drop points (Uber-style)
  const [pickupText, setPickupText] = useState('');
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);
  const [focusField, setFocusField] = useState<'pickup' | 'dest' | null>(null);
  const [pickingMode, setPickingMode] = useState<'pickup' | 'dest' | null>(null);
  const [pendingCenter, setPendingCenter] = useState<LatLng | null>(null);

  // Live request tracking
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePackage, setActivePackage] = useState<any>(null);

  // Navigation + activity history + sheet
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [history, setHistory] = useState<any[]>([]);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  // Real location
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<any>(null);
  const mapIframeRef = useRef<any>(null);

  // Animations / rotating tips
  const pulse = useRef(new Animated.Value(1)).current;
  const dashAnim = useRef(new Animated.Value(0)).current; // moving road dashes
  const bobAnim = useRef(new Animated.Value(0)).current; // truck bounce
  const [tipIndex, setTipIndex] = useState(0);

  // GROQ AR Scanner State
  const [isScanningAR, setIsScanningAR] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scannerAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<any>(null);
  const [cameraStream, setCameraStream] = useState<any>(null);

  // Derived
  const status: string | undefined = activePackage?.status;
  const isSearching = status === 'searching';
  const truckActive = isSearching || status === 'picked_up';

  // ------------------------------------------
  // 1. LISTEN FOR LOGIN SESSIONS
  // ------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return unsubscribe;
  }, []);

  // ------------------------------------------
  // 2. GET THE USER'S REAL GPS LOCATION
  // ------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const getLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          // @ts-ignore - browser geolocation
          navigator.geolocation?.getCurrentPosition(
            (pos: any) => {
              if (!cancelled) {
                setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            },
            () => !cancelled && setLocationDenied(true),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          const { status: perm } = await Location.requestForegroundPermissionsAsync();
          if (perm !== 'granted') {
            if (!cancelled) setLocationDenied(true);
            return;
          }
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          }
        }
      } catch {
        if (!cancelled) setLocationDenied(true);
      }
    };

    getLocation();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Smoothly move the map to the user once we know where they are
  useEffect(() => {
    if (coords) {
      if (Platform.OS === 'web' && mapIframeRef.current) {
        mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'flyTo', lat: coords.latitude, lng: coords.longitude }), '*');
      } else if (mapRef.current && Platform.OS !== 'web') {
        mapRef.current.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
      }
    }
  }, [coords]);

  // ------------------------------------------
  // 3. UBER MAP LOGIC (WEB IFRAME COMMUNICATION)
  // ------------------------------------------
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'mapCenter' && pickingMode) {
          setPendingCenter({ latitude: data.lat, longitude: data.lng });
        }
      } catch (e) {}
    };

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [pickingMode]);

  useEffect(() => {
    if (Platform.OS === 'web' && mapIframeRef.current) {
      const driverCoords = activePackage?.driver_coords;
      const actPick = activePackage?.pickup_coords;
      const actDrop = activePackage?.dropoff_coords;

      mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({
        type: 'updateMarkers',
        pickup: pickupPoint ? { lat: pickupPoint.latitude, lng: pickupPoint.longitude } : actPick ? { lat: actPick.latitude, lng: actPick.longitude } : null,
        drop: destPoint ? { lat: destPoint.latitude, lng: destPoint.longitude } : actDrop ? { lat: actDrop.latitude, lng: actDrop.longitude } : null,
        driver: driverCoords ? { lat: driverCoords.latitude, lng: driverCoords.longitude } : null
      }), '*');
    }
  }, [pickupPoint, destPoint, activePackage]);

  useEffect(() => {
    if (Platform.OS === 'web' && mapIframeRef.current) {
      mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({
        type: 'setMode',
        mode: pickingMode
      }), '*');
    }
  }, [pickingMode]);

  // ------------------------------------------
  // 4. RESUME AN ACTIVE REQUEST AFTER APP RESTART
  // ------------------------------------------
  useEffect(() => {
    if (!user) {
      setActiveId(null);
      setActivePackage(null);
      setActiveTab('home');
      return;
    }
    (async () => {
      try {
        const q = query(
          collection(db, 'Packages'),
          where('sender_id', '==', user.uid),
          where('status', 'in', ACTIVE_STATUSES),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) setActiveId(snap.docs[0].id);
      } catch {
        // Offline or index still building — safe to ignore
      }
    })();
  }, [user]);

  // ------------------------------------------
  // 5. LIVE LISTENER — updates instantly when the
  //    driver app changes this shipment's status
  // ------------------------------------------
  useEffect(() => {
    if (!activeId) return;
    const unsub = onSnapshot(doc(db, 'Packages', activeId), (snap) => {
      if (!snap.exists()) {
        setActiveId(null);
        setActivePackage(null);
        return;
      }
      setActivePackage({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [activeId]);

  // ------------------------------------------
  // 6. LIVE ACTIVITY — all of this user's shipments
  // ------------------------------------------
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    const q = query(collection(db, 'Packages'), where('sender_id', '==', user.uid), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
        rows.sort(
          (a, b) => (b.created_at?.toMillis?.() ?? Date.now()) - (a.created_at?.toMillis?.() ?? 0)
        );
        setHistory(rows);
      },
      () => {}
    );
    return unsub;
  }, [user]);

  // Pulse animation + rotating tips while searching
  useEffect(() => {
    if (!isSearching) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    const interval = setInterval(
      () => setTipIndex((i) => (i + 1) % SEARCH_TIPS.length),
      4000
    );
    return () => {
      anim.stop();
      clearInterval(interval);
    };
  }, [isSearching]);

  // 🚚 Truck drive animation (road dashes slide + truck bobs)
  useEffect(() => {
    if (!truckActive) return;
    dashAnim.setValue(0);
    const road = Animated.loop(
      Animated.timing(dashAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );
    road.start();
    bob.start();
    return () => {
      road.stop();
      bob.stop();
    };
  }, [truckActive]);

  const dashTranslate = dashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const truckBob = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  // ------------------------------------------
  // 7. GROQ API REAL AR SCANNER INTEGRATION (Web RTC)
  // ------------------------------------------
  const startARScan = async () => {
    Keyboard.dismiss();
    setIsScanningAR(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scannerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scannerAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    ).start();

    // Activate Real Camera if on Web
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        notify('Camera Permission Denied', 'Falling back to simulated scanner. Please allow camera access next time.');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track: any) => track.stop());
      setCameraStream(null);
    }
    setIsScanningAR(false);
  };

  const processGroqVision = async () => {
    setIsAnalyzing(true);
    let base64Image = 'https://images.unsplash.com/photo-1580674684081-77699ca1b794?q=80&w=2000&auto=format&fit=crop'; // Default/Fallback image

    // If on web and camera is active, snap a real picture and heavily compress it to avoid 400 Payload Too Large
    if (Platform.OS === 'web' && videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 400 / (videoRef.current.videoWidth || 640)); // Shrink to 400px width max
        canvas.width = (videoRef.current.videoWidth || 640) * scale;
        canvas.height = (videoRef.current.videoHeight || 480) * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg', 0.5); // 50% Quality compression
        }
      } catch (e) {
        console.log("Failed to capture from video stream, using fallback.");
      }
    }

    try {
      // Real API Call to Groq's active Vision Model
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer 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`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: 'Analyze the primary object in this image for logistics dispatch. Identify what the object is, and give a short, exact estimation of its dimensions and volumetric weight. Format strictly like: "[Item Name]: [L]x[W]x[H]cm (Vol. [X]kg)". Keep it to exactly one short line. Do not include conversational text.' 
                },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: base64Image 
                  } 
                }
              ]
            }
          ],
          temperature: 0.5,
          max_tokens: 50
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const resultText = data.choices[0].message.content.trim();
        setItemName(resultText);
        setCargoImage(base64Image);
        notify('Groq Vision Match', `Dimensions calculated by LPU instantly.\n\nResult: ${resultText}`);
      } else {
        throw new Error("Invalid format from Groq API");
      }
    } catch (err: any) {
      console.log('Groq API Error:', err);
      // Fallback in case API is temporarily unavailable or payload is still too large
      setItemName('L-Crate: 60x40x40cm (Volumetric 19kg)');
      setCargoImage(base64Image);
      notify('Groq Vision Issue', `Could not process image through API. Used fallback sizing. Reason: ${err.message || 'Unknown'}`);
    } finally {
      setIsAnalyzing(false);
      stopCamera();
    }
  };

  // ------------------------------------------
  // 8. LOCATION HELPERS (Uber/Rapido-style)
  // ------------------------------------------

  // Turn coordinates into a readable name using the device geocoder (no API key needed)
  const reverseGeocode = async (point: LatLng): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' || !Location) return null;
      const res = await Location.reverseGeocodeAsync(point);
      const a = res?.[0];
      if (!a) return null;
      return [a.name || a.street, a.city || a.district || a.subregion]
        .filter(Boolean)
        .join(', ');
    } catch {
      return null;
    }
  };

  // Fit both pins on screen, or fly to a single point
  const focusMap = (a?: LatLng | null, b?: LatLng | null) => {
    // If Web, send the postMessage to Leaflet iframe
    if (Platform.OS === 'web') {
      if (mapIframeRef.current) {
        if (a && b) {
          mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'fitBounds', lat1: a.latitude, lng1: a.longitude, lat2: b.latitude, lng2: b.longitude }), '*');
        } else if (a) {
          mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'flyTo', lat: a.latitude, lng: a.longitude }), '*');
        }
      }
      return;
    }
    
    // If Native App, animate MapView
    if (!mapRef.current) return;
    if (a && b) {
      mapRef.current.fitToCoordinates([a, b], {
        edgePadding: { top: 140, bottom: 420, left: 70, right: 70 },
        animated: true,
      });
    } else if (a) {
      mapRef.current.animateToRegion({ ...a, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600);
    }
  };

  // User tapped a highway-stop suggestion while typing
  const selectStop = (stop: (typeof HIGHWAY_STOPS)[number], which: 'pickup' | 'dest') => {
    const point = { latitude: stop.latitude, longitude: stop.longitude };
    if (which === 'pickup') {
      setPickupText(stop.name.trim());
      setPickupPoint(point);
      if (destPoint) focusMap(point, destPoint); else focusMap(point);
    } else {
      setDestination(stop.name.trim());
      setDestPoint(point);
      if (pickupPoint) focusMap(pickupPoint, point); else focusMap(point);
    }
    setFocusField(null);
    Keyboard.dismiss();
  };

  // Enter "move the map" pin mode
  const startPicking = (which: 'pickup' | 'dest') => {
    Keyboard.dismiss();
    setFocusField(null);
    setPickingMode(which);
    const start =
      (which === 'pickup' ? pickupPoint : destPoint) ?? coords ?? FALLBACK_COORDS;
    setPendingCenter(start);
    
    // Only animate region if it's the native map view
    if (Platform.OS !== 'web') {
      mapRef.current?.animateToRegion(
        { ...start, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } else {
      if (mapIframeRef.current) {
        mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'flyTo', lat: start.latitude, lng: start.longitude }), '*');
      }
    }
  };

  // Confirm the pin where the map is centered
  const confirmPin = async () => {
    if (!pickingMode || !pendingCenter) return;
    
    // On Web, reverse geocode isn't supported natively, provide a highly accurate generated tag
    const label =
      (await reverseGeocode(pendingCenter)) ??
      `Pinned Highway Node (${pendingCenter.latitude.toFixed(4)}, ${pendingCenter.longitude.toFixed(4)})`;
      
    if (pickingMode === 'pickup') {
      setPickupPoint(pendingCenter);
      setPickupText(label);
      if (destPoint) focusMap(pendingCenter, destPoint); else focusMap(pendingCenter);
    } else {
      setDestPoint(pendingCenter);
      setDestination(label);
      if (pickupPoint) focusMap(pickupPoint, pendingCenter); else focusMap(pendingCenter);
    }
    setPickingMode(null);
  };

  const cancelPicking = () => setPickingMode(null);

  // ------------------------------------------
  // 9. PRECISE GEOCODING (TYPE TO PIN)
  // ------------------------------------------
  const geocodeAndPin = async (address: string, which: 'pickup' | 'dest') => {
    if (!address.trim()) return;
    Keyboard.dismiss();
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const pt = { latitude: lat, longitude: lon };
        const locationName = data[0].display_name.split(',')[0]; // Get the cleanest short name
        
        if (which === 'pickup') {
          setPickupPoint(pt);
          setPickupText(locationName);
          if (destPoint) focusMap(pt, destPoint); else focusMap(pt);
        } else {
          setDestPoint(pt);
          setDestination(locationName);
          if (pickupPoint) focusMap(pickupPoint, pt); else focusMap(pt);
        }
        setFocusField(null);
        notify('Location Found', `Pinned to: ${locationName}`);
      } else {
        notify('Location not found', 'Please try a more specific city or address.');
      }
    } catch (e) {
      notify('Error', 'Geocoding failed. Check your internet connection.');
    }
  };

  // Open turn-by-turn navigation in Google Maps
  const openNavigation = () => {
    const target = activePackage?.pickup_coords;
    if (!target) {
      notify('No coordinates', 'This stop has no pinned location to navigate to.');
      return;
    }
    // Launch actual Google Maps navigation route directly to coordinates
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=...${target.latitude},${target.longitude}`
    );
  };

  // ------------------------------------------
  // 10. FIREBASE AUTHENTICATION
  // ------------------------------------------
  const handleAuthentication = async () => {
    if (!email || !password) {
      notify('Missing details', 'Enter both your email and password to continue.');
      return;
    }
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (error: any) {
      notify('Sign-in failed', error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // ------------------------------------------
  // 11. CREATE THE PICKUP REQUEST
  // ------------------------------------------
  const requestPickup = async () => {
    if (!itemName || !destination || !user) return;
    setIsSubmitting(true);
    try {
      const pickup = pickupPoint ?? coords ?? FALLBACK_COORDS;
      const docRef = await addDoc(collection(db, 'Packages'), {
        sender_id: user.uid,
        sender_email: user.email ?? null,
        item_name: itemName.trim(),
        pickup_name: pickupText.trim() || 'Current location',
        destination_name: destination.trim(),
        pickup_coords: new GeoPoint(pickup.latitude, pickup.longitude),
        dropoff_coords: destPoint
          ? new GeoPoint(destPoint.latitude, destPoint.longitude)
          : null,
        cargo_image: cargoImage,
        status: 'searching',
        driver_id: null,
        driver_name: null,
        created_at: serverTimestamp(),
      });
      setActiveId(docRef.id); // switches the sheet into "searching" mode
      setItemName('');
      setDestination('');
      setDestPoint(null);
      setCargoImage(null);
      setSheetCollapsed(false);
    } catch {
      notify('Could not submit', 'Check your connection and Firestore rules, then try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelRequest = async () => {
    if (!activeId) return;
    try {
      await updateDoc(doc(db, 'Packages', activeId), { status: 'cancelled' });
    } catch {
      notify('Could not cancel', 'Please check your connection and try again.');
    }
  };

  const dismissRequest = () => {
    setActiveId(null);
    setActivePackage(null);
  };

  // Tap an activity item that's still active → jump back to its live card
  const openHistoryItem = (item: any) => {
    if (ACTIVE_STATUSES.includes(item.status)) {
      setActiveId(item.id);
      setActiveTab('home');
      setSheetCollapsed(false);
    }
  };

  // ==========================================
  // VIEW: SPLASH
  // ==========================================
  if (isInitializing) {
    return (
      <View style={styles.center}>
        <Text style={styles.splashLogo}>
          Enso<Text style={{ color: C.orange }}>.</Text>
        </Text>
        <ActivityIndicator size="small" color={C.orange} style={{ marginTop: 24 }} />
      </View>
    );
  }

  // ==========================================
  // VIEW: LOGIN / SIGN UP
  // ==========================================
  if (!user) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.authContainer}
      >
        <StatusBar barStyle="light-content" backgroundColor={C.black} />
        <View style={styles.authCard}>
          <Text style={styles.authLogo}>
            Enso<Text style={{ color: C.orange }}>.</Text>
          </Text>
          <Text style={styles.authSubtitle}>
            Send shipments with drivers already going your way.
          </Text>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.inputBox}
            placeholder="you@example.com"
            placeholderTextColor={C.gray500}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            selectionColor={C.orange}
            value={email}
            onChangeText={setEmail}
            // @ts-ignore
            outlineStyle="none"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.inputBox}
            placeholder="••••••••"
            placeholderTextColor={C.gray500}
            secureTextEntry
            selectionColor={C.orange}
            value={password}
            onChangeText={setPassword}
            // @ts-ignore
            outlineStyle="none"
          />

          <TouchableOpacity
            style={[styles.btnPrimary, authLoading && { backgroundColor: C.orangeDark }]}
            onPress={handleAuthentication}
            disabled={authLoading}
            activeOpacity={0.85}
          >
            {authLoading ? (
              <ActivityIndicator color={C.black} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {isLoginMode ? 'Log in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.authToggle}
            onPress={() => setIsLoginMode(!isLoginMode)}
            activeOpacity={0.7}
          >
            <Text style={styles.authToggleText}>
              {isLoginMode ? (
                <>
                  New to Enso? <Text style={styles.authToggleAccent}>Sign up</Text>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Text style={styles.authToggleAccent}>Log in</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.authFooter}>Fast deliveries. Fair prices.</Text>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // VIEW: MAIN APP
  // ==========================================
  const formReady = !!itemName.trim() && !!destination.trim();
  const mapCenter = coords ?? FALLBACK_COORDS;
  const statusCopy = status ? STATUS_COPY[status] ?? null : null;
  const showLiveCard = !!activePackage && !!statusCopy;
  const isFinished = status === 'delivered' || status === 'cancelled';
  const userInitial = (user.email?.[0] ?? 'U').toUpperCase();
  const deliveredCount = history.filter((h) => h.status === 'delivered').length;

  // Highway-stop suggestions while typing (deduped by name)
  const suggQuery = focusField === 'pickup' ? pickupText : focusField === 'dest' ? destination : '';
  const suggestions =
    focusField && suggQuery.trim().length > 0
      ? HIGHWAY_STOPS.filter((s) =>
          s.name.toLowerCase().includes(suggQuery.trim().toLowerCase())
        )
          .filter((s, i, arr) => arr.findIndex((x) => x.name.trim() === s.name.trim()) === i)
          .slice(0, 4)
      : [];

  // Generate Leaflet Interactive Map HTML for Web
  const leafletMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; }
        .center-pin {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%);
          font-size: 38px; z-index: 1000; pointer-events: none; display: none;
          text-shadow: 0 4px 10px rgba(0,0,0,0.4);
        }
        .center-pin.active { display: block; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="pin" class="center-pin">📍</div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${mapCenter.latitude}, ${mapCenter.longitude}], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        let pickupMarker = null;
        let dropMarker = null;
        let driverMarker = null;
        const driverIcon = L.divIcon({ html: '<div style="font-size:24px; background:white; border-radius:50%; width:30px; height:30px; display:flex; justify-content:center; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.3)">🛻</div>', className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
        const orangeIcon = L.divIcon({ html: '<div style="font-size:24px">📍</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 24] });
        const blackIcon = L.divIcon({ html: '<div style="font-size:24px; filter: grayscale(1)">📍</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 24] });

        // Update React on Drag
        map.on('move', () => {
          const center = map.getCenter();
          window.parent.postMessage(JSON.stringify({ type: 'mapCenter', lat: center.lat, lng: center.lng }), '*');
        });

        // Listen for React Commands
        window.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'flyTo') {
              map.flyTo([data.lat, data.lng], 16, { animate: true, duration: 1.5 });
            }
            if (data.type === 'fitBounds') {
              const bounds = L.latLngBounds([data.lat1, data.lng1], [data.lat2, data.lng2]);
              map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1.5 });
            }
            if (data.type === 'setMode') {
              if (data.mode) document.getElementById('pin').classList.add('active');
              else document.getElementById('pin').classList.remove('active');
            }
            if (data.type === 'updateMarkers') {
              if (pickupMarker) map.removeLayer(pickupMarker);
              if (dropMarker) map.removeLayer(dropMarker);
              if (driverMarker) map.removeLayer(driverMarker);

              if (data.pickup) pickupMarker = L.marker([data.pickup.lat, data.pickup.lng], {icon: orangeIcon}).addTo(map);
              if (data.drop) dropMarker = L.marker([data.drop.lat, data.drop.lng], {icon: blackIcon}).addTo(map);
              if (data.driver) driverMarker = L.marker([data.driver.lat, data.driver.lng], {icon: driverIcon, zIndexOffset: 1000}).addTo(map);
            }
          } catch(e) {}
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.appRoot}>
      <StatusBar
        barStyle={activeTab === 'home' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* ---------- FULL-SCREEN SCROLLABLE MAP (always mounted) ---------- */}
      {Platform.OS === 'web' ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
          {/* @ts-ignore */}
          <iframe
            ref={mapIframeRef}
            title="Interactive Web Map"
            srcDoc={leafletMapHtml}
            style={styles.mapIframe as any}
          />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            ...mapCenter,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onRegionChangeComplete={(r: any) => {
            if (pickingMode) {
              setPendingCenter({ latitude: r.latitude, longitude: r.longitude });
            }
          }}
        >
          {/* Driver live pin (Sender side) */}
          {activePackage?.driver_coords && (
            <Marker
              coordinate={{
                latitude: activePackage.driver_coords.latitude,
                longitude: activePackage.driver_coords.longitude,
              }}
              title={activePackage.driver_name || 'Driver'}
              description="Live location"
              zIndex={1000}
            >
              <Text style={{ fontSize: 26 }}>🛻</Text>
            </Marker>
          )}
          {/* Active Job Pickup Pin (if active package exists) */}
          {!pickupPoint && activePackage?.pickup_coords && (
             <Marker
              coordinate={{
                latitude: activePackage.pickup_coords.latitude,
                longitude: activePackage.pickup_coords.longitude,
              }}
              title="Pickup"
              pinColor={C.orange}
            />
          )}
          {/* Active Job Drop Pin */}
          {!destPoint && activePackage?.dropoff_coords && (
             <Marker
              coordinate={{
                latitude: activePackage.dropoff_coords.latitude,
                longitude: activePackage.dropoff_coords.longitude,
              }}
              title="Drop"
              pinColor={C.black}
            />
          )}
          {/* Form Pickup pin */}
          {!activePackage && pickupPoint && (
            <Marker
              coordinate={pickupPoint}
              title="Pickup point"
              description={pickupText}
              pinColor={C.orange}
            />
          )}
          {/* Form Drop pin */}
          {!activePackage && destPoint && (
            <Marker
              coordinate={destPoint}
              title="Drop point"
              description={destination}
              pinColor={C.black}
            />
          )}
        </MapView>
      )}

      {/* ---------- WEB MAP OVERLAY (Non-blocking visual tint) ---------- */}
      {pickingMode && Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: 12, backgroundColor: 'rgba(0,0,0,0.05)' }]}
        />
      )}

      {/* ---------- CENTER PIN while choosing on native map ---------- */}
      {pickingMode && Platform.OS !== 'web' && (
        <View pointerEvents="none" style={[styles.centerPinWrap, { zIndex: 15 }]}>
          <Text style={styles.centerPin}>📍</Text>
          <View style={styles.centerPinShadow} />
        </View>
      )}

      {/* ---------- FLOATING HEADER (home only) ---------- */}
      {activeTab === 'home' && !pickingMode && (
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>
              Enso<Text style={{ color: C.orange }}>.</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBadge}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarBadgeText}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- GROQ AR SCANNER FULLSCREEN OVERLAY ---------- */}
      {isScanningAR && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.black, zIndex: 100 }]}>
           <View style={{ position: 'absolute', inset: 0, opacity: 1 }}>
             {/* If Web, render HTML5 Video. If Native, fallback to simulated image */}
             {Platform.OS === 'web' ? (
                // @ts-ignore
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isAnalyzing ? 'blur(10px)' : 'none', transition: 'filter 0.3s' }} 
                />
             ) : (
                <Image 
                  source={{uri: 'https://images.unsplash.com/photo-1580674684081-77699ca1b794?q=80&w=2000&auto=format&fit=crop'}} 
                  style={{width: '100%', height: '100%'}} 
                  blurRadius={isAnalyzing ? 10 : 0} 
                />
             )}
           </View>

           {/* AR Viewfinder UI */}
           <View style={styles.arViewfinder}>
              <View style={styles.arCornerTopLeft} />
              <View style={styles.arCornerTopRight} />
              <View style={styles.arCornerBottomLeft} />
              <View style={styles.arCornerBottomRight} />

              {/* Scanning Laser Animation */}
              {!isAnalyzing && (
                <Animated.View style={[styles.arLaser, { transform: [{ translateY: scannerAnim.interpolate({inputRange: [0,1], outputRange: [0, height * 0.45]}) }] }]} />
              )}
           </View>

           {/* Top Bar */}
           <View style={styles.arTopBar}>
              <View style={styles.arBadge}>
                <Text style={styles.arBadgeText}>Groq Vision™ Cargo AI</Text>
              </View>
              <TouchableOpacity onPress={stopCamera} style={styles.arCloseBtn}>
                 <Text style={styles.arCloseText}>✕</Text>
              </TouchableOpacity>
           </View>

           {/* Bottom Bar Actions */}
           <View style={styles.arBottomBar}>
              {isAnalyzing ? (
                 <View style={{alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 20}}>
                   <ActivityIndicator size="large" color={C.orange} />
                   <Text style={{color: C.orange, marginTop: 14, fontSize: 16, fontWeight: '800'}}>Groq LPU Analyzing Volume...</Text>
                 </View>
              ) : (
                 <View style={{alignItems: 'center'}}>
                   <Text style={{color: C.white, marginBottom: 20, fontSize: 14, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 10}}>Align object within frame</Text>
                   <TouchableOpacity style={styles.arCaptureBtn} onPress={processGroqVision} activeOpacity={0.8}>
                      <View style={styles.arCaptureInner} />
                   </TouchableOpacity>
                 </View>
              )}
           </View>
        </View>
      )}

      {/* ---------- PIN-PICKING OVERLAY ---------- */}
      {pickingMode && (
        <>
          <View style={styles.pickChip}>
            <Text style={styles.pickChipText}>
              Drag the map to pinpoint the exact location
            </Text>
          </View>
          <View style={styles.pickCard}>
            <Text style={styles.pickCardTitle}>
              {pickingMode === 'pickup' ? 'Set pickup location' : 'Set drop location'}
            </Text>
            <Text style={styles.pickCardSub}>
              Drag the map until the pin sits on the exact spot — a highway stop, road point, or
              gate.
            </Text>
            <View style={styles.pickBtnRow}>
              <TouchableOpacity
                style={styles.pickCancelBtn}
                onPress={cancelPicking}
                activeOpacity={0.8}
              >
                <Text style={styles.pickCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickConfirmBtn}
                onPress={confirmPin}
                activeOpacity={0.85}
              >
                <Text style={styles.pickConfirmText}>Confirm location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ---------- BOTTOM SHEET (home only) ---------- */}
      {activeTab === 'home' && !pickingMode && !isScanningAR && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View style={styles.bottomSheet}>
            {/* Tap the handle to collapse the sheet and free the map */}
            <TouchableOpacity
              style={styles.dragHandleTap}
              onPress={() => {
                setSheetCollapsed((s) => !s);
                setFocusField(null);
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.dragHandle} />
            </TouchableOpacity>

            {sheetCollapsed ? (
              /* ================= COLLAPSED BAR ================= */
              <TouchableOpacity
                style={styles.collapsedRow}
                onPress={() => setSheetCollapsed(false)}
                activeOpacity={0.85}
              >
                {showLiveCard ? (
                  <>
                    <View style={styles.pulseDotSmall} />
                    <Text style={styles.collapsedText} numberOfLines={1}>
                      {statusCopy!.title}
                    </Text>
                    <Text style={styles.collapsedAction}>View</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.dotOrange} />
                    <Text style={styles.collapsedText}>Send a shipment</Text>
                    <Text style={styles.collapsedAction}>＋</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : showLiveCard ? (
              /* ================= LIVE REQUEST CARD ================= */
              <View>
                <View style={styles.statusHeader}>
                  {status === 'searching' ? (
                    <View style={styles.pulseWrap}>
                      <Animated.View
                        style={[styles.pulseRing, { transform: [{ scale: pulse }] }]}
                      />
                      <View style={styles.pulseDot} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.statusIcon,
                        isFinished && status === 'cancelled' && { backgroundColor: C.charcoal },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusIconText,
                          status === 'cancelled' && { color: C.gray500 },
                        ]}
                      >
                        {status === 'accepted'
                          ? (activePackage.driver_name?.[0] ?? 'D').toUpperCase()
                          : status === 'picked_up'
                          ? '→'
                          : status === 'delivered'
                          ? '✓'
                          : '✕'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>{statusCopy!.title}</Text>
                    <Text style={styles.statusSubtitle}>
                      {status === 'searching'
                        ? SEARCH_TIPS[tipIndex]
                        : status === 'accepted' && activePackage.driver_name
                        ? `${activePackage.driver_name} is on the way to your pickup point.`
                        : statusCopy!.subtitle}
                    </Text>
                  </View>
                </View>

                {/* 🚚 Animated truck while searching / in transit */}
                {truckActive && (
                  <View style={styles.roadScene}>
                    <View style={styles.roadLineWrap}>
                      <Animated.View
                        style={[styles.dashRow, { transform: [{ translateX: dashTranslate }] }]}
                      >
                        {Array.from({ length: 18 }).map((_, i) => (
                          <View key={i} style={styles.dash} />
                        ))}
                      </Animated.View>
                    </View>
                    <Animated.Text
                      style={[
                        styles.truck,
                        { transform: [{ translateY: truckBob }, { scaleX: -1 }] },
                      ]}
                    >
                      🚚
                    </Animated.Text>
                    <Text style={styles.roadPin}>📍</Text>
                  </View>
                )}

                {/* Shipment summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryIcon}>📦</Text>
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activePackage.item_name}
                    </Text>
                  </View>
                  <View style={styles.connectorLine} />
                  <View style={styles.summaryRow}>
                    <View style={styles.dotOrange} />
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activePackage.pickup_name ?? 'Current location'}
                    </Text>
                  </View>
                  <View style={styles.connectorLine} />
                  <View style={styles.summaryRow}>
                    <View style={styles.dotWhite} />
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activePackage.destination_name}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {status === 'searching' ? (
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={cancelRequest}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnOutlineText}>Cancel request</Text>
                  </TouchableOpacity>
                ) : isFinished ? (
                  <TouchableOpacity
                    style={styles.btnCta}
                    onPress={dismissRequest}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnCtaText}>Send another shipment</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.btnNavigate}
                      onPress={openNavigation}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnNavigateText}>🧭 Route to Pickup</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              /* ================= REQUEST FORM ================= */
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.sheetTitle}>Send a shipment</Text>
                  <View style={styles.relayBadge}>
                    <View style={styles.relayDot} />
                    <Text style={styles.relayBadgeText}>Live matching</Text>
                  </View>
                </View>

                {/* Pickup GPS status */}
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>◉</Text>
                  <Text style={styles.locationText}>
                    {coords
                      ? 'GPS locked — pickup defaults to your current location'
                      : locationDenied
                      ? 'Location off — set pickup with the map pin'
                      : 'Finding your location…'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>What are you sending?</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldIcon}>📦</Text>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    placeholder="e.g. 5 kg box of documents"
                    placeholderTextColor={C.gray500}
                    selectionColor={C.orange}
                    returnKeyType="next"
                    value={itemName}
                    onChangeText={setItemName}
                    onFocus={() => setFocusField(null)}
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  {/* AR Scan Button Injection */}
                  <TouchableOpacity style={styles.arScanBadge} onPress={startARScan} activeOpacity={0.8}>
                     <Text style={styles.arScanBadgeIcon}>👁️</Text>
                     <Text style={styles.arScanBadgeText}>AR Scan</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Pickup point — highway / road stop</Text>
                <View style={styles.fieldBox}>
                  <View style={styles.dotOrange} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Current location (or type a stop)"
                    placeholderTextColor={C.gray500}
                    selectionColor={C.orange}
                    returnKeyType="next"
                    value={pickupText}
                    onChangeText={(t) => {
                      setPickupText(t);
                      setFocusField('pickup');
                    }}
                    onFocus={() => setFocusField('pickup')}
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  {/* Precise Geocoding Search Button */}
                  <TouchableOpacity
                    style={styles.pinBtn}
                    onPress={() => geocodeAndPin(pickupText, 'pickup')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pinBtnText}>🔍</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pinBtn}
                    onPress={() => startPicking('pickup')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pinBtnText}>📍</Text>
                  </TouchableOpacity>
                </View>
                {focusField === 'pickup' && suggestions.length > 0 && (
                  <View style={[styles.suggList, { maxHeight: height * 0.25 }]}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s.name + s.group}
                        style={styles.suggRow}
                        onPress={() => selectStop(s, 'pickup')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.suggPin}>📍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggName}>{s.name.trim()}</Text>
                          <Text style={styles.suggTag}>
                            {s.tag} · {s.group}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Drop point — highway / road stop</Text>
                <View style={styles.fieldBox}>
                  <View style={styles.dotWhite} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. Kondli, New Delhi"
                    placeholderTextColor={C.gray500}
                    selectionColor={C.orange}
                    returnKeyType="done"
                    value={destination}
                    onChangeText={(t) => {
                      setDestination(t);
                      setFocusField('dest');
                    }}
                    onFocus={() => setFocusField('dest')}
                    onSubmitEditing={() => formReady && requestPickup()}
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  {/* Precise Geocoding Search Button */}
                  <TouchableOpacity
                    style={styles.pinBtn}
                    onPress={() => geocodeAndPin(destination, 'dest')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pinBtnText}>🔍</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pinBtn}
                    onPress={() => startPicking('dest')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pinBtnText}>📍</Text>
                  </TouchableOpacity>
                </View>
                {focusField === 'dest' && suggestions.length > 0 && (
                  <View style={[styles.suggList, { maxHeight: height * 0.25 }]}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s.name + s.group}
                        style={styles.suggRow}
                        onPress={() => selectStop(s, 'dest')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.suggPin}>📍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggName}>{s.name.trim()}</Text>
                          <Text style={styles.suggTag}>
                            {s.tag} · {s.group}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={formReady ? styles.btnCta : styles.btnDisabled}
                  onPress={requestPickup}
                  disabled={isSubmitting || !formReady}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={C.black} />
                  ) : (
                    <Text style={formReady ? styles.btnCtaText : styles.btnDisabledText}>
                      Find a route match
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ======================= ACTIVITY TAB ======================= */}
      {activeTab === 'activity' && (
        <View style={styles.screen}>
          <Text style={styles.screenTitle}>Activity</Text>
          <Text style={styles.screenSub}>
            {history.length === 0
              ? 'Your shipments will appear here'
              : `${history.length} shipment${history.length === 1 ? '' : 's'}`}
          </Text>

          {history.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>No shipments yet</Text>
              <Text style={styles.emptySub}>
                Send your first shipment and it will show up here with its live status.
              </Text>
              <TouchableOpacity
                style={[styles.btnCta, { marginTop: 24, width: 'auto', paddingHorizontal: 28 }]}
                onPress={() => setActiveTab('home')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnCtaText}>Send a shipment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 130 }}
              showsVerticalScrollIndicator={false}
            >
              {history.map((item) => {
                const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.searching;
                const isActive = ACTIVE_STATUSES.includes(item.status);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    activeOpacity={isActive ? 0.75 : 1}
                    onPress={() => openHistoryItem(item)}
                  >
                    <View style={styles.historyTop}>
                      <Text style={styles.historyItem} numberOfLines={1}>
                        {item.item_name}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusPillText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyDest} numberOfLines={1}>
                      {(item.pickup_name ?? 'Current location') + '  →  ' + item.destination_name}
                    </Text>
                    <View style={styles.historyBottom}>
                      <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                      {isActive && <Text style={styles.historyTrack}>Track →</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ======================= STOPS TAB (ALL-INDIA) ======================= */}
      {activeTab === 'stops' && (
        <View style={styles.screen}>
          <Text style={styles.screenTitle}>Line stops</Text>
          <Text style={styles.screenSub}>Pan-India Relay Nodes on the Enso network</Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stopsFootnote}>
              Relay nodes switch automatically depending on which driver accepts your package. 
              The AI handles transfers seamlessly across India.
            </Text>
            
            {LINE_GROUPS.map((group) => (
              <View key={group} style={{ marginBottom: 22, marginTop: 12 }}>
                <View style={styles.lineHeader}>
                  <View style={styles.lineDot} />
                  <Text style={styles.lineTitle}>{group}</Text>
                </View>
                <View style={styles.lineCard}>
                  {HIGHWAY_STOPS.filter((s) => s.group === group).map((stop, idx, arr) => (
                    <TouchableOpacity
                      key={stop.name + stop.group}
                      style={[
                        styles.stopRow,
                        idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.line },
                      ]}
                      onPress={() => {
                        setDestination(stop.name.trim());
                        setDestPoint({ latitude: stop.latitude, longitude: stop.longitude });
                        setActiveTab('home');
                        setSheetCollapsed(false);
                        focusMap(pickupPoint ?? coords, {
                          latitude: stop.latitude,
                          longitude: stop.longitude,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stopPin}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stopName}>{stop.name.trim()}</Text>
                        <Text style={styles.stopTag}>{stop.tag}</Text>
                      </View>
                      <Text style={styles.stopAction}>Send here →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ======================= PROFILE TAB ======================= */}
      {activeTab === 'profile' && (
        <View style={styles.screen}>
          <Text style={styles.screenTitle}>Profile</Text>
          <Text style={styles.screenSub}>Your account</Text>

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{userInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={styles.profileJoined}>
                {user.metadata?.creationTime
                  ? `Member since ${MONTHS[new Date(user.metadata.creationTime).getMonth()]} ${new Date(
                      user.metadata.creationTime
                    ).getFullYear()}`
                  : 'Enso member'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{history.length}</Text>
              <Text style={styles.statLabel}>Shipments sent</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{deliveredCount}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.btnLogoutText}>Log out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Enso v1.0</Text>
        </View>
      )}

      {/* ======================= FLOATING TRANSPARENT CURVED NAVBAR ======================= */}
      {!pickingMode && !isScanningAR && (
        <View style={styles.navbarWrap} pointerEvents="box-none">
          <View style={styles.navbar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setFocusField(null);
                    Keyboard.dismiss();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.navIcon, !active && { opacity: 0.45 }]}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ==========================================
// STYLES — MINIMAL ORANGE & BLACK
// ==========================================
const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.black,
  },
  splashLogo: {
    fontSize: 44,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1.5,
  },
  mapIframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },

  // ---------- Auth (dark) ----------
  authContainer: {
    flex: 1,
    backgroundColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  authCard: { width: '100%', maxWidth: 400 },
  authLogo: {
    fontSize: 44,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  authSubtitle: {
    fontSize: 15,
    color: C.gray400,
    marginBottom: 40,
    fontWeight: '500',
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray400,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: C.charcoal,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 20,
    fontSize: 16,
    color: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
    marginTop: 8,
  },
  btnPrimaryText: {
    color: C.black,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  authToggle: { marginTop: 28, alignItems: 'center' },
  authToggleText: { color: C.gray400, fontSize: 14, fontWeight: '500' },
  authToggleAccent: { color: C.orange, fontWeight: '700' },
  authFooter: {
    position: 'absolute',
    bottom: 36,
    color: C.gray700,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ---------- App shell ----------
  appRoot: { flex: 1, backgroundColor: C.black },

  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 44,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  logoBadge: {
    backgroundColor: C.black,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarBadgeText: { color: C.orange, fontSize: 16, fontWeight: '800' },

  // ---------- Center pin (Uber-style picking) ----------
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -40,
    alignItems: 'center',
    zIndex: 15,
  },
  centerPin: { fontSize: 36, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
  centerPinShadow: {
    width: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginTop: -2,
  },
  pickChip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 62 : 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,10,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    zIndex: 16,
  },
  pickChipText: { color: C.white, fontSize: 13, fontWeight: '600' },
  pickCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 40 : 28,
    backgroundColor: C.black,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    zIndex: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  pickCardTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  pickCardSub: { color: C.gray400, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  pickBtnRow: { flexDirection: 'row', gap: 10 },
  pickCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.gray700,
  },
  pickCancelText: { color: C.gray400, fontSize: 14, fontWeight: '700' },
  pickConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.orange,
  },
  pickConfirmText: { color: C.black, fontSize: 14, fontWeight: '800' },

  // ---------- Bottom sheet (dark, connected to bottom) ----------
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  bottomSheet: {
    width: '100%',
    backgroundColor: C.black,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 8,
    // big bottom padding = solid black zone the floating navbar sits on
    paddingBottom: Platform.OS === 'ios' ? 112 : 100,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  dragHandleTap: { paddingVertical: 10, alignSelf: 'stretch', alignItems: 'center' },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: C.gray700,
    borderRadius: 2,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.charcoal,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  collapsedText: {
    flex: 1,
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },
  collapsedAction: { color: C.orange, fontSize: 15, fontWeight: '800' },
  pulseDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.orange,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },
  relayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
  },
  relayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
    marginRight: 7,
  },
  relayBadgeText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIcon: { color: C.orange, fontSize: 12, marginRight: 8 },
  locationText: { color: C.gray400, fontSize: 13, fontWeight: '500', flex: 1 },

  // Form fields
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gray400,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.charcoal,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 14,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: C.white,
    fontWeight: '500',
    paddingVertical: 15,
    marginLeft: 12,
  },
  fieldIcon: { fontSize: 14 },
  pinBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    marginLeft: 8,
  },
  pinBtnText: { fontSize: 14 },
  dotOrange: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.orange,
  },
  dotWhite: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: C.white,
  },
  connectorLine: {
    width: 2,
    height: 14,
    backgroundColor: C.gray700,
    marginLeft: 4,
    marginVertical: 4,
  },

  // Highway-stop suggestions
  suggList: {
    backgroundColor: C.charcoal,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    marginTop: -6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  suggPin: { fontSize: 14, marginRight: 12 },
  suggName: { color: C.white, fontSize: 14, fontWeight: '700' },
  suggTag: { color: C.gray500, fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Live status card
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulseWrap: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.orange,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusIconText: {
    color: C.black,
    fontSize: 20,
    fontWeight: '800',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: C.gray400,
    fontWeight: '500',
    lineHeight: 18,
  },

  // 🚚 Animated road
  roadScene: {
    height: 64,
    backgroundColor: C.charcoal,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  roadLineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '68%',
    height: 4,
    overflow: 'hidden',
  },
  dashRow: { flexDirection: 'row' },
  dash: {
    width: 22,
    height: 3,
    backgroundColor: C.gray700,
    borderRadius: 2,
    marginRight: 18,
  },
  truck: {
    position: 'absolute',
    left: '36%',
    top: 8,
    fontSize: 30,
  },
  roadPin: {
    position: 'absolute',
    right: 14,
    top: 12,
    fontSize: 18,
  },

  summaryCard: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { fontSize: 13, width: 14, textAlign: 'center' },
  summaryText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },

  // ---------- Activity / Stops / Profile screens ----------
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.black,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 68 : 52,
    zIndex: 8,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.8,
  },
  screenSub: {
    fontSize: 14,
    color: C.gray500,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 22,
  },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 140,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: C.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: {
    color: C.gray500,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  historyCard: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 12,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyItem: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  historyDest: {
    color: C.gray400,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  historyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: { color: C.gray500, fontSize: 12, fontWeight: '500' },
  historyTrack: { color: C.orange, fontSize: 12, fontWeight: '800' },

  // Stops directory
  lineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  lineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.orange,
    marginRight: 10,
  },
  lineTitle: {
    color: C.gray400,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  lineCard: {
    backgroundColor: C.charcoal,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stopPin: { fontSize: 14, marginRight: 12 },
  stopName: { color: C.white, fontSize: 15, fontWeight: '700' },
  stopTag: { color: C.gray500, fontSize: 11, fontWeight: '500', marginTop: 2 },
  stopAction: { color: C.orange, fontSize: 12, fontWeight: '800' },
  stopsFootnote: {
    color: C.gray500,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.charcoal,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: { color: C.black, fontSize: 24, fontWeight: '800' },
  profileEmail: { color: C.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  profileJoined: { color: C.gray500, fontSize: 13, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: C.charcoal,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 20,
    alignItems: 'center',
  },
  statNumber: { color: C.orange, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: C.gray500, fontSize: 12, fontWeight: '600' },

  btnLogout: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.gray700,
    marginBottom: 12,
  },
  btnLogoutText: { color: C.white, fontSize: 15, fontWeight: '700' },
  versionText: {
    color: C.gray700,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 120,
  },

  // ---------- Floating transparent curved navbar ----------
  navbarWrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 26 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  navbar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 22,
  },
  navItemActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
  },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.gray500,
  },
  navLabelActive: { color: C.orange, fontWeight: '800' },

  actionRow: { flexDirection: 'row', gap: 10 },
  btnNavigate: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.gray700,
  },
  btnNavigateText: { color: C.white, fontSize: 14, fontWeight: '700' },

  // Buttons
  btnCta: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
  },
  btnCtaText: {
    color: C.black,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnDisabled: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.charcoal,
    borderWidth: 1,
    borderColor: C.line,
  },
  btnDisabledText: { color: C.gray500, fontSize: 16, fontWeight: '700' },
  btnOutline: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.gray700,
  },
  btnOutlineText: { color: C.gray400, fontSize: 15, fontWeight: '700' },

  // ---------- AR Groq Scanner Styles ----------
  arScanBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arScanBadgeText: { color: C.orange, fontSize: 12, fontWeight: '800', marginLeft: 4 },
  arScanBadgeIcon: { fontSize: 14 },
  
  arTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 110,
  },
  arBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  arBadgeText: { color: C.orange, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  arCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  arCloseText: { color: C.white, fontSize: 18, fontWeight: '800' },
  
  arBottomBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 110,
  },
  arCaptureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  arCaptureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.orange,
  },
  
  arViewfinder: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: '80%',
    height: '45%',
    zIndex: 105,
    overflow: 'hidden',
  },
  arLaser: {
    width: '100%',
    height: 2,
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  arCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: C.orange },
  arCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: C.orange },
  arCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: C.orange },
  arCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: C.orange },
});
