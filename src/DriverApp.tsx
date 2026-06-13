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
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  runTransaction,
  query,
  where,
  getDocs,
  limit,
  GeoPoint,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config/firebaseConfig';

const { height } = Dimensions.get('window');

// ==========================================
// DESIGN TOKENS — ORANGE & BLACK THEME
// ==========================================
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

// Fallback point if GPS is unavailable (Guwahati)
const FALLBACK_COORDS = { latitude: 26.1445, longitude: 91.7362 };

const ACTIVE_STATUSES = ['accepted', 'picked_up'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VEHICLES = ['Bike', 'Car', 'Van', 'Truck'];

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

// Cross-platform alert helpers
const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

const confirmAsk = (title: string, message: string, onYes: () => void) => {
  if (Platform.OS === 'web') {
    // @ts-ignore
    if (window.confirm(`${title}\n\n${message}`)) onYes();
  } else {
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: onYes },
    ]);
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

// Straight-line distance in km between two points
const distKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

// Rotating messages while waiting for shipments
const WAITING_TIPS = [
  'Stay near the highway — most pickups are on the line.',
  'New shipments appear here the moment a sender posts them.',
  'Keep location on so distances stay accurate.',
];

// Copy for each job status
const JOB_COPY: Record<string, { title: string; subtitle: string }> = {
  accepted: {
    title: 'Head to pickup',
    subtitle: 'The sender has been notified that you\u2019re on the way.',
  },
  picked_up: {
    title: 'Deliver the shipment',
    subtitle: 'Drive safe — the sender can see the shipment is in transit.',
  },
  delivered: {
    title: 'Delivered \u2713',
    subtitle: 'Great job. You\u2019re ready for the next shipment.',
  },
  cancelled: {
    title: 'Cancelled by sender',
    subtitle: 'This request was withdrawn. No action needed.',
  },
};

const STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'delivered', label: 'Delivered' },
];
const STEP_INDEX: Record<string, number> = { accepted: 0, picked_up: 1, delivered: 2 };

