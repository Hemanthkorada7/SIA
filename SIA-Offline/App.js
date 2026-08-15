import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  Modal, Linking, SafeAreaView, StatusBar, Keyboard, Animated
} from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// ---------------------------------------------------------
// 🛠️ DEFAULT APP REGISTRY
// ---------------------------------------------------------
const DEFAULT_REGISTRY = {
  'whatsapp': 'intent://#Intent;package=com.whatsapp;component=com.whatsapp.Main;end',
  'linkedin': 'intent://#Intent;package=com.linkedin.android;component=com.linkedin.android.authenticator.LaunchActivityDefault;end',
  'youtube': 'vnd.youtube://',
  'spotify': 'spotify:',
  'calculator': 'calculator://',
  'phone': 'tel:',
  'camera': 'intent://#Intent;package=com.oneplus.camera;end',
  'gallery': 'intent://#Intent;package=com.oneplus.gallery;end'
};

// ---------------------------------------------------------
// 🌊 ANIMATED VOICE WAVE COMPONENT
// ---------------------------------------------------------
const VoiceWave = ({ isActive }) => {
  const bars = [useRef(new Animated.Value(12)).current, useRef(new Animated.Value(12)).current, useRef(new Animated.Value(12)).current, useRef(new Animated.Value(12)).current];

  useEffect(() => {
    if (isActive) {
      bars.forEach((bar, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, { toValue: 45, duration: 350 + (index * 50), useNativeDriver: false }),
            Animated.timing(bar, { toValue: 12, duration: 350 + (index * 50), useNativeDriver: false }),
          ])
        ).start();
      });
    } else {
      bars.forEach(bar => Animated.timing(bar, { toValue: 12, duration: 300, useNativeDriver: false }).start());
    }
  }, [isActive]);

  return (
    <View style={styles.waveContainer}>
      {bars.map((bar, i) => <Animated.View key={i} style={[styles.waveBar, { height: bar }]} />)}
    </View>
  );
};

