import React from 'react';
import PropTypes from 'prop-types';

import { withTranslation } from 'react-i18next';

import {
  Dropdown, DropdownToggle, DropdownMenu, DropdownItem,
} from 'reactstrap';

import { withUnstatedContainers } from '../UnstatedUtils';
import AppContainer from '../../services/AppContainer';
import EditorContainer from '../../services/EditorContainer';


export const defaultEditorOptions = {
  theme: 'elegant',
  keymapMode: 'default',
  styleActiveLine: false,
};

export const defaultPreviewOptions = {
  renderMathJaxInRealtime: false,
};

class OptionsSelector extends React.Component {

  constructor(props) {
    super(props);

    const config = this.props.appContainer.getConfig();
    const isMathJaxEnabled = !!config.env.MATHJAX;

    this.state = {
      isCddMenuOpened: false,
      isMathJaxEnabled,
    };

    this.availableThemes = [
      'eclipse', 'elegant', 'neo', 'mdn-like', 'material', 'dracula', 'monokai', 'twilight',
    ];
    this.keymapModes = {
      default: 'Default',
      vim: 'Vim',
      emacs: 'Emacs',
      sublime: 'Sublime Text',
    };

    this.onChangeTheme = this.onChangeTheme.bind(this);
    this.onChangeKeymapMode = this.onChangeKeymapMode.bind(this);
    this.onClickStyleActiveLine = this.onClickStyleActiveLine.bind(this);
    this.onClickRenderMathJaxInRealtime = this.onClickRenderMathJaxInRealtime.bind(this);
    this.onToggleConfigurationDropdown = this.onToggleConfigurationDropdown.bind(this);
  }

  onChangeTheme(newValue) {
    const { editorContainer } = this.props;

    const newOpts = Object.assign(editorContainer.state.editorOptions, { theme: newValue });
    editorContainer.setState({ editorOptions: newOpts });

    // save to localStorage
    editorContainer.saveOptsToLocalStorage();
  }

  onChangeKeymapMode(newValue) {
    const { editorContainer } = this.props;

    const newOpts = Object.assign(editorContainer.state.editorOptions, { keymapMode: newValue });
    editorContainer.setState({ editorOptions: newOpts });

    // save to localStorage
    editorContainer.saveOptsToLocalStorage();
  }

  onClickStyleActiveLine(event) {
    const { editorContainer } = this.props;

    // keep dropdown opened
    this._cddForceOpen = true;

    const newValue = !editorContainer.state.editorOptions.styleActiveLine;
    const newOpts = Object.assign(editorContainer.state.editorOptions, { styleActiveLine: newValue });
    editorContainer.setState({ editorOptions: newOpts });

    // save to localStorage
    editorContainer.saveOptsToLocalStorage();
  }

  onClickRenderMathJaxInRealtime(event) {
    const { editorContainer } = this.props;

    const newValue = !editorContainer.state.previewOptions.renderMathJaxInRealtime;
    const newOpts = Object.assign(editorContainer.state.previewOptions, { renderMathJaxInRealtime: newValue });
    editorContainer.setState({ previewOptions: newOpts });

    // save to localStorage
    editorContainer.saveOptsToLocalStorage();
  }

  onToggleConfigurationDropdown(newValue) {
    this.setState({ isCddMenuOpened: !this.state.isCddMenuOpened });
  }

  renderThemeSelector() {
    const { editorContainer } = this.props;

    const selectedTheme = editorContainer.state.editorOptions.theme;
    const menuItems = this.availableThemes.map((theme) => {
      return <button key={theme} className="dropdown-item" type="button" onClick={() => this.onChangeTheme(theme)}>{theme}</button>;
    });

    return (
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text" id="igt-theme">Theme</span>
        </div>
        <div className="input-group-append dropup">
          <button
            type="button"
            className="btn btn-outline-secondary dropdown-toggle"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            aria-describedby="igt-theme"
          >
            {selectedTheme}
          </button>
          <div className="dropdown-menu" aria-labelledby="dropdownMenuLink">
            {menuItems}
          </div>
        </div>
      </div>
    );
  }

