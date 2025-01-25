import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import Home from './Home';
import Dashboard from './pages/Dashboard';
import ManageAds from './pages/ManageAds';
import Library from './pages/Library';
import Scheduling from './pages/Scheduling';
import Devices from './pages/Devices';
import ChooseTemplate from './components/ChooseTemplate';
import EditTemplate from './pages/EditTemplate';
import Login from './pages/Login';
import { ImageProvider } from './components/ImageContext';

import Navbar from './components/Navbar';
import ProfileDropdown from './components/ProfileDropdown';
import './App.css';
import CanvaPage from './pages/CanvaPage';

// Separate component for the main app content to use hooks
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    useEffect(() => {
        // Validate token with backend
        const validateToken = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/validate`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    localStorage.removeItem('isAuthenticated');
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            } catch (error) {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('token');
                navigate('/login');
            }
        };

        if (token) {
            validateToken();
        }
    }, [token, navigate]);

    if (!isAuthenticated || !token) {
        return <Navigate to="/login" />;
    }

    return children;
};

function AppContent() {
    const [isAuthenticated, setIsAuthenticated] = useState(
        localStorage.getItem('isAuthenticated') === 'true'
    );
    const location = useLocation();

    useEffect(() => {
        localStorage.setItem('isAuthenticated', isAuthenticated);
    }, [isAuthenticated]);

    return (
        <div className="App">
            {location.pathname !== '/' && location.pathname !== '/login' && (
                <>
                    <Navbar />
                    <ProfileDropdown setIsAuthenticated={setIsAuthenticated} />
                </>
            )}

            <Routes>
                <Route path="/" element={<Home />} />
                <Route
                    path="/login"
                    element={<Login setIsAuthenticated={setIsAuthenticated} />}
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/adManagement"
                    element={
                        <ProtectedRoute>
                            <ManageAds />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/adTemplate"
                    element={
                        <ProtectedRoute>
                            <ChooseTemplate />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/library"
                    element={
                        <ProtectedRoute>
                            <Library />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/scheduling"
                    element={
                        <ProtectedRoute>
                            <Scheduling />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/devices"
                    element={
                        <ProtectedRoute>
                            <Devices />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/edit-template"
                    element={
                        <ProtectedRoute>
                            <EditTemplate />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/canva"
                    element={
                        <ProtectedRoute>
                            <CanvaPage />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </div>
    );
}

function App() {
    return (
        <Router>
            <ImageProvider>
                <AppContent />
            </ImageProvider>
        </Router>
    );
}

export default App;