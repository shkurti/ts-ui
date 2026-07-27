import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!user) return null;

  const displayName = user.first_name || user.username || user.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="user-avatar">{initial}</span>
        <span className="user-menu-name">{displayName}</span>
        <ChevronDown
          size={15}
          strokeWidth={2.5}
          className="user-menu-chevron"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-info">
            <strong>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}</strong>
            <span>{user.email}</span>
          </div>
          <button 
            className="user-menu-item"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;