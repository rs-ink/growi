import React from 'react';
import PropTypes from 'prop-types';

import { withTranslation } from 'react-i18next';

import { withUnstatedContainers } from '../UnstatedUtils';
import NavigationContainer from '../../services/NavigationContainer';

const NavbarToggler = (props) => {

  const { navigationContainer } = props;

  const clickHandler = () => {
    console.log("navigationContainer.toggleDrawer")

    navigationContainer.toggleDrawer();
  };

  return (
    <a
      className="nav-link grw-navbar-toggler border-0 waves-effect waves-light"
      type="button"
      aria-expanded="false"
      aria-label="Toggle navigation"
      onClick={clickHandler}
    >
      <i className="icon-menu"></i>
    </a>
  );

};

/**
 * Wrapper component for using unstated
 */
const NavbarTogglerWrapper = withUnstatedContainers(NavbarToggler, [NavigationContainer]);


NavbarToggler.propTypes = {
  t: PropTypes.func.isRequired, //  i18next
  navigationContainer: PropTypes.instanceOf(NavigationContainer).isRequired,
};

export default withTranslation()(NavbarTogglerWrapper);
