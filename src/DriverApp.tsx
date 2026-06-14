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

const ACTIVE_STATUSES = ['accepted', 'picked_up'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VEHICLES = ['Bike', 'Car', 'Van', 'Truck'];

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

const WAITING_TIPS = [
  'Stay near the highway — most pickups are on the line.',
  'New shipments appear here the moment a sender posts them.',
  'Keep location on so distances stay accurate.',
];

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

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  accepted: { label: 'Accepted', color: C.orange, bg: C.orangeSoft },
  picked_up: { label: 'In transit', color: C.orange, bg: C.orangeSoft },
  delivered: { label: 'Delivered', color: C.white, bg: 'rgba(255,255,255,0.08)' },
  cancelled: { label: 'Cancelled', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
  searching: { label: 'Released', color: C.gray500, bg: 'rgba(115,115,115,0.12)' },
};

const TABS = [
  { key: 'home', icon: 'truck', label: 'Drive' },
  { key: 'activity', icon: 'file-text', label: 'Activity' },
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
  const [driverProfile, setDriverProfile] = useState<any>(null);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState('Bike');
  const [authLoading, setAuthLoading] = useState(false);

  const [online, setOnline] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [declinedJobs, setDeclinedJobs] = useState<string[]>([]); 
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [ticker, setTicker] = useState(Date.now()); 

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeStart, setRouteStart] = useState('');
  const [routeEnd, setRouteEnd] = useState('');

  const [showPoolModal, setShowPoolModal] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [history, setHistory] = useState<any[]>([]);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [inputFocus, setInputFocus] = useState<string | null>(null);

  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const coordsRef = useRef<LatLng | null>(null);
  const mapRef = useRef<any>(null);
  const mapIframeRef = useRef<any>(null);

  const { width: winW } = useWindowDimensions();
  const isWide = winW >= 720;

  const pulse = useRef(new Animated.Value(1)).current;
  const dashAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const [tipIndex, setTipIndex] = useState(0);

  const jobStatus: string | undefined = activeJob?.status;
  const isScanning = online && !activeJobId;
  const truckActive = jobStatus === 'picked_up';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return unsubscribe;
  }, []);

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
          setDriverProfile({ name: user.email?.split('@')[0] ?? 'Driver', vehicle: '—' });
        }
      } catch {
        setDriverProfile({ name: 'Driver', vehicle: '—' });
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let sub: any = null;
    let webId: any = null;

    (async () => {
      try {
        if (Platform.OS === 'web') {
          // @ts-ignore
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
              distanceInterval: 50, 
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
          setActiveJob({ id: snap.docs[0].id, ...snap.docs[0].data() });
          setActiveJobId(snap.docs[0].id);
          setOnline(true);
        }
      } catch {
        
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!activeJobId) return;
    const unsub = onSnapshot(doc(db, 'Packages', activeJobId), (snap) => {
      if (!snap.exists()) {
        setActiveJobId(null);
        setActiveJob(null);
        return;
      }
      const data: any = { id: snap.id, ...snap.data() };
      if (data.status === 'searching') {
        setActiveJobId(null);
        setActiveJob(null);
        return;
      }
      setActiveJob(data);
    });
    return unsub;
  }, [activeJobId]);

  useEffect(() => {
    if (!user || !online) {
      setAvailableJobs([]);
      return;
    }
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
        interval = setInterval(() => Vibration.vibrate(500), 2000);
      }

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


  useEffect(() => {
    if (!user) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    const q = query(collection(db, 'Packages'), where('driver_id', '==', user.uid), limit(50));
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
        
      }
    };
    push();
    const id = setInterval(push, 4000); 
    return () => clearInterval(id);
  }, [online, history]);

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
      setActiveJob({ ...job, status: 'accepted' });
      setActiveJobId(job.id);
      setSheetCollapsed(false);
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

  const declineJob = (jobId: string) => {
    setDeclinedJobs(prev => [...prev, jobId]);
  };

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

  const releaseJob = () => {
    if (!activeJobId) return;
    confirmAsk(
      'Release this shipment?',
      'It will go back to the pool so another driver can take it.',
      async () => {
        try {
          setDeclinedJobs(prev => [...prev, activeJobId]); 
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

  const transferToRelay = async () => {
    if (!activeJobId) return;
    confirmAsk(
      'Transfer to Relay Hub?',
      'This drops the package at the nearest AI relay node. The next overlapping driver will automatically be assigned to carry it further.',
      async () => {
        setActionLoading(true);
        try {
          setDeclinedJobs(prev => [...prev, activeJobId]); 
          await updateDoc(doc(db, 'Packages', activeJobId), {
            status: 'searching', 
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

  const openNavigation = () => {
    const target =
      jobStatus === 'picked_up' && activeJob?.dropoff_coords
        ? activeJob.dropoff_coords
        : activeJob?.pickup_coords;
    if (!target) {
      notify('No coordinates', 'This stop has no pinned location to navigate to.');
      return;
    }
    Linking.openURL(
      `maps.google.com/maps?q={target.latitude},${target.longitude}`
    );
  };

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={C.black} />
        <View style={styles.splashMark}>
          <Text style={styles.splashLogo}>
            Enso<Text style={{ color: C.orange }}> Driver</Text>
          </Text>
        </View>
        <ActivityIndicator size="small" color={C.orange} style={{ marginTop: 28 }} />
        <Text style={styles.splashTagline}>Driver partner network</Text>
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
        <ScrollView contentContainerStyle={styles.authScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <Text style={styles.authLogo}>
            Enso<Text style={{ color: C.orange }}> Driver</Text>
          </Text>
          <Text style={styles.authSubtitle}>
            Earn on routes you{'\u2019'}re already driving.
          </Text>

          {!isLoginMode && (
            <>
              <Text style={styles.inputLabel}>Full name</Text>
              <View style={[styles.inputBox, inputFocus === 'name' && styles.inputBoxFocused]}>
                <Feather name="user" size={16} color={C.gray500} style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Shown to senders when you accept"
                  placeholderTextColor={C.gray500}
                  selectionColor={C.orange}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setInputFocus('name')}
                  onBlur={() => setInputFocus((f) => (f === 'name' ? null : f))}
                  accessibilityLabel="Full name"
                  // @ts-ignore
                  outlineStyle="none"
                />
              </View>

              <Text style={styles.inputLabel}>Vehicle</Text>
              <View style={styles.vehicleRow}>
                {VEHICLES.map((v) => (
                  <PressableScale
                    key={v}
                    style={[styles.vehicleChip, vehicle === v && styles.vehicleChipActive]}
                    onPress={() => setVehicle(v)}
                    scaleTo={0.95}
                    accessibilityLabel={`Vehicle ${v}`}
                    accessibilityState={{ selected: vehicle === v }}
                  >
                    <Text
                      style={[styles.vehicleChipText, vehicle === v && styles.vehicleChipTextActive]}
                    >
                      {v}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </>
          )}

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
            accessibilityLabel={isLoginMode ? 'Log in' : 'Start driving'}
            accessibilityState={{ disabled: authLoading }}
          >
            {authLoading ? (
              <ActivityIndicator color={C.black} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {isLoginMode ? 'Log in' : 'Start driving'}
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

        <Text style={styles.authFooter}>Your route · Your earnings</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const mapCenter = coords ?? FALLBACK_COORDS;
  const jobCopy = jobStatus ? JOB_COPY[jobStatus] ?? null : null;
  const showJobCard = !!activeJob && !!jobCopy;
  const jobFinished = jobStatus === 'delivered' || jobStatus === 'cancelled';
  const userInitial = (driverProfile?.name?.[0] ?? user.email?.[0] ?? 'D').toUpperCase();
  const deliveredCount = history.filter((h) => h.status === 'delivered').length;
  const activeCount = history.filter((h) => ACTIVE_STATUSES.includes(h.status)).length;

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

  const leafletMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background:#0a0a0a; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${mapCenter.latitude}, ${mapCenter.longitude}], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

        let driverMarker = null;
        let pickupMarker = null;
        let dropMarker = null;
        let availableMarkers = [];

        const driverIcon = L.divIcon({ html: '<div style="background:#fff; border-radius:50%; width:34px; height:34px; display:flex; justify-content:center; align-items:center; box-shadow:0 6px 16px rgba(0,0,0,0.5)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>', className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
        const orangeIcon = L.divIcon({ html: '<div style="width:22px; height:22px; border-radius:50%; background:#F97316; border:3px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,0.5)"></div>', className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
        const blackIcon = L.divIcon({ html: '<div style="width:20px; height:20px; border-radius:6px; background:#fff; border:3px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,0.5)"></div>', className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
        const availIcon = L.divIcon({ html: '<div style="width:16px; height:16px; border-radius:50%; background:rgba(249,115,22,0.55); border:2px solid #F97316; box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', className: '', iconSize: [16, 16], iconAnchor: [8, 8] });

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
                    const m = L.marker([job.lat, job.lng], {icon: availIcon}).addTo(map);
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
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {showPoolModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 110, justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.routeCard, webGlass]}>
             <View style={styles.modalHeaderRow}>
               <View style={styles.modalIconChip}>
                 <Feather name="layers" size={16} color={C.orange} />
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={styles.routeTitle}>AI route pooling</Text>
                 <Text style={styles.routeSub}>Packages overlapping with your current trajectory.</Text>
               </View>
             </View>
             <ScrollView style={{maxHeight: height * 0.5}} showsVerticalScrollIndicator={false}>
                {visibleJobs.length === 0 ? (
                  <View style={styles.miniEmpty}>
                    <Text style={styles.miniEmptyText}>No overlapping packages found right now.</Text>
                  </View>
                ) : visibleJobs.map(job => {
                  const p = job.pickup_coords;
                  const d = job.dropoff_coords;
                  const tripDist = p && d ? distKm(p, d) : 10;
                  const estPrice = Math.round(150 + (tripDist * 14)); 

                  return (
                   <View key={job.id} style={styles.jobCard}>
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       {job.cargo_image && (
                          <Image source={{uri: job.cargo_image}} style={{width: 50, height: 50, borderRadius: 10, marginRight: 12, backgroundColor: C.black}} />
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
                     <PressableScale style={[styles.acceptBtn, {marginTop: 12, width: '100%'}]} onPress={() => { acceptJob(job); setShowPoolModal(false); }} accessibilityLabel={`Add ${job.item_name} to pool`}>
                        <Text style={styles.acceptBtnText}>Add to pool</Text>
                     </PressableScale>
                   </View>
                  );
                })}
             </ScrollView>
             <PressableScale style={styles.modalCloseBtn} onPress={() => setShowPoolModal(false)} accessibilityLabel="Close">
                <Text style={styles.modalCloseText}>Close</Text>
             </PressableScale>
          </View>
        </View>
      )}

      {showRouteModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 100, justifyContent: 'center', padding: 24 }]}>
          <View style={[styles.routeCard, webGlass]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconChip}>
                <Feather name="git-merge" size={16} color={C.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeTitle}>Set your relay route</Text>
                <Text style={styles.routeSub}>So the AI can match overlapping shipments along your journey.</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Starting point</Text>
            <View style={[styles.inputBox, inputFocus === 'routeStart' && styles.inputBoxFocused]}>
              <Feather name="map-pin" size={16} color={C.orange} style={{ marginRight: 12 }} />
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Guwahati"
                placeholderTextColor={C.gray500}
                selectionColor={C.orange}
                value={routeStart}
                onChangeText={setRouteStart}
                onFocus={() => setInputFocus('routeStart')}
                onBlur={() => setInputFocus((f) => (f === 'routeStart' ? null : f))}
                accessibilityLabel="Starting point"
                // @ts-ignore
                outlineStyle="none"
              />
            </View>

            <Text style={styles.inputLabel}>Destination</Text>
            <View style={[styles.inputBox, inputFocus === 'routeEnd' && styles.inputBoxFocused]}>
              <Feather name="flag" size={16} color={C.gray500} style={{ marginRight: 12 }} />
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Shillong"
                placeholderTextColor={C.gray500}
                selectionColor={C.orange}
                value={routeEnd}
                onChangeText={setRouteEnd}
                onFocus={() => setInputFocus('routeEnd')}
                onBlur={() => setInputFocus((f) => (f === 'routeEnd' ? null : f))}
                accessibilityLabel="Destination"
                // @ts-ignore
                outlineStyle="none"
              />
            </View>

            <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
              <PressableScale style={[styles.btnOutline, {flex: 1}]} onPress={() => setShowRouteModal(false)} accessibilityLabel="Cancel">
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </PressableScale>
              <PressableScale style={[styles.btnCta, {flex: 2}]} onPress={() => {
                if(!routeStart || !routeEnd) { notify('Missing route', 'Please enter your start and end points.'); return; }
                setShowRouteModal(false);
                setOnline(true);
              }} accessibilityLabel="Go online">
                <Text style={styles.btnCtaText}>Go online</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      )}

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
          initialRegion={{ ...mapCenter, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingBackgroundColor={C.black}
        >
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

      {activeTab === 'home' && (
        <View style={styles.header} pointerEvents="box-none">
          <View style={[styles.logoBadge, webGlass]}>
            <Text style={styles.logoBadgeText}>
              Enso<Text style={{ color: C.orange }}> Driver</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale
              style={[styles.onlinePill, webGlass]}
              onPress={() => {
                if (activeJobId) {
                  notify('Finish your job first', 'Complete or release the active shipment before going offline.');
                  return;
                }
                if (!online) {
                  setShowRouteModal(true); 
                } else {
                  setOnline(false); 
                }
              }}
              scaleTo={0.94}
              accessibilityLabel={online ? 'Go offline' : 'Go online'}
            >
              <View style={[styles.onlineDot, { backgroundColor: online ? C.orange : C.gray500 }]} />
              <Text style={styles.onlineText}>{online ? 'Online' : 'Offline'}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.avatarBadge, webGlass]}
              onPress={() => setActiveTab('profile')}
              scaleTo={0.92}
              accessibilityLabel="Open profile"
            >
              <Text style={styles.avatarBadgeText}>{userInitial}</Text>
            </PressableScale>
          </View>
        </View>
      )}

      {activeTab === 'home' && (
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
                scaleTo={0.99}
                accessibilityLabel="Expand sheet"
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
                    <Text style={styles.collapsedText}>You{'\u2019'}re offline</Text>
                    <Text style={styles.collapsedAction}>Open</Text>
                  </>
                )}
              </PressableScale>
            ) : showJobCard ? (
              <View>
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
                              {done && <Feather name="check" size={11} color={C.black} />}
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
                      jobStatus === 'cancelled' && { backgroundColor: C.surfaceAlt },
                    ]}
                  >
                    <Feather
                      name={
                        jobStatus === 'accepted'
                          ? 'arrow-right'
                          : jobStatus === 'picked_up'
                          ? 'truck'
                          : jobStatus === 'delivered'
                          ? 'check'
                          : 'x'
                      }
                      size={20}
                      color={jobStatus === 'cancelled' ? C.gray500 : C.black}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>{jobCopy!.title}</Text>
                    <Text style={styles.statusSubtitle}>{jobCopy!.subtitle}</Text>
                  </View>
                </View>

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
                    <Animated.View
                      style={[
                        styles.truck,
                        { transform: [{ translateY: truckBob }, { scaleX: -1 }] },
                      ]}
                    >
                      <Feather name="truck" size={26} color={C.white} />
                    </Animated.View>
                    <Feather name="map-pin" size={16} color={C.gray500} style={{ position: 'absolute', right: 16, top: 14 }} />
                  </View>
                )}

                <View style={styles.summaryCard}>
                  {activeJob.cargo_image && (
                     <Image source={{uri: activeJob.cargo_image}} style={{width: '100%', height: 140, borderRadius: 14, marginBottom: 16, backgroundColor: C.black}} resizeMode="cover" />
                  )}
                  <View style={styles.summaryRow}>
                    <Feather name="package" size={14} color={C.gray400} style={{ width: 14, textAlign: 'center' }} />
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
                        <Feather name="mail" size={13} color={C.gray500} style={{ width: 14, textAlign: 'center' }} />
                        <Text style={[styles.summaryText, { color: C.gray400 }]} numberOfLines={1}>
                          {activeJob.sender_email}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {jobFinished ? (
                  <PressableScale style={styles.btnCta} onPress={dismissJob} accessibilityLabel="Continue">
                    <Text style={styles.btnCtaText}>
                      {jobStatus === 'delivered' ? 'Find next shipment' : 'Back to shipments'}
                    </Text>
                  </PressableScale>
                ) : (
                  <>
                    <View style={styles.actionRow}>
                      <PressableScale
                        style={styles.btnNavigate}
                        onPress={openNavigation}
                        accessibilityLabel="Navigate"
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="navigation" size={15} color={C.white} style={{ marginRight: 7 }} />
                          <Text style={styles.btnNavigateText}>Navigate</Text>
                        </View>
                      </PressableScale>
                      <PressableScale
                        style={styles.btnCtaFlex}
                        onPress={advanceStatus}
                        disabled={actionLoading}
                        accessibilityLabel={jobStatus === 'accepted' ? 'Confirm pickup' : 'Mark as delivered'}
                        accessibilityState={{ disabled: actionLoading }}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color={C.black} />
                        ) : (
                          <Text style={styles.btnCtaText}>
                            {jobStatus === 'accepted' ? 'Confirm pickup' : 'Mark as delivered'}
                          </Text>
                        )}
                      </PressableScale>
                    </View>

                    {jobStatus === 'accepted' ? (
                      <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
                        <PressableScale style={[styles.releaseBtn, {flex: 1, marginTop: 0}]} onPress={releaseJob} scaleTo={0.98} accessibilityLabel="Cancel job">
                          <Text style={styles.releaseText}>Cancel</Text>
                        </PressableScale>
                        <PressableScale style={[styles.btnOutline, {flex: 2, paddingVertical: 13, marginTop: 0}]} onPress={transferToRelay} accessibilityLabel="Drop at hub">
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="refresh-cw" size={14} color={C.orange} style={{ marginRight: 7 }} />
                            <Text style={[styles.btnOutlineText, {color: C.orange, fontSize: 13}]}>Drop at hub</Text>
                          </View>
                        </PressableScale>
                      </View>
                    ) : (
                      <PressableScale style={[styles.btnOutline, {marginTop: 14, paddingVertical: 13}]} onPress={transferToRelay} accessibilityLabel="Drop at relay hub">
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="refresh-cw" size={14} color={C.orange} style={{ marginRight: 7 }} />
                          <Text style={[styles.btnOutlineText, {color: C.orange, fontSize: 13}]}>Drop at relay hub</Text>
                        </View>
                      </PressableScale>
                    )}

                    <PressableScale style={styles.poolBtn} onPress={() => setShowPoolModal(true)} accessibilityLabel="Find combined deliveries">
                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                         <Feather name="layers" size={14} color={C.orange} style={{ marginRight: 8 }} />
                         <Text style={styles.poolBtnText}>Have space? Find combined deliveries</Text>
                       </View>
                    </PressableScale>
                  </>
                )}
              </View>
            ) : !online ? (
              <View>
                <Text style={styles.sheetTitle}>You{'\u2019'}re offline</Text>
                <Text style={styles.offlineSub}>
                  Go online to see live shipments along your route. You{'\u2019'}ll only be shown
                  requests while you{'\u2019'}re online.
                </Text>
                <PressableScale
                  style={styles.btnCta}
                  onPress={() => setShowRouteModal(true)}
                  accessibilityLabel="Go online"
                >
                  <Text style={styles.btnCtaText}>Go online</Text>
                </PressableScale>
                {locationDenied && (
                  <Text style={styles.locationWarn}>
                    Location is off — turn it on so senders see accurate distances.
                  </Text>
                )}
              </View>
            ) : (
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
                    <PressableScale
                      style={styles.btnOutline}
                      onPress={() => setOnline(false)}
                      accessibilityLabel="Go offline"
                    >
                      <Text style={styles.btnOutlineText}>Go offline</Text>
                    </PressableScale>
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
                      const estPrice = Math.round(150 + (tripDist * 14)); 

                      return (
                        <View key={job.id} style={styles.jobCard}>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            {job.cargo_image && (
                               <Image source={{uri: job.cargo_image}} style={{width: 60, height: 60, borderRadius: 12, marginRight: 14, backgroundColor: C.black}} />
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

                          <View style={styles.countdownRow}>
                            <Feather name="clock" size={13} color={C.orange} style={{ marginRight: 6 }} />
                            <Text style={styles.countdownText}>{timeLeft}s remaining to accept</Text>
                          </View>

                          <View style={[styles.jobBottom, {marginTop: 10, gap: 10}]}>
                            <PressableScale
                              style={styles.declineBtn}
                              onPress={() => declineJob(job.id)}
                              accessibilityLabel="Decline"
                            >
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </PressableScale>

                            <PressableScale
                              style={styles.acceptBtnFlex}
                              onPress={() => acceptJob(job)}
                              disabled={!!acceptingId}
                              accessibilityLabel="Accept"
                              accessibilityState={{ disabled: !!acceptingId }}
                            >
                              {acceptingId === job.id ? (
                                <ActivityIndicator size="small" color={C.black} />
                              ) : (
                                <Text style={styles.acceptBtnText}>Accept</Text>
                              )}
                            </PressableScale>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
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
              ? 'Your jobs will appear here'
              : `${history.length} job${history.length === 1 ? '' : 's'} · ${deliveredCount} delivered`}
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
              accessibilityLabel="Search jobs"
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
                <Feather name="truck" size={34} color={C.gray500} />
              </View>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptySub}>
                Go online and accept your first shipment — it will show up here.
              </Text>
              <PressableScale
                style={[styles.btnCta, { marginTop: 24, alignSelf: 'center', paddingHorizontal: 30 }]}
                onPress={() => {
                  setActiveTab('home');
                  setShowRouteModal(true);
                }}
                accessibilityLabel="Go online"
              >
                <Text style={styles.btnCtaText}>Go online</Text>
              </PressableScale>
            </View>
          ) : groupedHistory.length === 0 ? (
            <View style={styles.miniEmpty}>
              <Text style={styles.miniEmptyText}>No jobs match your search or filter.</Text>
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
                    const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.accepted;
                    const isActive = ACTIVE_STATUSES.includes(item.status);
                    return (
                      <PressableScale
                        key={item.id}
                        style={styles.historyCard}
                        haptics={isActive}
                        scaleTo={isActive ? 0.985 : 1}
                        onPress={() => {
                          if (ACTIVE_STATUSES.includes(item.status)) {
                             setActiveJob(item);
                             setActiveJobId(item.id);
                             setActiveTab('home');
                             setSheetCollapsed(false);
                          }
                        }}
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
                          {(item.pickup_name ?? 'Pickup') + '  →  ' + item.destination_name}
                        </Text>
                        <View style={styles.historyBottom}>
                          <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                          {isActive && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.historyTrack}>Resume</Text>
                              <Feather name="chevron-right" size={14} color={C.orange} style={{ marginLeft: 1 }} />
                            </View>
                          )}
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

      {activeTab === 'profile' && (
        <View style={styles.screen}>
          <FadeInView style={[styles.screenInner, isWide && styles.screenInnerWide, { flex: 1 }]}>
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
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{history.length}</Text>
              <Text style={styles.statLabel}>Jobs taken</Text>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <PressableScale style={styles.btnLogout} onPress={handleLogout} accessibilityLabel="Log out">
            <Text style={styles.btnLogoutText}>Log out</Text>
          </PressableScale>
          <Text style={styles.versionText}>Enso Driver v1.0</Text>
          </FadeInView>
        </View>
      )}

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
                  Keyboard.dismiss();
                }}
                scaleTo={0.9}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Feather name={tab.icon as any} size={20} color={active ? C.orange : C.gray500} style={{ marginBottom: 3 }} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.black },
  splashMark: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  splashLogo: { fontSize: 36, fontWeight: '800', color: C.white, letterSpacing: -1.2 },
  splashTagline: {
    marginTop: 18,
    color: C.gray500,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mapIframe: { width: '100%', height: '100%', borderWidth: 0 },

  authContainer: { flex: 1, backgroundColor: C.black },
  authScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28, paddingVertical: 60 },
  authCard: { width: '100%', maxWidth: 420 },
  authLogo: { fontSize: 38, fontWeight: '800', color: C.white, letterSpacing: -1.3, marginBottom: 12 },
  authSubtitle: { fontSize: 16, color: C.gray400, marginBottom: 40, fontWeight: '500', lineHeight: 23 },
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputBoxFocused: { backgroundColor: C.fieldFocus, borderColor: C.orangeBorder },
  inputField: { flex: 1, paddingVertical: 16, fontSize: 16, color: C.white, fontWeight: '500' },
  vehicleRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  vehicleChip: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  vehicleChipActive: { backgroundColor: C.orangeSoft, borderColor: C.orangeBorder },
  vehicleChipText: { color: C.gray400, fontSize: 13, fontWeight: '700' },
  vehicleChipTextActive: { color: C.orange },
  btnPrimary: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    marginTop: 8,
    shadowColor: C.orange,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnPrimaryLoading: { backgroundColor: C.orangeDark },
  btnPrimaryText: { color: C.black, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  authToggle: { marginTop: 28, alignItems: 'center' },
  authToggleText: { color: C.gray400, fontSize: 14, fontWeight: '500' },
  authToggleAccent: { color: C.orange, fontWeight: '700' },
  authFooter: {
    marginTop: 30,
    color: C.gray700,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  appRoot: { flex: 1, backgroundColor: C.black },

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

  routeCard: {
    backgroundColor: C.glassSheet,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: C.glassBorderStrong,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  modalIconChip: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.orangeSoft,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  routeTitle: { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: -0.3, marginBottom: 3 },
  routeSub: { fontSize: 13, color: C.gray400, lineHeight: 18 },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  modalCloseText: { color: C.white, fontWeight: '700', fontSize: 15 },
  miniEmpty: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 22,
    marginVertical: 8,
    alignItems: 'center',
  },
  miniEmptyText: { color: C.gray500, fontSize: 14, fontWeight: '500', textAlign: 'center' },

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
    backgroundColor: C.glass,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoBadgeText: { fontSize: 16, fontWeight: '800', color: C.white, letterSpacing: -0.4 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    paddingHorizontal: 14,
    borderRadius: 22,
    height: 44,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  onlineText: { color: C.white, fontSize: 13, fontWeight: '700' },
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
  collapsedAction: { color: C.orange, fontSize: 15, fontWeight: '800' },
  pulseDotSmall: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.orange },
  dotOrange: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.orange },
  dotWhite: { width: 11, height: 11, borderRadius: 3, backgroundColor: C.white },

  sheetTitle: { fontSize: 23, fontWeight: '800', color: C.white, letterSpacing: -0.5 },
  offlineSub: { color: C.gray400, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 20 },
  locationWarn: { color: C.gray500, fontSize: 12, marginTop: 14, textAlign: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
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
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  jobCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 16,
    marginBottom: 12,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  jobItem: { color: C.white, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  jobPrice: { color: C.white, fontSize: 18, fontWeight: '800' },
  jobDist: { color: C.orange, fontSize: 13, fontWeight: '800' },
  jobRoute: { color: C.gray400, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  jobBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobTime: { color: C.gray500, fontSize: 12, fontWeight: '500' },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: C.orangeSoft,
    borderRadius: 10,
    paddingVertical: 7,
  },
  countdownText: { color: C.orange, fontSize: 12, fontWeight: '700' },
  declineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
    paddingVertical: 12,
    borderRadius: 14,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { color: C.gray400, fontSize: 14, fontWeight: '700' },
  acceptBtnFlex: {
    backgroundColor: C.orange,
    paddingVertical: 12,
    borderRadius: 14,
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.orange,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  acceptBtn: {
    backgroundColor: C.orange,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { color: C.black, fontSize: 14, fontWeight: '800' },

  scanWrap: { alignItems: 'center', paddingVertical: 10 },
  scanTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginTop: 12 },
  scanSub: {
    color: C.gray400,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 20,
    maxWidth: 280,
  },
  pulseWrap: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.orangeSoftStrong,
  },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.orange },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  stepItem: { alignItems: 'center', width: 80 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1.5,
    borderColor: C.gray700,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
  },
  stepDotDone: { backgroundColor: C.orange, borderColor: C.orange },
  stepDotCheck: { color: C.black, fontSize: 11, fontWeight: '900' },
  stepLabel: { color: C.gray500, fontSize: 10, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: C.gray700, marginBottom: 19, maxWidth: 44 },

  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusIconText: { color: C.black, fontSize: 20, fontWeight: '800' },
  statusTitle: { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: -0.3, marginBottom: 4 },
  statusSubtitle: { fontSize: 13, color: C.gray400, fontWeight: '500', lineHeight: 18 },

  roadScene: {
    height: 66,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  roadLineWrap: { position: 'absolute', left: 0, right: 0, top: '68%', height: 4, overflow: 'hidden' },
  dashRow: { flexDirection: 'row' },
  dash: { width: 22, height: 3, backgroundColor: C.gray700, borderRadius: 2, marginRight: 18 },
  truck: { position: 'absolute', left: '36%', top: 18, fontSize: 30 },
  roadPin: { position: 'absolute', right: 16, top: 14, fontSize: 18 },

  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { fontSize: 13, width: 14, textAlign: 'center' },
  summaryText: { color: C.white, fontSize: 15, fontWeight: '600', marginLeft: 12, flex: 1 },
  distText: { color: C.orange, fontSize: 12, fontWeight: '800', marginLeft: 8 },
  connectorLine: { width: 2, height: 16, backgroundColor: C.gray700, marginLeft: 9, marginVertical: 6 },

  actionRow: { flexDirection: 'row', gap: 10 },
  btnNavigate: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
  },
  btnNavigateText: { color: C.white, fontSize: 14, fontWeight: '700' },
  btnCtaFlex: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  releaseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.hairlineStrong,
  },
  releaseText: { color: C.gray400, fontSize: 13, fontWeight: '700' },
  poolBtn: {
    backgroundColor: C.orangeSoft,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  poolBtnText: { color: C.orange, fontSize: 13, fontWeight: '700' },

  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: C.black, zIndex: 8 },
  screenInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 68 : 52,
  },
  screenInnerWide: { maxWidth: 680, alignSelf: 'center', width: '100%' },
  screenTitle: { fontSize: 30, fontWeight: '800', color: C.white, letterSpacing: -0.8 },
  screenSub: { fontSize: 14, color: C.gray500, fontWeight: '500', marginTop: 4, marginBottom: 20 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.field,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchBarFocused: { backgroundColor: C.fieldFocus, borderColor: C.orangeBorder },
  searchIcon: { fontSize: 14, marginRight: 10, opacity: 0.7 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.white, fontWeight: '500' },
  searchClear: { color: C.gray500, fontSize: 14, paddingLeft: 8 },
  filterRow: { flexGrow: 0, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.field,
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
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 140 },
  emptyBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: C.gray500, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  historyCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 16,
    marginBottom: 12,
  },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyItem: { color: C.white, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 10 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  historyDest: { color: C.gray400, fontSize: 13, fontWeight: '500', marginBottom: 12 },
  historyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: C.gray500, fontSize: 12, fontWeight: '500' },
  historyTrack: { color: C.orange, fontSize: 13, fontWeight: '800' },
  skeleton: { backgroundColor: C.gray700, borderRadius: 8 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 18,
    marginBottom: 14,
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
  profileEmail: { color: C.white, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  profileJoined: { color: C.gray500, fontSize: 13, fontWeight: '500' },
  vehicleBadge: {
    backgroundColor: C.orangeSoft,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginLeft: 10,
  },
  vehicleBadgeText: { color: C.orange, fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.hairline,
    paddingVertical: 20,
    alignItems: 'center',
  },
  statNumber: { color: C.orange, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: C.gray500, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  btnLogout: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(248,113,113,0.3)',
    marginBottom: 12,
  },
  btnLogoutText: { color: C.danger, fontSize: 15, fontWeight: '700' },
  versionText: { color: C.gray700, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 120 },

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
    backgroundColor: C.glassStrong,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.glassBorderStrong,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22 },
  navItemActive: { backgroundColor: C.orangeSoftStrong },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navLabel: { fontSize: 10, fontWeight: '600', color: C.gray500 },
  navLabelActive: { color: C.orange, fontWeight: '800' },
});
