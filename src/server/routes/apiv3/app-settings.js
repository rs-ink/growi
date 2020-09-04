const loggerFactory = require('@alias/logger');

const logger = loggerFactory('growi:routes:apiv3:app-settings');

const debug = require('debug')('growi:routes:admin');

const express = require('express');

const { listLocaleIds } = require('@commons/util/locale-utils');

const router = express.Router();

const { body } = require('express-validator');
const ErrorV3 = require('../../models/vo/error-apiv3');

/**
 * @swagger
 *  tags:
 *    name: AppSettings
 */

/**
 * @swagger
 *
 *  components:
 *    schemas:
 *      AppSettingParams:
 *        description: AppSettingParams
 *        type: object
 *        properties:
 *          title:
 *            type: string
 *            description: site name show on page header and tilte of HTML
 *          confidential:
 *            type: string
 *            description: confidential show on page header
 *          globalLang:
 *            type: string
 *            description: language set when create user
 *          fileUpload:
 *            type: boolean
 *            description: enable upload file except image file
 *      SiteUrlSettingParams:
 *        description: SiteUrlSettingParams
 *        type: object
 *        properties:
 *          siteUrl:
 *            type: string
 *            description: Site URL. e.g. https://example.com, https://example.com:8080
 *          envSiteUrl:
 *            type: string
 *            description: environment variable 'APP_SITE_URL'
 *      FromAddress:
 *        description: MailSettingParams
 *        type: object
 *        properties:
 *          fromAddress:
 *            type: string
 *            description: e-mail address used as from address of mail which sent from GROWI app
 *      MailSettingParams:
 *        description: MailSettingParams
 *        type: object
 *        properties:
 *          smtpHost:
 *            type: string
 *            description: host name of client's smtp server
 *          smtpPort:
 *            type: string
 *            description: port of client's smtp server
 *          smtpUser:
 *            type: string
 *            description: user name of client's smtp server
 *          smtpPassword:
 *            type: string
 *            description: password of client's smtp server
 *      AwsSettingParams:
 *        description: AwsSettingParams
 *        type: object
 *        properties:
 *          region:
 *            type: string
 *            description: region of AWS S3
 *          customEndpoint:
 *            type: string
 *            description: custom endpoint of AWS S3
 *          bucket:
 *            type: string
 *            description: AWS S3 bucket name
 *          accessKeyId:
 *            type: string
 *            description: accesskey id for authentification of AWS
 *          secretAccessKey:
 *            type: string
 *            description: secret key for authentification of AWS
 *      PluginSettingParams:
 *        description: PluginSettingParams
 *        type: object
 *        properties:
 *          isEnabledPlugins:
 *            type: string
 *            description: enable use plugins
 */

