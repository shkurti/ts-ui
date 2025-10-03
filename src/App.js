import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Shipments from './pages/Shipments';
import Trackers from './pages/Trackers';
import Analysis from './pages/Analysis';
import Configure from './pages/Configure';
import AddAlerts from './pages/AddAlerts';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Navbar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Shipments />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/trackers" element={<Trackers />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/configure" element={<Configure />} />
            <Route path="/configure/add-alerts" element={<AddAlerts />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

export default App;
