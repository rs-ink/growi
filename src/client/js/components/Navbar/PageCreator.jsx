import React from 'react';
import PropTypes from 'prop-types';

import { userPageRoot } from '@commons/util/path-utils';

import UserPicture from '../User/UserPicture';
import { withTranslation } from 'react-i18next';

const PageCreator = (props) => {
  const { creator, createdAt, isCompactMode,t } = props;
  const creatInfo = isCompactMode
    ? (<div>{t("Created at")} <span className="text-muted">{createdAt}</span></div>)
    : (<div><div>{t("Created by")} <a href={userPageRoot(creator)}>{creator.name}</a></div><div className="text-muted">{createdAt}</div></div>);
  const pictureSize = isCompactMode ? 'xs' : 'sm';

  return (
    <div className="d-flex align-items-center">
      <div className="mr-2">
        <UserPicture user={creator} size={pictureSize} />
      </div>
      {creatInfo}
    </div>
  );
};

PageCreator.propTypes = {

  creator: PropTypes.object.isRequired,
  createdAt: PropTypes.string.isRequired,
  isCompactMode: PropTypes.bool,
};

PageCreator.defaultProps = {
  isCompactMode: false,
};


export default withTranslation()(PageCreator);
