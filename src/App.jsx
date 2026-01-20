// Main App Component
// SeniorPill - Smart Medication Management System

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import CaregiverDashboard from './pages/CaregiverDashboard';
import { getCurrentUser } from './firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication state on mount
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={user.role === 'caregiver' ? '/caregiver' : '/patient'} /> : <Login setUser={setUser} />}
        />
        <Route
          path="/patient"
          element={user && user.role === 'patient' ? <PatientDashboard user={user} setUser={setUser} /> : <Navigate to="/login" />}
        />
        <Route
          path="/caregiver"
          element={user && user.role === 'caregiver' ? <CaregiverDashboard user={user} setUser={setUser} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to={user ? (user.role === 'caregiver' ? '/caregiver' : '/patient') : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default App;

