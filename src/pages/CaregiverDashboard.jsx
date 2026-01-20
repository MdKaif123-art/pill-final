// Caregiver Dashboard Component
// Allows caregivers to manage patient settings and monitor adherence

import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import {
  getDeviceSettings,
  createDeviceSettings,
  updateDeviceSettings,
  subscribeToDeviceSettings,
  subscribeToDoseLogs,
  calculateAdherence,
  getPatientByCustomUID,
  setCustomUID,
  getCaregiverPatientsByUID,
  getDoseLogs
} from '../firebase/database';
import { sendReminderEmail, sendDoseStatusEmail, sendLowStockEmail } from '../utils/emailNotifications';
import { register } from '../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parse, differenceInSeconds } from 'date-fns';
import toast from 'react-hot-toast';
import { useRef } from 'react';

const CaregiverDashboard = ({ user, setUser }) => {
  const [patientId, setPatientId] = useState('');
  const [settings, setSettings] = useState(null);
  const [doseLogs, setDoseLogs] = useState([]);
  const [adherence, setAdherence] = useState({ week: null, month: null });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    morningDoseTime: '',
    eveningDoseTime: '',
    morningPillCount: 0,
    eveningPillCount: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pendingPatientId, setPendingPatientId] = useState('');
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showCustomUIDDialog, setShowCustomUIDDialog] = useState(false);
  const [newPatientFirebaseUID, setNewPatientFirebaseUID] = useState('');
  const [customUID, setCustomUID] = useState('');
  const [activeReminder, setActiveReminder] = useState(null); // { type: 'morning'|'evening', time: Date, patientId: string }
  const unsubscribeRefs = useRef({ settings: null, logs: null });

  // Removed auto-load on patientId change - now manual load only

  const resetPatientState = () => {
    setSettings(null);
    setDoseLogs([]);
    setAdherence({ week: null, month: null });
    setAlerts([]);
    setIsEditing(false);
    setShowCreateDialog(false);
    setPendingPatientId('');
    setActiveReminder(null);
  };

  const clearSubscriptions = () => {
    if (unsubscribeRefs.current.settings) {
      unsubscribeRefs.current.settings();
    }
    if (unsubscribeRefs.current.logs) {
      unsubscribeRefs.current.logs();
    }
    unsubscribeRefs.current = { settings: null, logs: null };
  };

  const checkPatientExists = async (pid) => {
    if (!pid || pid.trim() === '') {
      toast.error('Please enter a valid patient ID');
      return;
    }

    setLoading(true);
    try {
      const customUIDUpper = pid.trim().toUpperCase();
      // Clear previous data/subscriptions before loading a new UID
      clearSubscriptions();
      resetPatientState();

      // Try to find patient by custom UID first
      const patientData = await getPatientByCustomUID(customUIDUpper);

      if (!patientData) {
        toast.error(`Patient with custom UID "${customUIDUpper}" not found. Please verify the UID.`);
        setLoading(false);
        resetPatientState();
        return;
      }

      // Check if settings exist (using custom UID)
      const deviceSettings = await getDeviceSettings(customUIDUpper);

      if (deviceSettings) {
        // Settings exist - load them
        loadPatientData(customUIDUpper, deviceSettings);
      } else {
        // Settings don't exist - ask if they want to create
        setPendingPatientId(customUIDUpper);
        setShowCreateDialog(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking patient:', error);
      toast.error('Failed to check patient. Please try again.');
      setLoading(false);
    }
  };

  const loadPatientData = async (pid, existingSettings = null) => {
    setLoading(true);
    clearSubscriptions();
    try {
      const deviceSettings = existingSettings || await getDeviceSettings(pid);

      if (!deviceSettings) {
        toast.error('Settings not found. Please create them first.');
        resetPatientState();
        setLoading(false);
        return;
      }

      setSettings(deviceSettings);
      setFormData({
        morningDoseTime: deviceSettings.morningDoseTime || '',
        eveningDoseTime: deviceSettings.eveningDoseTime || '',
        morningPillCount: deviceSettings.morningPillCount || 0,
        eveningPillCount: deviceSettings.eveningPillCount || 0
      });

      // Store current settings in a ref for use in callbacks
      const settingsRef = { current: deviceSettings };
      
      // Subscribe to real-time updates
      unsubscribeRefs.current.settings = subscribeToDeviceSettings(pid, (data) => {
        // Check for low stock and send email notifications
        // Use caregiverEmail from patient settings (not logged-in user email)
        const caregiverEmail = data?.caregiverEmail;
        
        if (data && settingsRef.current && caregiverEmail) {
          const prevMorningCount = settingsRef.current.morningPillCount || 0;
          const prevEveningCount = settingsRef.current.eveningPillCount || 0;
          const newMorningCount = data.morningPillCount || 0;
          const newEveningCount = data.eveningPillCount || 0;
          
          const today = format(new Date(), 'yyyy-MM-dd');
          
          // Check if morning pills dropped below threshold (10)
          if (prevMorningCount > 10 && newMorningCount <= 10 && newMorningCount >= 0) {
            const lowStockKey = `${pid}-lowstock-morning-${today}`;
            if (!sentEmailsRef.current.lowStock.has(lowStockKey)) {
              sentEmailsRef.current.lowStock.add(lowStockKey);
              console.log(`📧 Sending LOW STOCK email to ${caregiverEmail} for patient ${pid} - Morning pills: ${newMorningCount}`);
              
              sendLowStockEmail(
                caregiverEmail,
                pid,
                null,
                'morning',
                newMorningCount
              ).then(() => {
                console.log(`✅ Low stock email sent successfully for ${pid}`);
              }).catch(err => {
                console.error(`❌ Failed to send low stock email:`, err);
                sentEmailsRef.current.lowStock.delete(lowStockKey);
              });
            }
          }
          
          // Check if evening pills dropped below threshold (10)
          if (prevEveningCount > 10 && newEveningCount <= 10 && newEveningCount >= 0) {
            const lowStockKey = `${pid}-lowstock-evening-${today}`;
            if (!sentEmailsRef.current.lowStock.has(lowStockKey)) {
              sentEmailsRef.current.lowStock.add(lowStockKey);
              console.log(`📧 Sending LOW STOCK email to ${caregiverEmail} for patient ${pid} - Evening pills: ${newEveningCount}`);
              
              sendLowStockEmail(
                caregiverEmail,
                pid,
                null,
                'evening',
                newEveningCount
              ).then(() => {
                console.log(`✅ Low stock email sent successfully for ${pid}`);
              }).catch(err => {
                console.error(`❌ Failed to send low stock email:`, err);
                sentEmailsRef.current.lowStock.delete(lowStockKey);
              });
            }
          }
        }
        
        settingsRef.current = data; // Update ref
        setSettings(data);
        checkAlerts(data);
      });

      unsubscribeRefs.current.logs = subscribeToDoseLogs(pid, async (logs) => {
        // Check for new dose logs and send email notifications immediately
        // Use caregiverEmail from patient settings (not logged-in user email)
        const caregiverEmail = settingsRef.current?.caregiverEmail;
        
        if (logs.length > 0 && caregiverEmail) {
          const latestLog = logs[0];
          const logDate = latestLog.timestamp?.toDate ? latestLog.timestamp.toDate() : new Date(latestLog.createdAt);
          const now = new Date();
          
          // Send email if log is from the last 5 minutes (to catch all new logs)
          if (Math.abs(now - logDate) < 5 * 60 * 1000) {
            const logKey = `${pid}-dose-${latestLog.id}`;
            
            // Only send if we haven't sent for this log yet
            if (!sentEmailsRef.current.missed.has(logKey) && latestLog.status === 'missed') {
              sentEmailsRef.current.missed.add(logKey);
              console.log(`📧 Sending MISSED dose email to ${caregiverEmail} for patient ${pid}`);
              
              sendDoseStatusEmail(
                caregiverEmail,
                pid,
                null,
                latestLog.doseType,
                latestLog.status,
                latestLog.delaySeconds || 0,
                logDate.toLocaleString(),
                settingsRef.current.morningPillCount || 0,
                settingsRef.current.eveningPillCount || 0
              ).then(() => {
                console.log(`✅ Dose status email sent successfully for ${pid}`);
              }).catch(err => {
                console.error(`❌ Failed to send dose status email to ${caregiverEmail}:`, err);
                sentEmailsRef.current.missed.delete(logKey);
              });
            } else if (!sentEmailsRef.current.missed.has(logKey) && latestLog.status === 'taken') {
              // Also send email for taken doses
              sentEmailsRef.current.missed.add(logKey);
              console.log(`📧 Sending TAKEN dose email to ${caregiverEmail} for patient ${pid}`);
              
              sendDoseStatusEmail(
                caregiverEmail,
                pid,
                null,
                latestLog.doseType,
                latestLog.status,
                latestLog.delaySeconds || 0,
                logDate.toLocaleString(),
                settingsRef.current.morningPillCount || 0,
                settingsRef.current.eveningPillCount || 0
              ).then(() => {
                console.log(`✅ Dose status email sent successfully for ${pid}`);
              }).catch(err => {
                console.error(`❌ Failed to send dose status email:`, err);
                sentEmailsRef.current.missed.delete(logKey);
              });
            }
          }
        }
        
        setDoseLogs(logs);
        const weekStats = await calculateAdherence(pid, 'week');
        const monthStats = await calculateAdherence(pid, 'month');
        setAdherence({ week: weekStats, month: monthStats });
      });

      // Set patientId for reminder checking
      setPatientId(pid);
      setLoading(false);
    } catch (error) {
      console.error('Error loading patient data:', error);
      toast.error('Failed to load patient data. Please check the patient ID.');
      resetPatientState();
      clearSubscriptions();
      setLoading(false);
    }
  };

  const handleCreateSettings = async () => {
    if (!pendingPatientId) return;

    setLoading(true);
    try {
      // Create settings with no default times
      const newSettings = await createDeviceSettings(pendingPatientId, {
        caregiverEmail: user?.email,
        caregiverUID: user?.uid,
        morningDoseTime: null,
        eveningDoseTime: null,
        morningPillCount: 0,
        eveningPillCount: 0
      });

      setShowCreateDialog(false);
      setPatientId(pendingPatientId);
      await loadPatientData(pendingPatientId, newSettings);
      toast.success('New patient settings created! Please configure dose times and pill counts.');
      setIsEditing(true); // Auto-open edit mode for new patient
    } catch (error) {
      console.error('Error creating settings:', error);
      toast.error('Failed to create settings. Please try again.');
      setLoading(false);
    }
  };

  const handleCreateNewPatient = async (e) => {
    e.preventDefault();

    // Validate form
    if (!newPatientForm.email || !newPatientForm.password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPatientForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPatientForm.password !== newPatientForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Register new patient account
      const newUser = await register(newPatientForm.email, newPatientForm.password, 'patient');

      // Store Firebase UID and show custom UID dialog
      setNewPatientFirebaseUID(newUser.uid);
      setCustomUID(''); // Reset custom UID input
      setShowNewPatientForm(false);
      setShowCustomUIDDialog(true);

      toast.success('Patient account created! Please assign a custom UID (e.g., U1, U101)');
      setLoading(false);
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error(error.message || 'Failed to create patient. Please try again.');
      setLoading(false);
    }
  };

  const handleAssignCustomUID = async () => {
    if (!customUID || !customUID.trim()) {
      toast.error('Please enter a custom UID');
      return;
    }

    // Validate custom UID format (U followed by numbers, e.g., U1, U101)
    const customUIDRegex = /^U\d+$/i;
    if (!customUIDRegex.test(customUID.trim())) {
      toast.error('Custom UID must be in format U1, U101, etc. (U followed by numbers)');
      return;
    }

    setLoading(true);
    try {
      const customUIDUpper = customUID.trim().toUpperCase();

      // Set custom UID mapping with caregiver email
      await setCustomUID(newPatientFirebaseUID, customUIDUpper, user?.email, user?.uid);

      // Create settings for the new patient using custom UID
      const newSettings = await createDeviceSettings(customUIDUpper, {
        firebaseUID: newPatientFirebaseUID,
        caregiverEmail: user?.email,
        caregiverUID: user?.uid,
        morningDoseTime: null,
        eveningDoseTime: null,
        morningPillCount: 0,
        eveningPillCount: 0
      });

      // Reset forms
      setNewPatientForm({ email: '', password: '', confirmPassword: '' });
      setShowCustomUIDDialog(false);
      setCustomUID('');

      // Load the new patient using custom UID
      setPatientId(customUIDUpper);
      await loadPatientData(customUIDUpper, newSettings);
      setIsEditing(true); // Auto-open edit mode for new patient

      toast.success(`Patient created successfully! Custom UID: ${customUIDUpper}. Configure dose times and pill counts below.`);
    } catch (error) {
      console.error('Error assigning custom UID:', error);
      toast.error(error.message || 'Failed to assign custom UID. Please try again.');
      setLoading(false);
    }
  };

  const checkAlerts = (currentSettings) => {
    const newAlerts = [];

    // Low pill stock alerts (separate for morning and evening)
    if (currentSettings.morningPillCount <= 10) {
      newAlerts.push({
        type: 'low_stock',
        severity: 'high',
        message: `Low morning pill stock: ${currentSettings.morningPillCount} pills remaining`,
        timestamp: new Date()
      });
    }

    if (currentSettings.eveningPillCount <= 10) {
      newAlerts.push({
        type: 'low_stock',
        severity: 'high',
        message: `Low evening pill stock: ${currentSettings.eveningPillCount} pills remaining`,
        timestamp: new Date()
      });
    }

    // Device offline alert
    if (currentSettings.deviceStatus === 'offline') {
      newAlerts.push({
        type: 'offline',
        severity: 'medium',
        message: 'Device is offline. Check connection.',
        timestamp: new Date()
      });
    }

    // Missed dose alerts (check recent logs)
    const recentMissed = doseLogs.filter(log => {
      if (log.status !== 'missed') return false;
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.createdAt);
      const hoursAgo = (new Date() - logDate) / (1000 * 60 * 60);
      return hoursAgo < 24;
    });

    if (recentMissed.length > 0) {
      newAlerts.push({
        type: 'missed_dose',
        severity: 'high',
        message: `${recentMissed.length} missed dose(s) in the last 24 hours`,
        timestamp: new Date()
      });
    }

    setAlerts(newAlerts);
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    if (!patientId) {
      toast.error('Please enter a patient ID');
      return;
    }

    // Validate form data
    if (!formData.morningDoseTime || !formData.eveningDoseTime) {
      toast.error('Please set both morning and evening dose times');
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(formData.morningDoseTime) || !timeRegex.test(formData.eveningDoseTime)) {
      toast.error('Please enter valid time format (HH:MM, e.g., 11:04)');
      return;
    }

    if (isNaN(formData.morningPillCount) || formData.morningPillCount < 0) {
      toast.error('Please enter a valid morning pill count (0 or greater)');
      return;
    }

    if (isNaN(formData.eveningPillCount) || formData.eveningPillCount < 0) {
      toast.error('Please enter a valid evening pill count (0 or greater)');
      return;
    }

    try {
      // Update settings
      await updateDeviceSettings(patientId, {
        morningDoseTime: formData.morningDoseTime,
        eveningDoseTime: formData.eveningDoseTime,
        morningPillCount: parseInt(formData.morningPillCount),
        eveningPillCount: parseInt(formData.eveningPillCount)
      });

      toast.success('Settings updated successfully! The device will sync these changes.');
      setIsEditing(false);

      // Reload to get updated data
      await loadPatientData(patientId);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error(error.message || 'Failed to update settings. Please try again.');
    }
  };

  const prepareChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const dayLogs = doseLogs.filter(log => {
        const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
        return logDate === dateStr;
      });

      last7Days.push({
        date: format(date, 'MMM dd'),
        taken: dayLogs.filter(l => l.status === 'taken').length,
        missed: dayLogs.filter(l => l.status === 'missed').length
      });
    }
    return last7Days;
  };

  const getStatusColor = (status) => {
    return status === 'online' ? 'green' : 'red';
  };

  const formatDelay = (log) => {
    // Check for delaySeconds first (new format), then fall back to delayMinutes (old format)
    const delaySeconds = log.delaySeconds || (log.delayMinutes ? log.delayMinutes * 60 : 0);

    if (delaySeconds === 0) return '-';

    const hours = Math.floor(delaySeconds / 3600);
    const minutes = Math.floor((delaySeconds % 3600) / 60);
    const seconds = delaySeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  };

  // Track sent emails to avoid duplicates (persist across re-renders)
  const sentEmailsRef = useRef({
    reminders: new Set(),
    missed: new Set(),
    lowStock: new Set()
  });

  // Check for upcoming doses and send reminder emails for ALL patients of logged-in caregiver
  useEffect(() => {
    if (!user || user.role !== 'caregiver' || !user.email) {
      return;
    }

    const checkAllPatientReminders = async () => {
      try {
        // Get all patients for this caregiver
        const allPatients = await getCaregiverPatientsByUID(user.uid);
        
        if (allPatients.length === 0) {
          return;
        }

        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        // Check each patient for reminders
        for (const patient of allPatients) {
          const pId = patient.customUID || patient.id;
          
          // Use the caregiver email from patient settings (not logged-in user email)
          const caregiverEmail = patient.caregiverEmail || user.email;
          
          if (!caregiverEmail) {
            continue;
          }
          
          if (!patient.morningDoseTime || !patient.eveningDoseTime) {
            continue; // Skip if times not set
          }

          // Parse dose times
          const [morningHour, morningMin] = patient.morningDoseTime.split(':').map(Number);
          const [eveningHour, eveningMin] = patient.eveningDoseTime.split(':').map(Number);

          // Get dose logs for this patient
          const patientLogs = await getDoseLogs(pId);
          
          // Get missed doses today (array, not count)
          const missedToday = patientLogs.filter(log => {
            const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
            return logDate === today && log.status === 'missed';
          });

          // Send email for each missed dose
          for (const missedLog of missedToday) {
            const missedKey = `${pId}-missed-${missedLog.id}`;
            if (!sentEmailsRef.current.missed.has(missedKey)) {
              sentEmailsRef.current.missed.add(missedKey);
              
              console.log(`📧 Sending MISSED dose email to ${caregiverEmail} for patient ${pId}`);
              
              const logDate = missedLog.timestamp?.toDate ? missedLog.timestamp.toDate() : new Date(missedLog.createdAt);
              sendDoseStatusEmail(
                caregiverEmail,
                pId,
                null,
                missedLog.doseType,
                'missed',
                0,
                logDate.toLocaleString(),
                patient.morningPillCount || 0,
                patient.eveningPillCount || 0
              ).catch(err => console.error(`❌ Failed to send missed dose email:`, err));
            }
          }

          // Check morning reminder (within 2 minutes window - more reliable)
          const morningDiffMinutes = (currentHour * 60 + currentMin) - (morningHour * 60 + morningMin);
          if (Math.abs(morningDiffMinutes) <= 2 && morningDiffMinutes >= 0) {
            const reminderKey = `${pId}-morning-${today}`;
            
            // Check if already logged today
            const todayMorningLog = patientLogs.find(log => {
              const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
              return logDate === today && log.doseType === 'morning';
            });

            if (!todayMorningLog && !sentEmailsRef.current.reminders.has(reminderKey)) {
              sentEmailsRef.current.reminders.add(reminderKey);
              
              console.log(`📧 Sending REMINDER email to ${caregiverEmail} for patient ${pId} - Morning dose at ${patient.morningDoseTime}`);
              
              // Send comprehensive reminder email immediately
              sendReminderEmail(
                caregiverEmail,
                pId,
                'morning',
                patient.morningDoseTime,
                patient.morningPillCount || 0,
                patient.eveningPillCount || 0,
                missedToday.length
              ).then(result => {
                console.log(`✅ Reminder email sent successfully for ${pId}`);
              }).catch(err => {
                console.error(`❌ Failed to send reminder email for ${pId}:`, err);
                sentEmailsRef.current.reminders.delete(reminderKey);
              });

              // Update active reminder for loaded patient
              if (pId === patientId) {
                const morningDateTime = new Date(`${today}T${patient.morningDoseTime}:00`);
                setActiveReminder({ type: 'morning', time: morningDateTime, patientId: pId });
              }
            }
          }

          // Check evening reminder (within 2 minutes window)
          const eveningDiffMinutes = (currentHour * 60 + currentMin) - (eveningHour * 60 + eveningMin);
          if (Math.abs(eveningDiffMinutes) <= 2 && eveningDiffMinutes >= 0) {
            const reminderKey = `${pId}-evening-${today}`;
            
            // Check if already logged today
            const todayEveningLog = patientLogs.find(log => {
              const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
              return logDate === today && log.doseType === 'evening';
            });

            if (!todayEveningLog && !sentEmailsRef.current.reminders.has(reminderKey)) {
              sentEmailsRef.current.reminders.add(reminderKey);
              
              console.log(`📧 Sending REMINDER email to ${caregiverEmail} for patient ${pId} - Evening dose at ${patient.eveningDoseTime}`);
              
              // Send comprehensive reminder email immediately
              sendReminderEmail(
                caregiverEmail,
                pId,
                'evening',
                patient.eveningDoseTime,
                patient.morningPillCount || 0,
                patient.eveningPillCount || 0,
                missedToday.length
              ).then(result => {
                console.log(`✅ Reminder email sent successfully for ${pId}`);
              }).catch(err => {
                console.error(`❌ Failed to send reminder email for ${pId}:`, err);
                sentEmailsRef.current.reminders.delete(reminderKey);
              });

              // Update active reminder for loaded patient
              if (pId === patientId) {
                const eveningDateTime = new Date(`${today}T${patient.eveningDoseTime}:00`);
                setActiveReminder({ type: 'evening', time: eveningDateTime, patientId: pId });
              }
            }
          }

          // Check low stock and send email
          const morningCount = patient.morningPillCount || 0;
          const eveningCount = patient.eveningPillCount || 0;
          
          if (morningCount > 0 && morningCount <= 10) {
            const lowStockKey = `${pId}-lowstock-morning-${today}`;
            if (!sentEmailsRef.current.lowStock.has(lowStockKey)) {
              sentEmailsRef.current.lowStock.add(lowStockKey);
              console.log(`📧 Sending LOW STOCK email to ${caregiverEmail} for patient ${pId} - Morning pills: ${morningCount}`);
              
              sendLowStockEmail(
                caregiverEmail,
                pId,
                null,
                'morning',
                morningCount
              ).catch(err => console.error(`❌ Failed to send low stock email:`, err));
            }
          }
          
          if (eveningCount > 0 && eveningCount <= 10) {
            const lowStockKey = `${pId}-lowstock-evening-${today}`;
            if (!sentEmailsRef.current.lowStock.has(lowStockKey)) {
              sentEmailsRef.current.lowStock.add(lowStockKey);
              console.log(`📧 Sending LOW STOCK email to ${caregiverEmail} for patient ${pId} - Evening pills: ${eveningCount}`);
              
              sendLowStockEmail(
                caregiverEmail,
                pId,
                null,
                'evening',
                eveningCount
              ).catch(err => console.error(`❌ Failed to send low stock email:`, err));
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking patient reminders:', error);
      }
    };

    // Check every 10 seconds for instant notifications
    const interval = setInterval(checkAllPatientReminders, 10000);
    checkAllPatientReminders(); // Check immediately

    return () => clearInterval(interval);
  }, [user, patientId]);

  // Check for upcoming doses and show reminders for loaded patient (UI only)
  useEffect(() => {
    if (!settings || !patientId || !settings.morningDoseTime || !settings.eveningDoseTime) {
      setActiveReminder(null);
      return;
    }

    const checkReminders = () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      const morningDateTime = new Date(`${today}T${settings.morningDoseTime}:00`);
      const eveningDateTime = new Date(`${today}T${settings.eveningDoseTime}:00`);

      // Check if it's time for morning dose (within 1 minute window)
      const morningDiff = differenceInSeconds(now, morningDateTime);
      if (Math.abs(morningDiff) <= 60 && morningDiff >= 0) {
        const todayMorningLog = doseLogs.find(log => {
          const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
          return logDate === today && log.doseType === 'morning';
        });

        if (!todayMorningLog && (!activeReminder || activeReminder.type !== 'morning' || activeReminder.patientId !== patientId)) {
          setActiveReminder({ type: 'morning', time: morningDateTime, patientId: patientId });
        }
      }

      // Check if it's time for evening dose (within 1 minute window)
      const eveningDiff = differenceInSeconds(now, eveningDateTime);
      if (Math.abs(eveningDiff) <= 60 && eveningDiff >= 0) {
        const todayEveningLog = doseLogs.find(log => {
          const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
          return logDate === today && log.doseType === 'evening';
        });

        if (!todayEveningLog && (!activeReminder || activeReminder.type !== 'evening' || activeReminder.patientId !== patientId)) {
          setActiveReminder({ type: 'evening', time: eveningDateTime, patientId: patientId });
        }
      }

      // Clear reminder if dose was taken
      if (activeReminder && activeReminder.patientId === patientId) {
        const todayLog = doseLogs.find(log => {
          const logDate = log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : format(new Date(log.createdAt), 'yyyy-MM-dd');
          return logDate === today && log.doseType === activeReminder.type && log.status === 'taken';
        });
        if (todayLog) {
          setActiveReminder(null);
        }
      }
    };

    // Check every 10 seconds for UI updates
    const interval = setInterval(checkReminders, 10000);
    checkReminders();

    return () => clearInterval(interval);
  }, [settings, doseLogs, patientId, activeReminder]);

  return (
    <Layout user={user} setUser={setUser} title="Caregiver Dashboard">
      <div className="space-y-6">
        {/* Patient Management Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Patient Management</h2>
              <p className="text-xs text-gray-500 mt-1">
                Load existing patient or create a new patient account
              </p>
            </div>
            <button
              onClick={() => setShowNewPatientForm(!showNewPatientForm)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              {showNewPatientForm ? 'Cancel' : '+ Create New Patient'}
            </button>
          </div>

          {/* Create New Patient Form */}
          {showNewPatientForm && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Create New Patient Account</h3>
              <form onSubmit={handleCreateNewPatient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newPatientForm.email}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, email: e.target.value })}
                    required
                    placeholder="patient@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPatientForm.password}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPatientForm.confirmPassword}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, confirmPassword: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Re-enter password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Patient Account'}
                </button>
              </form>
            </div>
          )}

          {/* Load Existing Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Load Existing Patient
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Enter the custom Patient ID (e.g., U1, U101) to view their data.
            </p>
            <div className="flex space-x-4">
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    checkPatientExists(patientId);
                  }
                }}
                placeholder="Enter custom Patient ID (e.g., U1, U101)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <button
                onClick={() => checkPatientExists(patientId)}
                disabled={loading || !patientId.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Patient'}
              </button>
            </div>
          </div>
        </div>

        {/* Assign Custom UID Dialog */}
        {showCustomUIDDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Custom Patient ID</h3>
              <p className="text-sm text-gray-600 mb-4">
                Patient account created successfully! Please assign a custom Patient ID (e.g., U1, U101).
                <br /><br />
                This ID will be used to identify the patient in the system.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Patient ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customUID}
                  onChange={(e) => setCustomUID(e.target.value.toUpperCase())}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAssignCustomUID();
                    }
                  }}
                  placeholder="e.g., U1, U101"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">Format: U followed by numbers (e.g., U1, U101)</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleAssignCustomUID}
                  disabled={loading || !customUID.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Assigning...' : 'Assign & Continue'}
                </button>
                <button
                  onClick={() => {
                    setShowCustomUIDDialog(false);
                    setCustomUID('');
                    setNewPatientFirebaseUID('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Settings Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Patient Settings?</h3>
              <p className="text-sm text-gray-600 mb-6">
                Settings for patient <strong>{pendingPatientId}</strong> do not exist. Would you like to create them now?
                <br /><br />
                You will need to configure dose times and pill counts after creation.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={handleCreateSettings}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Yes, Create'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateDialog(false);
                    setPendingPatientId('');
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!settings && !loading && patientId && !showCreateDialog && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">No patient loaded</p>
                <p className="text-sm text-blue-700 mt-1">
                  Enter a patient ID above and click "Load Patient" to view their data.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        )}

        {settings && (
          <>
            {/* Active Reminder Banner for Loaded Patient */}
            {activeReminder && activeReminder.patientId === patientId && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-red-600">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-red-900">💊 Medication Reminder</h3>
                      <p className="text-lg text-red-800 mt-1">
                        Patient <strong>{patientId}</strong> needs to take <strong>{activeReminder.type}</strong> pills now!
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        Scheduled time: {format(activeReminder.time, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveReminder(null)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${alert.severity === 'high'
                        ? 'bg-red-50 border-red-500 text-red-800'
                        : 'bg-yellow-50 border-yellow-500 text-yellow-800'
                      }`}
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">{alert.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Morning Pills Remaining"
                value={settings?.morningPillCount || 0}
                subtitle={settings?.morningPillCount <= 10 ? 'Low stock!' : 'In stock'}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                }
                color={settings?.morningPillCount <= 10 ? 'red' : 'primary'}
              />
              <StatCard
                title="Evening Pills Remaining"
                value={settings?.eveningPillCount || 0}
                subtitle={settings?.eveningPillCount <= 10 ? 'Low stock!' : 'In stock'}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                }
                color={settings?.eveningPillCount <= 10 ? 'red' : 'primary'}
              />
              <StatCard
                title="Weekly Adherence"
                value={`${adherence.week?.percentage || 0}%`}
                subtitle={`${adherence.week?.taken || 0} taken, ${adherence.week?.missed || 0} missed`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                color={adherence.week?.percentage >= 80 ? 'green' : 'yellow'}
              />
              <StatCard
                title="Monthly Adherence"
                value={`${adherence.month?.percentage || 0}%`}
                subtitle={`${adherence.month?.taken || 0} taken, ${adherence.month?.missed || 0} missed`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                color={adherence.month?.percentage >= 80 ? 'green' : 'yellow'}
              />
              <StatCard
                title="Device Status"
                value={settings?.deviceStatus === 'online' ? 'Online' : 'Offline'}
                subtitle={settings?.lastSync ? `Last sync: ${format(settings.lastSync.toDate(), 'MMM dd, HH:mm')}` : 'Never synced'}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                }
                color={getStatusColor(settings?.deviceStatus)}
              />
            </div>

            {/* Settings Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Device Settings</h3>
                  {settings?.createdAt && !settings?.lastUpdated && (
                    <p className="text-xs text-gray-500 mt-1">
                      Settings initialized automatically. Configure dose times and pill count below.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  {isEditing ? 'Cancel' : 'Edit Settings'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Morning Dose Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.morningDoseTime}
                        onChange={(e) => setFormData({ ...formData, morningDoseTime: e.target.value })}
                        required
                        placeholder="HH:MM (e.g., 11:04)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: HH:MM (24-hour)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Evening Dose Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.eveningDoseTime}
                        onChange={(e) => setFormData({ ...formData, eveningDoseTime: e.target.value })}
                        required
                        placeholder="HH:MM (e.g., 21:00)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: HH:MM (24-hour)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Morning Pill Count <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.morningPillCount}
                        onChange={(e) => setFormData({ ...formData, morningPillCount: e.target.value })}
                        required
                        min="0"
                        placeholder="Enter morning pill count"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Evening Pill Count <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.eveningPillCount}
                        onChange={(e) => setFormData({ ...formData, eveningPillCount: e.target.value })}
                        required
                        min="0"
                        placeholder="Enter evening pill count"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Save Settings
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Morning Dose Time</p>
                    <p className="text-lg font-semibold text-gray-900">{settings.morningDoseTime || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Evening Dose Time</p>
                    <p className="text-lg font-semibold text-gray-900">{settings.eveningDoseTime || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Morning Pills</p>
                    <p className="text-lg font-semibold text-gray-900">{settings.morningPillCount || 0} pills</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Evening Pills</p>
                    <p className="text-lg font-semibold text-gray-900">{settings.eveningPillCount || 0} pills</p>
                  </div>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Dose History (Last 7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="taken" fill="#10b981" name="Taken" />
                    <Bar dataKey="missed" fill="#ef4444" name="Missed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Adherence Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="taken" stroke="#10b981" name="Taken" />
                    <Line type="monotone" dataKey="missed" stroke="#ef4444" name="Missed" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Dose History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Dose History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dose Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {doseLogs.slice(0, 10).map((log) => {
                      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.createdAt);
                      return (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(logDate, 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {log.doseType || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'taken'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}>
                              {log.status === 'taken' ? 'Taken' : 'Missed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDelay(log)}
                          </td>
                        </tr>
                      );
                    })}
                    {doseLogs.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                          No dose history available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default CaregiverDashboard;

