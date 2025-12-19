import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import UserMenu from './UserMenu';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [configureDropdownOpen, setConfigureDropdownOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path || (path === '/shipments' && location.pathname === '/');
  };

  const isConfigureActive = () => {
    return location.pathname.startsWith('/configure');
  };

  const toggleMobileMenu = () => {
    console.log('Toggling menu, current state:', mobileMenuOpen);
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    console.log('Closing menu');
    setMobileMenuOpen(false);
    setConfigureDropdownOpen(false);
  };

  const toggleConfigureDropdown = (e) => {
    e.preventDefault();
    setConfigureDropdownOpen(!configureDropdownOpen);
  };

  const handleConfigureItemClick = () => {
    setConfigureDropdownOpen(false);
    closeMobileMenu();
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
          <li className={`navbar-item dropdown ${configureDropdownOpen ? 'dropdown-open' : ''}`}>
            <a 
              href="#" 
              className={`navbar-link dropdown-toggle ${isConfigureActive() ? 'active' : ''}`}
              onClick={toggleConfigureDropdown}
            >
              Configure
              <span className="dropdown-arrow">▼</span>
            </a>
            <ul className="dropdown-menu">
              <li>
                <Link 
                  to="/configure" 
                  className="dropdown-link"
                  onClick={handleConfigureItemClick}
                >
                  Settings
                </Link>
              </li>
              <li>
                <Link 
                  to="/configure/add-alerts" 
                  className="dropdown-link"
                  onClick={handleConfigureItemClick}
                >
                  Add Alerts
                </Link>
              </li>
            </ul>
          </li>
        </ul>
        
        {/* User Menu */}
        <UserMenu />
      </div>
    </nav>
  );
};

export default Navbar;
