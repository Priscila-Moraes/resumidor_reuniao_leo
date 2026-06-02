import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Calendar, Settings as SettingsIcon, Plus, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './SidebarLayout.css';

const SidebarLayout: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const close = () => setMenuOpen(false);

  return (
    <div className="app-container">
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
        <div className="mobile-brand">
          <Activity size={20} />
          <span>ReuniãoAI</span>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {menuOpen && <div className="sidebar-overlay" onClick={close} aria-hidden="true" />}

      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Activity className="sidebar-logo" size={24} />
          <h2>ReuniãoAI</h2>
          <button className="sidebar-close-btn" onClick={close} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            onClick={close}
          >
            <Calendar size={20} />
            <span>Minhas Reuniões</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            onClick={close}
          >
            <SettingsIcon size={20} />
            <span>Configurações</span>
          </NavLink>

          <button className="nav-btn-new">
            <Plus size={20} />
            <span>Nova Reunião</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default SidebarLayout;
