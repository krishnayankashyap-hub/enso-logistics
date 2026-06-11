import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SenderHome() {
  const [itemName, setItemName] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestPickup = () => {
    if (!itemName || !destination) return;
    setIsSubmitting(true);
    
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Success! Enso is scanning for drivers.");
      setItemName('');
      setDestination('');
    }, 1500);
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.placeholderTitle}>🌍 Enso Live Map</Text>
        <Text style={styles.placeholderText}>GPS Tracking is enabled on the mobile app.</Text>
      </View>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Enso</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Where to?</Text>

        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={styles.dotBlue} />
            <TextInput
              style={styles.input}
              placeholder="What are you sending?"
              placeholderTextColor="#94a3b8"
              value={itemName}
              onChangeText={setItemName}
            />
          </View>
          <View style={styles.line} />
          <View style={styles.inputRow}>
            <View style={styles.dotBlack} />
            <TextInput
              style={styles.input}
              placeholder="Destination (e.g., Shillong)"
              placeholderTextColor="#94a3b8"
              value={destination}
              onChangeText={setDestination}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={itemName && destination ? styles.btnActive : styles.btnDisabled}
          onPress={requestPickup}
          disabled={isSubmitting || !itemName || !destination}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.btnText}>Find a Driver</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  webMapPlaceholder: { width, height: height * 0.65, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  placeholderTitle: { color: '#64748b', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  placeholderText: { color: '#94a3b8', fontSize: 16 },
  header: { position: 'absolute', top: 24, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  logoText: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.95)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: -5 }, elevation: 10 },
  handle: { width: 48, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 24 },
  inputCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginRight: 12 },
  dotBlack: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#0f172a', marginRight: 12 },
  line: { width: 2, height: 24, backgroundColor: '#e2e8f0', marginLeft: 4, marginVertical: 4 },
  input: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '500' },
  btnActive: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#0f172a', shadowColor: '#0f172a', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnDisabled: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#cbd5e1' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});