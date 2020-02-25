import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import urljoin from 'url-join';

import loggerFactory from '@alias/logger';

import { toastError } from '../../../util/apiNotification';

import TriggerEventCheckBox from './TriggerEventCheckBox';
import AdminUpdateButtonRow from '../Common/AdminUpdateButtonRow';
import AppContainer from '../../../services/AppContainer';
import { createSubscribedElement } from '../../UnstatedUtils';

const logger = loggerFactory('growi:manageGlobalNotification');

class ManageGlobalNotification extends React.Component {

  constructor() {
    super();

    let globalNotification;
    try {
      globalNotification = JSON.parse(document.getElementById('admin-global-notification-setting').getAttribute('data-global-notification'));
    }
    catch (err) {
      toastError(err);
      logger.error(err);
    }

    this.state = {
      globalNotificationId: globalNotification._id || null,
      triggerPath: globalNotification.triggerPath || '',
      notifyToType: globalNotification.__t || 'mail',
      emailToSend: globalNotification.toEmail || '',
      slackChannelToSend: globalNotification.slackChannels || '',
      triggerEvents: new Set(globalNotification.triggerEvents),
    };

    this.submitHandler = this.submitHandler.bind(this);
  }

  onChangeTriggerPath(inputValue) {
    this.setState({ triggerPath: inputValue });
  }

  onChangeNotifyToType(notifyToType) {
    this.setState({ notifyToType });
  }

  onChangeEmailToSend(inputValue) {
    this.setState({ emailToSend: inputValue });
  }

  onChangeSlackChannelToSend(inputValue) {
    this.setState({ slackChannelToSend: inputValue });
  }

  onChangeTriggerEvents(triggerEvent) {
    const { triggerEvents } = this.state;

    if (triggerEvents.has(triggerEvent)) {
      triggerEvents.delete(triggerEvent);
      this.setState({ triggerEvents });
    }
    else {
      triggerEvents.add(triggerEvent);
      this.setState({ triggerEvents });
    }
  }

  async submitHandler() {

    const requestParams = {
      triggerPath: this.state.triggerPath,
      notifyToType: this.state.notifyToType,
      toEmail: this.state.emailToSend,
      slackChannels: this.state.slackChannelToSend,
      triggerEvents: [...this.state.triggerEvents],
    };

    try {
      if (this.state.globalNotificationId != null) {
        await this.props.appContainer.apiv3.put(`/notification-setting/global-notification/${this.state.globalNotificationId}`, requestParams);
      }
      else {
        await this.props.appContainer.apiv3.post('/notification-setting/global-notification', requestParams);
      }
      window.location.href = urljoin(window.location.origin, '/admin/notification#global-notification');
    }
    catch (err) {
      toastError(err);
      logger.error(err);
    }
  }