  renderKeymapModeSelector() {
    const { editorContainer } = this.props;

    const selectedKeymapMode = editorContainer.state.editorOptions.keymapMode;
    const menuItems = Object.keys(this.keymapModes).map((mode) => {
      const label = this.keymapModes[mode];
      const icon = (mode !== 'default')
        ? <img src={`/images/icons/${mode}.png`} width="16px" className="mr-2"></img>
        : null;
      return <button key={mode} className="dropdown-item" type="button" onClick={() => this.onChangeKeymapMode(mode)}>{icon}{label}</button>;
    });

    return (
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text" id="igt-keymap">Keymap</span>
        </div>
        <div className="input-group-append dropup">
          <button
            type="button"
            className="btn btn-outline-secondary dropdown-toggle"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            aria-describedby="igt-keymap"
          >
            {selectedKeymapMode}
          </button>
          <div className="dropdown-menu" aria-labelledby="dropdownMenuLink">
            {menuItems}
          </div>
        </div>
      </div>
    );
  }

  renderConfigurationDropdown() {
    return (
      <div className="my-0 form-group">

        <Dropdown
          direction="up"
          className="grw-editor-configuration-dropdown"
          isOpen={this.state.isCddMenuOpened}
          toggle={this.onToggleConfigurationDropdown}
        >

          <DropdownToggle color="outline-secondary" caret>
            <i className="icon-settings"></i>
          </DropdownToggle>

          <DropdownMenu>
            {this.renderActiveLineMenuItem()}
            {this.renderRealtimeMathJaxMenuItem()}
            {/* <DropdownItem divider /> */}
          </DropdownMenu>

        </Dropdown>

      </div>
    );
  }

  renderActiveLineMenuItem() {
    const { t, editorContainer } = this.props;
    const isActive = editorContainer.state.editorOptions.styleActiveLine;

    const iconClasses = ['text-info'];
    if (isActive) {
      iconClasses.push('ti-check');
    }
    const iconClassName = iconClasses.join(' ');

    return (
      <DropdownItem toggle={false} onClick={this.onClickStyleActiveLine}>
        <div className="d-flex justify-content-between">
          <span className="icon-container"></span>
          <span className="menuitem-label">{ t('page_edit.Show active line') }</span>
          <span className="icon-container"><i className={iconClassName}></i></span>
        </div>
      </DropdownItem>
    );
  }

  renderRealtimeMathJaxMenuItem() {
    if (!this.state.isMathJaxEnabled) {
      return;
    }

    const { editorContainer } = this.props;

    const isEnabled = this.state.isMathJaxEnabled;
    const isActive = isEnabled && editorContainer.state.previewOptions.renderMathJaxInRealtime;

    const iconClasses = ['text-info'];
    if (isActive) {
      iconClasses.push('ti-check');
    }
    const iconClassName = iconClasses.join(' ');

    return (
      <DropdownItem toggle={false} onClick={this.onClickRenderMathJaxInRealtime}>
        <div className="d-flex justify-content-between">
          <span className="icon-container"><img src="/images/icons/fx.svg" width="14px" alt="fx"></img></span>
          <span className="menuitem-label">MathJax Rendering</span>
          <span className="icon-container"><i className={iconClassName}></i></span>
        </div>
      </DropdownItem>
    );
  }

  render() {
    return (
      <div className="d-flex flex-row">
        <span className="ml-3">{this.renderThemeSelector()}</span>
        <span className="ml-4">{this.renderKeymapModeSelector()}</span>
        <span className="ml-4">{this.renderConfigurationDropdown()}</span>
      </div>
    );
  }

}

/**
 * Wrapper component for using unstated
 */
const OptionsSelectorWrapper = withUnstatedContainers(OptionsSelector, [AppContainer, EditorContainer]);

OptionsSelector.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  appContainer: PropTypes.instanceOf(AppContainer).isRequired,
  editorContainer: PropTypes.instanceOf(EditorContainer).isRequired,
};

export default withTranslation()(OptionsSelectorWrapper);
