import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path || (path === '/shipments' && location.pathname === '/');
  };

  const toggleMobileMenu = () => {
    console.log('Toggling menu, current state:', mobileMenuOpen);
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    console.log('Closing menu');
    setMobileMenuOpen(false);
  };

  console.log('Current mobileMenuOpen state:', mobileMenuOpen);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" onClick={closeMobileMenu}>LogiTrack</Link>
        </div>
        
        <button 
          className="hamburger-menu" 
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>
        
        <ul className={`navbar-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <li className="navbar-item">
            <Link 
              to="/shipments" 
              className={`navbar-link ${isActive('/shipments') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Shipments
            </Link>
          </li>
          <li className="navbar-item">
            <Link 
              to="/trackers" 
              className={`navbar-link ${isActive('/trackers') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Trackers
            </Link>
          </li>
          <li className="navbar-item">
            <Link 
              to="/analysis" 
              className={`navbar-link ${isActive('/analysis') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Analysis
            </Link>
          </li>
          <li className="navbar-item">
            <Link 
              to="/configure" 
              className={`navbar-link ${isActive('/configure') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Configure
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
