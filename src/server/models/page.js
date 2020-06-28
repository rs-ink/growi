// disable no-return-await for model functions
/* eslint-disable no-return-await */

/* eslint-disable no-use-before-define */
const logger = require('@alias/logger')('growi:models:page');

const debug = require('debug')('growi:models:page');
const nodePath = require('path');
const urljoin = require('url-join');
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const uniqueValidator = require('mongoose-unique-validator');
const differenceInYears = require('date-fns/differenceInYears');

const { pathUtils } = require('growi-commons');
const templateChecker = require('@commons/util/template-checker');
const { isTopPage } = require('@commons/util/path-utils');
const escapeStringRegexp = require('escape-string-regexp');

const ObjectId = mongoose.Schema.Types.ObjectId;

/*
 * define schema
 */
const GRANT_PUBLIC = 1;
const GRANT_RESTRICTED = 2;
const GRANT_SPECIFIED = 3;
const GRANT_OWNER = 4;
const GRANT_USER_GROUP = 5;
const PAGE_GRANT_ERROR = 1;
const STATUS_PUBLISHED = 'published';
const STATUS_DELETED = 'deleted';

const pageSchema = new mongoose.Schema({
  path: {
    type: String, required: true, index: true, unique: true,
  },
  revision: { type: ObjectId, ref: 'Revision' },
  redirectTo: { type: String, index: true },
  status: { type: String, default: STATUS_PUBLISHED, index: true },
  grant: { type: Number, default: GRANT_PUBLIC, index: true },
  grantedUsers: [{ type: ObjectId, ref: 'User' }],
  grantedGroup: { type: ObjectId, ref: 'UserGroup', index: true },
  creator: { type: ObjectId, ref: 'User', index: true },
  lastUpdateUser: { type: ObjectId, ref: 'User' },
  liker: [{ type: ObjectId, ref: 'User' }],
  seenUsers: [{ type: ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  extended: {
    type: String,
    default: '{}',
    get(data) {
      try {
        return JSON.parse(data);
      }
      catch (e) {
        return data;
      }
    },
    set(data) {
      return JSON.stringify(data);
    },
  },
  pageIdOnHackmd: String,
  revisionHackmdSynced: { type: ObjectId, ref: 'Revision' }, // the revision that is synced to HackMD
  hasDraftOnHackmd: { type: Boolean }, // set true if revision and revisionHackmdSynced are same but HackMD document has modified
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});
// apply plugins
pageSchema.plugin(mongoosePaginate);
pageSchema.plugin(uniqueValidator);


/**
 * return an array of ancestors paths that is extracted from specified pagePath
 * e.g.
 *  when `pagePath` is `/foo/bar/baz`,
 *  this method returns [`/foo/bar/baz`, `/foo/bar`, `/foo`, `/`]
 *
 * @param {string} pagePath
 * @return {string[]} ancestors paths
 */
const extractToAncestorsPaths = (pagePath) => {
  const ancestorsPaths = [];

  let parentPath;
  while (parentPath !== '/') {
    parentPath = nodePath.dirname(parentPath || pagePath);
    ancestorsPaths.push(parentPath);
  }

  return ancestorsPaths;
};

const addSlashOfEnd = (path) => {
  let returnPath = path;
  if (!path.match(/\/$/)) {
    returnPath += '/';
  }
  return returnPath;
};

/**
 * populate page (Query or Document) to show revision
 * @param {any} page Query or Document
 * @param {string} userPublicFields string to set to select
 */
/* eslint-disable object-curly-newline, object-property-newline */
const populateDataToShowRevision = (page, userPublicFields) => {
  return page
    .populate([
      { path: 'lastUpdateUser', model: 'User', select: userPublicFields },
      { path: 'creator', model: 'User', select: userPublicFields },
      { path: 'grantedGroup', model: 'UserGroup' },
      { path: 'revision', model: 'Revision', populate: {
        path: 'author', model: 'User', select: userPublicFields,
      } },
    ]);
};
/* eslint-enable object-curly-newline, object-property-newline */


class PageQueryBuilder {

  constructor(query) {
    this.query = query;
  }

  addConditionToExcludeTrashed() {
    this.query = this.query
      .and({
        $or: [
          { status: null },
          { status: STATUS_PUBLISHED },
        ],
      });

    return this;
  }

  addConditionToExcludeRedirect() {
    this.query = this.query.and({ redirectTo: null });
    return this;
  }

  /**
   * generate the query to find the page that is match with `path` and its descendants
   */
  addConditionToListWithDescendants(path, option) {
    // ignore other pages than descendants
    // eslint-disable-next-line no-param-reassign
    path = addSlashOfEnd(path);

    this.addConditionToListByStartWith(path, option);
    return this;
  }

  /**
   * generate the query to find pages that start with `path`
   *
   * In normal case, returns '{path}/*' and '{path}' self.
   * If top page, return without doing anything.
   *
   * *option*
   *   Left for backward compatibility
   */
  addConditionToListByStartWith(path, option) {
    // No request is set for the top page
    if (isTopPage(path)) {
      return this;
    }
    const pathCondition = [];

    /*
     * 1. add condition for finding the page completely match with `path` w/o last slash
     */
    let pathSlashOmitted = path;
    if (path.match(/\/$/)) {
      pathSlashOmitted = path.substr(0, path.length - 1);
      pathCondition.push({ path: pathSlashOmitted });
    }
    /*
     * 2. add decendants
     */
    const pattern = escapeStringRegexp(path); // escape

    let queryReg;
    try {
      queryReg = new RegExp(`^${pattern}`);
    }
    // if regular expression is invalid
    catch (e) {
      // force to escape
      queryReg = new RegExp(`^${escapeStringRegexp(pattern)}`);
    }
    pathCondition.push({ path: queryReg });

    this.query = this.query
      .and({
        $or: pathCondition,
      });

    return this;
  }

  addConditionToFilteringByViewer(user, userGroups, showAnyoneKnowsLink = false, showPagesRestrictedByOwner = false, showPagesRestrictedByGroup = false) {
    const grantConditions = [
      { grant: null },
      { grant: GRANT_PUBLIC },
    ];

    if (showAnyoneKnowsLink) {
      grantConditions.push({ grant: GRANT_RESTRICTED });
    }

    if (showPagesRestrictedByOwner) {
      grantConditions.push(
        { grant: GRANT_SPECIFIED },
        { grant: GRANT_OWNER },
      );
    }
    else if (user != null) {
      grantConditions.push(
        { grant: GRANT_SPECIFIED, grantedUsers: user._id },
        { grant: GRANT_OWNER, grantedUsers: user._id },
      );
    }

    if (showPagesRestrictedByGroup) {
      grantConditions.push(
        { grant: GRANT_USER_GROUP },
      );
    }
    else if (userGroups != null && userGroups.length > 0) {
      grantConditions.push(
        { grant: GRANT_USER_GROUP, grantedGroup: { $in: userGroups } },
      );
    }

    this.query = this.query
      .and({
        $or: grantConditions,
      });

    return this;
  }

  addConditionToPagenate(offset, limit, sortOpt) {
    this.query = this.query
      .sort(sortOpt).skip(offset).limit(limit); // eslint-disable-line newline-per-chained-call

    return this;
  }

  populateDataToList(userPublicFields) {
    this.query = this.query
      .populate({
        path: 'lastUpdateUser',
        select: userPublicFields,
      });
    return this;
  }

  populateDataToShowRevision(userPublicFields) {
    this.query = populateDataToShowRevision(this.query, userPublicFields);
    return this;
  }

}

module.exports = function(crowi) {
  let pageEvent;

  // init event
  if (crowi != null) {
    pageEvent = crowi.event('page');
    pageEvent.on('create', pageEvent.onCreate);
    pageEvent.on('update', pageEvent.onUpdate);
  }

  function validateCrowi() {
    if (crowi == null) {
      throw new Error('"crowi" is null. Init User model with "crowi" argument first.');
    }
  }

  pageSchema.methods.isDeleted = function() {
    return (this.status === STATUS_DELETED) || checkIfTrashed(this.path);
  };

  pageSchema.methods.isPublic = function() {
    if (!this.grant || this.grant === GRANT_PUBLIC) {
      return true;
    }

    return false;
  };

  pageSchema.methods.isTopPage = function() {
    return isTopPage(this.path);
  };

  pageSchema.methods.isTemplate = function() {
    return templateChecker(this.path);
  };

  pageSchema.methods.isLatestRevision = function() {
    // populate されていなくて判断できない
    if (!this.latestRevision || !this.revision) {
      return true;
    }

    // comparing ObjectId with string
    // eslint-disable-next-line eqeqeq
    return (this.latestRevision == this.revision._id.toString());
  };

  pageSchema.methods.findRelatedTagsById = async function() {
    const PageTagRelation = mongoose.model('PageTagRelation');
    const relations = await PageTagRelation.find({ relatedPage: this._id }).populate('relatedTag');
    return relations.map((relation) => { return relation.relatedTag.name });
  };

  pageSchema.methods.isUpdatable = function(previousRevision) {
    const revision = this.latestRevision || this.revision;
    // comparing ObjectId with string
    // eslint-disable-next-line eqeqeq
    if (revision != previousRevision) {
      return false;
    }
    return true;
  };

  pageSchema.methods.isLiked = function(user) {
    if (user == null || user._id == null) {
      return false;
    }

    return this.liker.some((likedUserId) => {
      return likedUserId.toString() === user._id.toString();
    });
  };

  pageSchema.methods.like = function(userData) {
    const self = this;

    return new Promise(((resolve, reject) => {
      const added = self.liker.addToSet(userData._id);
      if (added.length > 0) {
        self.save((err, data) => {
          if (err) {
            return reject(err);
          }
          logger.debug('liker updated!', added);
          return resolve(data);
        });
      }
      else {
        logger.debug('liker not updated');
        return reject(self);
      }
    }));
  };

  pageSchema.methods.unlike = function(userData, callback) {
    const self = this;

    return new Promise(((resolve, reject) => {
      const beforeCount = self.liker.length;
      self.liker.pull(userData._id);
      if (self.liker.length !== beforeCount) {
        self.save((err, data) => {
          if (err) {
            return reject(err);
          }
          return resolve(data);
        });
      }
      else {
        logger.debug('liker not updated');
        return reject(self);
      }
    }));
  };

  pageSchema.methods.isSeenUser = function(userData) {
    return this.seenUsers.includes(userData._id);
  };

  pageSchema.methods.seen = async function(userData) {
    if (this.isSeenUser(userData)) {
      debug('seenUsers not updated');
      return this;
    }

    if (!userData || !userData._id) {
      throw new Error('User data is not valid');
    }

    const added = this.seenUsers.addToSet(userData);
    const saved = await this.save();

    debug('seenUsers updated!', added);

    return saved;
  };

  pageSchema.methods.getSlackChannel = function() {
    const extended = this.get('extended');
    if (!extended) {
      return '';
    }

    return extended.slack || '';
  };

  pageSchema.methods.updateSlackChannel = function(slackChannel) {
    const extended = this.extended;
    extended.slack = slackChannel;

    return this.updateExtended(extended);
  };

  pageSchema.methods.updateExtended = function(extended) {
    const page = this;
    page.extended = extended;
    return new Promise(((resolve, reject) => {
      return page.save((err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    }));
  };

  pageSchema.methods.initLatestRevisionField = async function(revisionId) {
    this.latestRevision = this.revision;
    if (revisionId != null) {
      this.revision = revisionId;
    }
  };

  pageSchema.methods.populateDataToShowRevision = async function() {
    validateCrowi();

    const User = crowi.model('User');
    return populateDataToShowRevision(this, User.USER_PUBLIC_FIELDS)
      .execPopulate();
  };

  pageSchema.methods.populateDataToMakePresentation = async function(revisionId) {
    this.latestRevision = this.revision;
    if (revisionId != null) {
      this.revision = revisionId;
    }
    return this.populate('revision').execPopulate();
  };

  pageSchema.methods.applyScope = function(user, grant, grantUserGroupId) {
    // reset
    this.grantedUsers = [];
    this.grantedGroup = null;

    this.grant = grant || GRANT_PUBLIC;

    if (grant !== GRANT_PUBLIC && grant !== GRANT_USER_GROUP) {
      this.grantedUsers.push(user._id);
    }

    if (grant === GRANT_USER_GROUP) {
      this.grantedGroup = grantUserGroupId;
    }
  };

  pageSchema.methods.getContentAge = function() {
    return differenceInYears(new Date(), this.updatedAt);
  };


  pageSchema.statics.updateCommentCount = function(pageId) {
    validateCrowi();

    const self = this;
    const Comment = crowi.model('Comment');
    return Comment.countCommentByPageId(pageId)
      .then((count) => {
        self.update({ _id: pageId }, { commentCount: count }, {}, (err, data) => {
          if (err) {
            debug('Update commentCount Error', err);
            throw err;
          }

          return data;
        });
      });
  };

  pageSchema.statics.getGrantLabels = function() {
    const grantLabels = {};
    grantLabels[GRANT_PUBLIC] = 'Public'; // 公開
    grantLabels[GRANT_RESTRICTED] = 'Anyone with the link'; // リンクを知っている人のみ
    // grantLabels[GRANT_SPECIFIED]  = 'Specified users only'; // 特定ユーザーのみ
    grantLabels[GRANT_USER_GROUP] = 'Only inside the group'; // 特定グループのみ
    grantLabels[GRANT_OWNER] = 'Only me'; // 自分のみ

    return grantLabels;
  };

  pageSchema.statics.getUserPagePath = function(user) {
    return `/user/${user.username}`;
  };

  pageSchema.statics.getDeletedPageName = function(path) {
    if (path.match('/')) {
      // eslint-disable-next-line no-param-reassign
      path = path.substr(1);
    }
    return `/trash/${path}`;
  };

  pageSchema.statics.getRevertDeletedPageName = function(path) {
    return path.replace('/trash', '');
  };

  pageSchema.statics.isDeletableName = function(path) {
    const notDeletable = [
      /^\/user\/[^/]+$/, // user page
    ];

    for (let i = 0; i < notDeletable.length; i++) {
      const pattern = notDeletable[i];
      if (path.match(pattern)) {
        return false;
      }
    }

    return true;
  };

  pageSchema.statics.isCreatableName = function(name) {
    const forbiddenPages = [
      /\^|\$|\*|\+|#|%/,
      /^\/-\/.*/,
      /^\/_r\/.*/,
      /^\/_apix?(\/.*)?/,
      /^\/?https?:\/\/.+$/, // avoid miss in renaming
      /\/{2,}/, // avoid miss in renaming
      /\s+\/\s+/, // avoid miss in renaming
      /.+\/edit$/,
      /.+\.md$/,
      /^\/(installer|register|login|logout|admin|me|files|trash|paste|comments|tags)(\/.*|$)/,
    ];

    let isCreatable = true;
    forbiddenPages.forEach((page) => {
      const pageNameReg = new RegExp(page);
      if (name.match(pageNameReg)) {
        isCreatable = false;
      }
    });

    return isCreatable;
  };

  pageSchema.statics.fixToCreatableName = function(path) {
    return path
      .replace(/\/\//g, '/');
  };

  pageSchema.statics.updateRevision = function(pageId, revisionId, cb) {
    this.update({ _id: pageId }, { revision: revisionId }, {}, (err, data) => {
      cb(err, data);
    });
  };

  /**
   * return whether the user is accessible to the page
   * @param {string} id ObjectId
   * @param {User} user
   */
  pageSchema.statics.isAccessiblePageByViewer = async function(id, user) {
    const baseQuery = this.count({ _id: id });

    let userGroups = [];
    if (user != null) {
      validateCrowi();
      const UserGroupRelation = crowi.model('UserGroupRelation');
      userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, userGroups, true);

    const count = await queryBuilder.query.exec();
    return count > 0;
  };

  /**
   * @param {string} id ObjectId
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  pageSchema.statics.findByIdAndViewer = async function(id, user, userGroups) {
    const baseQuery = this.findOne({ _id: id });

    let relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      validateCrowi();
      const UserGroupRelation = crowi.model('UserGroupRelation');
      relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups, true);

    return await queryBuilder.query.exec();
  };

  // find page by path
  pageSchema.statics.findByPath = function(path) {
    if (path == null) {
      return null;
    }
    return this.findOne({ path });
  };

  /**
   * @param {string} path Page path
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  pageSchema.statics.findByPathAndViewer = async function(path, user, userGroups) {
    if (path == null) {
      throw new Error('path is required.');
    }

    const baseQuery = this.findOne({ path });

    let relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      validateCrowi();
      const UserGroupRelation = crowi.model('UserGroupRelation');
      relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups, true);

    return await queryBuilder.query.exec();
  };

  /**
   * @param {string} path Page path
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  pageSchema.statics.findAncestorByPathAndViewer = async function(path, user, userGroups) {
    if (path == null) {
      throw new Error('path is required.');
    }

    if (path === '/') {
      return null;
    }

    const ancestorsPaths = extractToAncestorsPaths(path);

    // pick the longest one
    const baseQuery = this.findOne({ path: { $in: ancestorsPaths } }).sort({ path: -1 });

    let relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      validateCrowi();
      const UserGroupRelation = crowi.model('UserGroupRelation');
      relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups);

    return await queryBuilder.query.exec();
  };

  pageSchema.statics.findByRedirectTo = function(path) {
    return this.findOne({ redirectTo: path });
  };

  /**
   * find pages that is match with `path` and its descendants
   */
  pageSchema.statics.findListWithDescendants = async function(path, user, option) {
    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListWithDescendants(path, option);

    return await findListFromBuilderAndViewer(builder, user, false, option);
  };

  /**
   * find pages that start with `path`
   */
  pageSchema.statics.findListByStartWith = async function(path, user, option) {
    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListByStartWith(path, option);

    return await findListFromBuilderAndViewer(builder, user, false, option);
  };

  /**
   * find pages that is created by targetUser
   *
   * @param {User} targetUser
   * @param {User} currentUser
   * @param {any} option
   */
  pageSchema.statics.findListByCreator = async function(targetUser, currentUser, option) {
    const opt = Object.assign({ sort: 'createdAt', desc: -1 }, option);
    const builder = new PageQueryBuilder(this.find({ creator: targetUser._id }));

    let showAnyoneKnowsLink = null;
    if (targetUser != null && currentUser != null) {
      showAnyoneKnowsLink = targetUser._id.equals(currentUser._id);
    }

    return await findListFromBuilderAndViewer(builder, currentUser, showAnyoneKnowsLink, opt);
  };

  pageSchema.statics.findListByPageIds = async function(ids, option) {
    const User = crowi.model('User');

    const opt = Object.assign({}, option);
    const builder = new PageQueryBuilder(this.find({ _id: { $in: ids } }));

    builder.addConditionToExcludeRedirect();
    builder.addConditionToPagenate(opt.offset, opt.limit);

    // count
    const totalCount = await builder.query.exec('count');

    // find
    builder.populateDataToList(User.USER_PUBLIC_FIELDS);
    const pages = await builder.query.exec('find');

    const result = {
      pages, totalCount, offset: opt.offset, limit: opt.limit,
    };
    return result;
  };


  /**
   * find pages by PageQueryBuilder
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   * @param {any} option
   */
  async function findListFromBuilderAndViewer(builder, user, showAnyoneKnowsLink, option) {
    validateCrowi();

    const User = crowi.model('User');

    const opt = Object.assign({ sort: 'updatedAt', desc: -1 }, option);
    const sortOpt = {};
    sortOpt[opt.sort] = opt.desc;

    // exclude trashed pages
    if (!opt.includeTrashed) {
      builder.addConditionToExcludeTrashed();
    }
    // exclude redirect pages
    if (!opt.includeRedirect) {
      builder.addConditionToExcludeRedirect();
    }

    // add grant conditions
    await addConditionToFilteringByViewerForList(builder, user, showAnyoneKnowsLink);

    // count
    const totalCount = await builder.query.exec('count');

    // find
    builder.addConditionToPagenate(opt.offset, opt.limit, sortOpt);
    builder.populateDataToList(User.USER_PUBLIC_FIELDS);
    const pages = await builder.query.exec('find');

    const result = {
      pages, totalCount, offset: opt.offset, limit: opt.limit,
    };
    return result;
  }

  /**
   * Add condition that filter pages by viewer
   *  by considering Config
   *
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   */
  async function addConditionToFilteringByViewerForList(builder, user, showAnyoneKnowsLink) {
    validateCrowi();

    // determine User condition
    const hidePagesRestrictedByOwner = crowi.configManager.getConfig('crowi', 'security:list-policy:hideRestrictedByOwner');
    const hidePagesRestrictedByGroup = crowi.configManager.getConfig('crowi', 'security:list-policy:hideRestrictedByGroup');

    // determine UserGroup condition
    let userGroups = null;
    if (user != null) {
      const UserGroupRelation = crowi.model('UserGroupRelation');
      userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    return builder.addConditionToFilteringByViewer(user, userGroups, showAnyoneKnowsLink, !hidePagesRestrictedByOwner, !hidePagesRestrictedByGroup);
  }

  /**
   * Add condition that filter pages by viewer
   *  by considering Config
   *
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   */
  async function addConditionToFilteringByViewerToEdit(builder, user) {
    validateCrowi();

    // determine UserGroup condition
    let userGroups = null;
    if (user != null) {
      const UserGroupRelation = crowi.model('UserGroupRelation');
      userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    return builder.addConditionToFilteringByViewer(user, userGroups, false, false, false);
  }

  /**
   * export addConditionToFilteringByViewerForList as static method
   */
  pageSchema.statics.addConditionToFilteringByViewerForList = addConditionToFilteringByViewerForList;

  /**
   * Throw error for growi-lsx-plugin (v1.x)
   */
  pageSchema.statics.generateQueryToListByStartWith = function(path, user, option) {
    const dummyQuery = this.find();
    dummyQuery.exec = async() => {
      throw new Error('Plugin version mismatch. Upgrade growi-lsx-plugin to v2.0.0 or above.');
    };
    return dummyQuery;
  };
  pageSchema.statics.generateQueryToListWithDescendants = pageSchema.statics.generateQueryToListByStartWith;


  /**
   * find all templates applicable to the new page
   */
  pageSchema.statics.findTemplate = async function(path) {
    const templatePath = nodePath.posix.dirname(path);
    const pathList = generatePathsOnTree(path, []);
    const regexpList = pathList.map((path) => {
      const pathWithTrailingSlash = pathUtils.addTrailingSlash(path);
      return new RegExp(`^${escapeStringRegexp(pathWithTrailingSlash)}_{1,2}template$`);
    });

    const templatePages = await this.find({ path: { $in: regexpList } })
      .populate({ path: 'revision', model: 'Revision' })
      .exec();

    return fetchTemplate(templatePages, templatePath);
  };

  const generatePathsOnTree = (path, pathList) => {
    pathList.push(path);

    if (path === '/') {
      return pathList;
    }

    const newPath = nodePath.posix.dirname(path);

    return generatePathsOnTree(newPath, pathList);
  };

  const assignTemplateByType = (templates, path, type) => {
    const targetTemplatePath = urljoin(path, `${type}template`);

    return templates.find((template) => {
      return (template.path === targetTemplatePath);
    });
  };

  const assignDecendantsTemplate = (decendantsTemplates, path) => {
    const decendantsTemplate = assignTemplateByType(decendantsTemplates, path, '__');
    if (decendantsTemplate) {
      return decendantsTemplate;
    }

    if (path === '/') {
      return;
    }

    const newPath = nodePath.posix.dirname(path);
    return assignDecendantsTemplate(decendantsTemplates, newPath);
  };

  const fetchTemplate = async(templates, templatePath) => {
    let templateBody;
    let templateTags;
    /**
     * get children template
     * __tempate: applicable only to immediate decendants
     */
    const childrenTemplate = assignTemplateByType(templates, templatePath, '_');

    /**
     * get decendants templates
     * _tempate: applicable to all pages under
     */
    const decendantsTemplate = assignDecendantsTemplate(templates, templatePath);

    if (childrenTemplate) {
      templateBody = childrenTemplate.revision.body;
      templateTags = await childrenTemplate.findRelatedTagsById();
    }
    else if (decendantsTemplate) {
      templateBody = decendantsTemplate.revision.body;
      templateTags = await decendantsTemplate.findRelatedTagsById();
    }

    return { templateBody, templateTags };
  };

  async function pushRevision(pageData, newRevision, user) {
    await newRevision.save();
    debug('Successfully saved new revision', newRevision);

    pageData.revision = newRevision;
    pageData.lastUpdateUser = user;
    pageData.updatedAt = Date.now();

    return pageData.save();
  }

  async function validateAppliedScope(user, grant, grantUserGroupId) {
    if (grant === GRANT_USER_GROUP && grantUserGroupId == null) {
      throw new Error('grant userGroupId is not specified');
    }

    if (grant === GRANT_USER_GROUP) {
      const UserGroupRelation = crowi.model('UserGroupRelation');
      const count = await UserGroupRelation.countByGroupIdAndUser(grantUserGroupId, user);

      if (count === 0) {
        throw new Error('no relations were exist for group and user.');
      }
    }
  }

  pageSchema.statics.create = async function(path, body, user, options = {}) {
    validateCrowi();

    const Page = this;
    const Revision = crowi.model('Revision');
    const format = options.format || 'markdown';
    const redirectTo = options.redirectTo || null;
    const grantUserGroupId = options.grantUserGroupId || null;
    const socketClientId = options.socketClientId || null;

    // sanitize path
    path = crowi.xss.process(path); // eslint-disable-line no-param-reassign

    let grant = options.grant;
    // force public
    if (isTopPage(path)) {
      grant = GRANT_PUBLIC;
    }

    const isExist = await this.count({ path });

    if (isExist) {
      throw new Error('Cannot create new page to existed path');
    }

    const page = new Page();
    page.path = path;
    page.creator = user;
    page.lastUpdateUser = user;
    page.redirectTo = redirectTo;
    page.status = STATUS_PUBLISHED;

    await validateAppliedScope(user, grant, grantUserGroupId);
    page.applyScope(user, grant, grantUserGroupId);

    let savedPage = await page.save();
    const newRevision = Revision.prepareRevision(savedPage, body, null, user, { format });
    const revision = await pushRevision(savedPage, newRevision, user);
    savedPage = await this.findByPath(revision.path);
    await savedPage.populateDataToShowRevision();

    if (socketClientId != null) {
      pageEvent.emit('create', savedPage, user, socketClientId);
    }
    return savedPage;
  };

  pageSchema.statics.updatePage = async function(pageData, body, previousBody, user, options = {}) {
    validateCrowi();

    const Revision = crowi.model('Revision');
    const grant = options.grant || pageData.grant; //                                  use the previous data if absence
    const grantUserGroupId = options.grantUserGroupId || pageData.grantUserGroupId; // use the previous data if absence
    const isSyncRevisionToHackmd = options.isSyncRevisionToHackmd;
    const socketClientId = options.socketClientId || null;

    await validateAppliedScope(user, grant, grantUserGroupId);
    pageData.applyScope(user, grant, grantUserGroupId);

    // update existing page
    let savedPage = await pageData.save();
    const newRevision = await Revision.prepareRevision(pageData, body, previousBody, user);
    const revision = await pushRevision(savedPage, newRevision, user);
    savedPage = await this.findByPath(revision.path);
    await savedPage.populateDataToShowRevision();

    if (isSyncRevisionToHackmd) {
      savedPage = await this.syncRevisionToHackmd(savedPage);
    }

    if (socketClientId != null) {
      pageEvent.emit('update', savedPage, user, socketClientId);
    }

    return savedPage;
  };

  pageSchema.statics.applyScopesToDescendantsAsyncronously = async function(parentPage, user) {
    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListWithDescendants(parentPage.path);

    builder.addConditionToExcludeRedirect();

    // add grant conditions
    await addConditionToFilteringByViewerToEdit(builder, user);

    // get all pages that the specified user can update
    const pages = await builder.query.exec();

    for (const page of pages) {
      // skip parentPage
      if (page.id === parentPage.id) {
        continue;
      }

      page.applyScope(user, parentPage.grant, parentPage.grantedGroup);
      page.save();
    }
  };

  pageSchema.statics.deletePage = async function(pageData, user, options = {}) {
    const newPath = this.getDeletedPageName(pageData.path);
    const isTrashed = checkIfTrashed(pageData.path);

    if (isTrashed) {
      throw new Error('This method does NOT support deleting trashed pages.');
    }

    const socketClientId = options.socketClientId || null;
    if (this.isDeletableName(pageData.path)) {

      pageData.status = STATUS_DELETED;
      const updatedPageData = await this.rename(pageData, newPath, user, { socketClientId, createRedirectPage: true });

      return updatedPageData;
    }

    return Promise.reject(new Error('Page is not deletable.'));
  };

  const checkIfTrashed = (path) => {
    return (path.search(/^\/trash/) !== -1);
  };

  pageSchema.statics.deletePageRecursively = async function(targetPage, user, options = {}) {
    const isTrashed = checkIfTrashed(targetPage.path);

    if (isTrashed) {
      throw new Error('This method does NOT supports deleting trashed pages.');
    }

    const findOpts = { includeRedirect: true };
    const result = await this.findListWithDescendants(targetPage.path, user, findOpts);
    const pages = result.pages;

    let updatedPage = null;
    await Promise.all(pages.map((page) => {
      const isParent = (page.path === targetPage.path);
      const p = this.deletePage(page, user, options);
      if (isParent) {
        updatedPage = p;
      }
      return p;
    }));

    return updatedPage;
  };

  pageSchema.statics.revertDeletedPage = async function(page, user, options = {}) {
    const newPath = this.getRevertDeletedPageName(page.path);

    const originPage = await this.findByPath(newPath);
    if (originPage != null) {
      // 削除時、元ページの path には必ず redirectTo 付きで、ページが作成される。
      // そのため、そいつは削除してOK
      // が、redirectTo ではないページが存在している場合それは何かがおかしい。(データ補正が必要)
      if (originPage.redirectTo !== page.path) {
        throw new Error('The new page of to revert is exists and the redirect path of the page is not the deleted page.');
      }

      await this.completelyDeletePage(originPage, options);
    }

    page.status = STATUS_PUBLISHED;
    page.lastUpdateUser = user;
    debug('Revert deleted the page', page, newPath);
    const updatedPage = await this.rename(page, newPath, user, {});

    return updatedPage;
  };

  pageSchema.statics.revertDeletedPageRecursively = async function(targetPage, user, options = {}) {
    const findOpts = { includeRedirect: true, includeTrashed: true };
    const result = await this.findListWithDescendants(targetPage.path, user, findOpts);
    const pages = result.pages;

    let updatedPage = null;
    await Promise.all(pages.map((page) => {
      const isParent = (page.path === targetPage.path);
      const p = this.revertDeletedPage(page, user, options);
      if (isParent) {
        updatedPage = p;
      }
      return p;
    }));

    return updatedPage;
  };

  /**
   * This is danger.
   */
  pageSchema.statics.completelyDeletePage = async function(pageData, user, options = {}) {
    validateCrowi();

    // Delete Bookmarks, Attachments, Revisions, Pages and emit delete
    const Bookmark = crowi.model('Bookmark');
    const Attachment = crowi.model('Attachment');
    const Comment = crowi.model('Comment');
    const PageTagRelation = crowi.model('PageTagRelation');
    const Revision = crowi.model('Revision');
    const pageId = pageData._id;
    const socketClientId = options.socketClientId || null;

    debug('Completely delete', pageData.path);

    await Bookmark.removeBookmarksByPageId(pageId);
    await Attachment.removeAttachmentsByPageId(pageId);
    await Comment.removeCommentsByPageId(pageId);
    await PageTagRelation.remove({ relatedPage: pageId });
    await Revision.removeRevisionsByPath(pageData.path);
    await this.findByIdAndRemove(pageId);
    await this.removeRedirectOriginPageByPath(pageData.path);
    if (socketClientId != null) {
      pageEvent.emit('delete', pageData, user, socketClientId); // update as renamed page
    }
    return pageData;
  };

  /**
   * Delete Bookmarks, Attachments, Revisions, Pages and emit delete
   */
  pageSchema.statics.completelyDeletePageRecursively = async function(pagePath, user, options = {}) {

    const findOpts = { includeRedirect: true, includeTrashed: true };
    const result = await this.findListWithDescendants(pagePath, user, findOpts);
    const pages = result.pages;

    await Promise.all(pages.map((page) => {
      return this.completelyDeletePage(page, user, options);
    }));

    return pagePath;
  };

  pageSchema.statics.removeByPath = function(path) {
    if (path == null) {
      throw new Error('path is required');
    }
    return this.findOneAndRemove({ path }).exec();
  };

  /**
   * remove the page that is redirecting to specified `pagePath` recursively
   *  ex: when
   *    '/page1' redirects to '/page2' and
   *    '/page2' redirects to '/page3'
   *    and given '/page3',
   *    '/page1' and '/page2' will be removed
   *
   * @param {string} pagePath
   */
  pageSchema.statics.removeRedirectOriginPageByPath = async function(pagePath) {
    const redirectPage = await this.findByRedirectTo(pagePath);

    if (redirectPage == null) {
      return;
    }

    // remove
    await this.findByIdAndRemove(redirectPage.id);
    // remove recursive
    await this.removeRedirectOriginPageByPath(redirectPage.path);
  };

  pageSchema.statics.rename = async function(pageData, newPagePath, user, options) {
    validateCrowi();

    const Page = this;
    const Revision = crowi.model('Revision');
    const path = pageData.path;
    const createRedirectPage = options.createRedirectPage || false;
    const updateMetadata = options.updateMetadata || false;
    const socketClientId = options.socketClientId || null;

    // sanitize path
    newPagePath = crowi.xss.process(newPagePath); // eslint-disable-line no-param-reassign

    // update Page
    pageData.path = newPagePath;
    if (updateMetadata) {
      pageData.lastUpdateUser = user;
      pageData.updatedAt = Date.now();
    }
    const updatedPageData = await pageData.save();

    // update Rivisions
    await Revision.updateRevisionListByPath(path, { path: newPagePath }, {});

    if (createRedirectPage) {
      const body = `redirect ${newPagePath}`;
      await Page.create(path, body, user, { redirectTo: newPagePath });
    }

    pageEvent.emit('delete', pageData, user, socketClientId);
    pageEvent.emit('create', updatedPageData, user, socketClientId);

    return updatedPageData;
  };

  pageSchema.statics.renameRecursively = async function(pageData, newPagePathPrefix, user, options) {
    validateCrowi();

    const path = pageData.path;
    const pathRegExp = new RegExp(`^${escapeStringRegexp(path)}`, 'i');

    // sanitize path
    newPagePathPrefix = crowi.xss.process(newPagePathPrefix); // eslint-disable-line no-param-reassign

    const result = await this.findListWithDescendants(path, user, options);
    await Promise.all(result.pages.map((page) => {
      const newPagePath = page.path.replace(pathRegExp, newPagePathPrefix);
      return this.rename(page, newPagePath, user, options);
    }));
    pageData.path = newPagePathPrefix;
    return pageData;
  };

  pageSchema.statics.handlePrivatePagesForDeletedGroup = async function(deletedGroup, action, transferToUserGroupId) {
    const Page = mongoose.model('Page');

    const pages = await this.find({ grantedGroup: deletedGroup });

    switch (action) {
      case 'public':
        await Promise.all(pages.map((page) => {
          return Page.publicizePage(page);
        }));
        break;
      case 'delete':
        await Promise.all(pages.map((page) => {
          return Page.completelyDeletePage(page);
        }));
        break;
      case 'transfer':
        await Promise.all(pages.map((page) => {
          return Page.transferPageToGroup(page, transferToUserGroupId);
        }));
        break;
      default:
        throw new Error('Unknown action for private pages');
    }
  };

  pageSchema.statics.publicizePage = async function(page) {
    page.grantedGroup = null;
    page.grant = GRANT_PUBLIC;
    await page.save();
  };

  pageSchema.statics.transferPageToGroup = async function(page, transferToUserGroupId) {
    const UserGroup = mongoose.model('UserGroup');

    // check page existence
    const isExist = await UserGroup.count({ _id: transferToUserGroupId }) > 0;
    if (isExist) {
      page.grantedGroup = transferToUserGroupId;
      await page.save();
    }
    else {
      throw new Error('Cannot find the group to which private pages belong to. _id: ', transferToUserGroupId);
    }
  };

  /**
   * associate GROWI page and HackMD page
   * @param {Page} pageData
   * @param {string} pageIdOnHackmd
   */
  pageSchema.statics.registerHackmdPage = function(pageData, pageIdOnHackmd) {
    pageData.pageIdOnHackmd = pageIdOnHackmd;
    return this.syncRevisionToHackmd(pageData);
  };

  /**
   * update revisionHackmdSynced
   * @param {Page} pageData
   * @param {bool} isSave whether save or not
   */
  pageSchema.statics.syncRevisionToHackmd = function(pageData, isSave = true) {
    pageData.revisionHackmdSynced = pageData.revision;
    pageData.hasDraftOnHackmd = false;

    let returnData = pageData;
    if (isSave) {
      returnData = pageData.save();
    }
    return returnData;
  };

  /**
   * update hasDraftOnHackmd
   * !! This will be invoked many time from many people !!
   *
   * @param {Page} pageData
   * @param {Boolean} newValue
   */
  pageSchema.statics.updateHasDraftOnHackmd = async function(pageData, newValue) {
    if (pageData.hasDraftOnHackmd === newValue) {
      // do nothing when hasDraftOnHackmd equals to newValue
      return;
    }

    pageData.hasDraftOnHackmd = newValue;
    return pageData.save();
  };

  pageSchema.statics.getHistories = function() {
    // TODO

  };

  /**
   * return path that added slash to the end for specified path
   */
  pageSchema.statics.addSlashOfEnd = function(path) {
    return addSlashOfEnd(path);
  };

  pageSchema.statics.GRANT_PUBLIC = GRANT_PUBLIC;
  pageSchema.statics.GRANT_RESTRICTED = GRANT_RESTRICTED;
  pageSchema.statics.GRANT_SPECIFIED = GRANT_SPECIFIED;
  pageSchema.statics.GRANT_OWNER = GRANT_OWNER;
  pageSchema.statics.GRANT_USER_GROUP = GRANT_USER_GROUP;
  pageSchema.statics.PAGE_GRANT_ERROR = PAGE_GRANT_ERROR;

  pageSchema.statics.PageQueryBuilder = PageQueryBuilder;

  return mongoose.model('Page', pageSchema);
};
