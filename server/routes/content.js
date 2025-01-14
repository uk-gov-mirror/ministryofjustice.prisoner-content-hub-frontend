const { prop, path, propOr } = require('ramda');
const express = require('express');
const Sentry = require('@sentry/node');

const createContentRouter = ({ hubContentService, analyticsService }) => {
  const router = express.Router();

  router.get('/:id', async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next();
    }

    const userName = req.user && req.user.getFullName();

    const config = {
      content: true,
      header: false,
      postscript: false,
      userName,
      returnUrl: req.originalUrl,
    };

    const establishmentId = path(['session', 'establishmentId'], req);
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
          const { url } = data;

          analyticsService.sendEvent({
            category: 'PDFs',
            action: `${data.title}`,
            label: 'Downloads',
            sessionId,
            value: 1,
            userAgent,
          });

          return res.redirect(303, url);
        }
        default:
          // send to the 404 page
          return next();
      }
    } catch (exp) {
      Sentry.captureException(exp);
      return next(exp);
    }
  });

  return router;
};

module.exports = {
  createContentRouter,
};