// ---------------------------------------------------------
// 🚀 MAIN APPLICATION
// ---------------------------------------------------------
export default function App() {
  // App States
  const [activeTab, setActiveTab] = useState('HOME'); // HOME | SETTINGS | LOGS
  const [inputContent, setInputContent] = useState('');
  
  // Data States
  const [history, setHistory] = useState([]);
  const [appRegistry, setAppRegistry] = useState(DEFAULT_REGISTRY);
  const [errorLogs, setErrorLogs] = useState([]);
  
  // Interaction States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [bulkRouteText, setBulkRouteText] = useState('');

  // ---------------------------------------------------------
  // 💾 LOCAL STORAGE & INITIALIZATION
  // ---------------------------------------------------------
  useEffect(() => {
    loadLocalData();
  }, []);

  // Modern Expo Speech Recognition Events
  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    captureError('Voice Recognition', event.error || 'Unknown mic error');
  });
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      setInputContent(text);
      handleProcessText(text);
    }
  });

  const loadLocalData = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('@sia_history');
      const storedRegistry = await AsyncStorage.getItem('@sia_registry');
      const storedLogs = await AsyncStorage.getItem('@sia_logs');

      if (storedHistory) setHistory(JSON.parse(storedHistory));
      if (storedRegistry) setAppRegistry({ ...DEFAULT_REGISTRY, ...JSON.parse(storedRegistry) });
      if (storedLogs) setErrorLogs(JSON.parse(storedLogs));
    } catch (e) {
      captureError('Data Load', 'Failed to load local storage data.');
    }
  };

  const captureError = async (module, message) => {
    const newLog = { id: Date.now(), module, message, timestamp: new Date().toISOString() };
    const updatedLogs = [newLog, ...errorLogs].slice(0, 50);
    setErrorLogs(updatedLogs);
    await AsyncStorage.setItem('@sia_logs', JSON.stringify(updatedLogs));
  };

  const saveToHistory = async (content, category = 'general') => {
    const newEntry = { id: Date.now(), content, category, timestamp: new Date().toISOString() };
    const updatedHistory = [newEntry, ...history].slice(0, 100);
    setHistory(updatedHistory);
    await AsyncStorage.setItem('@sia_history', JSON.stringify(updatedHistory));
  };

  // ---------------------------------------------------------
  // 🧠 LOCAL INTENT ENGINE
  // ---------------------------------------------------------
  const parseUserIntent = (text) => {
    const cleanText = text.trim().toLowerCase();

    const callMatch = cleanText.match(/(?:call|dial|కాల్|ఫొన్)\s+([a-zA-Z0-9\s]+)/i);
    if (callMatch) {
      const target = callMatch[1].trim();
      const cleanTarget = target.replace(/[^0-9+]/g, '');
      return {
        intent: 'CALL',
        action_url: `tel:${cleanTarget || target}`,
        response_en: `Preparing to dial ${target}.`,
        targetName: target
      };
    }

    const navMatch = cleanText.match(/(?:open|launch|go to|ఓపెన్|తెరు)\s+([a-zA-Z0-9\s]+)/i);
    if (navMatch) {
      const appName = navMatch[1].trim();
      return {
        intent: 'OPEN_APP',
        app_name: appName,
        response_en: `Requesting to open ${appName}.`
      };
    }

    const noteMatch = cleanText.match(/(?:note|remember|write down|remind|రాసుకో|గుర్తుపెట్టుకో)\s+(.+)/i);
    if (noteMatch) {
      return {
        intent: 'SAVE_NOTE',
        saved_text: noteMatch[1].trim(),
        response_en: "Note saved to your private local storage.",
      };
    }

    return {
      intent: 'SAVE_NOTE',
      saved_text: text,
      response_en: "Logged entry locally.",
    };
  };

  const handleProcessText = async (textToSubmit) => {
    const text = textToSubmit || inputContent;
    if (!text.trim()) return;

    Keyboard.dismiss();
    setIsProcessing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const data = parseUserIntent(text);
      setInputContent('');
      setIsProcessing(false);

      if (data.intent === 'CALL') {
        speakBack(data.response_en);
        setPendingAction({ url: data.action_url, actionName: `Call: ${data.targetName}` });
        setTimeout(() => setModalVisible(true), 800);
      } 
      else if (data.intent === 'OPEN_APP') {
        const url = appRegistry[data.app_name.toLowerCase()] || `${data.app_name.toLowerCase()}://`;
        speakBack(data.response_en);
        setPendingAction({ url, actionName: data.app_name.toUpperCase() });
        setTimeout(() => setModalVisible(true), 800);
      } 
      else if (data.intent === 'SAVE_NOTE') {
        speakBack(data.response_en);
        saveToHistory(data.saved_text, 'note');
      }
    } catch (error) {
      setIsProcessing(false);
      captureError('Local Engine', error.message);
      speakBack("An error occurred while processing locally.");
    }
  };

  // ---------------------------------------------------------
  // 🎙️ DEVICE HARDWARE CONTROLS
  // ---------------------------------------------------------
  const toggleMicrophone = async () => {
    try {
      if (isListening) {
        await ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
      } else {
        setInputContent('');
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
          alert("Microphone permission not granted!");
          return;
        }
        ExpoSpeechRecognitionModule.start({
          lang: "en-US",
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
        });
      }
    } catch (error) {
      captureError('Microphone', 'Failed to toggle mic state. Check permissions.');
    }
  };

  const speakBack = (text, lang = 'en-US') => {
    setIsSpeaking(true);
    Speech.speak(text, {
      language: lang, pitch: 1.0, rate: 0.95,
      onDone: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        captureError('Speech Synthesis', 'TTS Failed');
      },
    });
  };

  const confirmAction = () => {
    if (pendingAction) {
      Linking.openURL(pendingAction.url).catch(() => {
        captureError('Deep Link', `App not found for URL: ${pendingAction.url}`);
        speakBack("Target app or route is not available on this device.");
      });
    }
    setModalVisible(false);
    setPendingAction(null);
  };

  // ---------------------------------------------------------
  // ⚙️ SETTINGS & BULK UPLOAD
  // ---------------------------------------------------------
  const handleBulkRouteUpload = async () => {
    if (!bulkRouteText.trim()) return;
    try {
      const lines = bulkRouteText.split('\n');
      let newRoutes = {};
      lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          newRoutes[parts[0].trim().toLowerCase()] = parts[1].trim();
        }
      });
      
      const updatedRegistry = { ...appRegistry, ...newRoutes };
      setAppRegistry(updatedRegistry);
      await AsyncStorage.setItem('@sia_registry', JSON.stringify(updatedRegistry));
      setBulkRouteText('');
      speakBack("Routes updated successfully.");
      setActiveTab('HOME');
    } catch (e) {
      captureError('Bulk Upload', 'Failed to parse route data.');
    }
  };

  // ---------------------------------------------------------
  // 🎨 UI RENDERING
  // ---------------------------------------------------------
  const renderHome = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.centerStage}>
        <VoiceWave isActive={isProcessing || isSpeaking || isListening} />
        <Text style={styles.statusText}>
          {isListening ? "Listening..." : isProcessing ? "Processing Locally..." : isSpeaking ? "SIA is speaking" : "System Ready. 100% Offline."}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={isListening ? "Listening..." : "Speak or type a command..."}
            placeholderTextColor="#64748B"
            value={inputContent}
            onChangeText={setInputContent}
            onSubmitEditing={() => handleProcessText(inputContent)}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => handleProcessText(inputContent)}>
            <Text style={styles.sendButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.micButton, isListening && styles.micButtonActive]} 
          onPress={toggleMicrophone}
          activeOpacity={0.7}
        >
          <Text style={styles.micButtonText}>{isListening ? "🛑" : "🎙️"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Local Vault</Text>
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {history.length === 0 && <Text style={styles.emptyText}>No recent activity.</Text>}
        {history.map((item) => (
          <View key={item.id} style={styles.glassCard}>
            <Text style={styles.cardText}>{item.content}</Text>
            <Text style={styles.cardTimestamp}>
              {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • {item.category.toUpperCase()}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderSettings = () => (
    <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Bulk App Routing</Text>
      <Text style={styles.descriptionText}>
        Add multiple app routes using the format: <Text style={{color: '#38BDF8'}}>appname, intent://url</Text> (One per line)
      </Text>
      
      <TextInput
        style={styles.textArea}
        multiline
        placeholder={"whatsapp, intent://#Intent;package=com.whatsapp;end\nnetflix, intent://..."}
        placeholderTextColor="#475569"
        value={bulkRouteText}
        onChangeText={setBulkRouteText}
      />
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleBulkRouteUpload}>
        <Text style={styles.primaryButtonText}>Save Bulk Routes</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, {marginTop: 30}]}>Current Registry ({Object.keys(appRegistry).length})</Text>
      {Object.keys(appRegistry).map(key => (
        <View key={key} style={styles.miniCard}>
          <Text style={styles.miniCardTitle}>{key}</Text>
          <Text style={styles.miniCardSub} numberOfLines={1} ellipsizeMode="tail">{appRegistry[key]}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderLogs = () => (
    <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
        <Text style={[styles.sectionTitle, {marginBottom: 0}]}>System Error Logs</Text>
        <TouchableOpacity onPress={async () => { setErrorLogs([]); await AsyncStorage.setItem('@sia_logs', '[]'); }}>
          <Text style={{color: '#EF4444', fontSize: 12, fontWeight: '600'}}>CLEAR ALL</Text>
        </TouchableOpacity>
      </View>
      
      {errorLogs.length === 0 && <Text style={styles.emptyText}>System is stable. No errors recorded.</Text>}
      {errorLogs.map((log) => (
        <View key={log.id} style={[styles.glassCard, {borderLeftWidth: 3, borderLeftColor: '#EF4444'}]}>
          <Text style={[styles.cardText, {color: '#EF4444', fontWeight: 'bold', fontSize: 12}]}>[{log.module}]</Text>
          <Text style={[styles.cardText, {marginTop: 4}]}>{log.message}</Text>
          <Text style={styles.cardTimestamp}>
            {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      <View style={styles.header}>
        <Text style={styles.logoText}>S I A</Text>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setActiveTab('HOME')}>
            <Text style={[styles.navItem, activeTab === 'HOME' && styles.navItemActive]}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('SETTINGS')}>
            <Text style={[styles.navItem, activeTab === 'SETTINGS' && styles.navItemActive]}>SETTINGS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('LOGS')}>
            <Text style={[styles.navItem, activeTab === 'LOGS' && styles.navItemActive]}>LOGS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'HOME' && renderHome()}
      {activeTab === 'SETTINGS' && renderSettings()}
      {activeTab === 'LOGS' && renderLogs()}

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <View style={styles.modalIconBox}><Text style={{fontSize: 24}}>🛡️</Text></View>
            <Text style={styles.modalTitle}>Security Authorization</Text>
            <Text style={styles.modalBody}>
              SIA intends to execute external routing to: <Text style={{color: '#FFF', fontWeight: 'bold'}}>{pendingAction?.actionName}</Text>. 
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.denyButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.denyButtonText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.allowButton} onPress={confirmAction}>
                <Text style={styles.allowButtonText}>Authorize</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 25 },
  logoText: { color: '#F8FAFC', fontSize: 26, fontWeight: '200', letterSpacing: 6 },
  navRow: { flexDirection: 'row', gap: 15, backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navItem: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  navItemActive: { color: '#38BDF8' },
  
  centerStage: { alignItems: 'center', justifyContent: 'center', height: 120, marginBottom: 10 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', height: 60, gap: 8 },
  waveBar: { width: 5, backgroundColor: '#38BDF8', borderRadius: 4 },
  statusText: { color: '#475569', fontSize: 12, marginTop: 16, fontWeight: '500', letterSpacing: 0.5 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 12 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  textInput: { flex: 1, color: '#F8FAFC', fontSize: 15, paddingVertical: 12 },
  sendButton: { backgroundColor: '#38BDF8', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 8, marginLeft: 8 },
  sendButtonText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  
  micButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  micButtonActive: { backgroundColor: '#EF4444', borderColor: '#F87171', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  micButtonText: { fontSize: 20 },
  
  listContainer: { flex: 1 },
  sectionTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  descriptionText: { color: '#64748B', fontSize: 13, marginBottom: 15, lineHeight: 20 },
  emptyText: { color: '#475569', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 30 },
  
  glassCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderColor: 'rgba(51, 65, 85, 0.8)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardText: { color: '#E2E8F0', fontSize: 15, lineHeight: 22 },
  cardTimestamp: { color: '#64748B', fontSize: 10, marginTop: 10, fontWeight: '600', letterSpacing: 0.5 },
  
  miniCard: { backgroundColor: '#0F172A', borderColor: '#1E293B', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  miniCardTitle: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  miniCardSub: { color: '#475569', fontSize: 11, marginTop: 4 },
  
  textArea: { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 16, color: '#F8FAFC', padding: 16, fontSize: 14, height: 140, textAlignVertical: 'top', marginBottom: 15 },
  primaryButton: { backgroundColor: '#38BDF8', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#0F172A', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 15, 25, 0.9)', justifyContent: 'flex-end', padding: 15 },
  actionModal: { backgroundColor: '#1E293B', borderColor: '#334155', borderWidth: 1, borderRadius: 28, padding: 25, width: '100%', paddingBottom: 40 },
  modalIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  modalBody: { color: '#94A3B8', fontSize: 15, marginBottom: 25, lineHeight: 24 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  denyButton: { flex: 1, backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  denyButtonText: { color: '#94A3B8', fontWeight: '700', fontSize: 15 },
  allowButton: { flex: 1, backgroundColor: '#38BDF8', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  allowButtonText: { color: '#0F172A', fontWeight: '800', fontSize: 15 }
});