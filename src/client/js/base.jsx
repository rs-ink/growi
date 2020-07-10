import React from 'react';

import loggerFactory from '@alias/logger';
import Xss from '@commons/service/xss';

import GrowiNavbar from './components/Navbar/GrowiNavbar';
import GrowiNavbarBottom from './components/Navbar/GrowiNavbarBottom';
import Sidebar from './components/Sidebar';
import Fab from './components/Fab';
import StaffCredit from './components/StaffCredit/StaffCredit';

import AppContainer from './services/AppContainer';
import WebsocketContainer from './services/WebsocketContainer';
import PageCreateModal from './components/PageCreateModal';

const logger = loggerFactory('growi:cli:app');

if (!window) {
  window = {};
}

// setup xss library
const xss = new Xss();
window.xss = xss;

// create unstated container instance
const appContainer = new AppContainer();
// eslint-disable-next-line no-unused-vars
const websocketContainer = new WebsocketContainer(appContainer);

appContainer.initApp();

logger.info('AppContainer has been initialized');

/**
 * define components
 *  key: id of element
 *  value: React Element
 */
const componentMappings = {
  'grw-navbar': <GrowiNavbar />,
  'grw-navbar-bottom-container': <GrowiNavbarBottom />,

  'page-create-modal': <PageCreateModal />,

  'grw-sidebar-wrapper': <Sidebar />,

  'grw-fab-container': <Fab />,

  'staff-credit': <StaffCredit />,
};

export { appContainer, componentMappings };
