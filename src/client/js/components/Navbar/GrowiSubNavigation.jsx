import React from 'react';
import PropTypes from 'prop-types';

import { withTranslation } from 'react-i18next';

import { isTrashPage } from '../../../../lib/util/path-utils';
import { createSubscribedElement } from '../UnstatedUtils';
import AppContainer from '../../services/AppContainer';
import RevisionPath from '../Page/RevisionPath';
import PageContainer from '../../services/PageContainer';
import TagLabels from '../Page/TagLabels';
import LikeButton from '../LikeButton';
import BookmarkButton from '../BookmarkButton';
import PageCreator from './PageCreator';
import RevisionAuthor from './RevisionAuthor';

const GrowiSubNavigation = (props) => {
  const isPageForbidden = document.querySelector('#grw-subnav').getAttribute('data-is-forbidden-page');
  const { appContainer, pageContainer } = props;
  const {
    path, createdAt, creator, updatedAt, revisionAuthor,
  } = pageContainer.state;

  // Display only the RevisionPath if the page is trash or forbidden
  if (isTrashPage(path) || isPageForbidden) {
    return (
      <div className="d-flex align-items-center">
        <div className="title-container mr-auto">
          <h1>
            <RevisionPath behaviorType={appContainer.config.behaviorType} pageId={pageContainer.state.pageId} pagePath={pageContainer.state.path} />
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center">

      {/* Page Path */}
      <div className="title-container mr-auto">
        <h1>
          <RevisionPath behaviorType={appContainer.config.behaviorType} pageId={pageContainer.state.pageId} pagePath={pageContainer.state.path} />
        </h1>
        <TagLabels />
      </div>

      {/* Header Button */}
      <div className="mr-2">
        <LikeButton pageId={pageContainer.state.pageId} isLiked={pageContainer.state.isLiked} />
      </div>
      <div>
        <BookmarkButton pageId={pageContainer.state.pageId} crowi={appContainer} />
      </div>

      {/* Page Authors */}
      <ul className="authors hidden-sm hidden-xs text-nowrap">
        {creator != null && <li><PageCreator creator={creator} createdAt={createdAt} /></li>}
        {revisionAuthor != null && <li className="mt-1"><RevisionAuthor revisionAuthor={revisionAuthor} updatedAt={updatedAt} /></li>}
      </ul>

    </div>
  );

};

/**
 * Wrapper component for using unstated
 */
const GrowiSubNavigationWrapper = (props) => {
  return createSubscribedElement(GrowiSubNavigation, props, [AppContainer, PageContainer]);
};


GrowiSubNavigation.propTypes = {
  t: PropTypes.func.isRequired, //  i18next
  appContainer: PropTypes.instanceOf(AppContainer).isRequired,
  pageContainer: PropTypes.instanceOf(PageContainer).isRequired,
};

export default withTranslation()(GrowiSubNavigationWrapper);