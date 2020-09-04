import React from 'react';
import PropTypes from 'prop-types';

import { withTranslation } from 'react-i18next';

import {
  UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem,
  Tooltip,
} from 'reactstrap';

import { CopyToClipboard } from 'react-copy-to-clipboard';

class CopyDropdown extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      dropdownOpen: false,
      tooltipOpen: false,
      isParamsAppended: true,
    };

    this.id = (Math.random() * 1000).toString();

    this.toggle = this.toggle.bind(this);
    this.showToolTip = this.showToolTip.bind(this);
    this.generatePagePathWithParams = this.generatePagePathWithParams.bind(this);
    this.generatePagePathUrl = this.generatePagePathUrl.bind(this);
    this.generatePermalink = this.generatePermalink.bind(this);
    this.generateMarkdownLink = this.generateMarkdownLink.bind(this);
  }

  toggle() {
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  }

  showToolTip() {
    this.setState({ tooltipOpen: true });
    setTimeout(() => {
      this.setState({ tooltipOpen: false });
    }, 1000);
  }

  get uriParams() {
    const { isParamsAppended } = this.state;

    if (!isParamsAppended) {
      return '';
    }

    const {
      search, hash,
    } = window.location;
    return `${search}${hash}`;
  }

  encodeSpaces(str) {
    if (str == null) {
      return null;
    }

    // Encode SPACE and IDEOGRAPHIC SPACE
    return str.replace(/ /g, '%20').replace(/\u3000/g, '%E3%80%80');
  }

  generatePagePathWithParams() {
    const { pagePath } = this.props;
    return decodeURI(`${pagePath}${this.uriParams}`);
  }

  generatePagePathUrl() {
    const { origin } = window.location;
    return `${origin}${this.encodeSpaces(this.generatePagePathWithParams())}`;
  }

  generatePermalink() {
    const { pageId, isShareLinkMode } = this.props;

    if (pageId == null) {
      return null;
    }
    if (isShareLinkMode) {
      return decodeURI(`${origin}/share/${pageId}`);
    }

    return this.encodeSpaces(decodeURI(`${origin}/${pageId}${this.uriParams}`));
  }

  generateMarkdownLink() {
    const { pagePath } = this.props;

    const label = decodeURI(`${pagePath}${this.uriParams}`);
    const permalink = this.generatePermalink();

    return `[${label}](${permalink})`;
  }

  DropdownItemContents = ({ title, contents }) => (
    <>
      <div className="h6 mt-1 mb-2"><strong>{title}</strong></div>
      <div className="card well mb-1 p-2">{contents}</div>
    </>
  );

  render() {
    const {
      t, pageId, isShareLinkMode,
    } = this.props;
    const { isParamsAppended } = this.state;

    const pagePathWithParams = this.generatePagePathWithParams();
    const pagePathUrl = this.generatePagePathUrl();
    const permalink = this.generatePermalink();

    const copyTarget = isShareLinkMode ? `copyShareLink${pageId}` : 'copyPagePathDropdown';
    const dropdownToggleStyle = isShareLinkMode ? 'btn btn-secondary' : 'd-block text-muted bg-transparent btn-copy border-0';

    const { id, DropdownItemContents } = this;

    const customSwitchForParamsId = `customSwitchForParams_${id}`;

    return (
      <>
        <UncontrolledDropdown id={copyTarget} className="grw-copy-dropdown">
          <DropdownToggle
            caret
            className={dropdownToggleStyle}
            style={this.props.buttonStyle}
          >
            { isShareLinkMode ? (
              <>Copy Link</>
            ) : (<i className="ti-clipboard"></i>)}
          </DropdownToggle>

          <DropdownMenu positionFixed modifiers={{ preventOverflow: { boundariesElement: null } }}>

            <div className="d-flex align-items-center justify-content-between">
              <DropdownItem header className="px-3">
                { t('copy_to_clipboard.Copy to clipboard') }
              </DropdownItem>
              <div className="px-3 custom-control custom-switch custom-switch-sm">
                <input
                  type="checkbox"
                  id={customSwitchForParamsId}
                  className="custom-control-input"
                  checked={isParamsAppended}
                  onChange={e => this.setState({ isParamsAppended: !isParamsAppended })}
                />
                <label className="custom-control-label small" htmlFor={customSwitchForParamsId}>Append params</label>
              </div>
            </div>

            <DropdownItem divider className="my-0"></DropdownItem>

            {/* Page path */}
            <CopyToClipboard text={pagePathWithParams} onCopy={this.showToolTip}>
              <DropdownItem className="px-3">
                <DropdownItemContents title={t('copy_to_clipboard.Page path')} contents={pagePathWithParams} />
              </DropdownItem>
            </CopyToClipboard>

            <DropdownItem divider className="my-0"></DropdownItem>

            {/* Page path URL */}
            <CopyToClipboard text={pagePathUrl} onCopy={this.showToolTip}>
              <DropdownItem className="px-3">
                <DropdownItemContents title={t('copy_to_clipboard.Page URL')} contents={pagePathUrl} />
              </DropdownItem>
            </CopyToClipboard>
            <DropdownItem divider className="my-0"></DropdownItem>

            {/* Permanent Link */}
            { pageId && (
              <CopyToClipboard text={permalink} onCopy={this.showToolTip}>
                <DropdownItem className="px-3">
                  <DropdownItemContents title={t('copy_to_clipboard.Permanent link')} contents={permalink} />
                </DropdownItem>
              </CopyToClipboard>
            )}

            <DropdownItem divider className="my-0"></DropdownItem>

            {/* Page path + Permanent Link */}
            { pageId && (
              <CopyToClipboard text={`${pagePathWithParams}\n${permalink}`} onCopy={this.showToolTip}>
                <DropdownItem className="px-3">
                  <DropdownItemContents title={t('copy_to_clipboard.Page path and permanent link')} contents={<>{pagePathWithParams}<br />{permalink}</>} />
                </DropdownItem>
              </CopyToClipboard>
            )}

            <DropdownItem divider className="my-0"></DropdownItem>

            {/* Markdown Link */}
            { pageId && (
              <CopyToClipboard text={this.generateMarkdownLink()} onCopy={this.showToolTip}>
                <DropdownItem className="px-3 text-wrap">
                  <DropdownItemContents title={t('copy_to_clipboard.Markdown link')} contents={this.generateMarkdownLink()} isContentsWrap />
                </DropdownItem>
              </CopyToClipboard>
            )}
          </DropdownMenu>

        </UncontrolledDropdown>

        <Tooltip placement="bottom" isOpen={this.state.tooltipOpen} target={copyTarget} fade={false}>
          copied!
        </Tooltip>
      </>
    );
  }

}

CopyDropdown.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  pagePath: PropTypes.string.isRequired,
  pageId: PropTypes.string,
  buttonStyle: PropTypes.object,
  isShareLinkMode: PropTypes.bool,
};

export default withTranslation()(CopyDropdown);
