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
  Pressable,
  useWindowDimensions,
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
import { Feather } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const C = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  orangeSoft: 'rgba(249,115,22,0.12)',
  orangeSoftStrong: 'rgba(249,115,22,0.18)',
  orangeBorder: 'rgba(249,115,22,0.30)',
  orangeGlow: 'rgba(249,115,22,0.35)',

  black: '#0A0A0A',
  charcoal: '#171717',
  line: '#262626',
  gray700: '#404040',
  gray600: '#525252',
  gray500: '#737373',
  gray400: '#A3A3A3',
  white: '#FFFFFF',

  surface: '#141416',
  surfaceAlt: '#1B1B1E',
  field: 'rgba(255,255,255,0.055)',
  fieldFocus: 'rgba(255,255,255,0.09)',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(255,255,255,0.14)',
  textHi: '#FAFAFA',
  danger: '#F87171',

  glass: 'rgba(18,18,20,0.62)',
  glassStrong: 'rgba(16,16,18,0.80)',
  glassSheet: 'rgba(13,13,15,0.84)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassBorderStrong: 'rgba(255,255,255,0.16)',
  shadow: '#000000',
};

const webGlass: any =
  Platform.OS === 'web'
    ? { backdropFilter: 'blur(22px) saturate(150%)', WebkitBackdropFilter: 'blur(22px) saturate(150%)' }
    : null;

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0f10' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#141716' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a2d' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05080d' }] },
];

const FALLBACK_COORDS = { latitude: 26.1445, longitude: 91.7362 };

