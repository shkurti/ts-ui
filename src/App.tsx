import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Shipments from './pages/Shipments';
import Trackers from './pages/Trackers';
import Configure from './pages/Configure';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Shipments />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/trackers" element={<Trackers />} />
            <Route path="/configure" element={<Configure />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