  render() {
    const { t } = this.props;
    return (
      <React.Fragment>

        <div className="my-3">
          <a href="/admin/notification#global-notification">
            <button type="button" className="btn page-link text-dark d-inline-block">
              <i className="icon-fw ti-arrow-left" aria-hidden="true"></i>
              {t('notification_setting.back_to_list')}
            </button>
          </a>
        </div>


        <div className="row">
          <div className="m-t-20 form-box col-md-12">
            <h2 className="border-bottom mb-5">{t('notification_setting.notification_detail')}</h2>
          </div>

          <div className="col-sm-4">
            <h3 htmlFor="triggerPath">{t('notification_setting.trigger_path')}
              {/* eslint-disable-next-line react/no-danger */}
              <small dangerouslySetInnerHTML={{ __html: t('notification_setting.trigger_path_help', '<code>*</code>') }} />
            </h3>
            <div className="form-group">
              <input
                className="form-control"
                type="text"
                name="triggerPath"
                value={this.state.triggerPath}
                onChange={(e) => { this.onChangeTriggerPath(e.target.value) }}
                required
              />
            </div>

            <h3>{t('notification_setting.notify_to')}</h3>
            <div className="form-group form-inline">
              <div className="custom-control custom-radio">
                <input
                  className="custom-control-input"
                  type="radio"
                  id="mail"
                  name="notifyToType"
                  value="mail"
                  checked={this.state.notifyToType === 'mail'}
                  onChange={() => { this.onChangeNotifyToType('mail') }}
                />
                <label className="custom-control-label" htmlFor="mail">
                  <p className="font-weight-bold">Email</p>
                </label>
              </div>
              <div className="custom-control custom-radio ml-2">
                <input
                  className="custom-control-input"
                  type="radio"
                  id="slack"
                  name="notifyToType"
                  value="slack"
                  checked={this.state.notifyToType === 'slack'}
                  onChange={() => { this.onChangeNotifyToType('slack') }}
                />
                <label className="custom-control-label" htmlFor="slack">
                  <p className="font-weight-bold">Slack</p>
                </label>
              </div>
            </div>

            {this.state.notifyToType === 'mail'
              ? (
                <div className="form-group notify-to-option" id="mail-input">
                  <input
                    className="form-control"
                    type="text"
                    name="toEmail"
                    placeholder="Email"
                    value={this.state.emailToSend}
                    onChange={(e) => { this.onChangeEmailToSend(e.target.value) }}
                  />
                  <p className="help">
                    <b>Hint: </b>
                    <a href="https://ifttt.com/create" target="blank">{t('notification_setting.email.ifttt_link')}
                      <i className="icon-share-alt" />
                    </a>
                  </p>
                </div>
              )
              : (
                <div className="form-group notify-to-option" id="slack-input">
                  <input
                    className="form-control"
                    type="text"
                    name="notificationGlobal[slackChannels]"
                    placeholder="Slack Channel"
                    value={this.state.slackChannelToSend}
                    onChange={(e) => { this.onChangeSlackChannelToSend(e.target.value) }}
                  />
                </div>
              )}
          </div>

          <div className="offset-1 col-sm-5">
            <div className="form-group">
              <h3>{t('notification_setting.trigger_events')}</h3>
              <TriggerEventCheckBox
                event="pageCreate"
                checked={this.state.triggerEvents.has('pageCreate')}
                onChange={() => this.onChangeTriggerEvents('pageCreate')}
              >
                <span className="badge badge-pill badge-success">
                  <i className="icon-doc"></i> CREATE
                </span>
              </TriggerEventCheckBox>
              <TriggerEventCheckBox
                event="pageEdit"
                checked={this.state.triggerEvents.has('pageEdit')}
                onChange={() => this.onChangeTriggerEvents('pageEdit')}
              >
                <span className="badge badge-pill badge-warning">
                  <i className="icon-pencil"></i>EDIT
                </span>
              </TriggerEventCheckBox>
              <TriggerEventCheckBox
                event="pageMove"
                checked={this.state.triggerEvents.has('pageMove')}
                onChange={() => this.onChangeTriggerEvents('pageMove')}
              >
                <span className="badge badge-pill badge-warning">
                  <i className="icon-action-redo"></i>MOVE
                </span>
              </TriggerEventCheckBox>
              <TriggerEventCheckBox
                event="pageDelete"
                checked={this.state.triggerEvents.has('pageDelete')}
                onChange={() => this.onChangeTriggerEvents('pageDelete')}
              >
                <span className="badge badge-pill badge-danger">
                  <i className="icon-fire"></i>DELETE
                </span>
              </TriggerEventCheckBox>
              <TriggerEventCheckBox
                event="pageLike"
                checked={this.state.triggerEvents.has('pageLike')}
                onChange={() => this.onChangeTriggerEvents('pageLike')}
              >
                <span className="badge badge-pill badge-info">
                  <i className="icon-like"></i>LIKE
                </span>
              </TriggerEventCheckBox>
              <TriggerEventCheckBox
                event="comment"
                checked={this.state.triggerEvents.has('comment')}
                onChange={() => this.onChangeTriggerEvents('comment')}
              >
                <span className="badge badge-pill badge-light">
                  <i className="icon-bubble"></i>POST
                </span>
              </TriggerEventCheckBox>

            </div>
          </div>
        </div>

        <AdminUpdateButtonRow
          onClick={this.submitHandler}
          disabled={this.state.retrieveError != null}
        />

      </React.Fragment>

    );
  }

}

const ManageGlobalNotificationWrapper = (props) => {
  return createSubscribedElement(ManageGlobalNotification, props, [AppContainer]);
};

ManageGlobalNotification.propTypes = {
  t: PropTypes.func.isRequired, // i18next
  appContainer: PropTypes.instanceOf(AppContainer).isRequired,

};

export default withTranslation()(ManageGlobalNotificationWrapper);