import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Collapse } from 'reactstrap';

import NavigationContainer from '../../services/NavigationContainer';
import { withUnstatedContainers } from '../UnstatedUtils';

import SavePageControls from '../SavePageControls';

import OptionsSelector from './OptionsSelector';

const EditorNavbarBottom = (props) => {

  const [isExpanded, setExpanded] = useState(false);

  const {
    navigationContainer,
  } = props;
  const { editorMode, isDrawerMode, isDeviceSmallerThanMd } = navigationContainer.state;

  const additionalClasses = ['grw-editor-navbar-bottom'];

  const renderDrawerButton = () => (
    <button type="button" className="btn btn-outline-secondary border-0" onClick={() => navigationContainer.toggleDrawer()}>
      <i className="icon-menu"></i>
    </button>
  );

  // eslint-disable-next-line react/prop-types
  const renderExpandButton = () => (
    <div className="d-md-none ml-2">
      <button
        type="button"
        className={`btn btn-outline-secondary btn-expand border-0 ${isExpanded ? 'expand' : ''}`}
        onClick={() => setExpanded(!isExpanded)}
      >
        <i className="icon-arrow-up"></i>
      </button>
    </div>
  );

  const isOptionsSelectorEnabled = editorMode !== 'hackmd';
  const isCollapsedOptionsSelectorEnabled = isOptionsSelectorEnabled && isDeviceSmallerThanMd;

  return (
    <div className={`${isCollapsedOptionsSelectorEnabled ? 'fixed-bottom' : ''} `}>
      <div className={`navbar navbar-expand border-top px-2 ${additionalClasses.join(' ')}`}>
        <form className="form-inline">
          { isDrawerMode && renderDrawerButton() }
          { isOptionsSelectorEnabled && !isDeviceSmallerThanMd && <OptionsSelector /> }
        </form>
        <form className="form-inline ml-auto">
          <SavePageControls />
          { isCollapsedOptionsSelectorEnabled && renderExpandButton() }
        </form>
      </div>
      {/* Collapsed OptionsSelector */}
      { isCollapsedOptionsSelectorEnabled && (
        <Collapse isOpen={isExpanded}>
          <div className="px-2"> {/* set padding for border-top */}
            <div className={`navbar navbar-expand border-top px-0 ${additionalClasses.join(' ')}`}>
              <form className="form-inline ml-auto">
                <OptionsSelector />
              </form>
            </div>
          </div>
        </Collapse>
      ) }
    </div>
  );
};

EditorNavbarBottom.propTypes = {
  navigationContainer: PropTypes.instanceOf(NavigationContainer).isRequired,
};

export default withUnstatedContainers(EditorNavbarBottom, [NavigationContainer]);