// Badge colors for the Activity list
const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  accepted: { label: 'Accepted', color: C.orange, bg: 'rgba(249,115,22,0.12)' },
  picked_up: { label: 'In transit', color: C.orange, bg: 'rgba(249,115,22,0.12)' },
  delivered: { label: 'Delivered', color: C.white, bg: 'rgba(255,255,255,0.08)' },
  cancelled: { label: 'Cancelled', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
  searching: { label: 'Released', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
};

const TABS = [
  { key: 'home', icon: '🛻', label: 'Drive' },
  { key: 'activity', icon: '🧾', label: 'Activity' },
  { key: 'profile', icon: '👤', label: 'Profile' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type LatLng = { latitude: number; longitude: number };

export default function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  // Auth form state
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState('Bike');
  const [authLoading, setAuthLoading] = useState(false);

  // Driver state
  const [online, setOnline] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [declinedJobs, setDeclinedJobs] = useState<string[]>([]); // Memory for cancelled/declined jobs
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [ticker, setTicker] = useState(Date.now()); // Live clock for 60s countdown

  // AI Relay Route State
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeStart, setRouteStart] = useState('');
  const [routeEnd, setRouteEnd] = useState('');

  // AI Combined Pooling State
  const [showPoolModal, setShowPoolModal] = useState(false);

  // Navigation + history + sheet
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [history, setHistory] = useState<any[]>([]);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  // Real location (live — drivers move)
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const coordsRef = useRef<LatLng | null>(null);
  const mapRef = useRef<any>(null);
  const mapIframeRef = useRef<any>(null);

  // Animations / rotating tips
  const pulse = useRef(new Animated.Value(1)).current;
  const dashAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const [tipIndex, setTipIndex] = useState(0);

  // Derived Values
  const jobStatus: string | undefined = activeJob?.status;
  const isScanning = online && !activeJobId;
  const truckActive = jobStatus === 'picked_up';

  // Tick the clock every second to power the 60s countdown
  useEffect(() => {
    const t = setInterval(() => setTicker(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const jobsSorted = [...availableJobs].sort((a, b) => {
    if (!coords) return 0;
    const da = a.pickup_coords ? distKm(coords, a.pickup_coords) : 99999;
    const dbb = b.pickup_coords ? distKm(coords, b.pickup_coords) : 99999;
    return da - dbb;
  });

  // Filter out declined jobs OR jobs older than 60 seconds
  const visibleJobs = jobsSorted.filter((job) => {
    if (declinedJobs.includes(job.id)) return false;
    const ageSecs = job.created_at ? Math.floor((ticker - (job.created_at?.toMillis?.() || ticker)) / 1000) : 0;
    return ageSecs <= 60;
  });

  const pickupDistance =
    activeJob?.pickup_coords && coords ? distKm(coords, activeJob.pickup_coords) : null;
  const dropDistance =
    activeJob?.dropoff_coords && coords ? distKm(coords, activeJob.dropoff_coords) : null;

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

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
  // 2. LOAD THE DRIVER PROFILE (name + vehicle)
  // ------------------------------------------
  useEffect(() => {
    if (!user) {
      setDriverProfile(null);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'Drivers', user.uid));
        if (snap.exists()) {
          setDriverProfile(snap.data());
        } else {
          // Account exists but no profile yet (e.g. created elsewhere)
          setDriverProfile({ name: user.email?.split('@')[0] ?? 'Driver', vehicle: '—' });
        }
      } catch {
        setDriverProfile({ name: 'Driver', vehicle: '—' });
      }
    })();
  }, [user]);

  // ------------------------------------------
  // 3. LIVE GPS — drivers move, so we watch position
  // ------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let sub: any = null;
    let webId: any = null;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          // @ts-ignore - browser geolocation
          webId = navigator.geolocation?.watchPosition(
            (pos: any) => {
              if (!cancelled) {
                setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            },
            () => !cancelled && setLocationDenied(true),
            { enableHighAccuracy: true }
          );
        } else {
          const { status: perm } = await Location.requestForegroundPermissionsAsync();
          if (perm !== 'granted') {
            if (!cancelled) setLocationDenied(true);
            return;
          }
          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 50, // metres between updates
              timeInterval: 10000,
            },
            (pos: any) => {
              if (!cancelled) {
                setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            }
          );
        }
      } catch {
        if (!cancelled) setLocationDenied(true);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove?.();
      // @ts-ignore
      if (webId != null) navigator.geolocation?.clearWatch(webId);
    };
  }, [user]);

  // Centre the map on the driver the first time we get a fix
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (coords && !centeredOnce.current) {
      centeredOnce.current = true;
      if (Platform.OS === 'web' && mapIframeRef.current) {
         mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'flyTo', lat: coords.latitude, lng: coords.longitude }), '*');
      } else if (mapRef.current && Platform.OS !== 'web') {
         mapRef.current.animateToRegion({ ...coords, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
      }
    }
  }, [coords]);

  // ------------------------------------------
  // 4. RESUME AN ACTIVE JOB AFTER APP RESTART
  // ------------------------------------------
  useEffect(() => {
    if (!user) {
      setActiveJobId(null);
      setActiveJob(null);
      setOnline(false);
      setActiveTab('home');
      return;
    }
    (async () => {
      try {
        const q = query(
          collection(db, 'Packages'),
          where('driver_id', '==', user.uid),
          where('status', 'in', ACTIVE_STATUSES),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // OPTIMISTIC UI FIX: Eagerly set the active job data before snapshot loads
          setActiveJob({ id: snap.docs[0].id, ...snap.docs[0].data() });
          setActiveJobId(snap.docs[0].id);
          setOnline(true);
        }
      } catch {
        // Offline or index still building — safe to ignore
      }
    })();
  }, [user]);

  // ------------------------------------------
  // 5. LIVE LISTENER on the active job
  // ------------------------------------------
  useEffect(() => {
    if (!activeJobId) return;
    const unsub = onSnapshot(doc(db, 'Packages', activeJobId), (snap) => {
      if (!snap.exists()) {
        setActiveJobId(null);
        setActiveJob(null);
        return;
      }
      const data: any = { id: snap.id, ...snap.data() };
      // If the job was released back to the pool, let go of it
      if (data.status === 'searching') {
        setActiveJobId(null);
        setActiveJob(null);
        return;
      }
      setActiveJob(data);
    });
    return unsub;
  }, [activeJobId]);

  // ------------------------------------------
  // 6. AVAILABLE SHIPMENTS — live feed while online
  // ------------------------------------------
  useEffect(() => {
    if (!user || !online) {
      setAvailableJobs([]);
      return;
    }
    // Driver can see available jobs even if they have an active one (for Pooling)
    const q = query(collection(db, 'Packages'), where('status', '==', 'searching'), limit(25));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAvailableJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return unsub;
  }, [user, online]);

  // ------------------------------------------
  // UPDATE WEB MAP MARKERS DYNAMICALLY
  // ------------------------------------------
  useEffect(() => {
    if (Platform.OS === 'web' && mapIframeRef.current) {
      const availablePayload = online 
        ? visibleJobs.filter(j => j.pickup_coords).map(j => ({lat: j.pickup_coords.latitude, lng: j.pickup_coords.longitude}))
        : [];
        
      mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({
        type: 'updateMarkers',
        driver: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
        pickup: activeJob?.pickup_coords ? { lat: activeJob.pickup_coords.latitude, lng: activeJob.pickup_coords.longitude } : null,
        drop: activeJob?.dropoff_coords ? { lat: activeJob.dropoff_coords.latitude, lng: activeJob.dropoff_coords.longitude } : null,
        available: availablePayload
      }), '*');
    }
  }, [coords, activeJob, online, visibleJobs]);

  // ------------------------------------------
  // 7. 60-SECOND ALARM SOUND / VIBRATION FOR NEW JOBS
  // ------------------------------------------
  useEffect(() => {
    let audio: any = null;
    let interval: any = null;
    let timeout: any = null;

    if (online && visibleJobs.length > 0 && !activeJobId) {
      if (Platform.OS === 'web') {
        try {
          audio = new window.Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
          audio.loop = true;
          audio.play().catch(() => {});
        } catch (e) {}
      } else {
        // Vibrate continuously on native devices
        interval = setInterval(() => Vibration.vibrate(500), 2000);
      }

      // Stop the alarm forcefully after 60 seconds
      timeout = setTimeout(() => {
        if (audio) { audio.pause(); audio.currentTime = 0; }
        if (interval) clearInterval(interval);
      }, 60000);
    }

    return () => {
      if (audio) { audio.pause(); audio.currentTime = 0; }
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [online, visibleJobs.length, activeJobId]);


  // ------------------------------------------
  // 8. ACTIVITY — this driver's past jobs
  // ------------------------------------------
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    const q = query(collection(db, 'Packages'), where('driver_id', '==', user.uid), limit(50));
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

  // ------------------------------------------
  // 9. LIVE UBER TRACKING (FAST 4-SECOND PING)
  //    Updates location for ALL packages driver is carrying
  // ------------------------------------------
  useEffect(() => {
    if (!online || history.length === 0) return;
    const activeJobs = history.filter(h => ACTIVE_STATUSES.includes(h.status));
    if (activeJobs.length === 0) return;

    const push = async () => {
      const c = coordsRef.current;
      if (!c) return;
      try {
        activeJobs.forEach(job => {
           updateDoc(doc(db, 'Packages', job.id), {
             driver_coords: new GeoPoint(c.latitude, c.longitude),
             driver_updated_at: serverTimestamp(),
           });
        });
      } catch {
        // transient network issues are fine
      }
    };
    push();
    const id = setInterval(push, 4000); // 4 seconds for real-time tracking
    return () => clearInterval(id);
  }, [online, history]);

  // Pulse + rotating tips while scanning for shipments
  useEffect(() => {
    if (!isScanning) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % WAITING_TIPS.length), 4000);
    return () => {
      anim.stop();
      clearInterval(interval);
    };
  }, [isScanning]);

  // 🚚 Truck drive animation while delivering
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
  // 10. FIREBASE AUTHENTICATION (with driver profile)
  // ------------------------------------------
  const handleAuthentication = async () => {
    if (!email || !password) {
      notify('Missing details', 'Enter both your email and password to continue.');
      return;
    }
    if (!isLoginMode && !name.trim()) {
      notify('Missing name', 'Senders see your name when you accept a shipment.');
      return;
    }
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'Drivers', cred.user.uid), {
          name: name.trim(),
          vehicle,
          email: email.trim(),
          created_at: serverTimestamp(),
        });
        setDriverProfile({ name: name.trim(), vehicle });
      }
      setEmail('');
      setPassword('');
      setName('');
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
  // 11. ACCEPT A SHIPMENT — transaction-safe
  // ------------------------------------------
  const acceptJob = async (job: any) => {
    if (!user || acceptingId) return;
    setAcceptingId(job.id);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'Packages', job.id);
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data().status !== 'searching') {
          throw new Error('taken');
        }
        tx.update(ref, {
          status: 'accepted',
          driver_id: user.uid,
          driver_name: driverProfile?.name ?? 'Driver',
          driver_vehicle: driverProfile?.vehicle ?? null,
          accepted_at: serverTimestamp(),
        });
      });
      // OPTIMISTIC UI FIX: Eagerly set the active job data so it instantly displays
      setActiveJob({ ...job, status: 'accepted' });
      setActiveJobId(job.id);
      setSheetCollapsed(false);
      // Fit the map to driver + pickup
      const p = job.pickup_coords;
      if (p && coords) {
        if (Platform.OS === 'web' && mapIframeRef.current) {
            mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'fitBounds', lat1: coords.latitude, lng1: coords.longitude, lat2: p.latitude, lng2: p.longitude }), '*');
        } else if (mapRef.current && Platform.OS !== 'web') {
            mapRef.current.fitToCoordinates(
              [coords, { latitude: p.latitude, longitude: p.longitude }],
              { edgePadding: { top: 140, bottom: 440, left: 70, right: 70 }, animated: true }
            );
        }
      }
    } catch {
      notify('Too late', 'Another driver just took this shipment.');
    } finally {
      setAcceptingId(null);
    }
  };

  // Decline a job (local memory so it hides)
  const declineJob = (jobId: string) => {
    setDeclinedJobs(prev => [...prev, jobId]);
  };

  // ------------------------------------------
  // 12. PROGRESS THE JOB:  accepted → picked_up → delivered
  // ------------------------------------------
  const advanceStatus = async () => {
    if (!activeJobId || !jobStatus) return;
    const next = jobStatus === 'accepted' ? 'picked_up' : jobStatus === 'picked_up' ? 'delivered' : null;
    if (!next) return;

    const go = async () => {
      setActionLoading(true);
      try {
        const update: any = { status: next };
        if (next === 'picked_up') update.picked_up_at = serverTimestamp();
        if (next === 'delivered') update.delivered_at = serverTimestamp();
        await updateDoc(doc(db, 'Packages', activeJobId), update);
        
        // After pickup, point the map toward the drop
        if (next === 'picked_up') {
          const d = activeJob?.dropoff_coords;
          if (d && coords) {
            if (Platform.OS === 'web' && mapIframeRef.current) {
                mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'fitBounds', lat1: coords.latitude, lng1: coords.longitude, lat2: d.latitude, lng2: d.longitude }), '*');
            } else if (mapRef.current && Platform.OS !== 'web') {
                mapRef.current.fitToCoordinates(
                  [coords, { latitude: d.latitude, longitude: d.longitude }],
                  { edgePadding: { top: 140, bottom: 440, left: 70, right: 70 }, animated: true }
                );
            }
          }
        }
      } catch {
        notify('Could not update', 'Check your connection and try again.');
      } finally {
        setActionLoading(false);
      }
    };

    if (next === 'delivered') {
      confirmAsk('Mark as delivered?', 'Confirm the shipment has been handed over at the drop point.', go);
    } else {
      go();
    }
  };

  // Release the job back to the pool
  const releaseJob = () => {
    if (!activeJobId) return;
    confirmAsk(
      'Release this shipment?',
      'It will go back to the pool so another driver can take it.',
      async () => {
        try {
          setDeclinedJobs(prev => [...prev, activeJobId]); // Bug Fix: Add to memory so it doesn't pop up again
          await updateDoc(doc(db, 'Packages', activeJobId), {
            status: 'searching',
            driver_id: null,
            driver_name: null,
            driver_vehicle: null,
            driver_coords: null,
          });
          setActiveJobId(null);
          setActiveJob(null);
        } catch {
          notify('Could not release', 'Check your connection and try again.');
        }
      }
    );
  };

  // ------------------------------------------
  // AI RELAY TRANSFER LOGIC
  // ------------------------------------------
  const transferToRelay = async () => {
    if (!activeJobId) return;
    confirmAsk(
      'Transfer to Relay Hub?',
      'This drops the package at the nearest AI relay node. The next overlapping driver will automatically be assigned to carry it further.',
      async () => {
        setActionLoading(true);
        try {
          setDeclinedJobs(prev => [...prev, activeJobId]); // Bug Fix: Hide it locally after relay
          await updateDoc(doc(db, 'Packages', activeJobId), {
            status: 'searching', // Sends it back into the pool for the next driver
            pickup_name: `Relay Node (${driverProfile?.name || 'Driver'} dropped)`,
            pickup_coords: coords ? new GeoPoint(coords.latitude, coords.longitude) : activeJob?.pickup_coords,
            driver_id: null,
            driver_name: null,
            driver_vehicle: null,
            driver_coords: null,
          });
          setActiveJobId(null);
          setActiveJob(null);
          notify('Relay Successful', 'Package handed off to the AI relay network. It is now broadcasting to drivers in the next sector.');
        } catch {
          notify('Error', 'Could not transfer package.');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const dismissJob = () => {
    setActiveJobId(null);
    setActiveJob(null);
  };

  // Open turn-by-turn navigation in Google Maps
  const openNavigation = () => {
    const target =
      jobStatus === 'picked_up' && activeJob?.dropoff_coords
        ? activeJob.dropoff_coords
        : activeJob?.pickup_coords;
    if (!target) {
      notify('No coordinates', 'This stop has no pinned location to navigate to.');
      return;
    }
    // Launch actual Google Maps navigation route directly to coordinates
    Linking.openURL(
      `maps.google.com/maps?q={target.latitude},${target.longitude}`
    );
  };

  // ==========================================
  // VIEW: SPLASH
  // ==========================================
  if (isInitializing) {
    return (
      <View style={styles.center}>
        <Text style={styles.splashLogo}>
          Enso<Text style={{ color: C.orange }}> Driver</Text>
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
            Enso<Text style={{ color: C.orange }}> Driver</Text>
          </Text>
          <Text style={styles.authSubtitle}>
            Earn on routes you\u2019re already driving.
          </Text>

          {!isLoginMode && (
            <>
              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="Shown to senders when you accept"
                placeholderTextColor={C.gray500}
                selectionColor={C.orange}
                value={name}
                onChangeText={setName}
                // @ts-ignore
                outlineStyle="none"
              />

              <Text style={styles.inputLabel}>Vehicle</Text>
              <View style={styles.vehicleRow}>
                {VEHICLES.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.vehicleChip, vehicle === v && styles.vehicleChipActive]}
                    onPress={() => setVehicle(v)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.vehicleChipText, vehicle === v && styles.vehicleChipTextActive]}
                    >
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

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
                {isLoginMode ? 'Log in' : 'Start driving'}
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
                  New driver? <Text style={styles.authToggleAccent}>Sign up</Text>
                </>
              ) : (
                <>
                  Already registered? <Text style={styles.authToggleAccent}>Log in</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.authFooter}>Your route. Your earnings.</Text>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // VIEW: MAIN APP
  // ==========================================
  const mapCenter = coords ?? FALLBACK_COORDS;
  const jobCopy = jobStatus ? JOB_COPY[jobStatus] ?? null : null;
  const showJobCard = !!activeJob && !!jobCopy;
  const jobFinished = jobStatus === 'delivered' || jobStatus === 'cancelled';
  const userInitial = (driverProfile?.name?.[0] ?? user.email?.[0] ?? 'D').toUpperCase();
  const deliveredCount = history.filter((h) => h.status === 'delivered').length;

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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${mapCenter.latitude}, ${mapCenter.longitude}], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        let driverMarker = null;
        let pickupMarker = null;
        let dropMarker = null;
        let availableMarkers = [];

        const driverIcon = L.divIcon({ html: '<div style="font-size:24px; background:white; border-radius:50%; width:30px; height:30px; display:flex; justify-content:center; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.3)">🛻</div>', className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
        const orangeIcon = L.divIcon({ html: '<div style="font-size:24px">📍</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 24] });
        const blackIcon = L.divIcon({ html: '<div style="font-size:24px; filter: grayscale(1)">📍</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 24] });

        window.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'flyTo') {
              map.flyTo([data.lat, data.lng], 14, { animate: true, duration: 1.5 });
            }
            if (data.type === 'fitBounds') {
              const bounds = L.latLngBounds([data.lat1, data.lng1], [data.lat2, data.lng2]);
              map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1.5 });
            }
            if (data.type === 'updateMarkers') {
              if (driverMarker) map.removeLayer(driverMarker);
              if (pickupMarker) map.removeLayer(pickupMarker);
              if (dropMarker) map.removeLayer(dropMarker);
              availableMarkers.forEach(m => map.removeLayer(m));
              availableMarkers = [];

              if (data.driver) driverMarker = L.marker([data.driver.lat, data.driver.lng], {icon: driverIcon, zIndexOffset: 1000}).addTo(map);
              if (data.pickup) pickupMarker = L.marker([data.pickup.lat, data.pickup.lng], {icon: orangeIcon}).addTo(map);
              if (data.drop) dropMarker = L.marker([data.drop.lat, data.drop.lng], {icon: blackIcon}).addTo(map);
              
              if (data.available && data.available.length > 0) {
                 data.available.forEach(job => {
                    const m = L.marker([job.lat, job.lng], {icon: orangeIcon}).addTo(map);
                    availableMarkers.push(m);
                 });
              }
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

      {/* ---------- AI POOLING MODAL ---------- */}
      {showPoolModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 110, justifyContent: 'center', padding: 20 }]}>
          <View style={styles.routeCard}>
             <Text style={styles.routeTitle}>AI Route Pooling</Text>
             <Text style={styles.routeSub}>Scanning for packages overlapping with your current trajectory...</Text>
             <ScrollView style={{maxHeight: height * 0.5}}>
                {visibleJobs.length === 0 ? <Text style={{color: C.gray400}}>No overlapping packages found right now.</Text> : visibleJobs.map(job => {
                  const p = job.pickup_coords;
                  const d = job.dropoff_coords;
                  const tripDist = p && d ? distKm(p, d) : 10;
                  const estPrice = Math.round(150 + (tripDist * 14)); // Pricing Formula

                  return (
                   <View key={job.id} style={styles.jobCard}>
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       {job.cargo_image && (
                          <Image source={{uri: job.cargo_image}} style={{width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: C.black}} />
                       )}
                       <View style={{flex: 1}}>
                         <View style={styles.jobTop}>
                           <Text style={styles.jobItem} numberOfLines={1}>{job.item_name}</Text>
                           <Text style={styles.jobPrice}>₹{estPrice}</Text>
                         </View>
                         <Text style={styles.jobRoute} numberOfLines={1}>
                           {(job.pickup_name ?? 'Current location') + '  →  ' + job.destination_name}
                         </Text>
                       </View>
                     </View>
                     <TouchableOpacity style={[styles.acceptBtn, {marginTop: 10}]} onPress={() => { acceptJob(job); setShowPoolModal(false); }}>
                        <Text style={styles.acceptBtnText}>Add to Pool</Text>
                     </TouchableOpacity>
                   </View>
                  );
                })}
             </ScrollView>
             <TouchableOpacity style={{marginTop: 15, padding: 15, backgroundColor: C.charcoal, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.line}} onPress={() => setShowPoolModal(false)}>
                <Text style={{color: C.white, fontWeight: '700'}}>Close</Text>
             </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---------- AI RELAY ROUTE MODAL ---------- */}
      {showRouteModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, justifyContent: 'center', padding: 24 }]}>
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Set Your Relay Route</Text>
            <Text style={styles.routeSub}>Enter your path so the AI can match you with overlapping shipments along your journey.</Text>

            <Text style={styles.inputLabel}>Starting point</Text>
            <TextInput style={styles.inputBox} placeholder="e.g. Guwahati" placeholderTextColor={C.gray500} value={routeStart} onChangeText={setRouteStart} />

            <Text style={styles.inputLabel}>Destination</Text>
            <TextInput style={styles.inputBox} placeholder="e.g. Shillong" placeholderTextColor={C.gray500} value={routeEnd} onChangeText={setRouteEnd} />

            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.btnOutline, {flex: 1}]} onPress={() => setShowRouteModal(false)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnCta, {flex: 2}]} onPress={() => {
                if(!routeStart || !routeEnd) { notify('Missing route', 'Please enter your start and end points.'); return; }
                setShowRouteModal(false);
                setOnline(true);
              }}>
                <Text style={styles.btnCtaText}>Go Online</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ---------- FULL-SCREEN SCROLLABLE MAP ---------- */}
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
          initialRegion={{ ...mapCenter, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {/* Active job pins */}
          {activeJob?.pickup_coords && (
            <Marker
              coordinate={{
                latitude: activeJob.pickup_coords.latitude,
                longitude: activeJob.pickup_coords.longitude,
              }}
              title="Pickup"
              description={activeJob.pickup_name ?? 'Pickup point'}
              pinColor={C.orange}
            />
          )}
          {activeJob?.dropoff_coords && (
            <Marker
              coordinate={{
                latitude: activeJob.dropoff_coords.latitude,
                longitude: activeJob.dropoff_coords.longitude,
              }}
              title="Drop"
              description={activeJob.destination_name ?? 'Drop point'}
              pinColor={C.black}
            />
          )}
          {/* Available shipment pins while browsing */}
          {!activeJob &&
            online &&
            visibleJobs.map(
              (j) =>
                j.pickup_coords && (
                  <Marker
                    key={j.id}
                    coordinate={{
                      latitude: j.pickup_coords.latitude,
                      longitude: j.pickup_coords.longitude,
                    }}
                    title={j.item_name}
                    description={`→ ${j.destination_name}`}
                    pinColor={C.orange}
                  />
                )
            )}
        </MapView>
      )}

      {/* ---------- FLOATING HEADER (home only) ---------- */}
      {activeTab === 'home' && (
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>
              Enso<Text style={{ color: C.orange }}> Driver</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={styles.onlinePill}
              onPress={() => {
                if (activeJobId) {
                  notify('Finish your job first', 'Complete or release the active shipment before going offline.');
                  return;
                }
                if (!online) {
                  setShowRouteModal(true); // Ask for Relay Route before going online
                } else {
                  setOnline(false); // Go offline directly
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.onlineDot, { backgroundColor: online ? C.orange : C.gray500 }]} />
              <Text style={styles.onlineText}>{online ? 'Online' : 'Offline'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBadge}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarBadgeText}>{userInitial}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---------- BOTTOM SHEET (home only) ---------- */}
      {activeTab === 'home' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View style={styles.bottomSheet}>
            <TouchableOpacity
              style={styles.dragHandleTap}
              onPress={() => {
                setSheetCollapsed((s) => !s);
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
                {showJobCard ? (
                  <>
                    <View style={styles.pulseDotSmall} />
                    <Text style={styles.collapsedText} numberOfLines={1}>
                      {jobCopy!.title}
                    </Text>
                    <Text style={styles.collapsedAction}>View</Text>
                  </>
                ) : online ? (
                  <>
                    <View style={styles.pulseDotSmall} />
                    <Text style={styles.collapsedText}>
                      {visibleJobs.length > 0
                        ? `${visibleJobs.length} shipment${visibleJobs.length === 1 ? '' : 's'} nearby`
                        : 'Scanning for shipments…'}
                    </Text>
                    <Text style={styles.collapsedAction}>Open</Text>
                  </>
                ) : (
                  <>
                    <View style={[styles.pulseDotSmall, { backgroundColor: C.gray500 }]} />
                    <Text style={styles.collapsedText}>You\u2019re offline</Text>
                    <Text style={styles.collapsedAction}>Open</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : showJobCard ? (
              /* ================= ACTIVE JOB CARD ================= */
              <View>
                {/* Step progress */}
                {!jobFinished || jobStatus === 'delivered' ? (
                  <View style={styles.stepperRow}>
                    {STEPS.map((s, i) => {
                      const done = STEP_INDEX[jobStatus!] >= i;
                      return (
                        <React.Fragment key={s.key}>
                          {i > 0 && (
                            <View
                              style={[
                                styles.stepLine,
                                STEP_INDEX[jobStatus!] >= i && { backgroundColor: C.orange },
                              ]}
                            />
                          )}
                          <View style={styles.stepItem}>
                            <View style={[styles.stepDot, done && styles.stepDotDone]}>
                              {done && <Text style={styles.stepDotCheck}>✓</Text>}
                            </View>
                            <Text style={[styles.stepLabel, done && { color: C.white }]}>
                              {s.label}
                            </Text>
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </View>
                ) : null}

                <View style={styles.statusHeader}>
                  <View
                    style={[
                      styles.statusIcon,
                      jobStatus === 'cancelled' && { backgroundColor: C.charcoal },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusIconText,
                        jobStatus === 'cancelled' && { color: C.gray500 },
                      ]}
                    >
                      {jobStatus === 'accepted'
                        ? '→'
                        : jobStatus === 'picked_up'
                        ? '🚚'
                        : jobStatus === 'delivered'
                        ? '✓'
                        : '✕'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>{jobCopy!.title}</Text>
                    <Text style={styles.statusSubtitle}>{jobCopy!.subtitle}</Text>
                  </View>
                </View>

                {/* 🚚 Truck animation while in transit */}
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

                {/* Job details */}
                <View style={styles.summaryCard}>
                  {/* Driver sees the Groq AR snapshot if it exists */}
                  {activeJob.cargo_image && (
                     <Image source={{uri: activeJob.cargo_image}} style={{width: '100%', height: 140, borderRadius: 12, marginBottom: 16, backgroundColor: C.black}} resizeMode="cover" />
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryIcon}>📦</Text>
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activeJob.item_name}
                    </Text>
                  </View>
                  <View style={styles.connectorLine} />
                  <View style={styles.summaryRow}>
                    <View style={styles.dotOrange} />
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activeJob.pickup_name ?? 'Pickup point'}
                    </Text>
                    {pickupDistance != null && jobStatus === 'accepted' && (
                      <Text style={styles.distText}>~{pickupDistance.toFixed(1)} km</Text>
                    )}
                  </View>
                  <View style={styles.connectorLine} />
                  <View style={styles.summaryRow}>
                    <View style={styles.dotWhite} />
                    <Text style={styles.summaryText} numberOfLines={1}>
                      {activeJob.destination_name}
                    </Text>
                    {dropDistance != null && jobStatus === 'picked_up' && (
                      <Text style={styles.distText}>~{dropDistance.toFixed(1)} km</Text>
                    )}
                  </View>
                  {activeJob.sender_email && (
                    <>
                      <View style={styles.connectorLine} />
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryIcon}>✉️</Text>
                        <Text style={[styles.summaryText, { color: C.gray400 }]} numberOfLines={1}>
                          {activeJob.sender_email}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Actions */}
                {jobFinished ? (
                  <TouchableOpacity style={styles.btnCta} onPress={dismissJob} activeOpacity={0.85}>
                    <Text style={styles.btnCtaText}>
                      {jobStatus === 'delivered' ? 'Find next shipment' : 'Back to shipments'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.btnNavigate}
                        onPress={openNavigation}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnNavigateText}>🧭 Navigate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnCtaFlex}
                        onPress={advanceStatus}
                        disabled={actionLoading}
                        activeOpacity={0.85}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color={C.black} />
                        ) : (
                          <Text style={styles.btnCtaText}>
                            {jobStatus === 'accepted' ? 'Confirm pickup' : 'Mark as delivered'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    
                    {/* Secondary Actions Row */}
                    {jobStatus === 'accepted' ? (
                      <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
                        <TouchableOpacity style={[styles.releaseBtn, {flex: 1, marginTop: 0}]} onPress={releaseJob} activeOpacity={0.7}>
                          <Text style={styles.releaseText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnOutline, {flex: 2, paddingVertical: 12, marginTop: 0}]} onPress={transferToRelay} activeOpacity={0.7}>
                          <Text style={[styles.btnOutlineText, {color: C.orange, fontSize: 13}]}>🔄 Drop at Hub</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.btnOutline, {marginTop: 14, paddingVertical: 12}]} onPress={transferToRelay} activeOpacity={0.7}>
                        <Text style={[styles.btnOutlineText, {color: C.orange, fontSize: 13}]}>🔄 Drop at Relay Hub</Text>
                      </TouchableOpacity>
                    )}

                    {/* AI Pool Scanner Button */}
                    <TouchableOpacity style={styles.poolBtn} onPress={() => setShowPoolModal(true)} activeOpacity={0.8}>
                       <Text style={styles.poolBtnText}>📦 Have more space? Find combined deliveries</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : !online ? (
              /* ================= OFFLINE CARD ================= */
              <View>
                <Text style={styles.sheetTitle}>You\u2019re offline</Text>
                <Text style={styles.offlineSub}>
                  Go online to see live shipments along your route. You\u2019ll only be shown
                  requests while you\u2019re online.
                </Text>
                <TouchableOpacity
                  style={styles.btnCta}
                  onPress={() => setShowRouteModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnCtaText}>Go online</Text>
                </TouchableOpacity>
                {locationDenied && (
                  <Text style={styles.locationWarn}>
                    Location is off — turn it on so senders see accurate distances.
                  </Text>
                )}
              </View>
            ) : (
              /* ================= AVAILABLE SHIPMENTS ================= */
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.sheetTitle}>Available shipments</Text>
                  <View style={styles.relayBadge}>
                    <View style={styles.relayDot} />
                    <Text style={styles.relayBadgeText}>
                      {visibleJobs.length} live
                    </Text>
                  </View>
                </View>

                {visibleJobs.length === 0 ? (
                  <View style={styles.scanWrap}>
                    <View style={styles.pulseWrap}>
                      <Animated.View
                        style={[styles.pulseRing, { transform: [{ scale: pulse }] }]}
                      />
                      <View style={styles.pulseDot} />
                    </View>
                    <Text style={styles.scanTitle}>Scanning for shipments…</Text>
                    <Text style={styles.scanSub}>{WAITING_TIPS[tipIndex]}</Text>
                    <TouchableOpacity
                      style={styles.btnOutline}
                      onPress={() => setOnline(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnOutlineText}>Go offline</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView
                    style={{ maxHeight: height * 0.4 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {visibleJobs.map((job) => {
                      const ageSecs = job.created_at ? Math.floor((ticker - (job.created_at?.toMillis?.() || ticker)) / 1000) : 0;
                      const timeLeft = Math.max(0, 60 - ageSecs);
                      const p = job.pickup_coords;
                      const d = job.dropoff_coords;
                      const tripDist = p && d ? distKm(p, d) : 10;
                      const estPrice = Math.round(150 + (tripDist * 14)); // Dynamic Pricing logic

                      return (
                        <View key={job.id} style={styles.jobCard}>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            {/* Driver sees cargo preview directly in the feed */}
                            {job.cargo_image && (
                               <Image source={{uri: job.cargo_image}} style={{width: 60, height: 60, borderRadius: 10, marginRight: 14, backgroundColor: C.black}} />
                            )}
                            <View style={{flex: 1}}>
                              <View style={styles.jobTop}>
                                <Text style={styles.jobItem} numberOfLines={1}>
                                  {job.item_name}
                                </Text>
                                <Text style={styles.jobPrice}>₹{estPrice}</Text>
                              </View>
                              <Text style={styles.jobRoute} numberOfLines={1}>
                                {(job.pickup_name ?? 'Current location') +
                                  '  →  ' +
                                  job.destination_name}
                              </Text>
                            </View>
                          </View>
                          
                          <Text style={{color: C.orange, fontSize: 12, textAlign: 'center', marginTop: 12, fontWeight: '700'}}>
                            ⏳ {timeLeft}s remaining to accept
                          </Text>

                          <View style={[styles.jobBottom, {marginTop: 10, gap: 10}]}>
                            <TouchableOpacity
                              style={styles.declineBtn}
                              onPress={() => declineJob(job.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.acceptBtnFlex}
                              onPress={() => acceptJob(job)}
                              disabled={!!acceptingId}
                              activeOpacity={0.85}
                            >
                              {acceptingId === job.id ? (
                                <ActivityIndicator size="small" color={C.black} />
                              ) : (
                                <Text style={styles.acceptBtnText}>Accept</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
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
              ? 'Your jobs will appear here'
              : `${history.length} job${history.length === 1 ? '' : 's'} · ${deliveredCount} delivered`}
          </Text>

          {history.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🛻</Text>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptySub}>
                Go online and accept your first shipment — it will show up here.
              </Text>
              <TouchableOpacity
                style={[styles.btnCta, { marginTop: 24, width: 'auto', paddingHorizontal: 28 }]}
                onPress={() => {
                  setActiveTab('home');
                  setShowRouteModal(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.btnCtaText}>Go online</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 130 }}
              showsVerticalScrollIndicator={false}
            >
              {history.map((item) => {
                const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.accepted;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    activeOpacity={ACTIVE_STATUSES.includes(item.status) ? 0.7 : 1}
                    onPress={() => {
                      if (ACTIVE_STATUSES.includes(item.status)) {
                         // OPTIMISTIC UI FIX: Eagerly inject the job data
                         setActiveJob(item);
                         setActiveJobId(item.id);
                         setActiveTab('home');
                         setSheetCollapsed(false);
                      }
                    }}
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
                      {(item.pickup_name ?? 'Pickup') + '  →  ' + item.destination_name}
                    </Text>
                    <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ======================= PROFILE TAB ======================= */}
      {activeTab === 'profile' && (
        <View style={styles.screen}>
          <Text style={styles.screenTitle}>Profile</Text>
          <Text style={styles.screenSub}>Your driver account</Text>

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{userInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {driverProfile?.name ?? 'Driver'}
              </Text>
              <Text style={styles.profileJoined} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View style={styles.vehicleBadge}>
              <Text style={styles.vehicleBadgeText}>{driverProfile?.vehicle ?? '—'}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{deliveredCount}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{history.length}</Text>
              <Text style={styles.statLabel}>Jobs taken</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.btnLogoutText}>Log out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Enso Driver v1.0</Text>
        </View>
      )}

      {/* ======================= FLOATING TRANSPARENT CURVED NAVBAR ======================= */}
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
                  Keyboard.dismiss();
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.navIcon, !active && { opacity: 0.45 }]}>{tab.icon}</Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
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
    fontSize: 40,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1.2,
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
    fontSize: 38,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -1.2,
    marginBottom: 10,
  },
  authSubtitle: {
    fontSize: 15,
    color: C.gray400,
    marginBottom: 36,
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
    marginBottom: 18,
    fontSize: 16,
    color: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  vehicleRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  vehicleChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.charcoal,
    borderWidth: 1,
    borderColor: C.line,
  },
  vehicleChipActive: {
    backgroundColor: 'rgba(249,115,22,0.14)',
    borderColor: 'rgba(249,115,22,0.4)',
  },
  vehicleChipText: { color: C.gray400, fontSize: 13, fontWeight: '700' },
  vehicleChipTextActive: { color: C.orange },
  btnPrimary: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
    marginTop: 6,
  },
  btnPrimaryText: {
    color: C.black,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  authToggle: { marginTop: 26, alignItems: 'center' },
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.4,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.black,
    paddingHorizontal: 14,
    borderRadius: 21,
    height: 42,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  onlineText: { color: C.white, fontSize: 13, fontWeight: '700' },
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

  // ---------- AI Relay Route Modal ----------
  routeCard: { 
    backgroundColor: C.charcoal, 
    borderRadius: 20, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: C.line,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: {width: 0, height: 10}, elevation: 20
  },
  routeTitle: { fontSize: 22, fontWeight: '800', color: C.white, marginBottom: 8 },
  routeSub: { fontSize: 14, color: C.gray400, marginBottom: 20, lineHeight: 20 },

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
    marginBottom: 16,
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

  offlineSub: {
    color: C.gray400,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },
  locationWarn: {
    color: C.gray500,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },

  scanWrap: { alignItems: 'center', paddingVertical: 6 },
  scanTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginTop: 10 },
  scanSub: {
    color: C.gray400,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
    maxWidth: 280,
  },

  // Available job cards
  jobCard: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 12,
  },
  jobTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobItem: { color: C.white, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  jobPrice: { color: C.white, fontSize: 18, fontWeight: '800' },
  jobDist: { color: C.orange, fontSize: 13, fontWeight: '800' },
  jobRoute: { color: C.gray400, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  jobBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTime: { color: C.gray500, fontSize: 12, fontWeight: '500' },
  
  declineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.gray700,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  declineBtnText: { color: C.gray400, fontSize: 14, fontWeight: '700' },
  acceptBtnFlex: {
    backgroundColor: C.orange,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1.5,
    alignItems: 'center',
  },
  
  acceptBtn: {
    backgroundColor: C.orange,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 88,
    alignItems: 'center',
  },
  acceptBtnText: { color: C.black, fontSize: 14, fontWeight: '800' },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stepItem: { alignItems: 'center', width: 76 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.charcoal,
    borderWidth: 1.5,
    borderColor: C.gray700,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepDotDone: { backgroundColor: C.orange, borderColor: C.orange },
  stepDotCheck: { color: C.black, fontSize: 11, fontWeight: '900' },
  stepLabel: { color: C.gray500, fontSize: 10, fontWeight: '700' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.gray700,
    marginBottom: 18,
    maxWidth: 40,
  },

  // Active job status
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
  distText: { color: C.orange, fontSize: 12, fontWeight: '800', marginLeft: 8 },

  connectorLine: { width: 2, height: 16, backgroundColor: C.gray700, marginLeft: 8, marginVertical: 6 },
  dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange },
  dotWhite: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.white },

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
  btnCtaFlex: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.orange,
  },
  releaseBtn: { alignItems: 'center', marginTop: 14 },
  releaseText: { color: C.gray500, fontSize: 13, fontWeight: '600' },

  poolBtn: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  poolBtnText: { color: C.orange, fontSize: 13, fontWeight: '700' },

  // ---------- Activity / Profile screens ----------
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
  historyDate: { color: C.gray500, fontSize: 12, fontWeight: '500' },

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
  vehicleBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10,
  },
  vehicleBadgeText: { color: C.orange, fontSize: 12, fontWeight: '800' },

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
});