module.exports = (crowi) => {
  const accessTokenParser = require('../../middlewares/access-token-parser')(crowi);
  const loginRequired = require('../../middlewares/login-required')(crowi);
  const loginRequiredStrictly = require('../../middlewares/login-required')(crowi);
  const adminRequired = require('../../middlewares/admin-required')(crowi);
  const csrf = require('../../middlewares/csrf')(crowi);
  const apiV3FormValidator = require('../../middlewares/apiv3-form-validator')(crowi);

  const validator = {
    appSetting: [
      body('title').trim(),
      body('confidential'),
      body('globalLang').isIn(listLocaleIds()),
      body('fileUpload').isBoolean(),
    ],
    siteUrlSetting: [
      body('siteUrl').trim().matches(/^(https?:\/\/[^/]+|)$/).isURL({ require_tld: false }),
    ],
    fromAddress: [
      body('fromAddress').trim().if(value => value !== '').isEmail(),
    ],
    mailSetting: [
      body('smtpHost').trim(),
      body('smtpPort').trim().isPort(),
      body('smtpUser').trim(),
      body('smtpPassword').trim(),
    ],
    awsSetting: [
      body('region').trim().matches(/^[a-z]+-[a-z]+-\d+$/).withMessage((value, { req }) => req.t('validation.aws_region')),
      body('customEndpoint').trim().matches(/^(https?:\/\/[^/]+|)$/).withMessage((value, { req }) => req.t('validation.aws_custom_endpoint')),
      body('bucket').trim(),
      body('accessKeyId').trim().matches(/^[\da-zA-Z]+$/),
      body('secretAccessKey').trim(),
    ],
    pluginSetting: [
      body('isEnabledPlugins').isBoolean(),
    ],
  };

  /**
   * @swagger
   *
   *    /app-settings:
   *      get:
   *        tags: [AppSettings]
   *        operationId: getAppSettings
   *        summary: /app-settings
   *        description: get app setting params
   *        responses:
   *          200:
   *            description: Resources are available
   *            content:
   *              application/json:
   *                schema:
   *                  properties:
   *                    appSettingsParams:
   *                      type: object
   *                      description: app settings params
   */
  router.get('/', accessTokenParser, loginRequired, adminRequired, async(req, res) => {
    const appSettingsParams = {
      title: crowi.configManager.getConfig('crowi', 'app:title'),
      confidential: crowi.configManager.getConfig('crowi', 'app:confidential'),
      globalLang: crowi.configManager.getConfig('crowi', 'app:globalLang'),
      fileUpload: crowi.configManager.getConfig('crowi', 'app:fileUpload'),
      siteUrl: crowi.configManager.getConfig('crowi', 'app:siteUrl'),
      envSiteUrl: crowi.configManager.getConfigFromEnvVars('crowi', 'app:siteUrl'),
      fromAddress: crowi.configManager.getConfig('crowi', 'mail:from'),
      smtpHost: crowi.configManager.getConfig('crowi', 'mail:smtpHost'),
      smtpPort: crowi.configManager.getConfig('crowi', 'mail:smtpPort'),
      smtpUser: crowi.configManager.getConfig('crowi', 'mail:smtpUser'),
      smtpPassword: crowi.configManager.getConfig('crowi', 'mail:smtpPassword'),
      region: crowi.configManager.getConfig('crowi', 'aws:region'),
      customEndpoint: crowi.configManager.getConfig('crowi', 'aws:customEndpoint'),
      bucket: crowi.configManager.getConfig('crowi', 'aws:bucket'),
      accessKeyId: crowi.configManager.getConfig('crowi', 'aws:accessKeyId'),
      secretAccessKey: crowi.configManager.getConfig('crowi', 'aws:secretAccessKey'),
      isEnabledPlugins: crowi.configManager.getConfig('crowi', 'plugin:isEnabledPlugins'),
    };
    return res.apiv3({ appSettingsParams });

  });


  /**
   * @swagger
   *
   *    /app-settings/app-setting:
   *      put:
   *        tags: [AppSettings]
   *        summary: /app-settings/app-setting
   *        operationId: updateAppSettings
   *        description: Update app setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/AppSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to update app setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/AppSettingParams'
   */
  router.put('/app-setting', loginRequiredStrictly, adminRequired, csrf, validator.appSetting, apiV3FormValidator, async(req, res) => {
    const requestAppSettingParams = {
      'app:title': req.body.title,
      'app:confidential': req.body.confidential,
      'app:globalLang': req.body.globalLang,
      'app:fileUpload': req.body.fileUpload,
    };

    try {
      await crowi.configManager.updateConfigsInTheSameNamespace('crowi', requestAppSettingParams);
      const appSettingParams = {
        title: crowi.configManager.getConfig('crowi', 'app:title'),
        confidential: crowi.configManager.getConfig('crowi', 'app:confidential'),
        globalLang: crowi.configManager.getConfig('crowi', 'app:globalLang'),
        fileUpload: crowi.configManager.getConfig('crowi', 'app:fileUpload'),
      };
      return res.apiv3({ appSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating app setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-appSetting-failed'));
    }

  });

  /**
   * @swagger
   *
   *    /app-settings/site-url-setting:
   *      put:
   *        tags: [AppSettings]
   *        operationId: updateAppSettingSiteUrlSetting
   *        summary: /app-settings/site-url-setting
   *        description: Update site url setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/SiteUrlSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to update site url setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/SiteUrlSettingParams'
   */
  router.put('/site-url-setting', loginRequiredStrictly, adminRequired, csrf, validator.siteUrlSetting, apiV3FormValidator, async(req, res) => {

    const requestSiteUrlSettingParams = {
      'app:siteUrl': req.body.siteUrl,
    };

    try {
      await crowi.configManager.updateConfigsInTheSameNamespace('crowi', requestSiteUrlSettingParams);
      const siteUrlSettingParams = {
        siteUrl: crowi.configManager.getConfig('crowi', 'app:siteUrl'),
      };
      return res.apiv3({ siteUrlSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating site url setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-siteUrlSetting-failed'));
    }

  });

  /**
   * send mail (Promise wrapper)
   */
  async function sendMailPromiseWrapper(smtpClient, options) {
    return new Promise((resolve, reject) => {
      smtpClient.sendMail(options, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          resolve(res);
        }
      });
    });
  }

  /**
   * validate mail setting send test mail
   */
  async function validateMailSetting(req) {
    const { configManager, mailService } = crowi;
    const fromAddress = configManager.getConfig('crowi', 'mail:from');
    if (fromAddress == null) {
      throw Error('fromAddress is not setup');
    }

    const option = {
      host: req.body.smtpHost,
      port: req.body.smtpPort,
    };
    if (req.body.smtpUser && req.body.smtpPassword) {
      option.auth = {
        user: req.body.smtpUser,
        pass: req.body.smtpPassword,
      };
    }
    if (option.port === 465) {
      option.secure = true;
    }

    const smtpClient = mailService.createSMTPClient(option);
    debug('mailer setup for validate SMTP setting', smtpClient);

    const mailOptions = {
      from: fromAddress,
      to: req.user.email,
      subject: 'Wiki管理設定のアップデートによるメール通知',
      text: 'このメールは、WikiのSMTP設定のアップデートにより送信されています。',
    };

    await sendMailPromiseWrapper(smtpClient, mailOptions);
  }

  const updateMailSettinConfig = async function(requestMailSettingParams) {
    const {
      configManager,
      mailService,
    } = crowi;

    // update config without publishing S2sMessage
    await configManager.updateConfigsInTheSameNamespace('crowi', requestMailSettingParams, true);

    await mailService.initialize();
    mailService.publishUpdatedMessage();

    return {
      smtpHost: configManager.getConfig('crowi', 'mail:smtpHost'),
      smtpPort: configManager.getConfig('crowi', 'mail:smtpPort'),
      smtpUser: configManager.getConfig('crowi', 'mail:smtpUser'),
      smtpPassword: configManager.getConfig('crowi', 'mail:smtpPassword'),
    };
  };

  /**
   * @swagger
   *
   *    /app-settings/from-address:
   *      put:
   *        tags: [AppSettings]
   *        operationId: updateAppSettingFromAddress
   *        summary: /app-settings/from-address
   *        description: Update from address
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/FromAddress'
   *        responses:
   *          200:
   *            description: Succeeded to update from adress
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/FromAddress'
   */
  router.put('/from-address', loginRequiredStrictly, adminRequired, csrf, validator.fromAddress, apiV3FormValidator, async(req, res) => {

    try {
      const mailSettingParams = await updateMailSettinConfig({ 'mail:from': req.body.fromAddress });

      return res.apiv3({ mailSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating from adress';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-from-adress-failed'));
    }

  });

  /**
   * @swagger
   *
   *    /app-settings/mail-setting:
   *      put:
   *        tags: [AppSettings]
   *        operationId: updateAppSettingMailSetting
   *        summary: /app-settings/mail-setting
   *        description: Update mail setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/MailSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to update mail setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/MailSettingParams'
   */
  router.put('/mail-setting', loginRequiredStrictly, adminRequired, csrf, validator.mailSetting, apiV3FormValidator, async(req, res) => {
    try {
      await validateMailSetting(req);
    }
    catch (err) {
      const msg = 'SMTPを利用したテストメール送信に失敗しました。設定をみなおしてください。';
      logger.error('Error', err);
      debug('Error validate mail setting: ', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-mailSetting-failed'));
    }


    const requestMailSettingParams = {
      'mail:smtpHost': req.body.smtpHost,
      'mail:smtpPort': req.body.smtpPort,
      'mail:smtpUser': req.body.smtpUser,
      'mail:smtpPassword': req.body.smtpPassword,
    };

    try {
      const mailSettingParams = await updateMailSettinConfig(requestMailSettingParams);
      return res.apiv3({ mailSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating mail setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-mailSetting-failed'));
    }
  });

  /**
   * @swagger
   *
   *    /app-settings/mail-setting:
   *      delete:
   *        tags: [AppSettings]
   *        operationId: deleteAppSettingMailSetting
   *        summary: /app-settings/mail-setting
   *        description: delete mail setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/MailSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to delete mail setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/MailSettingParams'
   */
  router.delete('/mail-setting', loginRequiredStrictly, adminRequired, csrf, async(req, res) => {
    const requestMailSettingParams = {
      'mail:smtpHost': null,
      'mail:smtpPort': null,
      'mail:smtpUser': null,
      'mail:smtpPassword': null,
    };
    try {
      const mailSettingParams = await updateMailSettinConfig(requestMailSettingParams);
      return res.apiv3({ mailSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in initializing mail setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'initialize-mailSetting-failed'));
    }
  });

  /**
   * @swagger
   *
   *    /app-settings/aws-setting:
   *      put:
   *        tags: [AppSettings]
   *        operationId: updateAppSettingAwsSetting
   *        summary: /app-settings/aws-setting
   *        description: Update aws setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/AwsSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to update aws setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/AwsSettingParams'
   */
  router.put('/aws-setting', loginRequiredStrictly, adminRequired, csrf, validator.awsSetting, apiV3FormValidator, async(req, res) => {
    const requestAwsSettingParams = {
      'aws:region': req.body.region,
      'aws:customEndpoint': req.body.customEndpoint,
      'aws:bucket': req.body.bucket,
      'aws:accessKeyId': req.body.accessKeyId,
      'aws:secretAccessKey': req.body.secretAccessKey,
    };

    try {
      const { configManager, mailService } = crowi;

      // update config without publishing S2sMessage
      await configManager.updateConfigsInTheSameNamespace('crowi', requestAwsSettingParams, true);

      await mailService.initialize();
      mailService.publishUpdatedMessage();

      const awsSettingParams = {
        region: crowi.configManager.getConfig('crowi', 'aws:region'),
        customEndpoint: crowi.configManager.getConfig('crowi', 'aws:customEndpoint'),
        bucket: crowi.configManager.getConfig('crowi', 'aws:bucket'),
        accessKeyId: crowi.configManager.getConfig('crowi', 'aws:accessKeyId'),
        secretAccessKey: crowi.configManager.getConfig('crowi', 'aws:secretAccessKey'),
      };
      return res.apiv3({ awsSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating aws setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-awsSetting-failed'));
    }

  });

  /**
   * @swagger
   *
   *    /app-settings/plugin-setting:
   *      put:
   *        tags: [AppSettings]
   *        operationId: updateAppSettingPluginSetting
   *        summary: /app-settings/plugin-setting
   *        description: Update plugin setting
   *        requestBody:
   *          required: true
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/PluginSettingParams'
   *        responses:
   *          200:
   *            description: Succeeded to update plugin setting
   *            content:
   *              application/json:
   *                schema:
   *                  $ref: '#/components/schemas/PluginSettingParams'
   */
  router.put('/plugin-setting', loginRequiredStrictly, adminRequired, csrf, validator.pluginSetting, apiV3FormValidator, async(req, res) => {
    const requestPluginSettingParams = {
      'plugin:isEnabledPlugins': req.body.isEnabledPlugins,
    };

    try {
      await crowi.configManager.updateConfigsInTheSameNamespace('crowi', requestPluginSettingParams);
      const pluginSettingParams = {
        isEnabledPlugins: crowi.configManager.getConfig('crowi', 'plugin:isEnabledPlugins'),
      };
      return res.apiv3({ pluginSettingParams });
    }
    catch (err) {
      const msg = 'Error occurred in updating plugin setting';
      logger.error('Error', err);
      return res.apiv3Err(new ErrorV3(msg, 'update-pluginSetting-failed'));
    }

  });

  return router;
};