const ACTIVE_STATUSES = ['searching', 'accepted', 'picked_up'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HIGHWAY_STOPS = [
  { name: 'Guwahati (ISBT)', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.1207, longitude: 91.6517 },
  { name: 'Jorabat Junction', group: 'NH-27 · Guwahati – Upper Assam', tag: 'NH-27 / NH-6 junction', latitude: 26.1147, longitude: 91.8859 },
  { name: 'Nagaon', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.3464, longitude: 92.684 },
  { name: 'Tezpur', group: 'NH-27 · Guwahati – Upper Assam', tag: 'NH-15 link stop', latitude: 26.6338, longitude: 92.8 },
  { name: 'Jorhat', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.7509, longitude: 94.2037 },
  { name: 'Sivasagar', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 26.9826, longitude: 94.6425 },
  { name: 'Dibrugarh', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 27.4728, longitude: 94.912 },
  { name: 'Tinsukia', group: 'NH-27 · Guwahati – Upper Assam', tag: 'Highway stop', latitude: 27.4922, longitude: 95.3468 },

  { name: 'Khanapara (Guwahati)', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 26.1158, longitude: 91.8266 },
  { name: 'Jorabat Junction ', group: 'NH-6 · Guwahati – Shillong', tag: 'NH-27 / NH-6 junction', latitude: 26.1147, longitude: 91.8859 },
  { name: 'Nongpoh', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 25.9035, longitude: 91.877 },
  { name: 'Umiam (Barapani)', group: 'NH-6 · Guwahati – Shillong', tag: 'Highway stop', latitude: 25.6635, longitude: 91.9117 },
  { name: 'Shillong (Police Bazar)', group: 'NH-6 · Guwahati – Shillong', tag: 'Line terminus', latitude: 25.5788, longitude: 91.8933 },

  { name: 'Srinagar (NH-44 Start)', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 34.0837, longitude: 74.7973 },
  { name: 'Pathankot Bypass', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 32.2687, longitude: 75.6455 },
  { name: 'Delhi (Kondli)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 28.6139, longitude: 77.2090 },
  { name: 'Agra (NH-44)', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 27.1767, longitude: 78.0081 },
  { name: 'Gwalior Bypass', group: 'NH-44 · North-South Corridor', tag: 'Relay Node', latitude: 26.2124, longitude: 78.1772 },
  { name: 'Nagpur (Zero Mile)', group: 'NH-44 · North-South Corridor', tag: 'Central Hub', latitude: 21.1458, longitude: 79.0882 },
  { name: 'Hyderabad (Outer Ring)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 17.3850, longitude: 78.4867 },
  { name: 'Bengaluru (Electronic City)', group: 'NH-44 · North-South Corridor', tag: 'Major Hub', latitude: 12.8452, longitude: 77.6602 },
  { name: 'Kanyakumari (NH-44 End)', group: 'NH-44 · North-South Corridor', tag: 'Line terminus', latitude: 8.0883, longitude: 77.5385 },

  { name: 'Jaipur (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 26.9124, longitude: 75.7873 },
  { name: 'Ahmedabad (Ring Road)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Surat (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 21.1702, longitude: 72.8311 },
  { name: 'Mumbai (Navi Mumbai)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Major Hub', latitude: 19.0330, longitude: 73.0297 },
  { name: 'Pune (NH-48)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Relay Node', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Chennai (NH-48 End)', group: 'NH-48 · Golden Quadrilateral West', tag: 'Line terminus', latitude: 13.0827, longitude: 80.2707 },

  { name: 'Kanpur (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 26.4499, longitude: 80.3319 },
  { name: 'Prayagraj (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 25.4358, longitude: 81.8463 },
  { name: 'Varanasi (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 25.3176, longitude: 82.9739 },
  { name: 'Dhanbad (NH-19)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Relay Node', latitude: 23.7957, longitude: 86.4304 },
  { name: 'Kolkata (NH-19 End)', group: 'NH-19 · Golden Quadrilateral East', tag: 'Major Hub', latitude: 22.5726, longitude: 88.3639 },
];

const LINE_GROUPS = Array.from(new Set(HIGHWAY_STOPS.map(stop => stop.group)));

let MapView: any = null;
let Marker: any = null;
let Location: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Location = require('expo-location');
}

const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

const haptic = () => {
  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate(8);
    } catch (e) {}
  }
};

const formatDate = (ts: any) => {
  if (!ts?.toDate) return 'Just now';
  const d = ts.toDate();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${mm} ${ampm}`;
};

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

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: 'Searching', color: C.orange, bg: C.orangeSoft },
  accepted: { label: 'Driver on way', color: C.orange, bg: C.orangeSoft },
  picked_up: { label: 'In transit', color: C.orange, bg: C.orangeSoft },
  delivered: { label: 'Delivered', color: C.white, bg: 'rgba(255,255,255,0.08)' },
  cancelled: { label: 'Cancelled', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
};

const PROGRESS_STEPS = ['searching', 'accepted', 'picked_up', 'delivered'];
const PROGRESS_LABELS = ['Request', 'Matched', 'Pickup', 'Delivered'];

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'activity', icon: 'file-text', label: 'Activity' },
  { key: 'stops', icon: 'git-merge', label: 'Stops' },
  { key: 'profile', icon: 'user', label: 'Profile' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type LatLng = { latitude: number; longitude: number };
type ActivityFilter = 'all' | 'active' | 'delivered' | 'cancelled';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PressableScale = ({
  style,
  children,
  onPress,
  disabled,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  scaleTo = 0.97,
  haptics = true,
  ...rest
}: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      onPress={(e: any) => {
        if (disabled) return;
        if (haptics) haptic();
        onPress?.(e);
      }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

const Shimmer = ({ style }: any) => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return <Animated.View style={[styles.skeleton, { opacity }, style]} />;
};

const SkeletonCard = () => (
  <View style={styles.historyCard}>
    <View style={styles.historyTop}>
      <Shimmer style={{ width: '52%', height: 16, borderRadius: 6 }} />
      <Shimmer style={{ width: 74, height: 22, borderRadius: 11 }} />
    </View>
    <Shimmer style={{ width: '78%', height: 12, borderRadius: 6, marginBottom: 14 }} />
    <Shimmer style={{ width: '38%', height: 11, borderRadius: 6 }} />
  </View>
);

const FadeInView = ({ children, style }: any) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[
        { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [itemName, setItemName] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoImage, setCargoImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pickupText, setPickupText] = useState('');
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);
  const [focusField, setFocusField] = useState<'pickup' | 'dest' | null>(null);
  const [pickingMode, setPickingMode] = useState<'pickup' | 'dest' | null>(null);
  const [pendingCenter, setPendingCenter] = useState<LatLng | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePackage, setActivePackage] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [history, setHistory] = useState<any[]>([]);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [stopSearch, setStopSearch] = useState('');
  const [inputFocus, setInputFocus] = useState<string | null>(null);

  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<any>(null);
  const mapIframeRef = useRef<any>(null);

  const { width: winW } = useWindowDimensions();
  const isWide = winW >= 720;

  const pulse = useRef(new Animated.Value(1)).current;
  const dashAnim = useRef(new Animated.Value(0)).current; 
  const bobAnim = useRef(new Animated.Value(0)).current; 
  const [tipIndex, setTipIndex] = useState(0);

  const [isScanningAR, setIsScanningAR] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scannerAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<any>(null);
  const [cameraStream, setCameraStream] = useState<any>(null);

  const status: string | undefined = activePackage?.status;
  const isSearching = status === 'searching';
  const truckActive = isSearching || status === 'picked_up';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const getLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          // @ts-ignore
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

  useEffect(() => {
    if (coords) {
      if (Platform.OS === 'web' && mapIframeRef.current) {
        mapIframeRef.current.contentWindow?.postMessage(JSON.stringify({ type: 'flyTo', lat: coords.latitude, lng: coords.longitude }), '*');
      } else if (mapRef.current && Platform.OS !== 'web') {
        mapRef.current.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
      }
    }
  }, [coords]);

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
        
      }
    })();
  }, [user]);

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

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    const q = query(collection(db, 'Packages'), where('sender_id', '==', user.uid), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
        rows.sort(
          (a, b) => (b.created_at?.toMillis?.() ?? Date.now()) - (a.created_at?.toMillis?.() ?? 0)
        );
        setHistory(rows);
        setHistoryLoading(false);
      },
      () => {
        setHistoryLoading(false);
      }
    );
    return unsub;
  }, [user]);

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

  const startARScan = async () => {
    Keyboard.dismiss();
    setIsScanningAR(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scannerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scannerAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    ).start();

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
    let base64Image = 'https://images.unsplash.com/photo-1580674684081-77699ca1b794?q=80&w=2000&auto=format&fit=crop'; 

    if (Platform.OS === 'web' && videoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 400 / (videoRef.current.videoWidth || 640)); 
        canvas.width = (videoRef.current.videoWidth || 640) * scale;
        canvas.height = (videoRef.current.videoHeight || 480) * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg', 0.5); 
        }
      } catch (e) {
        console.log("Failed to capture from video stream, using fallback.");
      }
    }

    try {
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
      
      setItemName('L-Crate: 60x40x40cm (Volumetric 19kg)');
      setCargoImage(base64Image);
      notify('Groq Vision Issue', `Could not process image through API. Used fallback sizing. Reason: ${err.message || 'Unknown'}`);
    } finally {
      setIsAnalyzing(false);
      stopCamera();
    }
  };


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

  const focusMap = (a?: LatLng | null, b?: LatLng | null) => {
    
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

  const recenter = () => {
    const target = coords ?? FALLBACK_COORDS;
    haptic();
    focusMap(target);
  };

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

  const startPicking = (which: 'pickup' | 'dest') => {
    Keyboard.dismiss();
    setFocusField(null);
    setPickingMode(which);
    const start =
      (which === 'pickup' ? pickupPoint : destPoint) ?? coords ?? FALLBACK_COORDS;
    setPendingCenter(start);

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

  const confirmPin = async () => {
    if (!pickingMode || !pendingCenter) return;

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
        const locationName = data[0].display_name.split(',')[0]; 

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

  const openNavigation = () => {
    const target = activePackage?.pickup_coords;
    if (!target) {
      notify('No coordinates', 'This stop has no pinned location to navigate to.');
      return;
    }
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=...${target.latitude},${target.longitude}`
    );
  };

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
      setActiveId(docRef.id); 
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

  const openHistoryItem = (item: any) => {
    if (ACTIVE_STATUSES.includes(item.status)) {
      setActiveId(item.id);
      setActiveTab('home');
      setSheetCollapsed(false);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={C.black} />
        <View style={styles.splashMark}>
          <Text style={styles.splashLogo}>
            Enso<Text style={{ color: C.orange }}>.</Text>
          </Text>
        </View>
        <ActivityIndicator size="small" color={C.orange} style={{ marginTop: 28 }} />
        <Text style={styles.splashTagline}>Relay logistics network</Text>
      </View>
    );
  }

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
          <View style={[styles.inputBox, inputFocus === 'email' && styles.inputBoxFocused]}>
            <Feather name="mail" size={16} color={C.gray500} style={{ marginRight: 12 }} />
            <TextInput
              style={styles.inputField}
              placeholder="you@example.com"
              placeholderTextColor={C.gray500}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              selectionColor={C.orange}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setInputFocus('email')}
              onBlur={() => setInputFocus((f) => (f === 'email' ? null : f))}
              accessibilityLabel="Email address"
              // @ts-ignore
              outlineStyle="none"
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputBox, inputFocus === 'password' && styles.inputBoxFocused]}>
            <Feather name="lock" size={16} color={C.gray500} style={{ marginRight: 12 }} />
            <TextInput
              style={styles.inputField}
              placeholder="••••••••"
              placeholderTextColor={C.gray500}
              secureTextEntry
              selectionColor={C.orange}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setInputFocus('password')}
              onBlur={() => setInputFocus((f) => (f === 'password' ? null : f))}
              accessibilityLabel="Password"
              // @ts-ignore
              outlineStyle="none"
            />
          </View>

          <PressableScale
            style={[styles.btnPrimary, authLoading && styles.btnPrimaryLoading]}
            onPress={handleAuthentication}
            disabled={authLoading}
            accessibilityLabel={isLoginMode ? 'Log in' : 'Create account'}
            accessibilityState={{ disabled: authLoading }}
          >
            {authLoading ? (
              <ActivityIndicator color={C.black} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {isLoginMode ? 'Log in' : 'Create account'}
              </Text>
            )}
          </PressableScale>

          <TouchableOpacity
            style={styles.authToggle}
            onPress={() => setIsLoginMode(!isLoginMode)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isLoginMode ? 'Switch to sign up' : 'Switch to log in'}
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

        <Text style={styles.authFooter}>Fast deliveries · Fair prices</Text>
      </KeyboardAvoidingView>
    );
  }

  const formReady = !!itemName.trim() && !!destination.trim();
  const mapCenter = coords ?? FALLBACK_COORDS;
  const statusCopy = status ? STATUS_COPY[status] ?? null : null;
  const showLiveCard = !!activePackage && !!statusCopy;
  const isFinished = status === 'delivered' || status === 'cancelled';
  const userInitial = (user.email?.[0] ?? 'U').toUpperCase();
  const deliveredCount = history.filter((h) => h.status === 'delivered').length;
  const activeCount = history.filter((h) => ACTIVE_STATUSES.includes(h.status)).length;
  const stepIndex = status ? PROGRESS_STEPS.indexOf(status) : -1;

  const suggQuery = focusField === 'pickup' ? pickupText : focusField === 'dest' ? destination : '';
  const suggestions =
    focusField && suggQuery.trim().length > 0
      ? HIGHWAY_STOPS.filter((s) =>
          s.name.toLowerCase().includes(suggQuery.trim().toLowerCase())
        )
          .filter((s, i, arr) => arr.findIndex((x) => x.name.trim() === s.name.trim()) === i)
          .slice(0, 4)
      : [];

  const activityQuery = activitySearch.trim().toLowerCase();
  const filteredHistory = history.filter((h) => {
    const matchesQuery =
      !activityQuery ||
      [h.item_name, h.destination_name, h.pickup_name]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(activityQuery));
    const matchesFilter =
      activityFilter === 'all'
        ? true
        : activityFilter === 'active'
        ? ACTIVE_STATUSES.includes(h.status)
        : activityFilter === 'delivered'
        ? h.status === 'delivered'
        : h.status === 'cancelled';
    return matchesQuery && matchesFilter;
  });

  const dateGroupOf = (ts: any): string => {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return 'Earlier';
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const t = d.getTime();
    if (t >= startToday) return 'Today';
    if (t >= startToday - 86400000) return 'Yesterday';
    if (t >= startToday - 7 * 86400000) return 'This week';
    return 'Earlier';
  };
  const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const groupedHistory = GROUP_ORDER.map((g) => ({
    group: g,
    rows: filteredHistory.filter((h) => dateGroupOf(h.created_at) === g),
  })).filter((s) => s.rows.length > 0);

  const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const stopQuery = stopSearch.trim().toLowerCase();
  const filteredStops = HIGHWAY_STOPS.filter(
    (s) =>
      !stopQuery ||
      s.name.toLowerCase().includes(stopQuery) ||
      s.group.toLowerCase().includes(stopQuery) ||
      s.tag.toLowerCase().includes(stopQuery)
  );
  const visibleGroups = LINE_GROUPS.filter((g) => filteredStops.some((s) => s.group === g));

  const leafletMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background:#0a0a0a; }
        .center-pin {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          z-index: 1000; pointer-events: none; display: none;
        }
        .center-pin.active { display: block; }
        .center-pin .dot {
          width: 24px; height: 24px; border-radius: 50%;
          background: #F97316; border: 3px solid #0a0a0a;
          box-shadow: 0 6px 18px rgba(0,0,0,0.5);
        }
        .center-pin .halo {
          position: absolute; top: 50%; left: 50%; width: 56px; height: 56px;
          transform: translate(-50%, -50%); border-radius: 50%;
          background: rgba(249,115,22,0.20);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div id="pin" class="center-pin"><div class="halo"></div><div class="dot"></div></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${mapCenter.latitude}, ${mapCenter.longitude}], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

        let pickupMarker = null;
        let dropMarker = null;
        let driverMarker = null;
        const driverIcon = L.divIcon({ html: '<div style="font-size:18px; background:#fff; border-radius:50%; width:34px; height:34px; display:flex; justify-content:center; align-items:center; box-shadow:0 6px 16px rgba(0,0,0,0.5)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>', className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
        const orangeIcon = L.divIcon({ html: '<div style="width:22px; height:22px; border-radius:50%; background:#F97316; border:3px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,0.5)"></div>', className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
        const blackIcon = L.divIcon({ html: '<div style="width:20px; height:20px; border-radius:6px; background:#fff; border:3px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,0.5)"></div>', className: '', iconSize: [20, 20], iconAnchor: [10, 10] });

        map.on('move', () => {
          const center = map.getCenter();
          window.parent.postMessage(JSON.stringify({ type: 'mapCenter', lat: center.lat, lng: center.lng }), '*');
        });

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
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

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
          customMapStyle={MAP_STYLE}
          initialRegion={{
            ...mapCenter,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingBackgroundColor={C.black}
          onRegionChangeComplete={(r: any) => {
            if (pickingMode) {
              setPendingCenter({ latitude: r.latitude, longitude: r.longitude });
            }
          }}
        >
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
              <View style={styles.driverPin}>
                <Feather name="truck" size={18} color={C.black} />
              </View>
            </Marker>
          )}
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
          {!activePackage && pickupPoint && (
            <Marker
              coordinate={pickupPoint}
              title="Pickup point"
              description={pickupText}
              pinColor={C.orange}
            />
          )}
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

      {pickingMode && Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: 12, backgroundColor: 'rgba(0,0,0,0.08)' }]}
        />
      )}

      {pickingMode && Platform.OS !== 'web' && (
        <View pointerEvents="none" style={[styles.centerPinWrap, { zIndex: 15 }]}>
          <View style={styles.centerPinHalo} />
          <View style={styles.centerPinDot} />
          <View style={styles.centerPinShadow} />
        </View>
      )}

      {activeTab === 'home' && !pickingMode && !isScanningAR && (
        <View style={styles.header} pointerEvents="box-none">
          <View style={[styles.logoBadge, webGlass]}>
            <Text style={styles.logoBadgeText}>
              Enso<Text style={{ color: C.orange }}>.</Text>
            </Text>
            <View style={styles.logoBadgeDivider} />
            <View style={styles.networkDot} />
            <Text style={styles.logoBadgeNetwork}>Live</Text>
          </View>
          <PressableScale
            style={[styles.avatarBadge, webGlass]}
            onPress={() => setActiveTab('profile')}
            accessibilityLabel="Open profile"
            scaleTo={0.92}
          >
            <Text style={styles.avatarBadgeText}>{userInitial}</Text>
          </PressableScale>
        </View>
      )}

      {activeTab === 'home' && sheetCollapsed && !pickingMode && !isScanningAR && (
        <PressableScale
          style={[styles.locateBtn, webGlass]}
          onPress={recenter}
          accessibilityLabel="Center on my location"
          scaleTo={0.9}
        >
          <Feather name="navigation" size={19} color={C.orange} />
        </PressableScale>
      )}

      {isScanningAR && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.black, zIndex: 100 }]}>
           <View style={{ position: 'absolute', inset: 0, opacity: 1 } as any}>
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

           <View pointerEvents="none" style={styles.arVignette} />

           <View style={styles.arViewfinder} pointerEvents="none">
              <View style={styles.arCornerTopLeft} />
              <View style={styles.arCornerTopRight} />
              <View style={styles.arCornerBottomLeft} />
              <View style={styles.arCornerBottomRight} />

              {!isAnalyzing && (
                <Animated.View style={[styles.arLaser, { transform: [{ translateY: scannerAnim.interpolate({inputRange: [0,1], outputRange: [0, height * 0.45]}) }] }]} />
              )}
           </View>

           <View style={styles.arTopBar}>
              <View style={[styles.arBadge, webGlass]}>
                <View style={styles.arBadgeDot} />
                <Text style={styles.arBadgeText}>Groq Vision · Cargo AI</Text>
              </View>
              <PressableScale onPress={stopCamera} style={[styles.arCloseBtn, webGlass]} accessibilityLabel="Close scanner" scaleTo={0.9}>
                 <Feather name="x" size={18} color={C.white} />
              </PressableScale>
           </View>

           <View style={styles.arBottomBar} pointerEvents="box-none">
              {isAnalyzing ? (
                 <View style={[styles.arAnalyzing, webGlass]}>
                   <ActivityIndicator size="large" color={C.orange} />
                   <Text style={styles.arAnalyzingText}>Groq LPU analyzing volume…</Text>
                 </View>
              ) : (
                 <View style={{alignItems: 'center'}}>
                   <Text style={styles.arHint}>Align the object within the frame</Text>
                   <PressableScale style={styles.arCaptureBtn} onPress={processGroqVision} accessibilityLabel="Capture and analyze" scaleTo={0.9}>
                      <View style={styles.arCaptureInner} />
                   </PressableScale>
                 </View>
              )}
           </View>
        </View>
      )}

      {pickingMode && (
        <>
          <View style={[styles.pickChip, webGlass]}>
            <Text style={styles.pickChipText}>
              Drag the map to pinpoint the exact location
            </Text>
          </View>
          <View style={[styles.pickCard, webGlass]}>
            <Text style={styles.pickCardTitle}>
              {pickingMode === 'pickup' ? 'Set pickup location' : 'Set drop location'}
            </Text>
            <Text style={styles.pickCardSub}>
              Drag the map until the pin sits on the exact spot — a highway stop, road point, or
              gate.
            </Text>
            <View style={styles.pickBtnRow}>
              <PressableScale
                style={styles.pickCancelBtn}
                onPress={cancelPicking}
                accessibilityLabel="Cancel pin selection"
              >
                <Text style={styles.pickCancelText}>Cancel</Text>
              </PressableScale>
              <PressableScale
                style={styles.pickConfirmBtn}
                onPress={confirmPin}
                accessibilityLabel="Confirm location"
              >
                <Text style={styles.pickConfirmText}>Confirm location</Text>
              </PressableScale>
            </View>
          </View>
        </>
      )}

      {activeTab === 'home' && !pickingMode && !isScanningAR && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View style={[styles.bottomSheet, webGlass]}>
            <TouchableOpacity
              style={styles.dragHandleTap}
              onPress={() => {
                setSheetCollapsed((s) => !s);
                setFocusField(null);
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={sheetCollapsed ? 'Expand sheet' : 'Collapse sheet'}
            >
              <View style={styles.dragHandle} />
            </TouchableOpacity>

            <View style={[styles.sheetInner, isWide && styles.sheetInnerWide]}>
            {sheetCollapsed ? (
              <PressableScale
                style={styles.collapsedRow}
                onPress={() => setSheetCollapsed(false)}
                accessibilityLabel="Expand sheet"
                scaleTo={0.99}
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
                    <Feather name="plus" size={18} color={C.orange} />
                  </>
                )}
              </PressableScale>
            ) : showLiveCard ? (
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
                        isFinished && status === 'cancelled' && { backgroundColor: C.surfaceAlt },
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

                {status !== 'cancelled' && stepIndex >= 0 && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      {PROGRESS_STEPS.map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.progressSeg,
                            i === 0 && { marginLeft: 0 },
                            i <= stepIndex && styles.progressSegFill,
                          ]}
                        />
                      ))}
                    </View>
                    <View style={styles.progressLabelsRow}>
                      {PROGRESS_LABELS.map((label, i) => (
                        <Text
                          key={label}
                          style={[styles.progressLabel, i <= stepIndex && styles.progressLabelOn]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}

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
                      <Feather name="truck" size={26} color={C.white} />
                    </Animated.Text>
                    <Feather name="map-pin" size={16} color={C.gray500} style={{ position: 'absolute', right: 16, top: 14 }} />
                  </View>
                )}

                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Feather name="package" size={14} color={C.gray400} style={{ width: 14, textAlign: 'center' }} />
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
                  <PressableScale
                    style={styles.btnOutline}
                    onPress={cancelRequest}
                    accessibilityLabel="Cancel request"
                  >
                    <Text style={styles.btnOutlineText}>Cancel request</Text>
                  </PressableScale>
                ) : isFinished ? (
                  <PressableScale
                    style={styles.btnCta}
                    onPress={dismissRequest}
                    accessibilityLabel="Send another shipment"
                  >
                    <Text style={styles.btnCtaText}>Send another shipment</Text>
                  </PressableScale>
                ) : (
                  <View style={styles.actionRow}>
                    <PressableScale
                      style={styles.btnNavigate}
                      onPress={openNavigation}
                      accessibilityLabel="Route to pickup"
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Feather name="navigation" size={15} color={C.white} style={{ marginRight: 8 }} /><Text style={styles.btnNavigateText}>Route to pickup</Text></View>
                    </PressableScale>
                  </View>
                )}
              </View>
            ) : (
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.sheetTitle}>Send a shipment</Text>
                  <View style={styles.relayBadge}>
                    <View style={styles.relayDot} />
                    <Text style={styles.relayBadgeText}>Live matching</Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Feather name="navigation" size={13} color={C.orange} style={{ marginRight: 9 }} />
                  <Text style={styles.locationText}>
                    {coords
                      ? 'GPS locked — pickup defaults to your current location'
                      : locationDenied
                      ? 'Location off — set pickup with the map pin'
                      : 'Finding your location…'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>What are you sending?</Text>
                <View style={[styles.fieldBox, inputFocus === 'item' && styles.fieldBoxFocused]}>
                  <Feather name="package" size={17} color={C.gray400} />
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    placeholder="e.g. 5 kg box of documents"
                    placeholderTextColor={C.gray500}
                    selectionColor={C.orange}
                    returnKeyType="next"
                    value={itemName}
                    onChangeText={setItemName}
                    onFocus={() => { setFocusField(null); setInputFocus('item'); }}
                    onBlur={() => setInputFocus((f) => (f === 'item' ? null : f))}
                    accessibilityLabel="Item description"
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  <PressableScale style={styles.arScanBadge} onPress={startARScan} accessibilityLabel="Scan cargo with AR">
                     <Feather name="maximize" size={13} color={C.orange} />
                     <Text style={styles.arScanBadgeText}>AR Scan</Text>
                  </PressableScale>
                </View>

                <Text style={styles.fieldLabel}>Pickup point — highway / road stop</Text>
                <View style={[styles.fieldBox, inputFocus === 'pickup' && styles.fieldBoxFocused]}>
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
                    onFocus={() => { setFocusField('pickup'); setInputFocus('pickup'); }}
                    onBlur={() => setInputFocus((f) => (f === 'pickup' ? null : f))}
                    accessibilityLabel="Pickup location"
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  <PressableScale
                    style={styles.pinBtn}
                    onPress={() => geocodeAndPin(pickupText, 'pickup')}
                    accessibilityLabel="Search pickup address"
                    scaleTo={0.9}
                  >
                    <Feather name="search" size={16} color={C.gray400} />
                  </PressableScale>
                  <PressableScale
                    style={styles.pinBtn}
                    onPress={() => startPicking('pickup')}
                    accessibilityLabel="Drop pin for pickup"
                    scaleTo={0.9}
                  >
                    <Feather name="map-pin" size={16} color={C.gray400} />
                  </PressableScale>
                </View>
                {focusField === 'pickup' && suggestions.length > 0 && (
                  <View style={[styles.suggList, { maxHeight: height * 0.25 }]}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s.name + s.group}
                        style={styles.suggRow}
                        onPress={() => selectStop(s, 'pickup')}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${s.name.trim()} as pickup`}
                      >
                        <Feather name="map-pin" size={14} color={C.gray500} style={{ marginRight: 12 }} />
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
                <View style={[styles.fieldBox, inputFocus === 'dest' && styles.fieldBoxFocused]}>
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
                    onFocus={() => { setFocusField('dest'); setInputFocus('dest'); }}
                    onBlur={() => setInputFocus((f) => (f === 'dest' ? null : f))}
                    onSubmitEditing={() => formReady && requestPickup()}
                    accessibilityLabel="Drop location"
                    // @ts-ignore
                    outlineStyle="none"
                  />
                  <PressableScale
                    style={styles.pinBtn}
                    onPress={() => geocodeAndPin(destination, 'dest')}
                    accessibilityLabel="Search drop address"
                    scaleTo={0.9}
                  >
                    <Feather name="search" size={16} color={C.gray400} />
                  </PressableScale>
                  <PressableScale
                    style={styles.pinBtn}
                    onPress={() => startPicking('dest')}
                    accessibilityLabel="Drop pin for destination"
                    scaleTo={0.9}
                  >
                    <Feather name="map-pin" size={16} color={C.gray400} />
                  </PressableScale>
                </View>
                {focusField === 'dest' && suggestions.length > 0 && (
                  <View style={[styles.suggList, { maxHeight: height * 0.25 }]}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s.name + s.group}
                        style={styles.suggRow}
                        onPress={() => selectStop(s, 'dest')}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${s.name.trim()} as destination`}
                      >
                        <Feather name="map-pin" size={14} color={C.gray500} style={{ marginRight: 12 }} />
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

                <PressableScale
                  style={formReady ? styles.btnCta : styles.btnDisabled}
                  onPress={requestPickup}
                  disabled={isSubmitting || !formReady}
                  accessibilityLabel="Find a route match"
                  accessibilityState={{ disabled: isSubmitting || !formReady }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={C.black} />
                  ) : (
                    <Text style={formReady ? styles.btnCtaText : styles.btnDisabledText}>
                      Find a route match
                    </Text>
                  )}
                </PressableScale>
              </View>
            )}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {activeTab === 'activity' && (
        <View style={styles.screen}>
          <FadeInView style={[styles.screenInner, isWide && styles.screenInnerWide]}>
          <Text style={styles.screenTitle}>Activity</Text>
          <Text style={styles.screenSub}>
            {history.length === 0
              ? 'Your shipments will appear here'
              : `${history.length} shipment${history.length === 1 ? '' : 's'}`}
          </Text>

          <View style={[styles.searchBar, inputFocus === 'activitySearch' && styles.searchBarFocused]}>
            <Feather name="search" size={15} color={C.gray500} style={{ marginRight: 10, opacity: 0.8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search item, pickup or destination"
              placeholderTextColor={C.gray500}
              selectionColor={C.orange}
              value={activitySearch}
              onChangeText={setActivitySearch}
              onFocus={() => setInputFocus('activitySearch')}
              onBlur={() => setInputFocus((f) => (f === 'activitySearch' ? null : f))}
              accessibilityLabel="Search shipments"
              // @ts-ignore
              outlineStyle="none"
            />
            {activitySearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setActivitySearch('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Feather name="x" size={15} color={C.gray500} style={{ paddingLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {ACTIVITY_FILTERS.map((f) => {
              const active = activityFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActivityFilter(f.key)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter: ${f.label}`}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {historyLoading && history.length === 0 ? (
            <View style={{ marginTop: 8 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyBadge}>
                <Feather name="package" size={34} color={C.gray500} />
              </View>
              <Text style={styles.emptyTitle}>No shipments yet</Text>
              <Text style={styles.emptySub}>
                Send your first shipment and it will show up here with its live status.
              </Text>
              <PressableScale
                style={[styles.btnCta, { marginTop: 24, alignSelf: 'center', paddingHorizontal: 30 }]}
                onPress={() => setActiveTab('home')}
                accessibilityLabel="Send a shipment"
              >
                <Text style={styles.btnCtaText}>Send a shipment</Text>
              </PressableScale>
            </View>
          ) : groupedHistory.length === 0 ? (
            <View style={styles.miniEmpty}>
              <Text style={styles.miniEmptyText}>No shipments match your search or filter.</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 130, paddingTop: 4 }}
              showsVerticalScrollIndicator={false}
            >
              {groupedHistory.map((section) => (
                <View key={section.group}>
                  <Text style={styles.groupLabel}>{section.group}</Text>
                  {section.rows.map((item) => {
                    const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.searching;
                    const isActive = ACTIVE_STATUSES.includes(item.status);
                    return (
                      <PressableScale
                        key={item.id}
                        style={styles.historyCard}
                        onPress={() => openHistoryItem(item)}
                        haptics={isActive}
                        scaleTo={isActive ? 0.985 : 1}
                        accessibilityLabel={`${item.item_name}, ${badge.label}`}
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
                          {isActive && <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.historyTrack}>Track</Text><Feather name="chevron-right" size={14} color={C.orange} style={{ marginLeft: 1 }} /></View>}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
          </FadeInView>
        </View>
      )}

      {activeTab === 'stops' && (
        <View style={styles.screen}>
          <FadeInView style={[styles.screenInner, isWide && styles.screenInnerWide]}>
          <Text style={styles.screenTitle}>Line stops</Text>
          <Text style={styles.screenSub}>Pan-India relay nodes on the Enso network</Text>

          <View style={[styles.searchBar, inputFocus === 'stopSearch' && styles.searchBarFocused]}>
            <Feather name="search" size={15} color={C.gray500} style={{ marginRight: 10, opacity: 0.8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search a stop, hub or corridor"
              placeholderTextColor={C.gray500}
              selectionColor={C.orange}
              value={stopSearch}
              onChangeText={setStopSearch}
              onFocus={() => setInputFocus('stopSearch')}
              onBlur={() => setInputFocus((f) => (f === 'stopSearch' ? null : f))}
              accessibilityLabel="Search stops"
              // @ts-ignore
              outlineStyle="none"
            />
            {stopSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setStopSearch('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Feather name="x" size={15} color={C.gray500} style={{ paddingLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 130 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stopsFootnote}>
              Relay nodes switch automatically depending on which driver accepts your package.
              The AI handles transfers seamlessly across India.
            </Text>

            {visibleGroups.length === 0 ? (
              <View style={styles.miniEmpty}>
                <Text style={styles.miniEmptyText}>No stops match “{stopSearch.trim()}”.</Text>
              </View>
            ) : (
              visibleGroups.map((group) => (
                <View key={group} style={{ marginBottom: 22, marginTop: 12 }}>
                  <View style={styles.lineHeader}>
                    <View style={styles.lineDot} />
                    <Text style={styles.lineTitle}>{group}</Text>
                  </View>
                  <View style={styles.lineCard}>
                    {filteredStops.filter((s) => s.group === group).map((stop, idx, arr) => (
                      <PressableScale
                        key={stop.name + stop.group}
                        style={[
                          styles.stopRow,
                          idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.hairline },
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
                        scaleTo={0.99}
                        accessibilityLabel={`Send to ${stop.name.trim()}`}
                      >
                        <Feather name="map-pin" size={15} color={C.gray500} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stopName}>{stop.name.trim()}</Text>
                          <Text style={styles.stopTag}>{stop.tag}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.stopAction}>Send here</Text><Feather name="chevron-right" size={15} color={C.orange} style={{ marginLeft: 2 }} /></View>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          </FadeInView>
        </View>
      )}

      {activeTab === 'profile' && (
        <View style={styles.screen}>
          <FadeInView style={[styles.screenInner, isWide && styles.screenInnerWide, { flex: 1 }]}>
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
              <Text style={styles.statLabel}>Sent</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{deliveredCount}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <PressableScale style={styles.btnLogout} onPress={handleLogout} accessibilityLabel="Log out">
            <Text style={styles.btnLogoutText}>Log out</Text>
          </PressableScale>
          <Text style={styles.versionText}>Enso v1.0</Text>
          </FadeInView>
        </View>
      )}

      {!pickingMode && !isScanningAR && (
        <View style={styles.navbarWrap} pointerEvents="box-none">
          <View style={[styles.navbar, webGlass]}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <PressableScale
                  key={tab.key}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setFocusField(null);
                    Keyboard.dismiss();
                  }}
                  scaleTo={0.9}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tab.label}
                >
                  <Feather name={tab.icon as any} size={20} color={active ? C.orange : C.gray500} style={{ marginBottom: 3 }} />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {tab.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.black,
  },
  splashMark: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  splashLogo: { fontSize: 40, fontWeight: '800', color: C.white, letterSpacing: -1.5 },
  splashTagline: {
    marginTop: 18,
    color: C.gray500,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mapIframe: { width: '100%', height: '100%', borderWidth: 0 },
  driverPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  authContainer: {
    flex: 1,
    backgroundColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  authCard: { width: '100%', maxWidth: 420 },
  authLogo: { fontSize: 46, fontWeight: '800', color: C.white, letterSpacing: -1.6, marginBottom: 12 },
  authSubtitle: { fontSize: 16, color: C.gray400, marginBottom: 44, fontWeight: '500', lineHeight: 24 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gray500,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.field,
    width: '100%',
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputBoxFocused: { backgroundColor: C.fieldFocus, borderColor: C.orangeBorder },
  inputGlyph: { color: C.gray500, fontSize: 15, marginRight: 12, width: 18, textAlign: 'center' },
  inputField: { flex: 1, paddingVertical: 17, fontSize: 16, color: C.white, fontWeight: '500' },
  btnPrimary: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    marginTop: 10,
    shadowColor: C.orange,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnPrimaryLoading: { backgroundColor: C.orangeDark },
  btnPrimaryText: { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  authToggle: { marginTop: 30, alignItems: 'center' },
  authToggleText: { color: C.gray400, fontSize: 14, fontWeight: '500' },
  authToggleAccent: { color: C.orange, fontWeight: '700' },
  authFooter: {
    position: 'absolute',
    bottom: 40,
    color: C.gray700,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoBadgeText: { fontSize: 18, fontWeight: '800', color: C.white, letterSpacing: -0.5 },
  logoBadgeDivider: { width: 1, height: 16, backgroundColor: C.hairlineStrong, marginHorizontal: 12 },
  networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange, marginRight: 7 },
  logoBadgeNetwork: {
    color: C.gray400,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  avatarBadgeText: { color: C.orange, fontSize: 16, fontWeight: '800' },

  locateBtn: {
    position: 'absolute',
    right: 20,
    bottom: 176,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.glassStrong,
    borderWidth: 1,
    borderColor: C.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  locateIcon: { color: C.orange, fontSize: 22, fontWeight: '700', marginTop: -1 },

  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  centerPinHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: C.orangeSoftStrong },
  centerPinDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange, borderWidth: 3, borderColor: C.black },
  centerPinShadow: { position: 'absolute', bottom: 8, width: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.4)' },

  pickChip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 62 : 50,
    alignSelf: 'center',
    backgroundColor: C.glassStrong,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.glassBorder,
    zIndex: 16,
  },
  pickChipText: { color: C.white, fontSize: 13, fontWeight: '600' },
  pickCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 40 : 28,
    maxWidth: 520,
    alignSelf: 'center',
    width: '92%',
    backgroundColor: C.glassSheet,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.glassBorderStrong,
    padding: 22,
    zIndex: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  pickCardTitle: { color: C.white, fontSize: 19, fontWeight: '800', marginBottom: 7, letterSpacing: -0.3 },
  pickCardSub: { color: C.gray400, fontSize: 13.5, lineHeight: 19, marginBottom: 18 },
  pickBtnRow: { flexDirection: 'row', gap: 12 },
  pickCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
  },
  pickCancelText: { color: C.gray400, fontSize: 14, fontWeight: '700' },
  pickConfirmBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  pickConfirmText: { color: C.black, fontSize: 14, fontWeight: '800' },

  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5 },
  bottomSheet: {
    width: '100%',
    backgroundColor: C.glassSheet,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: C.glassBorderStrong,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 116 : 104,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: -12 },
    elevation: 24,
  },
  sheetInner: { width: '100%' },
  sheetInnerWide: { maxWidth: 600, alignSelf: 'center' },
  dragHandleTap: { paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' },
  dragHandle: { width: 40, height: 5, backgroundColor: C.gray700, borderRadius: 3 },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  collapsedText: { flex: 1, color: C.white, fontSize: 15, fontWeight: '700', marginLeft: 12 },
  collapsedAction: { color: C.orange, fontSize: 16, fontWeight: '800' },
  pulseDotSmall: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange },
  dotOrange: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.orange },
  dotWhite: { width: 11, height: 11, borderRadius: 3, backgroundColor: C.white },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 23, fontWeight: '800', color: C.white, letterSpacing: -0.5 },
  relayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orangeSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.orangeBorder,
  },
  relayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange, marginRight: 7 },
  relayBadgeText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  locationIcon: { color: C.orange, fontSize: 12, marginRight: 9 },
  locationText: { color: C.gray400, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gray500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.field,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 16,
  },
  fieldBoxFocused: { backgroundColor: C.fieldFocus, borderColor: C.orangeBorder },
  fieldInput: { flex: 1, fontSize: 15, color: C.white, fontWeight: '500', paddingVertical: 16, marginLeft: 12 },
  fieldIcon: { fontSize: 14 },
  pinBtn: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.hairline,
    marginLeft: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBtnText: { fontSize: 14 },
  connectorLine: { width: 2, height: 16, backgroundColor: C.gray700, marginLeft: 5, marginVertical: 4 },
  suggList: {
    backgroundColor: C.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    marginTop: -6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  suggPin: { fontSize: 14, marginRight: 12 },
  suggName: { color: C.white, fontSize: 14, fontWeight: '700' },
  suggTag: { color: C.gray500, fontSize: 11, fontWeight: '500', marginTop: 2 },

  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  pulseWrap: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  pulseRing: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: C.orangeSoftStrong },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.orange },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusIconText: { color: C.black, fontSize: 20, fontWeight: '800' },
  statusTitle: { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: -0.3, marginBottom: 4 },
  statusSubtitle: { fontSize: 13, color: C.gray400, fontWeight: '500', lineHeight: 18 },

  progressWrap: { marginBottom: 16 },
  progressTrack: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.line, marginLeft: 6 },
  progressSegFill: { backgroundColor: C.orange },
  progressLabelsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { flex: 1, color: C.gray600, fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  progressLabelOn: { color: C.orange },

  roadScene: {
    height: 64,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  roadLineWrap: { position: 'absolute', left: 0, right: 0, top: '68%', height: 4, overflow: 'hidden' },
  dashRow: { flexDirection: 'row' },
  dash: { width: 22, height: 3, backgroundColor: C.gray700, borderRadius: 2, marginRight: 18 },
  truck: { position: 'absolute', left: '36%', top: 8, fontSize: 30 },
  roadPin: { position: 'absolute', right: 16, top: 12, fontSize: 18 },

  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 18,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { fontSize: 13, width: 14, textAlign: 'center' },
  summaryText: { color: C.white, fontSize: 15, fontWeight: '600', marginLeft: 12, flex: 1 },

  actionRow: { flexDirection: 'row', gap: 12 },
  btnNavigate: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairlineStrong,
  },
  btnNavigateText: { color: C.white, fontSize: 14, fontWeight: '700' },
  btnCta: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnCtaText: { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  btnDisabled: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  btnDisabledText: { color: C.gray500, fontSize: 16, fontWeight: '700' },
  btnOutline: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
  },
  btnOutlineText: { color: C.gray400, fontSize: 15, fontWeight: '700' },

  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.black,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 68 : 52,
    zIndex: 8,
  },
  screenInner: { flex: 1, width: '100%' },
  screenInnerWide: { maxWidth: 680, alignSelf: 'center' },
  screenTitle: { fontSize: 31, fontWeight: '800', color: C.white, letterSpacing: -0.8 },
  screenSub: { fontSize: 14, color: C.gray500, fontWeight: '500', marginTop: 4, marginBottom: 20 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.field,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 14,
  },
  searchBarFocused: { backgroundColor: C.fieldFocus, borderColor: C.orangeBorder },
  searchIcon: { fontSize: 14, marginRight: 10, opacity: 0.7 },
  searchInput: { flex: 1, fontSize: 15, color: C.white, fontWeight: '500', paddingVertical: 14 },
  searchClear: { color: C.gray500, fontSize: 15, fontWeight: '700', paddingLeft: 8 },
  filterRow: { flexGrow: 0, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: C.orangeSoft, borderColor: C.orangeBorder },
  filterChipText: { color: C.gray400, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: C.orange },
  groupLabel: {
    color: C.gray500,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },
  miniEmpty: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 22,
    marginTop: 8,
    alignItems: 'center',
  },
  miniEmptyText: { color: C.gray500, fontSize: 14, fontWeight: '500', textAlign: 'center' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 140 },
  emptyBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: C.white, fontSize: 19, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  emptySub: { color: C.gray500, fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 290 },

  historyCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 18,
    marginBottom: 12,
  },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  historyItem: { color: C.white, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  statusPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  historyDest: { color: C.gray400, fontSize: 13, fontWeight: '500', marginBottom: 12 },
  historyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: C.gray500, fontSize: 12, fontWeight: '500' },
  historyTrack: { color: C.orange, fontSize: 12, fontWeight: '800' },

  skeleton: { backgroundColor: C.gray700, borderRadius: 8 },

  stopsFootnote: { color: C.gray500, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  lineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange, marginRight: 10 },
  lineTitle: { color: C.gray400, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  lineCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.hairline,
    overflow: 'hidden',
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  stopPin: { fontSize: 14, marginRight: 12 },
  stopName: { color: C.white, fontSize: 15, fontWeight: '700' },
  stopTag: { color: C.gray500, fontSize: 11, fontWeight: '500', marginTop: 2 },
  stopAction: { color: C.orange, fontSize: 12, fontWeight: '800' },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.hairline,
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
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingVertical: 22,
    alignItems: 'center',
  },
  statNumber: { color: C.orange, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: C.gray500, fontSize: 12, fontWeight: '600' },
  btnLogout: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
    marginBottom: 12,
  },
  btnLogoutText: { color: C.danger, fontSize: 15, fontWeight: '700' },
  versionText: { color: C.gray700, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 120 },

  navbarWrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  navbar: {
    flexDirection: 'row',
    backgroundColor: C.glassStrong,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  navItem: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22 },
  navItemActive: { backgroundColor: C.orangeSoftStrong },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: { fontSize: 10, fontWeight: '600', color: C.gray500 },
  navLabelActive: { color: C.orange, fontWeight: '800' },

  arScanBadge: {
    backgroundColor: C.orangeSoft,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arScanBadgeText: { color: C.orange, fontSize: 12, fontWeight: '800', marginLeft: 5 },
  arScanBadgeIcon: { fontSize: 14 },
  arVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 90,
    borderColor: 'rgba(0,0,0,0.35)',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glassStrong,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  arBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange, marginRight: 8 },
  arBadgeText: { color: C.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  arCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.glassStrong,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  arCloseText: { color: C.white, fontSize: 17, fontWeight: '800' },
  arBottomBar: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', zIndex: 110 },
  arAnalyzing: {
    alignItems: 'center',
    backgroundColor: C.glassStrong,
    paddingHorizontal: 26,
    paddingVertical: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  arAnalyzingText: { color: C.orange, marginTop: 14, fontSize: 15, fontWeight: '800' },
  arHint: {
    color: C.white,
    marginBottom: 22,
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 10,
  },
  arCaptureBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  arCaptureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.orange },
  arViewfinder: { position: 'absolute', top: '25%', left: '10%', width: '80%', height: '45%', zIndex: 105, overflow: 'hidden' },
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
  arCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: C.orange, borderTopLeftRadius: 8 },
  arCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: C.orange, borderTopRightRadius: 8 },
  arCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: C.orange, borderBottomLeftRadius: 8 },
  arCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: C.orange, borderBottomRightRadius: 8 },
});
