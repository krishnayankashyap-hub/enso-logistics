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

// Fallback pickup point if GPS is unavailable (Guwahati)
const FALLBACK_COORDS = { latitude: 26.1445, longitude: 91.7362 };

const ACTIVE_STATUSES = ['searching', 'accepted', 'picked_up'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ==========================================
// MILK-RUN LINE STOPS (main highway points)
// Edit / extend this list as your network grows.
// Coordinates are approximate town/junction centers.
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
];

const LINE_GROUPS = ['NH-27 · Guwahati – Upper Assam', 'NH-6 · Guwahati – Shillong'];

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

// Copy for each shipment status (the driver app will update `status`)
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

  // Animations / rotating tips
  const pulse = useRef(new Animated.Value(1)).current;
  const dashAnim = useRef(new Animated.Value(0)).current; // moving road dashes
  const bobAnim = useRef(new Animated.Value(0)).current; // truck bounce
  const [tipIndex, setTipIndex] = useState(0);

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
    if (coords && mapRef.current && Platform.OS !== 'web') {
      mapRef.current.animateToRegion(
        { ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        800
      );
    }
  }, [coords]);

  // ------------------------------------------
  // 3. RESUME AN ACTIVE REQUEST AFTER APP RESTART
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
  // 4. LIVE LISTENER — updates instantly when the
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
  // 5. LIVE ACTIVITY — all of this user's shipments
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
  // 6. FIREBASE AUTHENTICATION
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
  // 7. LOCATION HELPERS (Uber/Rapido-style)
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
    if (Platform.OS === 'web' || !mapRef.current) return;
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
      focusMap(point, destPoint);
    } else {
      setDestination(stop.name.trim());
      setDestPoint(point);
      focusMap(pickupPoint ?? coords, point);
    }
    setFocusField(null);
    Keyboard.dismiss();
  };

  // Enter "move the map" pin mode
  const startPicking = (which: 'pickup' | 'dest') => {
    if (Platform.OS === 'web') {
      notify('Pin on map', 'Map-pin selection works in the mobile app. On web, type a stop name instead.');
      return;
    }
    Keyboard.dismiss();
    setFocusField(null);
    setPickingMode(which);
    const start =
      (which === 'pickup' ? pickupPoint : destPoint) ?? coords ?? FALLBACK_COORDS;
    setPendingCenter(start);
    mapRef.current?.animateToRegion(
      { ...start, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  // Confirm the pin where the map is centered
  const confirmPin = async () => {
    if (!pickingMode || !pendingCenter) return;
    const label =
      (await reverseGeocode(pendingCenter)) ??
      `Pinned (${pendingCenter.latitude.toFixed(4)}, ${pendingCenter.longitude.toFixed(4)})`;
    if (pickingMode === 'pickup') {
      setPickupPoint(pendingCenter);
      setPickupText(label);
      focusMap(pendingCenter, destPoint);
    } else {
      setDestPoint(pendingCenter);
      setDestination(label);
      focusMap(pickupPoint ?? coords, pendingCenter);
    }
    setPickingMode(null);
  };

  const cancelPicking = () => setPickingMode(null);

  // ------------------------------------------
  // 8. CREATE THE PICKUP REQUEST
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
        status: 'searching',
        driver_id: null,
        driver_name: null,
        created_at: serverTimestamp(),
      });
      setActiveId(docRef.id); // switches the sheet into "searching" mode
      setItemName('');
      setDestination('');
      setDestPoint(null);
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

  return (
    <View style={styles.appRoot}>
      <StatusBar
        barStyle={activeTab === 'home' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* ---------- FULL-SCREEN SCROLLABLE MAP (always mounted) ---------- */}
      {Platform.OS === 'web' ? (
        <View style={StyleSheet.absoluteFill}>
          {/* @ts-ignore */}
          <iframe
            src={`https://maps.google.com/maps?q=${mapCenter.latitude},${mapCenter.longitude}&z=15&output=embed`}
            style={{ width: '100%', height: '100%', border: 'none' }}
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
          {/* Pickup pin */}
          <Marker
            coordinate={pickupPoint ?? mapCenter}
            title="Pickup point"
            description={
              pickupPoint
                ? pickupText || 'Chosen pickup'
                : coords
                ? 'Your current location'
                : 'Approximate location'
            }
            pinColor={C.orange}
          />
          {/* Drop pin */}
          {destPoint && (
            <Marker
              coordinate={destPoint}
              title="Drop point"
              description={destination || 'Destination'}
              pinColor={C.black}
            />
          )}
        </MapView>
      )}

      {/* ---------- CENTER PIN while choosing on map ---------- */}
      {pickingMode && Platform.OS !== 'web' && (
        <View pointerEvents="none" style={styles.centerPinWrap}>
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

      {/* ---------- PIN-PICKING OVERLAY ---------- */}
      {pickingMode && (
        <>
          <View style={styles.pickChip}>
            <Text style={styles.pickChipText}>
              {pickingMode === 'pickup'
                ? 'Move the map to set your pickup point'
                : 'Move the map to set the drop point'}
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
      {activeTab === 'home' && !pickingMode && (
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
                ) : null}
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
                    style={styles.fieldInput}
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
                    placeholder="e.g. Shillong (Police Bazar)"
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

      {/* ======================= STOPS TAB (milk-run lines) ======================= */}
      {activeTab === 'stops' && (
        <View style={styles.screen}>
          <Text style={styles.screenTitle}>Line stops</Text>
          <Text style={styles.screenSub}>Main highway points on the Enso network</Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
          >
            {LINE_GROUPS.map((group) => (
              <View key={group} style={{ marginBottom: 22 }}>
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
            <Text style={styles.stopsFootnote}>
              More lines are added as the driver network grows. A stop can be any safe roadside
              point — fuel pumps, dhabas, toll gates, or town junctions.
            </Text>
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
      {!pickingMode && (
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
  centerPin: { fontSize: 36 },
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
    paddingHorizontal: 16,
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
});