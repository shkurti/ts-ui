import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/shipments' && location.pathname === '/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/">LogiTrack</Link>
        </div>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link 
              to="/shipments" 
              className={`navbar-link ${isActive('/shipments') ? 'active' : ''}`}
            >
              Shipments
            </Link>
          </li>
          <li className="navbar-item">
            <Link 
              to="/trackers" 
              className={`navbar-link ${isActive('/trackers') ? 'active' : ''}`}
            >
              Trackers
            </Link>
          </li>
          <li className="navbar-item">
            <Link 
              to="/configure" 
              className={`navbar-link ${isActive('/configure') ? 'active' : ''}`}
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
