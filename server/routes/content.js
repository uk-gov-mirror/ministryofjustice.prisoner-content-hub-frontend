const { prop, path, propOr } = require('ramda');
const express = require('express');
const { relativeUrlFrom } = require('../utils');

const createContentRouter = ({
  hubContentService,
  analyticsService,
  logger,
}) => {
  const router = express.Router();

  router.get('/:id', async (req, res, next) => {
    const { id } = req.params;

    logger.info(`GET /${id}`);

    if (!id) {
      return next();
    }

    const userName = path(['session', 'user', 'name'], req);

    const config = {
      content: true,
      header: false,
      postscript: false,
      userName,
      returnUrl: req.originalUrl,
    };

    const establishmentId = path(['locals', 'establishmentId'], res);
    const backendUrl = path(['app', 'locals', 'config', 'backendUrl'], req);
    const userAgent = path(['headers', 'user-agent'], req);

    try {
      const data = await hubContentService.contentFor(id, establishmentId);
      const contentType = prop('contentType', data);
      const sessionId = path(['session', 'id'], req);
      const getCategoriesFrom = propOr([], 'categories');
      const getSecondaryTagsFrom = propOr([], 'secondaryTags');

      switch (contentType) {
        case 'radio':
          return res.render('pages/audio', {
            title: data.title,
            config,
            data: {
              ...data,
              categories: getCategoriesFrom(data).join(','),
              secondaryTags: getSecondaryTagsFrom(data).join(','),
            },
          });
        case 'video':
          return res.render('pages/video', {
            title: data.title,
            config,
            data: {
              ...data,
              categories: getCategoriesFrom(data).join(','),
              secondaryTags: getSecondaryTagsFrom(data).join(','),
            },
          });
        case 'page':
          config.content = false;

          return res.render('pages/flat-content', {
            title: data.title,
            config,
            data: {
              ...data,
              categories: getCategoriesFrom(data).join(','),
              secondaryTags: getSecondaryTagsFrom(data).join(','),
            },
          });
        case 'landing-page':
          config.postscript = true;

          return res.render('pages/category', {
            title: data.title,
            config,
            data: {
              ...data,
              categories: propOr('', 'categoryId', data),
            },
          });
        case 'pdf': {
          const url = relativeUrlFrom(data.url, backendUrl);
          logger.info('PROD - Sending PDF to client from:', url);

          analyticsService.sendEvent({
            category: 'PDFs',
            action: `${data.title}`,
            label: 'Downloads',
            sessionId,
            value: 1,
            userAgent,
          });

          const stream = await hubContentService.streamFor(url);

          // X-Download-Options prevents Internet Explorer from executing downloads
          // in your site’s context. We don't want that
          res.removeHeader('X-Download-Options');
          res.type('application/pdf');

          stream.on('error', next);

          return stream.pipe(res);
        }
        default:
          // send to the 404 page
          return next();
      }
    } catch (exp) {
      return next(exp);
    }
  });

  return router;
};

module.exports = {
  createContentRouter,
};
