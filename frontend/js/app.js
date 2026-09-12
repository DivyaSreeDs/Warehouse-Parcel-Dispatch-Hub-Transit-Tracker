/**
 * Warehouse Parcel Dispatch & Hub Transit Tracker
 * Main Application Orchestrator
 */

import { store } from './state/store.js';
import { NavbarComponent } from './components/navbar.js';
import { DispatchModalComponent } from './components/dispatchModal.js';
import { DashboardPage } from './pages/dashboard.js';
import { IntakePage } from './pages/intake.js';
import { LoadingBayPage } from './pages/loadingBay.js';

class HubApp {
  constructor() {
    this.mainContainer = document.getElementById('main-content');
    this.navElement = document.getElementById('hub-navbar');

    this.navbar = new NavbarComponent(this.navElement);
    this.dispatchModal = new DispatchModalComponent();

    this.pages = {
      dashboard: new DashboardPage(this.mainContainer),
      intake: new IntakePage(this.mainContainer),
      'loading-bay': new LoadingBayPage(this.mainContainer),
    };

    this._setupSubscribers();
  }

  async init() {
    console.log('Initializing Warehouse Hub Console...');
    this.navbar.render();
    await store.init();
    this.renderCurrentScreen();
  }

  _setupSubscribers() {
    store.subscribe((state, changedKey) => {
      if (changedKey === 'screen') {
        this.renderCurrentScreen();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (changedKey === 'refresh' || changedKey === 'loading') {
        this.renderCurrentScreen();
      }
    });
  }

  renderCurrentScreen() {
    const { activeScreen } = store.getState();
    const page = this.pages[activeScreen] || this.pages.dashboard;
    page.render();
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new HubApp();
  app.init().catch(err => {
    console.error('Fatal initialization error:', err);
  });
});
