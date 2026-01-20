// Email Notification Utilities
// Sends emails to caregivers via the backend API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Send reminder email to caregiver with all patient details
 */
export const sendReminderEmail = async (
  caregiverEmail, 
  patientId, 
  doseType, 
  scheduledTime,
  morningPillCount = 0,
  eveningPillCount = 0,
  missedDosesToday = 0
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/email/reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caregiverEmail,
        patientId,
        doseType,
        scheduledTime,
        morningPillCount,
        eveningPillCount,
        missedDosesToday,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send reminder email');
    }
    return result;
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
};

/**
 * Send dose status email (taken/missed) to caregiver
 */
export const sendDoseStatusEmail = async (
  caregiverEmail,
  patientId,
  patientName,
  doseType,
  status,
  delaySeconds,
  timestamp,
  morningPillCount,
  eveningPillCount
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/email/dose-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caregiverEmail,
        patientId,
        patientName,
        doseType,
        status,
        delaySeconds,
        timestamp,
        morningPillCount,
        eveningPillCount,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send dose status email');
    }
    return result;
  } catch (error) {
    console.error('Error sending dose status email:', error);
    throw error;
  }
};

/**
 * Send low stock alert email to caregiver
 */
export const sendLowStockEmail = async (caregiverEmail, patientId, patientName, doseType, currentCount) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/email/low-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caregiverEmail,
        patientId,
        patientName,
        doseType,
        currentCount,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send low stock email');
    }
    return result;
  } catch (error) {
    console.error('Error sending low stock email:', error);
    throw error;
  }
};
