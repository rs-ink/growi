import React, { Suspense, useState } from 'react';
import PropTypes from 'prop-types';
import loggerFactory from '@alias/logger';

import { withUnstatedContainers } from './UnstatedUtils';
import { toastError } from '../util/apiNotification';

import PageRevisionList from './PageHistory/PageRevisionList';
import AppContainer from '../services/AppContainer';
import PageContainer from '../services/PageContainer';

const logger = loggerFactory('growi:PageHistory');

// set dummy value tile for using suspense
let isLoaded = false;

function AppSettingsPage(props) {
  return (
    <Suspense
      fallback={(
        <div className="my-5 text-center">
          <i className="fa fa-lg fa-spinner fa-pulse mx-auto text-muted"></i>
        </div>
      )}
    >
      <PageHistoryWrapper2 props={props} />
    </Suspense>
  );
}
function PageHistory(props) {

  const [errorMessage, setErrorMessage] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [diffOpened, setDiffOpened] = useState(null);

  function fetchPageRevisionBody(revision) {
    const { appContainer, pageContainer } = props;
    const { pageId, shareLinkId } = pageContainer.state;

    if (revision.body) {
      return;
    }

    appContainer.apiGet('/revisions.get', { page_id: pageId, revision_id: revision._id, share_link_id: shareLinkId })
      .then((res) => {
        if (res.ok) {
          this.setState({
            revisions: this.state.revisions.map((rev) => {
              // comparing ObjectId
              // eslint-disable-next-line eqeqeq
              if (rev._id == res.revision._id) {
                return res.revision;
              }

              return rev;
            }),
          });
        }
      })
      .catch((err) => {

      });
  }

  async function retrieveRevisions() {
    const { appContainer, pageContainer } = props;
    const { shareLinkId, pageId } = pageContainer.state;

    if (!pageId) {
      return;
    }

    const res = await appContainer.apiv3Get('/revisions/list', { pageId, share_link_id: shareLinkId });
    const rev = res.data.revisions;
    console.log(rev);
    const diffOpened = {};
    const lastId = rev.length - 1;

    res.data.revisions.forEach((revision, i) => {
      const user = revision.author;
      if (user) {
        rev[i].author = user;
      }

      if (i === 0 || i === lastId) {
        diffOpened[revision._id] = true;
      }
      else {
        diffOpened[revision._id] = false;
      }
    });

    setRevisions(rev);
    setDiffOpened(diffOpened);

    // load 0, and last default
    if (rev[0]) {
      fetchPageRevisionBody(rev[0]);
    }
    if (rev[1]) {
      fetchPageRevisionBody(rev[1]);
    }
    if (lastId !== 0 && lastId !== 1 && rev[lastId]) {
      fetchPageRevisionBody(rev[lastId]);
    }

    return;
  }

  function getPreviousRevision(currentRevision) {
    let cursor = null;
    for (const revision of revisions) {
      // comparing ObjectId
      // eslint-disable-next-line eqeqeq
      if (cursor && cursor._id == currentRevision._id) {
        cursor = revision;
        break;
      }

      cursor = revision;
    }

    return cursor;
  }

  function onDiffOpenClicked(revision) {
    const revisionId = revision._id;

    diffOpened[revisionId] = !(diffOpened[revisionId]);
    setDiffOpened(diffOpened);

    fetchPageRevisionBody(revision);
    fetchPageRevisionBody(getPreviousRevision(revision));
  }

  if (!isLoaded) {
    throw new Promise(async() => {
      try {
        await retrieveRevisions();
        isLoaded = true;
        return;
      }
      catch (err) {
        toastError(err);
        logger.error(err);
        setErrorMessage(err);
      }
    });
  }

  return (
    <div className="mt-4">
      {errorMessage && (
      <div className="my-5">
        <div className="text-danger">{errorMessage}</div>
      </div>
        ) }
      <PageRevisionList
        revisions={revisions}
        diffOpened={diffOpened}
        getPreviousRevision={getPreviousRevision}
        onDiffOpenClicked={onDiffOpenClicked}
      />
    </div>
  );

}

const PageHistoryWrapper2 = withUnstatedContainers(PageHistory, [AppContainer, PageContainer]);


PageHistory.propTypes = {
  appContainer: PropTypes.instanceOf(AppContainer).isRequired,
  pageContainer: PropTypes.instanceOf(PageContainer).isRequired,

};


export default AppSettingsPage;
